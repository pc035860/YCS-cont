import { strict as assert } from 'node:assert';
import test from 'node:test';

import { createXlsxLoader, loadXLSXViaExtension, withTimeout } from '../src/source/web-resources/services/xlsxLoader';

const FAKE_XLSX = { utils: {} };

test('loader (non-Safari): uses the dynamic import and never the extension path', async () => {
    let imports = 0;
    let extension = 0;
    const load = createXlsxLoader({
        useExtensionInjection: false,
        importModule: async () => {
            imports++;
            return FAKE_XLSX;
        },
        loadViaExtension: async () => {
            extension++;
            return FAKE_XLSX;
        }
    });
    assert.equal(await load(), FAKE_XLSX);
    assert.equal(imports, 1);
    assert.equal(extension, 0);
});

test('loader (non-Safari): a slow import is not cut off by a timeout', async () => {
    const load = createXlsxLoader({
        useExtensionInjection: false,
        importModule: () => new Promise((resolve) => setTimeout(() => resolve(FAKE_XLSX), 60)),
        loadViaExtension: async () => {
            throw new Error('should not be called');
        },
        extensionTimeoutMs: 10
    });
    assert.equal(await load(), FAKE_XLSX);
});

test('loader (Safari): uses extension injection and skips the CSP-blocked chunk', async () => {
    let imports = 0;
    const load = createXlsxLoader({
        useExtensionInjection: true,
        importModule: async () => {
            imports++;
            return FAKE_XLSX;
        },
        loadViaExtension: async () => FAKE_XLSX
    });
    assert.equal(await load(), FAKE_XLSX);
    assert.equal(imports, 0);
});

test('loader: caches the module after success', async () => {
    let calls = 0;
    const load = createXlsxLoader({
        useExtensionInjection: true,
        importModule: async () => FAKE_XLSX,
        loadViaExtension: async () => {
            calls++;
            return FAKE_XLSX;
        }
    });
    await load();
    await load();
    assert.equal(calls, 1);
});

test('loader: a failure clears the cache so the next export retries', async () => {
    let calls = 0;
    const load = createXlsxLoader({
        useExtensionInjection: true,
        importModule: async () => FAKE_XLSX,
        loadViaExtension: async () => {
            calls++;
            if (calls === 1) throw new Error('first attempt fails');
            return FAKE_XLSX;
        }
    });
    await assert.rejects(load());
    assert.equal(await load(), FAKE_XLSX);
    assert.equal(calls, 2);
});

test('loader (Safari): a missing reply times out instead of hanging, and later exports retry', async () => {
    let calls = 0;
    const load = createXlsxLoader({
        useExtensionInjection: true,
        importModule: async () => FAKE_XLSX,
        loadViaExtension: () => {
            calls++;
            return calls === 1 ? new Promise(() => {}) : Promise.resolve(FAKE_XLSX);
        },
        extensionTimeoutMs: 20
    });
    await assert.rejects(load(), /timed out/);
    assert.equal(await load(), FAKE_XLSX);
});

test('withTimeout: passes through value and rejection', async () => {
    assert.equal(await withTimeout(Promise.resolve(1), 50), 1);
    await assert.rejects(withTimeout(Promise.reject(new Error('boom')), 50), /boom/);
});

// ---------------------------------------------------------------------------
// Page-side extension request
// ---------------------------------------------------------------------------

// Minimal window stand-in: jsdom's postMessage doesn't set event.source, which the loader checks.
type Listener = (e: MessageEvent) => void;
function makeWindow(): Window & { __ycsXLSX?: unknown } {
    const listeners = new Set<Listener>();
    const win = {
        location: { origin: 'https://www.youtube.com' },
        addEventListener: (_type: string, fn: Listener) => listeners.add(fn),
        removeEventListener: (_type: string, fn: Listener) => listeners.delete(fn),
        postMessage: (data: unknown) => {
            setTimeout(() => {
                for (const fn of [...listeners]) fn({ data, source: win } as unknown as MessageEvent);
            }, 0);
        }
    };
    return win as unknown as Window & { __ycsXLSX?: unknown };
}

test('loadXLSXViaExtension: posts YCS_LOAD_XLSX and resolves window.__ycsXLSX on ok', async () => {
    const win = makeWindow();
    win.addEventListener('message', (e: MessageEvent) => {
        if (e.data?.type !== 'YCS_LOAD_XLSX') return;
        win.__ycsXLSX = FAKE_XLSX;
        win.postMessage({ type: 'YCS_LOAD_XLSX_RESULT', ok: true }, win.location.origin);
    });
    assert.equal(await loadXLSXViaExtension(win), FAKE_XLSX);
});

test('loadXLSXViaExtension: rejects when the extension reports failure', async () => {
    const win = makeWindow();
    win.addEventListener('message', (e: MessageEvent) => {
        if (e.data?.type !== 'YCS_LOAD_XLSX') return;
        win.postMessage({ type: 'YCS_LOAD_XLSX_RESULT', ok: false }, win.location.origin);
    });
    await assert.rejects(loadXLSXViaExtension(win), /Unable to load xlsx/);
});

test('loadXLSXViaExtension: returns an already-injected module without posting', async () => {
    const win = makeWindow();
    win.__ycsXLSX = FAKE_XLSX;
    let posted = false;
    win.addEventListener('message', () => {
        posted = true;
    });
    assert.equal(await loadXLSXViaExtension(win), FAKE_XLSX);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(posted, false);
});
