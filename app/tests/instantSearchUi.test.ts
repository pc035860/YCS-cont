import { strict as assert } from 'node:assert';
import test from 'node:test';

import { JSDOM } from 'jsdom';
import { mergeInstantPageResults } from '../src/source/web-resources/search/instantCommentsSearch';
import {
    bindInstantDegradedCapture,
    buildInstantAllModeStatusHtml,
    buildInstantResultsStatusHtml,
    buildUpgradeCompleteNotifyMessage,
    buildUpgradedStatusText,
    buildUpgradingStatusText,
    createPendingUpgradeStore,
    DEGRADED_FILTER_ELEMENT_IDS,
    DEGRADED_FILTER_PARAMS,
    INSTANT_ALWAYS_DEGRADED_FILTER_PARAMS,
    INSTANT_UNLOCKABLE_FILTER_PARAMS,
    isDegradedFilterParam,
    isInstantBlockedFilterParam,
    resolveInstantDegradedAction,
    syncInstantDegradedControls,
    UNLOCKABLE_FILTER_ELEMENT_IDS,
    DEGRADED_EXPORT_ELEMENT_IDS,
    DEGRADED_EXTENDED_SEARCH_ID,
    DEGRADED_OPEN_COMMENTS_WINDOW_ID
} from '../src/source/web-resources/search/instantSearchUi';
import type { InstantDegradedAction } from '../src/source/web-resources/search/instantSearchUi';
import type { FilterParamKey } from '../src/source/web-resources/ui/filters';
import type { CommentItem } from '../src/source/utils/interfaces/i_types';

function makeComment(id: string): CommentItem {
    return {
        typeComment: 'C',
        commentRenderer: {
            commentId: id,
            authorText: { simpleText: 'user' },
            contentText: { runs: [{ text: 'hello' }] }
        }
    } as CommentItem;
}

test('DEGRADED_FILTER_ELEMENT_IDS derive from FILTER_BUTTONS', () => {
    assert.equal(DEGRADED_FILTER_PARAMS.length, 12);
    assert.equal(DEGRADED_FILTER_ELEMENT_IDS.length, 12);
    assert.deepEqual(DEGRADED_FILTER_ELEMENT_IDS, [
        'ycs_btn_heart',
        'ycs_btn_verified',
        'ycs_btn_members',
        'ycs_btn_donated',
        'ycs_btn_author',
        'ycs_btn_timestamp_viz',
        'ycs_btn_random',
        'ycs_btn_links',
        'ycs_btn_likes',
        'ycs_btn_replied_comments',
        'ycs_btn_timestamps',
        'ycs_btn_sort_first'
    ]);
});

test('INSTANT_ALWAYS_DEGRADED_FILTER_PARAMS and INSTANT_UNLOCKABLE_FILTER_PARAMS partition DEGRADED_FILTER_PARAMS exactly', () => {
    assert.equal(INSTANT_ALWAYS_DEGRADED_FILTER_PARAMS.length + INSTANT_UNLOCKABLE_FILTER_PARAMS.length, 12);
    const union = new Set([...INSTANT_ALWAYS_DEGRADED_FILTER_PARAMS, ...INSTANT_UNLOCKABLE_FILTER_PARAMS]);
    assert.equal(union.size, 12);
    for (const param of DEGRADED_FILTER_PARAMS) {
        assert.ok(union.has(param), `${param} missing from tier union`);
    }
    for (const param of INSTANT_ALWAYS_DEGRADED_FILTER_PARAMS) {
        assert.equal(INSTANT_UNLOCKABLE_FILTER_PARAMS.includes(param), false, `${param} should not be in both tiers`);
    }
    assert.deepEqual(INSTANT_ALWAYS_DEGRADED_FILTER_PARAMS, [
        'heart',
        'verified',
        'members',
        'donated',
        'author',
        'timestampViz'
    ]);
    assert.deepEqual(INSTANT_UNLOCKABLE_FILTER_PARAMS, [
        'random',
        'links',
        'likes',
        'replied',
        'timestamp',
        'sortFirst'
    ]);
});

