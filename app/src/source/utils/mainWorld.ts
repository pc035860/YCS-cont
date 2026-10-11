/**
 * Safari-only main-world injection (Safari applies the page CSP to <script src="safari-web-extension://...">,
 * which YouTube's CSP blocks). The content script asks the background to run an allowlisted file with
 * chrome.scripting.executeScript({ world: 'MAIN' }); the background replies with YCS_MAIN_WORLD_RESULT.
 *
 * Message contract:
 *   content -> background  { type: 'YCS_INJECT_MAIN_WORLD', file }
 *   background -> content  { type: 'YCS_MAIN_WORLD_RESULT', file, ok }   (sent to sender's frame)
 */

export const INJECT_MAIN_WORLD = 'YCS_INJECT_MAIN_WORLD';
export const MAIN_WORLD_RESULT = 'YCS_MAIN_WORLD_RESULT';

export const MAIN_WORLD_FILES: ReadonlySet<string> = new Set([
    'web-resources/wresources.js',
    'web-resources/xlsx-global.js'
]);

// ---------------------------------------------------------------------------
// Content-script side
// ---------------------------------------------------------------------------

export interface MainWorldInjector {
    /** Resolves true once the background reports success; false on failure or timeout. */
    request(file: string, timeoutMs?: number): Promise<boolean>;
    /** Feed YCS_MAIN_WORLD_RESULT messages in here. */
    handleResult(file: unknown, ok: unknown): void;
}

/**
 * - One in-flight request per file: concurrent callers share the same promise.
 * - Successful injections are remembered, so repeated requests (e.g. page scripts re-posting
 *   YCS_LOAD_XLSX) don't re-run the bundle.
 * - Async sendMessage failures settle the request as failed immediately instead of waiting
 *   for the timeout.
 */
export function createMainWorldInjector(
    send: (message: { type: string; file: string }) => unknown,
    defaultTimeoutMs = 4000
): MainWorldInjector {
    const inFlight = new Map<string, { promise: Promise<boolean>; finish: (ok: boolean) => void }>();
    const succeeded = new Set<string>();

    function request(file: string, timeoutMs = defaultTimeoutMs): Promise<boolean> {
        if (succeeded.has(file)) return Promise.resolve(true);
        const existing = inFlight.get(file);
        if (existing) return existing.promise;

        let settle!: (ok: boolean) => void;
        const promise = new Promise<boolean>((resolve) => {
            settle = resolve;
        });
        let done = false;
        const finish = (ok: boolean): void => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            if (inFlight.get(file)?.promise === promise) inFlight.delete(file);
            if (ok) succeeded.add(file);
            settle(ok);
        };
        const timer = setTimeout(() => finish(false), timeoutMs);
        inFlight.set(file, { promise, finish });

        try {
            Promise.resolve(send({ type: INJECT_MAIN_WORLD, file })).catch((err) => {
                console.warn('[YCS] Main-world injection request failed:', err);
                finish(false);
            });
        } catch (err) {
            console.warn('[YCS] Main-world injection request failed:', err);
            finish(false);
        }
        return promise;
    }

    function handleResult(file: unknown, ok: unknown): void {
        if (typeof file !== 'string') return;
        inFlight.get(file)?.finish(ok === true);
    }

    return { request, handleResult };
}

// ---------------------------------------------------------------------------
// Background side
// ---------------------------------------------------------------------------

export interface MainWorldHandlerDeps {
    executeScript(injection: {
        target: { tabId: number; frameIds: number[] };
        files: string[];
        world: 'MAIN';
    }): Promise<unknown>;
    sendToTab(tabId: number, message: unknown, options: { frameId: number }): Promise<unknown>;
}

/**
 * Handles YCS_INJECT_MAIN_WORLD. Returns true if the message was of that type (handled or rejected),
 * false if the caller should keep processing it.
 */
export async function handleInjectMainWorldMessage(
    message: unknown,
    sender: { tab?: { id?: number }; frameId?: number },
    deps: MainWorldHandlerDeps
): Promise<boolean> {
    const msg = message as { type?: unknown; file?: unknown } | null;
    if (msg?.type !== INJECT_MAIN_WORLD) return false;

    const tabId = sender.tab?.id;
    const file = msg.file;
    if (!tabId || typeof file !== 'string' || !MAIN_WORLD_FILES.has(file)) return true;

    const frameId = sender.frameId ?? 0;
    let ok = false;
    try {
        await deps.executeScript({ target: { tabId, frameIds: [frameId] }, files: [file], world: 'MAIN' });
        ok = true;
    } catch (err) {
        console.warn('[YCS] MAIN world injection failed:', file, err);
    }
    try {
        await deps.sendToTab(tabId, { type: MAIN_WORLD_RESULT, file, ok }, { frameId });
    } catch {
        // Tab closed or navigated away
    }
    return true;
}
