import { strict as assert } from 'node:assert';
import test from 'node:test';

import { fetchAndMergeReplies, mergeFetchedReplies } from '../src/source/web-resources/search/instantReplyFetch';
import { UPGRADE_OPEN_REPLIES_MODAL_MESSAGE } from '../src/source/web-resources/search/instantSearchUi';
import { createState, getRemoteSearch, setRemoteSearch } from '../src/source/web-resources/state';
import type { CommentItem, YouTubeApiComment } from '../src/source/utils/interfaces/i_types';

function makeCommentItem(id: string, typeComment: 'C' | 'R' = 'R', originComment?: CommentItem): CommentItem {
    return {
        typeComment,
        originComment,
        commentRenderer: {
            commentId: id,
            authorText: { simpleText: 'user' },
            contentText: { runs: [{ text: `text ${id}` }] }
        }
    } as unknown as CommentItem;
}

function makeApiComment(id: string): YouTubeApiComment {
    return {
        kind: 'youtube#comment',
        etag: 'etag',
        id,
        snippet: {
            authorDisplayName: 'Reply Author',
            authorProfileImageUrl: 'https://example.com/a.jpg',
            authorChannelUrl: 'https://www.youtube.com/channel/UC1',
            authorChannelId: { value: 'UC1' },
            textDisplay: `reply ${id}`,
            textOriginal: `reply ${id}`,
            parentId: 'parent-1',
            canRate: true,
            viewerRating: 'none',
            likeCount: 0,
            publishedAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
        }
    };
}

test('UPGRADE_OPEN_REPLIES_MODAL_MESSAGE: exists and mentions replies + full archive', () => {
    assert.equal(typeof UPGRADE_OPEN_REPLIES_MODAL_MESSAGE, 'string');
    assert.match(UPGRADE_OPEN_REPLIES_MODAL_MESSAGE, /repl/i);
    assert.match(UPGRADE_OPEN_REPLIES_MODAL_MESSAGE, /full comment archive/i);
    assert.match(UPGRADE_OPEN_REPLIES_MODAL_MESSAGE, /instant results stay visible/i);
});

test('mergeFetchedReplies: appends only replies whose commentId is not already present', () => {
    const existing = [makeCommentItem('parent-1', 'C'), makeCommentItem('reply-1'), makeCommentItem('reply-2')];
    const fetched = [makeCommentItem('reply-1'), makeCommentItem('reply-3'), makeCommentItem('reply-4')];

    const merged = mergeFetchedReplies(existing, fetched);

    assert.equal(merged.length, 5);
    const ids = merged.map((item) => item.commentRenderer?.commentId);
    assert.deepEqual(ids, ['parent-1', 'reply-1', 'reply-2', 'reply-3', 'reply-4']);
});

test('mergeFetchedReplies: assigns a continuing _index to newly-appended replies', () => {
    const existing = [makeCommentItem('parent-1', 'C'), makeCommentItem('reply-1')];
    const fetched = [makeCommentItem('reply-1'), makeCommentItem('reply-2'), makeCommentItem('reply-3')];

    const merged = mergeFetchedReplies(existing, fetched);

    assert.deepEqual(
        merged.map((item) => item._index),
        [undefined, undefined, 2, 3]
    );
});

test('mergeFetchedReplies: returns the same array reference when nothing new is added', () => {
    const existing = [makeCommentItem('reply-1'), makeCommentItem('reply-2')];
    const fetched = [makeCommentItem('reply-1'), makeCommentItem('reply-2')];

    const merged = mergeFetchedReplies(existing, fetched);

    assert.equal(merged, existing);
});

test('mergeFetchedReplies: keeps replies missing a commentId rather than dropping them', () => {
    const existing: CommentItem[] = [];
    const fetched = [{ typeComment: 'R', commentRenderer: {} } as unknown as CommentItem];

    const merged = mergeFetchedReplies(existing, fetched);

    assert.equal(merged.length, 1);
});