test('isInstantBlockedFilterParam: truth table', () => {
    // Non-degraded filter: never blocked.
    assert.equal(isInstantBlockedFilterParam('quickChat' as FilterParamKey, false), false);
    assert.equal(isInstantBlockedFilterParam('quickChat' as FilterParamKey, true), false);

    // Incomplete session: all degraded filters stay blocked.
    for (const param of DEGRADED_FILTER_PARAMS) {
        assert.equal(isInstantBlockedFilterParam(param, false), true, `${param} should block on incomplete session`);
    }

    // Complete session: always-degraded stays blocked, unlockable unblocks.
    for (const param of INSTANT_ALWAYS_DEGRADED_FILTER_PARAMS) {
        assert.equal(isInstantBlockedFilterParam(param, true), true, `${param} should stay blocked when complete`);
    }
    for (const param of INSTANT_UNLOCKABLE_FILTER_PARAMS) {
        assert.equal(isInstantBlockedFilterParam(param, true), false, `${param} should unlock when complete`);
    }
});

test('isDegradedFilterParam marks incompatible instant filters', () => {
    assert.equal(isDegradedFilterParam('heart'), true);
    assert.equal(isDegradedFilterParam('timestampViz'), true);
    assert.equal(isDegradedFilterParam('links'), true);
    assert.equal(isDegradedFilterParam('likes'), true);
    assert.equal(isDegradedFilterParam('replied'), true);
    assert.equal(isDegradedFilterParam('author'), true);
    assert.equal(isDegradedFilterParam('timestamp'), true);
    assert.equal(isDegradedFilterParam('sortFirst'), true);
    assert.equal(isDegradedFilterParam('quickChat'), false);
});

test('buildInstantResultsStatusHtml includes chip and load-all CTA', () => {
    const html = buildInstantResultsStatusHtml('foo bar', 3);
    assert.match(html, /ycs-instant-chip/);
    assert.match(html, /3 matches/);
    assert.match(html, /ycs-instant-load-all-cta/);
    assert.match(html, /foo bar/);
});

test('separator and load-all CTA wrap as one unit (no dangling middle dot)', () => {
    const html = buildInstantResultsStatusHtml('foo', 3);
    // "·" must live inside the nowrap wrapper together with the CTA button
    assert.match(html, /<span class="ycs-instant-load-all-wrap">·\s*<button[^>]*ycs-instant-load-all-cta/);
});

test('buildUpgradingStatusText shows loaded count without percent', () => {
    assert.match(buildUpgradingStatusText(5, 42), /42 loaded/);
    assert.doesNotMatch(buildUpgradingStatusText(5, 42), /%/);
    assert.doesNotMatch(buildUpgradingStatusText(5), /loaded/);
    assert.doesNotMatch(buildUpgradingStatusText(5, 0), /loaded/);
});

test('buildUpgradedStatusText uses local found copy', () => {
    assert.equal(buildUpgradedStatusText(12), '(Comments) Found: 12');
});

test('buildUpgradeCompleteNotifyMessage reflects intent', () => {
    assert.match(buildUpgradeCompleteNotifyMessage({ filterLabel: 'Heart' }), /applied Heart filter/);
    assert.match(buildUpgradeCompleteNotifyMessage({ query: 'uk' }), /"uk"/);
    assert.match(buildUpgradeCompleteNotifyMessage({ exportUnlocked: true }), /Export unlocked/);
    assert.doesNotMatch(buildUpgradeCompleteNotifyMessage({ query: 'uk' }), /re-run locally/);
});

test('mergeInstantPageResults appends with sequential indexes', () => {
    const existing = [makeComment('a'), makeComment('b')];
    existing[0]._index = 0;
    existing[1]._index = 1;
    const incoming = [makeComment('c'), makeComment('d')];
    const merged = mergeInstantPageResults(existing, incoming);
    assert.equal(merged.length, 4);
    assert.deepEqual(
        merged.map((item) => item._index),
        [0, 1, 2, 3]
    );
});

test('createPendingUpgradeStore consume clears intent', () => {
    const store = createPendingUpgradeStore();
    store.set({ filterParam: { heart: true } });
    assert.deepEqual(store.peek(), { filterParam: { heart: true } });
    assert.deepEqual(store.consume(), { filterParam: { heart: true } });
    assert.equal(store.peek(), null);
});

test('createPendingUpgradeStore retains enableExtendedSearch intent', () => {
    const store = createPendingUpgradeStore();
    store.set({ enableExtendedSearch: true });
    assert.deepEqual(store.consume(), { enableExtendedSearch: true });
});

