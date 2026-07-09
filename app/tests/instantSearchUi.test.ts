import { strict as assert } from 'node:assert';
import test from 'node:test';

import { mergeInstantPageResults } from '../src/source/web-resources/search/instantCommentsSearch';
import {
    buildInstantResultsStatusHtml,
    buildUpgradedStatusText,
    buildUpgradingStatusText,
    createPendingUpgradeStore,
    DEGRADED_FILTER_ELEMENT_IDS,
    DEGRADED_FILTER_PARAMS,
    isDegradedFilterParam
} from '../src/source/web-resources/search/instantSearchUi';
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

test('isDegradedFilterParam marks incompatible instant filters', () => {
    assert.equal(isDegradedFilterParam('heart'), true);
    assert.equal(isDegradedFilterParam('timestampViz'), true);
    assert.equal(isDegradedFilterParam('links'), false);
    assert.equal(DEGRADED_FILTER_PARAMS.length, 6);
    assert.equal(DEGRADED_FILTER_ELEMENT_IDS.length, 6);
});

test('buildInstantResultsStatusHtml includes chip and load-all CTA', () => {
    const html = buildInstantResultsStatusHtml('foo bar', 3);
    assert.match(html, /ycs-instant-chip/);
    assert.match(html, /3 matches/);
    assert.match(html, /ycs-instant-load-all-cta/);
    assert.match(html, /foo bar/);
});

test('buildUpgradingStatusText includes percent when provided', () => {
    assert.match(buildUpgradingStatusText(5, 42), /42%/);
    assert.doesNotMatch(buildUpgradingStatusText(5), /%/);
});

test('buildUpgradedStatusText uses local found copy', () => {
    assert.equal(buildUpgradedStatusText(12), '(Comments) Found: 12');
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
