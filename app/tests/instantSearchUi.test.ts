import { strict as assert } from 'node:assert';
import test from 'node:test';

import { JSDOM } from 'jsdom';
import {
    buildInitialRemoteSearchSession,
    mergeInstantPageResults,
    mergeRemoteSearchSession
} from '../src/source/web-resources/search/instantCommentsSearch';
import {
    bindInstantDegradedCapture,
    buildInstantAllModeStatusHtml,
    buildInstantChipHtml,
    buildInstantFetchAllProgressLabel,
    buildInstantFetchAllTooltip,
    buildInstantResultsStatusHtml,
    buildInstantResultsStatusText,
    buildUpgradeCompleteNotifyMessage,
    buildUpgradedStatusText,
    buildUpgradingStatusText,
    createPendingUpgradeStore,
    DEGRADED_FILTER_ELEMENT_IDS,
    DEGRADED_FILTER_PARAMS,
    INSTANT_ALWAYS_DEGRADED_FILTER_PARAMS,
    INSTANT_FETCH_ALL_TOOLTIP_UNKNOWN,
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

test('buildInstantResultsStatusHtml: incomplete session keeps the long CTA label without a tooltip', () => {
    const html = buildInstantResultsStatusHtml('foo bar', 3, false);
    assert.match(html, /<button type="button" class="ycs-instant-load-all-cta">Load all comments for filters &amp; export<\/button>/);
    assert.doesNotMatch(html, /ycs-instant-load-all-cta"[^>]*title=/);
});

test('buildInstantResultsStatusHtml: complete session shortens the CTA label and adds a tooltip', () => {
    const html = buildInstantResultsStatusHtml('foo bar', 3, true);
    assert.match(
        html,
        /<button type="button" class="ycs-instant-load-all-cta" title="For remaining filters">Load all comments<\/button>/
    );
    assert.doesNotMatch(html, /Load all comments for filters/);
});

test('buildInstantResultsStatusText: sessionComplete shortens the CTA copy', () => {
    assert.equal(
        buildInstantResultsStatusText('foo', 3),
        '3 matches for "foo" · Load all comments for filters & export'
    );
    assert.equal(buildInstantResultsStatusText('foo', 3, true), '3 matches for "foo" · Load all comments');
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

test('syncInstantDegradedControls: preserves native title across degrade → unlock cycle for the save button', () => {
    // Reproduce the real DOM shape: `#ycs_save_all_comments` ships with a native
    // `title="Save comments to file"` (renderView.ts). If setDegraded strips it
    // on unlock, hovering Save shows no tooltip — a real regression once the
    // export button unlocks on session complete.
    const dom = buildDegradedControlsDom();
    const { document } = dom.window;
    (globalThis as any).document = document;
    try {
        const saveButton = document.getElementById('ycs_save_all_comments') as HTMLElement;
        saveButton.setAttribute('title', 'Save comments to file');

        // Degrade → title snapshot captured, degraded copy displayed.
        syncInstantDegradedControls(true);
        assert.equal(saveButton.classList.contains('ycs-btn-degraded'), true);
        assert.equal(saveButton.getAttribute('title'), 'Needs all comments loaded — click to load');

        // A second degrade pass must not overwrite the snapshot with our own copy.
        syncInstantDegradedControls(true);

        // Session complete unlocks the export: native title restored, dataset cleaned up.
        syncInstantDegradedControls(true, { sessionComplete: true });
        assert.equal(saveButton.classList.contains('ycs-btn-degraded'), false);
        assert.equal(saveButton.getAttribute('title'), 'Save comments to file');
        assert.equal(saveButton.dataset.ycsNativeTitle, undefined);
    } finally {
        delete (globalThis as any).document;
    }
});

test('syncInstantDegradedControls: matches real app.ts sync sequence on a fresh instant-eligible video', () => {
    // Regression fixture that mirrors the actual sync-call sequence observed via
    // instrumented E2E on a fresh instant-eligible video (see PR #157 review round):
    //   1. `initFilterButtons` → `syncInstantControlsFromState` fires BEFORE the
    //      async YCS_OPTIONS message arrives, so `hasYoutubeApiKey` is still
    //      undefined and `isInstantDegradedMode()` returns false → active=false.
    //   2. Options land → `syncInstantSearchPlaceholder` fires
    //      `syncInstantDegradedControls(true)` (no sessionComplete arg → second
    //      branch, active=true). This is the transition that MUST snapshot.
    //   3. A repeated degrade pass (same call again) MUST NOT overwrite the
    //      snapshot with its own degraded copy.
    //   4. Instant session completes → `syncInstantDegradedControls(true,
    //      { sessionComplete: true })` → first branch → save unlocks with the
    //      snapshotted native title restored, `dataset.ycsNativeTitle` deleted.
    // The prior fixture skipped step 1 entirely; without step 1 no measurable
    // difference exists between working code and a broken "always overwrite"
    // implementation, because step 2's snapshot logic runs cleanly either way.
    const dom = buildDegradedControlsDom();
    const { document } = dom.window;
    (globalThis as any).document = document;
    try {
        const saveButton = document.getElementById('ycs_save_all_comments') as HTMLElement;
        saveButton.setAttribute('title', 'Save comments to file');

        // 1. Pre-options sync: nothing degraded yet, native title must survive the no-op unlock.
        syncInstantDegradedControls(false);
        assert.equal(saveButton.getAttribute('title'), 'Save comments to file');
        assert.equal(saveButton.classList.contains('ycs-btn-degraded'), false);

        // 2. Options-arrived degrade: snapshot the native title before overwriting it.
        syncInstantDegradedControls(true);
        assert.equal(saveButton.classList.contains('ycs-btn-degraded'), true);
        assert.equal(saveButton.getAttribute('title'), 'Needs all comments loaded — click to load');
        assert.equal(saveButton.dataset.ycsNativeTitle, 'Save comments to file');

        // 3. Repeated degrade must be a no-op on the snapshot — otherwise the
        // second pass would overwrite the stored native title with the degraded
        // copy and unlock later would restore the wrong string.
        syncInstantDegradedControls(true);
        assert.equal(saveButton.dataset.ycsNativeTitle, 'Save comments to file');

        // 4. Session complete unlocks: native title restored, dataset cleared.
        syncInstantDegradedControls(true, { sessionComplete: true });
        assert.equal(saveButton.classList.contains('ycs-btn-degraded'), false);
        assert.equal(saveButton.getAttribute('title'), 'Save comments to file');
        assert.equal(saveButton.dataset.ycsNativeTitle, undefined);
    } finally {
        delete (globalThis as any).document;
    }
});

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

test('syncInstantDegradedControls: active + sessionComplete unlocks unlockable filters AND export', () => {
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

        // Export unlocks alongside filters: instant results become the export source.
        for (const id of DEGRADED_EXPORT_ELEMENT_IDS) {
            const el = document.getElementById(id) as HTMLElement;
            assert.equal(el.classList.contains('ycs-btn-degraded'), false, `${id} should be unlocked on complete`);
            assert.equal(el.hasAttribute('title'), false, `${id} should have no degraded tooltip`);
        }

        const alwaysDegradedIds = DEGRADED_FILTER_ELEMENT_IDS.filter(
            (id) => !UNLOCKABLE_FILTER_ELEMENT_IDS.includes(id)
        );
        for (const id of alwaysDegradedIds) {
            const el = document.getElementById(id) as HTMLElement;
            assert.equal(el.classList.contains('ycs-btn-degraded'), true, `${id} should stay degraded`);
        }

        for (const id of [DEGRADED_EXTENDED_SEARCH_ID, DEGRADED_OPEN_COMMENTS_WINDOW_ID]) {
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

test('bindInstantDegradedCapture: isExportUnlocked lets export clicks through natively', () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div class="ycs-app">
            <button id="ycs_btn_heart">Heart</button>
            <button id="ycs_save_all_comments">Save</button>
        </div>
    </body></html>`);
    const { document } = dom.window;
    const root = document.querySelector('.ycs-app') as HTMLElement;

    const actions: InstantDegradedAction[] = [];
    let nativeClicks = 0;
    let exportUnlocked = false;

    bindInstantDegradedCapture(root, {
        isActive: () => true,
        isExportUnlocked: () => exportUnlocked,
        onAction: (action) => actions.push(action)
    });

    const attachNative = (button: HTMLElement): void => {
        button.addEventListener('click', () => {
            nativeClicks += 1;
        });
    };
    attachNative(document.getElementById('ycs_save_all_comments') as HTMLElement);
    attachNative(document.getElementById('ycs_btn_heart') as HTMLElement);

    // Locked (session incomplete): export intercepted, degraded action fires.
    document
        .getElementById('ycs_save_all_comments')
        ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(actions.length, 1);
    assert.deepEqual(actions[0], { kind: 'export' });
    assert.equal(nativeClicks, 0);

    // Unlocked (session complete): export passes through to native handler.
    exportUnlocked = true;
    const nativeExportClick = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('ycs_save_all_comments')?.dispatchEvent(nativeExportClick);
    assert.equal(nativeExportClick.defaultPrevented, false);
    assert.equal(actions.length, 1);
    assert.equal(nativeClicks, 1);

    // Always-degraded filter still intercepted regardless of export state.
    document
        .getElementById('ycs_btn_heart')
        ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(actions.length, 2);
    assert.deepEqual(actions[1], { kind: 'filter', elementId: 'ycs_btn_heart', param: 'heart' });
    assert.equal(nativeClicks, 1);
});

test('buildInstantAllModeStatusHtml contains chip, escaped text, and load-all CTA', () => {
    const html = buildInstantAllModeStatusHtml('Links, found: 5 <b>x</b>');
    assert.match(html, /ycs-instant-chip/);
    assert.match(html, /Links, found: 5 &lt;b&gt;x&lt;\/b&gt;/);
    assert.match(html, /ycs-instant-load-all-cta/);
});

test('buildInstantAllModeStatusHtml: incomplete session keeps the long CTA label', () => {
    const html = buildInstantAllModeStatusHtml('(All) Found: 5', false);
    assert.match(html, />Load all comments for filters &amp; export</);
});

test('buildInstantAllModeStatusHtml: complete session shortens the CTA label and adds a tooltip', () => {
    const html = buildInstantAllModeStatusHtml('(All) Found: 5', true);
    assert.match(html, /title="For remaining filters">Load all comments</);
    assert.doesNotMatch(html, /Load all comments for filters/);
});

test('buildInstantChipHtml renders the shared instant chip with SVG bolt, without the ⚡ emoji', () => {
    const html = buildInstantChipHtml();
    assert.match(html, /class="ycs-instant-chip"/);
    assert.match(html, /<svg class="ycs-instant-bolt"/);
    assert.match(html, /Instant/);
    assert.doesNotMatch(html, /⚡/);
});

test('buildInstantFetchAllTooltip: known totalResults estimates remaining pages (min 1)', () => {
    assert.equal(buildInstantFetchAllTooltip(250, 100), 'Fetch every remaining page (~2 quota units)');
    // Exactly 100 remaining still rounds up to 1 page.
    assert.equal(buildInstantFetchAllTooltip(200, 100), 'Fetch every remaining page (~1 quota units)');
    // Already-loaded count meets/exceeds totalResults: floor at 1, never 0 or negative.
    assert.equal(buildInstantFetchAllTooltip(100, 100), 'Fetch every remaining page (~1 quota units)');
    assert.equal(buildInstantFetchAllTooltip(50, 100), 'Fetch every remaining page (~1 quota units)');
});

test('buildInstantFetchAllTooltip: unknown totalResults falls back to generic quota copy', () => {
    assert.equal(buildInstantFetchAllTooltip(undefined, 0), INSTANT_FETCH_ALL_TOOLTIP_UNKNOWN);
    assert.equal(buildInstantFetchAllTooltip(Number.NaN, 10), INSTANT_FETCH_ALL_TOOLTIP_UNKNOWN);
});

test('buildInstantFetchAllProgressLabel shows loaded count when known', () => {
    assert.equal(buildInstantFetchAllProgressLabel(), 'Fetching all matches…');
    assert.equal(buildInstantFetchAllProgressLabel(0), 'Fetching all matches… (0 loaded)');
    assert.equal(buildInstantFetchAllProgressLabel(150), 'Fetching all matches… (150 loaded)');
});

test('buildInitialRemoteSearchSession stores totalResults from the response', () => {
    const items = [makeComment('a'), makeComment('b')];
    const session = buildInitialRemoteSearchSession('foo', items, { nextPageToken: 'p2', totalResults: 42 });
    assert.equal(session.active, true);
    assert.equal(session.query, 'foo');
    assert.equal(session.results, items);
    assert.equal(session.pageToken, 'p2');
    assert.equal(session.totalResults, 42);
});

test('buildInitialRemoteSearchSession leaves totalResults undefined when the response omits it', () => {
    const session = buildInitialRemoteSearchSession('foo', [], {});
    assert.equal(session.totalResults, undefined);
});

test('mergeRemoteSearchSession refreshes totalResults from the latest response', () => {
    const base = buildInitialRemoteSearchSession('foo', [makeComment('a')], {
        nextPageToken: 'p2',
        totalResults: 42
    });
    const merged = mergeRemoteSearchSession(base, [makeComment('a'), makeComment('b')], {
        nextPageToken: undefined,
        totalResults: 45
    });
    assert.equal(merged.results.length, 2);
    assert.equal(merged.pageToken, undefined);
    assert.equal(merged.totalResults, 45);
});

test('mergeRemoteSearchSession keeps the previous totalResults when the response omits it', () => {
    const base = buildInitialRemoteSearchSession('foo', [makeComment('a')], {
        nextPageToken: 'p2',
        totalResults: 42
    });
    const merged = mergeRemoteSearchSession(base, [makeComment('a'), makeComment('b')], {
        nextPageToken: 'p3'
    });
    assert.equal(merged.totalResults, 42);
});