test('resolveInstantDegradedAction maps degraded controls by id', () => {
    const filterButtonsHtml = DEGRADED_FILTER_ELEMENT_IDS.map(
        (id) => `<button id="${id}"><span>x</span></button>`
    ).join('');
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div class="ycs-app">
            ${filterButtonsHtml}
            <button id="ycs_btn_quick_chat">Chat</button>
            <button id="ycs_save_all_comments">Save</button>
            <button id="ycs_open_all_comments_window">Open</button>
            <input id="ycs_extended_search" type="checkbox" />
        </div>
    </body></html>`);
    const { document } = dom.window;

    for (let i = 0; i < DEGRADED_FILTER_ELEMENT_IDS.length; i++) {
        const elementId = DEGRADED_FILTER_ELEMENT_IDS[i];
        const child = document.querySelector(`#${elementId} span`);
        assert.deepEqual(resolveInstantDegradedAction(child), {
            kind: 'filter',
            elementId,
            param: DEGRADED_FILTER_PARAMS[i]
        });
    }
    assert.equal(resolveInstantDegradedAction(document.getElementById('ycs_btn_quick_chat')), null);
    assert.deepEqual(resolveInstantDegradedAction(document.getElementById('ycs_save_all_comments')), {
        kind: 'export'
    });
    assert.deepEqual(resolveInstantDegradedAction(document.getElementById('ycs_extended_search')), {
        kind: 'extended'
    });
    assert.deepEqual(resolveInstantDegradedAction(document.getElementById('ycs_open_all_comments_window')), {
        kind: 'openWindow'
    });
});

test('createPendingUpgradeStore retains openCommentsWindow intent', () => {
    const store = createPendingUpgradeStore();
    store.set({ openCommentsWindow: true });
    assert.deepEqual(store.consume(), { openCommentsWindow: true });
});

