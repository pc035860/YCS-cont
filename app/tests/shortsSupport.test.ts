import { strict as assert } from 'node:assert';
import test from 'node:test';

import { waitForShortsPanelStable } from '../src/source/web-resources/features/shortsSupport';

class MockMutationObserver {
    static instances: MockMutationObserver[] = [];
    private callback: MutationCallback;
    public disconnected = false;

    constructor(callback: MutationCallback) {
        this.callback = callback;
        MockMutationObserver.instances.push(this);
    }

    observe(): void {
        // no-op for tests
    }

    disconnect(): void {
        this.disconnected = true;
    }

    trigger(records: MutationRecord[] = []): void {
        this.callback(records, this as unknown as MutationObserver);
    }
}

const sleep = async (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

function setupTestEnvironment(anchoredPanel: Element | null): {
    restore: () => void;
    getObservers: () => MockMutationObserver[];
} {
    const originalDocument = (globalThis as any).document;
    const originalMutationObserver = (globalThis as any).MutationObserver;

    MockMutationObserver.instances = [];

    (globalThis as any).document = {
        querySelector: (selector: string): Element | null => {
            if (selector === '#anchored-panel') {
                return anchoredPanel;
            }
            return null;
        }
    };

    (globalThis as any).MutationObserver = MockMutationObserver;

    return {
        restore: () => {
            (globalThis as any).document = originalDocument;
            (globalThis as any).MutationObserver = originalMutationObserver;
            MockMutationObserver.instances = [];
        },
        getObservers: () => MockMutationObserver.instances
    };
}

test('waitForShortsPanelStable resolves with quiet when no mutation occurs', async () => {
    const panel = {} as Element;
    const { restore, getObservers } = setupTestEnvironment(panel);

    try {
        const start = Date.now();
        const result = await waitForShortsPanelStable({ quietWindowMs: 20, timeoutMs: 120 });
        const elapsedMs = Date.now() - start;

        assert.equal(result.stable, true);
        assert.equal(result.reason, 'quiet');
        assert.ok(elapsedMs >= 10);

        const observers = getObservers();
        assert.equal(observers.length, 1);
        assert.equal(observers[0]?.disconnected, true);
    } finally {
        restore();
    }
});

test('waitForShortsPanelStable resets quiet window after mutations and resolves by quiet', async () => {
    const panel = {} as Element;
    const { restore, getObservers } = setupTestEnvironment(panel);

    try {
        const start = Date.now();
        const waitPromise = waitForShortsPanelStable({ quietWindowMs: 30, timeoutMs: 200 });
        const observer = getObservers()[0];
        assert.ok(observer);

        setTimeout(() => {
            observer?.trigger([{ type: 'attributes' } as MutationRecord]);
        }, 10);
        setTimeout(() => {
            observer?.trigger([{ type: 'childList' } as MutationRecord]);
        }, 25);

        const result = await waitPromise;
        const elapsedMs = Date.now() - start;

        assert.equal(result.stable, true);
        assert.equal(result.reason, 'quiet');
        assert.ok(elapsedMs >= 45);
        assert.equal(observer?.disconnected, true);
    } finally {
        restore();
    }
});

test('waitForShortsPanelStable resolves with timeout when panel keeps mutating', async () => {
    const panel = {} as Element;
    const { restore, getObservers } = setupTestEnvironment(panel);

    try {
        const waitPromise = waitForShortsPanelStable({ quietWindowMs: 30, timeoutMs: 80 });
        const observer = getObservers()[0];
        assert.ok(observer);

        const intervalId = setInterval(() => {
            observer?.trigger([{ type: 'attributes' } as MutationRecord]);
        }, 5);

        const result = await waitPromise;
        clearInterval(intervalId);

        assert.equal(result.stable, false);
        assert.equal(result.reason, 'timeout');
        assert.equal(observer?.disconnected, true);

        // Ensure no residual async side effect after resolve
        await sleep(20);
        observer?.trigger([{ type: 'attributes' } as MutationRecord]);
    } finally {
        restore();
    }
});

test('waitForShortsPanelStable resolves with unavailable when anchored panel does not exist', async () => {
    const { restore, getObservers } = setupTestEnvironment(null);

    try {
        const result = await waitForShortsPanelStable({ quietWindowMs: 10, timeoutMs: 50 });
        assert.equal(result.stable, false);
        assert.equal(result.reason, 'unavailable');
        assert.equal(getObservers().length, 0);
    } finally {
        restore();
    }
});
