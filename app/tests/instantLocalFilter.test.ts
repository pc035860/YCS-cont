import { strict as assert } from 'node:assert';
import test from 'node:test';

import { runSearch, runSearchOnComments } from '../src/source/web-resources/search/commentsSearch';
import { createState, getComments, setComments } from '../src/source/web-resources/state';
import type { CommentItem } from '../src/source/utils/interfaces/i_types';
import type { SearchContext } from '../src/source/web-resources/search/types';

function makeComment(
    id: string,
    overrides?: {
        likeCount?: number;
        replyCount?: number;
        content?: string;
        isTimeLine?: 'timeline';
        publishedAtMs?: number;
        index?: number;
    }
): CommentItem {
    const item: CommentItem = {
        typeComment: 'C',
        commentRenderer: {
            commentId: id,
            authorText: { simpleText: 'user' },
            contentText: { runs: [{ text: overrides?.content ?? 'hello world' }] },
            likeCount: overrides?.likeCount,
            replyCount: overrides?.replyCount,
            isTimeLine: overrides?.isTimeLine,
            publishedAtMs: overrides?.publishedAtMs
        }
    } as CommentItem;
    if (overrides?.index !== undefined) {
        item._index = overrides.index;
    }
    return item;
}

function commentIds(items: Array<{ item: CommentItem }>): string[] {
    return items.map((entry) => entry.item.commentRenderer.commentId);
}

const baseContext: SearchContext = {
    extendedSearch: { enabled: false, title: false, main: false },
    sortOrders: { comments: {}, chat: {}, transcript: {} }
};

test('runSearchOnComments: likes filter sorts by likeCount desc', () => {
    const items = [
        makeComment('a', { likeCount: 5, index: 0 }),
        makeComment('b', { likeCount: 10, index: 1 }),
        makeComment('c', { likeCount: 2, index: 2 })
    ];

    const result = runSearchOnComments('', { likes: true }, items, baseContext);
    assert.deepEqual(commentIds(result.results), ['b', 'a', 'c']);
});

test('runSearchOnComments: sortFirst with publishedAtMs sorts by date desc (newest first) when preferPublishedAtOrder is set', () => {
    const items = [
        makeComment('a', { publishedAtMs: 1000, index: 0 }),
        makeComment('b', { publishedAtMs: 3000, index: 1 }),
        makeComment('c', { publishedAtMs: 2000, index: 2 })
    ];

    const result = runSearchOnComments('', { sortFirst: true }, items, baseContext, {
        preferPublishedAtOrder: true
    });
    assert.deepEqual(commentIds(result.results), ['b', 'c', 'a']);
});

test('runSearchOnComments: sortFirst with sortOrder oldest reverses date order when preferPublishedAtOrder is set', () => {
    const items = [
        makeComment('a', { publishedAtMs: 1000, index: 0 }),
        makeComment('b', { publishedAtMs: 3000, index: 1 }),
        makeComment('c', { publishedAtMs: 2000, index: 2 })
    ];

    const result = runSearchOnComments('', { sortFirst: true, sortOrder: 'oldest' }, items, baseContext, {
        preferPublishedAtOrder: true
    });
    assert.deepEqual(commentIds(result.results), ['a', 'c', 'b']);
});

test('runSearchOnComments: sortFirst without publishedAtMs keeps _index/load order (full-archive regression guard)', () => {
    const items = [makeComment('a', { index: 0 }), makeComment('b', { index: 1 }), makeComment('c', { index: 2 })];

    const result = runSearchOnComments('', { sortFirst: true }, items, baseContext, {
        preferPublishedAtOrder: true
    });
    assert.deepEqual(commentIds(result.results), ['a', 'b', 'c']);
});

test('runSearchOnComments: sortFirst with publishedAtMs but WITHOUT preferPublishedAtOrder keeps _index order (scope guard: full Data API archive load must not get instant-only date ordering)', () => {
    const items = [
        makeComment('a', { publishedAtMs: 1000, index: 0 }),
        makeComment('b', { publishedAtMs: 3000, index: 1 }),
        makeComment('c', { publishedAtMs: 2000, index: 2 })
    ];

    const result = runSearchOnComments('', { sortFirst: true }, items, baseContext);
    assert.deepEqual(commentIds(result.results), ['a', 'b', 'c']);
});

