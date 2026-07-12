import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
    instantEligible,
    isInstantBrowseMode,
    resolveInstantSearchEnabled,
    shouldSkipAutoload,
    shouldSkipAutoloadFromStorage
} from '../src/source/web-resources/search/instantSearchGate';
import { createState, setComments } from '../src/source/web-resources/state';
import type { CommentItem } from '../src/source/utils/interfaces/i_types';

test('resolveInstantSearchEnabled: missing key defaults to true', () => {
    assert.equal(resolveInstantSearchEnabled({}), true);
    assert.equal(resolveInstantSearchEnabled({ youtubeApiInstantSearch: undefined }), true);
    assert.equal(resolveInstantSearchEnabled({ youtubeApiInstantSearch: false }), false);
});

test('instantEligible: requires API key and instant flag; Enable is irrelevant', () => {
    assert.equal(
        instantEligible({ hasYoutubeApiKey: true, youtubeApiEnabled: true, youtubeApiInstantSearch: true }),
        true
    );
    assert.equal(
        instantEligible({ hasYoutubeApiKey: true, youtubeApiEnabled: false, youtubeApiInstantSearch: true }),
        true
    );
    assert.equal(
        instantEligible({ hasYoutubeApiKey: true, youtubeApiEnabled: true, youtubeApiInstantSearch: false }),
        false
    );
    assert.equal(instantEligible({ hasYoutubeApiKey: false, youtubeApiEnabled: true }), false);
    assert.equal(instantEligible({ hasYoutubeApiKey: true, youtubeApiEnabled: false }), true);
});

test('shouldSkipAutoload mirrors instantEligible (Enable OFF + Instant ON still skips)', () => {
    const eligibleWithEnableOff = {
        hasYoutubeApiKey: true,
        youtubeApiEnabled: false,
        youtubeApiInstantSearch: true
    };
    const ineligible = { hasYoutubeApiKey: true, youtubeApiEnabled: true, youtubeApiInstantSearch: false };

    assert.equal(shouldSkipAutoload(eligibleWithEnableOff), true);
    assert.equal(shouldSkipAutoload(ineligible), false);
});

test('instantEligible: community post disables instant even with API key + Instant ON', () => {
    assert.equal(
        instantEligible({
            hasYoutubeApiKey: true,
            youtubeApiEnabled: true,
            youtubeApiInstantSearch: true,
            isCommunityPost: true
        }),
        false
    );
});

test('shouldSkipAutoload: community post restores autoload (does not skip)', () => {
    assert.equal(
        shouldSkipAutoload({
            hasYoutubeApiKey: true,
            youtubeApiEnabled: true,
            youtubeApiInstantSearch: true,
            isCommunityPost: true
        }),
        false
    );
});

test('shouldSkipAutoloadFromStorage: requires non-empty API key; Enable not required', () => {
    assert.equal(
        shouldSkipAutoloadFromStorage({
            youtubeApiKey: 'abc',
            youtubeApiEnabled: false,
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

test('shouldSkipAutoloadFromStorage: community post restores autoload (does not skip)', () => {
    assert.equal(
        shouldSkipAutoloadFromStorage({
            youtubeApiKey: 'abc',
            youtubeApiEnabled: true,
            youtubeApiInstantSearch: true,
            isCommunityPost: true
        }),
        false
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
    const eligible = { hasYoutubeApiKey: true, youtubeApiEnabled: false, youtubeApiInstantSearch: true };
    assert.equal(isInstantBrowseMode(createState(), eligible), true);

    let state = createState();
    state = setComments(state, [makeComment('c1')]);
    assert.equal(isInstantBrowseMode(state, eligible), false);
});

test('isInstantBrowseMode: community post disables browse mode even with no comments loaded', () => {
    const communityPost = {
        hasYoutubeApiKey: true,
        youtubeApiEnabled: false,
        youtubeApiInstantSearch: true,
        isCommunityPost: true
    };
    assert.equal(isInstantBrowseMode(createState(), communityPost), false);
});
