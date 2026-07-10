import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
    instantEligible,
    isInstantSessionComplete,
    shouldUseInstantSearch
} from '../src/source/web-resources/search/instantSearchGate';
import { createState, setComments, setRemoteSearch } from '../src/source/web-resources/state';
import type { CommentItem } from '../src/source/utils/interfaces/i_types';

const eligibleFlags = {
    hasYoutubeApiKey: true,
    youtubeApiEnabled: true,
    youtubeApiInstantSearch: true
};

const eligibleEnableOff = {
    hasYoutubeApiKey: true,
    youtubeApiEnabled: false,
    youtubeApiInstantSearch: true
};

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

test('shouldUseInstantSearch: empty query never uses instant path', () => {
    const state = createState();
    assert.equal(shouldUseInstantSearch('', state, eligibleFlags), false);
    assert.equal(shouldUseInstantSearch('   ', state, eligibleFlags), false);
});

test('shouldUseInstantSearch: not eligible when instant flags off', () => {
    const state = createState();
    assert.equal(
        shouldUseInstantSearch('hello', state, {
            ...eligibleFlags,
            youtubeApiInstantSearch: false
        }),
        false
    );
});

test('shouldUseInstantSearch: Enable OFF still uses instant when key + Instant ON', () => {
    const state = createState();
    assert.equal(shouldUseInstantSearch('hello', state, eligibleEnableOff), true);
});

test('shouldUseInstantSearch: full archive present uses local Fuse', () => {
    let state = createState();
    state = setComments(state, [makeComment('c1')]);
    assert.equal(shouldUseInstantSearch('hello', state, eligibleFlags), false);
    assert.equal(shouldUseInstantSearch('hello', state, eligibleEnableOff), false);
});

test('shouldUseInstantSearch: eligible with query and no comments', () => {
    const state = createState();
    assert.equal(shouldUseInstantSearch('hello', state, eligibleFlags), true);
});

test('instantEligible: missing youtubeApiInstantSearch treated as enabled; Enable ignored', () => {
    assert.equal(instantEligible({ hasYoutubeApiKey: true, youtubeApiEnabled: true }), true);
    assert.equal(instantEligible({ hasYoutubeApiKey: true, youtubeApiEnabled: false }), true);
});

test('isInstantSessionComplete: truth table', () => {
    const base = createState();

    // Inactive session.
    assert.equal(isInstantSessionComplete(base), false);

    // Active but empty results.
    const activeEmpty = setRemoteSearch(base, { active: true, query: 'hello', results: [] });
    assert.equal(isInstantSessionComplete(activeEmpty), false);

    // Active with results but a pageToken remaining (more pages to fetch).
    const activeWithPageToken = setRemoteSearch(base, {
        active: true,
        query: 'hello',
        results: [makeComment('c1')],
        pageToken: 'next-page'
    });
    assert.equal(isInstantSessionComplete(activeWithPageToken), false);

    // Active, with results, no pageToken: complete.
    const activeComplete = setRemoteSearch(base, {
        active: true,
        query: 'hello',
        results: [makeComment('c1')]
    });
    assert.equal(isInstantSessionComplete(activeComplete), true);
});