test('runSearchOnComments: links filter sorts by publishedAtMs when preferPublishedAtOrder is set (instant unlock fix)', () => {
    const items = [
        makeComment('a', { content: 'https://a.example', publishedAtMs: 1000, index: 0 }),
        makeComment('b', { content: 'https://b.example', publishedAtMs: 3000, index: 1 }),
        makeComment('c', { content: 'https://c.example', publishedAtMs: 2000, index: 2 })
    ];

    const result = runSearchOnComments('', { links: true }, items, baseContext, {
        preferPublishedAtOrder: true
    });
    assert.deepEqual(commentIds(result.results), ['b', 'c', 'a']);
});

test('runSearchOnComments: links filter keeps _index order without preferPublishedAtOrder (full-archive regression guard)', () => {
    const items = [
        makeComment('a', { content: 'https://a.example', publishedAtMs: 1000, index: 0 }),
        makeComment('b', { content: 'https://b.example', publishedAtMs: 3000, index: 1 }),
        makeComment('c', { content: 'https://c.example', publishedAtMs: 2000, index: 2 })
    ];

    const result = runSearchOnComments('', { links: true }, items, baseContext);
    assert.deepEqual(commentIds(result.results), ['a', 'b', 'c']);
});

test('runSearchOnComments: timestamp filter sorts by publishedAtMs when preferPublishedAtOrder is set (instant unlock fix)', () => {
    const items = [
        makeComment('a', { isTimeLine: 'timeline', publishedAtMs: 1000, index: 0 }),
        makeComment('b', { isTimeLine: 'timeline', publishedAtMs: 3000, index: 1 }),
        makeComment('c', { isTimeLine: 'timeline', publishedAtMs: 2000, index: 2 })
    ];

    const result = runSearchOnComments('', { timestamp: true }, items, baseContext, {
        preferPublishedAtOrder: true
    });
    assert.deepEqual(commentIds(result.results), ['b', 'c', 'a']);
});

test('runSearchOnComments: timestamp filter keeps _index order without preferPublishedAtOrder (full-archive regression guard)', () => {
    const items = [
        makeComment('a', { isTimeLine: 'timeline', publishedAtMs: 1000, index: 0 }),
        makeComment('b', { isTimeLine: 'timeline', publishedAtMs: 3000, index: 1 }),
        makeComment('c', { isTimeLine: 'timeline', publishedAtMs: 2000, index: 2 })
    ];

    const result = runSearchOnComments('', { timestamp: true }, items, baseContext);
    assert.deepEqual(commentIds(result.results), ['a', 'b', 'c']);
});

test('runSearchOnComments: replied filter sorts by replyCount desc', () => {
    const items = [
        makeComment('a', { replyCount: 1, index: 0 }),
        makeComment('b', { replyCount: 4, index: 1 }),
        makeComment('c', { replyCount: 0, index: 2 })
    ];

    const result = runSearchOnComments('', { replied: true }, items, baseContext);
    assert.deepEqual(commentIds(result.results), ['b', 'a']);
});

test('runSearchOnComments: links filter keeps only comments containing a URL', () => {
    const items = [
        makeComment('a', { content: 'check https://example.com', index: 0 }),
        makeComment('b', { content: 'no link here', index: 1 }),
        makeComment('c', { content: 'http://another.example', index: 2 })
    ];

    const result = runSearchOnComments('', { links: true }, items, baseContext);
    assert.deepEqual(commentIds(result.results), ['a', 'c']);
});

test('runSearchOnComments: timestamp filter keeps only timeline comments', () => {
    const items = [
        makeComment('a', { isTimeLine: 'timeline', index: 0 }),
        makeComment('b', { index: 1 }),
        makeComment('c', { isTimeLine: 'timeline', index: 2 })
    ];

    const result = runSearchOnComments('', { timestamp: true }, items, baseContext);
    assert.deepEqual(commentIds(result.results), ['a', 'c']);
});

test('runSearch wrapper delegates to runSearchOnComments over getComments(state)', () => {
    const items = [
        makeComment('a', { likeCount: 5, index: 0 }),
        makeComment('b', { likeCount: 10, index: 1 }),
        makeComment('c', { likeCount: 2, index: 2 })
    ];
    let state = createState();
    state = setComments(state, items);

    const viaState = runSearch('', { likes: true }, state, baseContext);
    const viaComments = runSearchOnComments('', { likes: true }, getComments(state), baseContext);

    assert.deepEqual(commentIds(viaState.results), commentIds(viaComments.results));
    assert.equal(viaState.total, viaComments.total);
    assert.equal(viaState.summary, viaComments.summary);
});