test('fetchAndMergeReplies: transforms raw items, sets originComment, and dedupes against the session', async () => {
    const parentItem = makeCommentItem('parent-1', 'C');
    const inlineReply = makeCommentItem('reply-1');

    let state = createState();
    state = setRemoteSearch(state, {
        ...getRemoteSearch(state),
        active: true,
        query: 'hello',
        results: [parentItem, inlineReply]
    });

    let capturedArgs: unknown;
    const stubFetchReplies = async (opts: { videoId: string; parentId: string; signal?: AbortSignal }) => {
        capturedArgs = opts;
        return {
            items: [makeApiComment('reply-1'), makeApiComment('reply-2'), makeApiComment('reply-3')],
            quotaUsed: 1
        };
    };

    const outcome = await fetchAndMergeReplies(
        {
            videoId: 'video-1',
            parentId: 'parent-1',
            parentItem,
            getState: () => state
        },
        stubFetchReplies
    );

    assert.deepEqual(capturedArgs, { videoId: 'video-1', parentId: 'parent-1', signal: undefined });

    // 3 raw items transformed, even though reply-1 duplicates the already-inlined reply.
    assert.equal(outcome.fetchedReplies.length, 3);
    for (const reply of outcome.fetchedReplies) {
        assert.equal(reply.originComment, parentItem);
        assert.equal(reply.typeComment, 'R');
    }

    // Session merge dedupes reply-1: parent + inline reply-1 + new reply-2/reply-3 = 4.
    const merged = getRemoteSearch(outcome.state).results;
    assert.equal(merged.length, 4);
    assert.deepEqual(
        merged.map((item) => item.commentRenderer?.commentId),
        ['parent-1', 'reply-1', 'reply-2', 'reply-3']
    );
});

test('fetchAndMergeReplies: propagates errors from the injected fetch function untouched', async () => {
    const parentItem = makeCommentItem('parent-1', 'C');
    const state = createState();

    const quotaError = new Error('quota exceeded') as Error & { isQuotaExceeded: boolean };
    quotaError.isQuotaExceeded = true;

    await assert.rejects(
        fetchAndMergeReplies(
            { videoId: 'video-1', parentId: 'parent-1', parentItem, getState: () => state },
            async () => {
                throw quotaError;
            }
        ),
        (error: unknown) => error === quotaError
    );
});

test('fetchAndMergeReplies: two concurrent fetches on different threads both survive (last resolver does not clobber the first)', async () => {
    const parentA = makeCommentItem('parent-A', 'C');
    const parentB = makeCommentItem('parent-B', 'C');

    let state = createState();
    state = setRemoteSearch(state, {
        ...getRemoteSearch(state),
        active: true,
        query: 'hello',
        results: [parentA, parentB]
    });
    const getState = () => state;

    // Fetch A starts first but resolves LAST (deferred); fetch B starts second but resolves FIRST.
    let resolveA: (() => void) | undefined;
    const fetchRepliesA = (): Promise<{ items: YouTubeApiComment[]; quotaUsed: number }> =>
        new Promise((resolve) => {
            resolveA = () => resolve({ items: [makeApiComment('replyA-1')], quotaUsed: 1 });
        });
    const fetchRepliesB = async (): Promise<{ items: YouTubeApiComment[]; quotaUsed: number }> => ({
        items: [makeApiComment('replyB-1')],
        quotaUsed: 1
    });

    const promiseA = fetchAndMergeReplies(
        { videoId: 'video-1', parentId: 'parent-A', parentItem: parentA, getState },
        fetchRepliesA
    );
    // B fetches and merges (synchronously-resolving stub) while A is still pending.
    const outcomeB = await fetchAndMergeReplies(
        { videoId: 'video-1', parentId: 'parent-B', parentItem: parentB, getState },
        fetchRepliesB
    );
    state = outcomeB.state; // simulates the caller applying B's result to `state` immediately.

    // Now let A resolve - it must merge on top of the CURRENT state (which already has B's reply),
    // not the stale pre-fetch snapshot from before B landed.
    resolveA?.();
    const outcomeA = await promiseA;

    const finalIds = getRemoteSearch(outcomeA.state).results.map((item) => item.commentRenderer?.commentId);
    assert.deepEqual(finalIds, ['parent-A', 'parent-B', 'replyB-1', 'replyA-1']);
});
