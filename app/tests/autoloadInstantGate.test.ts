import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
    instantEligible,
    isInstantBrowseMode,
    resolveInstantSearchEnabled,
    shouldSkipAutoload,
    shouldSkipAutoloadFromStorage,
    shouldUseInstantSearch
} from '../src/source/web-resources/search/instantSearchGate';
import { createState, setComments } from '../src/source/web-resources/state';
import type { CommentItem } from '../src/source/utils/interfaces/i_types';

test('resolveInstantSearchEnabled: missing key defaults to true', () => {
    assert.equal(resolveInstantSearchEnabled({}), true);
    assert.equal(resolveInstantSearchEnabled({ youtubeApiInstantSearch: undefined }), true);
    assert.equal(resolveInstantSearchEnabled({ youtubeApiInstantSearch: false }), false);
});

test('instantEligible: requires API key, enabled API, and instant flag', () => {
    assert.equal(
        instantEligible({ hasYoutubeApiKey: true, youtubeApiEnabled: true, youtubeApiInstantSearch: true }),
        true
    );
    assert.equal(
        instantEligible({ hasYoutubeApiKey: true, youtubeApiEnabled: true, youtubeApiInstantSearch: false }),
        false
    );
    assert.equal(instantEligible({ hasYoutubeApiKey: false, youtubeApiEnabled: true }), false);
    assert.equal(instantEligible({ hasYoutubeApiKey: true, youtubeApiEnabled: false }), false);
});

test('shouldSkipAutoload mirrors instantEligible', () => {
    const eligible = { hasYoutubeApiKey: true, youtubeApiEnabled: true, youtubeApiInstantSearch: true };
    const ineligible = { hasYoutubeApiKey: true, youtubeApiEnabled: true, youtubeApiInstantSearch: false };

    assert.equal(shouldSkipAutoload(eligible), true);
    assert.equal(shouldSkipAutoload(ineligible), false);
});

test('shouldSkipAutoloadFromStorage: requires non-empty API key in storage', () => {
    assert.equal(
        shouldSkipAutoloadFromStorage({
            youtubeApiKey: 'abc',
            youtubeApiEnabled: true,
            youtubeApiInstantSearch: true
        }),
        true
    );
    assert.equal(
        shouldSkipAutoloadFromStorage({
            youtubeApiKey: '',
            youtubeApiEnabled: true,
            youtubeApiInstantSearch: true
        }),
        false
    );
    assert.equal(
        shouldSkipAutoloadFromStorage({
            youtubeApiKey: 'abc',
            youtubeApiEnabled: true
        }),
        true
    );
});

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

test('isInstantBrowseMode: eligible only when no comments loaded', () => {
    const eligible = { hasYoutubeApiKey: true, youtubeApiEnabled: true, youtubeApiInstantSearch: true };
    assert.equal(isInstantBrowseMode(createState(), eligible), true);

    let state = createState();
    state = setComments(state, [makeComment('c1')]);
    assert.equal(isInstantBrowseMode(state, eligible), false);
});
