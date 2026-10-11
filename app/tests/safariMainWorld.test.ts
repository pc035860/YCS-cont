import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
    createMainWorldInjector,
    handleInjectMainWorldMessage,
    INJECT_MAIN_WORLD,
    MAIN_WORLD_RESULT
} from '../src/source/utils/mainWorld';
import type { MainWorldHandlerDeps } from '../src/source/utils/mainWorld';

const WRES = 'web-resources/wresources.js';
const XLSX = 'web-resources/xlsx-global.js';

function silenceWarnings(): () => void {
    const original = console.warn;
    console.warn = () => {};
    return () => {
        console.warn = original;
    };
}

// ---------------------------------------------------------------------------
// Content-script injector
// ---------------------------------------------------------------------------

test('injector: sends YCS_INJECT_MAIN_WORLD and resolves with the reported result', async () => {
    const sent: unknown[] = [];
    const injector = createMainWorldInjector((m) => {
        sent.push(m);
        return Promise.resolve();
    });
    const pending = injector.request(WRES);
    assert.deepEqual(sent, [{ type: INJECT_MAIN_WORLD, file: WRES }]);
    injector.handleResult(WRES, true);
    assert.equal(await pending, true);
});

test('injector: concurrent requests for the same file share one in-flight request', async () => {
    let sends = 0;
    const injector = createMainWorldInjector(() => {
        sends++;
        return Promise.resolve();
    });
    const a = injector.request(XLSX);
    const b = injector.request(XLSX);
    assert.equal(a, b);
    assert.equal(sends, 1);
    injector.handleResult(XLSX, true);
    assert.deepEqual(await Promise.all([a, b]), [true, true]);
});

test('injector: a successful file is not injected again', async () => {
    let sends = 0;
    const injector = createMainWorldInjector(() => {
        sends++;
        return Promise.resolve();
    });
    const first = injector.request(XLSX);
    injector.handleResult(XLSX, true);
    await first;
    assert.equal(await injector.request(XLSX), true);
    assert.equal(sends, 1);
});

test('injector: a failed file can be retried', async () => {
    let sends = 0;
    const injector = createMainWorldInjector(() => {
        sends++;
        return Promise.resolve();
    });
    const first = injector.request(XLSX);
    injector.handleResult(XLSX, false);
    assert.equal(await first, false);
    const second = injector.request(XLSX);
    assert.equal(sends, 2);
    injector.handleResult(XLSX, true);
    assert.equal(await second, true);
});

test('injector: async sendMessage rejection fails fast instead of waiting for the timeout', async () => {
    const restore = silenceWarnings();
    try {
        const injector = createMainWorldInjector(() => Promise.reject(new Error('no receiver')), 60_000);
        const started = Date.now();
        assert.equal(await injector.request(WRES), false);
        assert.ok(Date.now() - started < 1000);
    } finally {
        restore();
    }
});

test('injector: synchronous sendMessage throw fails fast', async () => {
    const restore = silenceWarnings();
    try {
        const injector = createMainWorldInjector(() => {
            throw new Error('context invalidated');
        }, 60_000);
        assert.equal(await injector.request(WRES), false);
    } finally {
        restore();
    }
});

test('injector: resolves false on timeout when no result arrives', async () => {
    const injector = createMainWorldInjector(() => Promise.resolve(), 20);
    assert.equal(await injector.request(WRES), false);
});

test('injector: ignores results for other files and non-boolean ok values', async () => {
    const injector = createMainWorldInjector(() => Promise.resolve(), 50);
    const pending = injector.request(WRES);
    injector.handleResult(XLSX, true);
    injector.handleResult(42, true);
    injector.handleResult(WRES, 'true');
    assert.equal(await pending, false);
});

// ---------------------------------------------------------------------------
// Background handler (message contract)
// ---------------------------------------------------------------------------

function makeDeps(opts: { executeFails?: boolean; sendFails?: boolean } = {}): {
    deps: MainWorldHandlerDeps;
    executed: unknown[];
    sent: Array<{ tabId: number; message: unknown; options: unknown }>;
} {
    const executed: unknown[] = [];
    const sent: Array<{ tabId: number; message: unknown; options: unknown }> = [];
    return {
        executed,
        sent,
        deps: {
            executeScript: async (injection) => {
                executed.push(injection);
                if (opts.executeFails) throw new Error('blocked');
            },
            sendToTab: async (tabId, message, options) => {
                sent.push({ tabId, message, options });
                if (opts.sendFails) throw new Error('tab gone');
            }
        }
    };
}

test('handler: ignores other message types', async () => {
    const { deps, executed } = makeDeps();
    assert.equal(await handleInjectMainWorldMessage({ type: 'YCS_SET_BADGE' }, { tab: { id: 1 } }, deps), false);
    assert.equal(await handleInjectMainWorldMessage(null, { tab: { id: 1 } }, deps), false);
    assert.equal(executed.length, 0);
});

test('handler: injects allowlisted file into the sender frame in the MAIN world and reports ok', async () => {
    const { deps, executed, sent } = makeDeps();
    const handled = await handleInjectMainWorldMessage(
        { type: INJECT_MAIN_WORLD, file: XLSX },
        { tab: { id: 7 }, frameId: 3 },
        deps
    );
    assert.equal(handled, true);
    assert.deepEqual(executed, [{ target: { tabId: 7, frameIds: [3] }, files: [XLSX], world: 'MAIN' }]);
    assert.deepEqual(sent, [
        { tabId: 7, message: { type: MAIN_WORLD_RESULT, file: XLSX, ok: true }, options: { frameId: 3 } }
    ]);
});

test('handler: defaults to the top frame when frameId is missing', async () => {
    const { deps, executed, sent } = makeDeps();
    await handleInjectMainWorldMessage({ type: INJECT_MAIN_WORLD, file: WRES }, { tab: { id: 7 } }, deps);
    assert.deepEqual((executed[0] as { target: unknown }).target, { tabId: 7, frameIds: [0] });
    assert.deepEqual(sent[0].options, { frameId: 0 });
});

test('handler: refuses files outside the allowlist without injecting or replying', async () => {
    const { deps, executed, sent } = makeDeps();
    for (const file of ['background.js', '../evil.js', 'web-resources/other.js', 42, undefined]) {
        assert.equal(
            await handleInjectMainWorldMessage({ type: INJECT_MAIN_WORLD, file }, { tab: { id: 7 } }, deps),
            true
        );
    }
    assert.equal(executed.length, 0);
    assert.equal(sent.length, 0);
});

test('handler: refuses messages that did not come from a tab', async () => {
    const { deps, executed } = makeDeps();
    assert.equal(await handleInjectMainWorldMessage({ type: INJECT_MAIN_WORLD, file: WRES }, {}, deps), true);
    assert.equal(executed.length, 0);
});

test('handler: reports ok=false when executeScript fails', async () => {
    const restore = silenceWarnings();
    try {
        const { deps, sent } = makeDeps({ executeFails: true });
        await handleInjectMainWorldMessage({ type: INJECT_MAIN_WORLD, file: WRES }, { tab: { id: 7 } }, deps);
        assert.deepEqual(sent[0].message, { type: MAIN_WORLD_RESULT, file: WRES, ok: false });
    } finally {
        restore();
    }
});

test('handler: a closed tab while replying does not throw', async () => {
    const { deps } = makeDeps({ sendFails: true });
    assert.equal(
        await handleInjectMainWorldMessage({ type: INJECT_MAIN_WORLD, file: WRES }, { tab: { id: 7 } }, deps),
        true
    );
});
