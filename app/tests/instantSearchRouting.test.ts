import { strict as assert } from 'node:assert';
import test from 'node:test';

import { instantEligible, shouldUseInstantSearch } from '../src/source/web-resources/search/instantSearchGate';
import { createState, setComments } from '../src/source/web-resources/state';
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
