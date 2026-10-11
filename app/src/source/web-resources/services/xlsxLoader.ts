/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Lazy XLSX loader.
 *
 * Chrome/Firefox: plain dynamic import of the lazy xlsx chunk.
 * Safari: the lazy chunk is loaded via <script src="safari-web-extension://...">, which YouTube's CSP
 * blocks in Safari, so we ask the extension to inject web-resources/xlsx-global.js into the page
 * (see utils/mainWorld.ts) and read window.__ycsXLSX. That path is bounded by a timeout so a missing
 * reply can't hang exports.
 *
 * The module promise is cached; a failure clears the cache so the next export retries.
 */
export interface XlsxLoaderOptions {
    useExtensionInjection: boolean;
    importModule: () => Promise<any>;
    loadViaExtension: () => Promise<any>;
    extensionTimeoutMs?: number;
}

export const XLSX_EXTENSION_TIMEOUT_MS = 15000;

export function createXlsxLoader(options: XlsxLoaderOptions): () => Promise<any> {
    let cached: Promise<any> | null = null;
    return function loadXLSX(): Promise<any> {
        if (!cached) {
            const attempt = options.useExtensionInjection
                ? withTimeout(options.loadViaExtension(), options.extensionTimeoutMs ?? XLSX_EXTENSION_TIMEOUT_MS)
                : options.importModule();
            cached = attempt;
            attempt.catch(() => {
                if (cached === attempt) cached = null;
            });
        }
        return cached;
    };
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
        promise.then(
            (v) => {
                clearTimeout(t);
                resolve(v);
            },
            (e) => {
                clearTimeout(t);
                reject(e);
            }
        );
    });
}

/** Page-side request for the extension to inject the standalone XLSX bundle. */
export function loadXLSXViaExtension(win: Window = window): Promise<any> {
    const existing = (win as any).__ycsXLSX;
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
        const onMessage = (e: MessageEvent): void => {
            if (e.source !== win || e.data?.type !== 'YCS_LOAD_XLSX_RESULT') return;
            win.removeEventListener('message', onMessage);
            const XLSX = (win as any).__ycsXLSX;
            if (e.data.ok && XLSX) resolve(XLSX);
            else reject(new Error('Unable to load xlsx'));
        };
        win.addEventListener('message', onMessage);
        win.postMessage({ type: 'YCS_LOAD_XLSX' }, win.location.origin);
    });
}