test('bindInstantDegradedCapture survives child rebind and stays idle when inactive', () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div class="ycs-app">
            <div id="ycs-btn-panel">
                <button id="ycs_btn_heart">❤</button>
            </div>
        </div>
    </body></html>`);
    const { document } = dom.window;
    const root = document.querySelector('.ycs-app') as HTMLElement;
    const panel = document.getElementById('ycs-btn-panel') as HTMLElement;

    let active = true;
    const actions: InstantDegradedAction[] = [];
    let bubbleClicks = 0;

    bindInstantDegradedCapture(root, {
        isActive: () => active,
        onAction: (action) => {
            actions.push(action);
        }
    });
    bindInstantDegradedCapture(root, {
        isActive: () => active,
        onAction: () => {
            actions.push({ kind: 'extended' });
        }
    });

    const attachBubble = (button: HTMLElement): void => {
        button.addEventListener('click', () => {
            bubbleClicks += 1;
        });
    };

    attachBubble(document.getElementById('ycs_btn_heart') as HTMLElement);
    const firstClick = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('ycs_btn_heart')?.dispatchEvent(firstClick);
    assert.equal(firstClick.defaultPrevented, true);
    assert.equal(actions.length, 1);
    assert.deepEqual(actions[0], { kind: 'filter', elementId: 'ycs_btn_heart', param: 'heart' });
    assert.equal(bubbleClicks, 0);

    panel.innerHTML = '<button id="ycs_btn_heart">❤</button>';
    attachBubble(document.getElementById('ycs_btn_heart') as HTMLElement);
    document
        .getElementById('ycs_btn_heart')
        ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(actions.length, 2);
    assert.equal(bubbleClicks, 0);

    active = false;
    document
        .getElementById('ycs_btn_heart')
        ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(actions.length, 2);
    assert.equal(bubbleClicks, 1);
});

function buildDegradedControlsDom(): JSDOM {
    const buttons = DEGRADED_FILTER_ELEMENT_IDS.map((id) => `<button id="${id}"><span>x</span></button>`).join('');
    const exportButtons = DEGRADED_EXPORT_ELEMENT_IDS.map((id) => `<button id="${id}"></button>`).join('');
    return new JSDOM(`<!DOCTYPE html><html><body>
        <div class="ycs-app">
            ${buttons}
            ${exportButtons}
            <input id="${DEGRADED_EXTENDED_SEARCH_ID}" type="checkbox" />
            <button id="${DEGRADED_OPEN_COMMENTS_WINDOW_ID}"></button>
        </div>
    </body></html>`);
}

test('syncInstantDegradedControls: active + no sessionComplete degrades everything', () => {
    const dom = buildDegradedControlsDom();
    const { document } = dom.window;
    (globalThis as any).document = document;
    try {
        syncInstantDegradedControls(true);
        for (const id of DEGRADED_FILTER_ELEMENT_IDS) {
            const el = document.getElementById(id) as HTMLElement;
            assert.equal(el.classList.contains('ycs-btn-degraded'), true, `${id} should be degraded`);
        }
    } finally {
        delete (globalThis as any).document;
    }
});

test('syncInstantDegradedControls: active + sessionComplete unlocks only unlockable filters', () => {
    const dom = buildDegradedControlsDom();
    const { document } = dom.window;
    (globalThis as any).document = document;
    try {
        syncInstantDegradedControls(true, { sessionComplete: true });

        for (const id of UNLOCKABLE_FILTER_ELEMENT_IDS) {
            const el = document.getElementById(id) as HTMLElement;
            assert.equal(el.classList.contains('ycs-btn-degraded'), false, `${id} should be unlocked`);
            assert.equal(el.hasAttribute('title'), false, `${id} should have no degraded tooltip`);
        }

        const alwaysDegradedIds = DEGRADED_FILTER_ELEMENT_IDS.filter(
            (id) => !UNLOCKABLE_FILTER_ELEMENT_IDS.includes(id)
        );
        for (const id of alwaysDegradedIds) {
            const el = document.getElementById(id) as HTMLElement;
            assert.equal(el.classList.contains('ycs-btn-degraded'), true, `${id} should stay degraded`);
        }

        for (const id of [
            ...DEGRADED_EXPORT_ELEMENT_IDS,
            DEGRADED_EXTENDED_SEARCH_ID,
            DEGRADED_OPEN_COMMENTS_WINDOW_ID
        ]) {
            const el = document.getElementById(id) as HTMLElement;
            assert.equal(el.classList.contains('ycs-btn-degraded'), true, `${id} should stay degraded`);
        }
    } finally {
        delete (globalThis as any).document;
    }
});

test('bindInstantDegradedCapture: isFilterUnlocked lets unlocked filter clicks through natively', () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div class="ycs-app">
            <button id="ycs_btn_likes">Likes</button>
            <button id="ycs_btn_heart">Heart</button>
            <button id="ycs_save_all_comments">Save</button>
        </div>
    </body></html>`);
    const { document } = dom.window;
    const root = document.querySelector('.ycs-app') as HTMLElement;

    const actions: InstantDegradedAction[] = [];
    let nativeClicks = 0;

    bindInstantDegradedCapture(root, {
        isActive: () => true,
        isFilterUnlocked: (param) => param === 'likes',
        onAction: (action) => actions.push(action)
    });

    const attachNative = (button: HTMLElement): void => {
        button.addEventListener('click', () => {
            nativeClicks += 1;
        });
    };
    attachNative(document.getElementById('ycs_btn_likes') as HTMLElement);
    attachNative(document.getElementById('ycs_btn_heart') as HTMLElement);
    attachNative(document.getElementById('ycs_save_all_comments') as HTMLElement);

    // Unlocked filter: not intercepted, native handler runs.
    const likesClick = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('ycs_btn_likes')?.dispatchEvent(likesClick);
    assert.equal(likesClick.defaultPrevented, false);
    assert.equal(actions.length, 0);
    assert.equal(nativeClicks, 1);

    // Always-degraded filter: still intercepted.
    document
        .getElementById('ycs_btn_heart')
        ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(actions.length, 1);
    assert.deepEqual(actions[0], { kind: 'filter', elementId: 'ycs_btn_heart', param: 'heart' });
    assert.equal(nativeClicks, 1);

    // Export: still intercepted regardless of isFilterUnlocked.
    document
        .getElementById('ycs_save_all_comments')
        ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(actions.length, 2);
    assert.deepEqual(actions[1], { kind: 'export' });
    assert.equal(nativeClicks, 1);
});

test('buildInstantAllModeStatusHtml contains chip, escaped text, and load-all CTA', () => {
    const html = buildInstantAllModeStatusHtml('Links, found: 5 <b>x</b>');
    assert.match(html, /ycs-instant-chip/);
    assert.match(html, /Links, found: 5 &lt;b&gt;x&lt;\/b&gt;/);
    assert.match(html, /ycs-instant-load-all-cta/);
});
