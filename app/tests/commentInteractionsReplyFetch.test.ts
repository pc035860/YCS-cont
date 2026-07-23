import { strict as assert } from 'node:assert';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
(globalThis as any).document = dom.window.document;
(globalThis as any).window = dom.window;
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).Element = dom.window.Element;
(globalThis as any).Node = dom.window.Node;
(globalThis as any).DocumentFragment = dom.window.DocumentFragment;
(globalThis as any).DOMException = dom.window.DOMException;

import { registerCommentInteractions } from '../src/source/web-resources/ui/commentInteractions';
import type { CommentInteractionsDeps } from '../src/source/web-resources/ui/commentInteractions';
import type { CommentStateAccessor } from '../src/source/web-resources/ui/originChain';

function buildParentComment(id: string, replyCount: number | string): Record<string, any> {
    return {
        _index: 0,
        typeComment: 'C',
        commentId: id,
        commentRenderer: {
            commentId: id,
            replyCount,
            contentText: { simpleText: 'parent text' },
            authorText: { simpleText: 'parent_author' },
            publishedTimeText: { runs: [{ text: '2d ago' }] }
        }
    };
}

function buildReplyComment(id: string, parent: Record<string, any>, index: number): Record<string, any> {
    return {
        _index: index,
        typeComment: 'R',
        commentId: id,
        commentRenderer: {
            commentId: id,
            contentText: { simpleText: `reply ${id}` },
            authorText: { simpleText: 'replier' },
            publishedTimeText: { runs: [{ text: '1d ago' }] }
        },
        originComment: parent
    };
}

function buildCommentContainer(commentId: string): { container: HTMLElement; button: HTMLElement } {
    const container = document.createElement('div');
    container.id = 'ycs-number-comment-0';
    container.className = 'ycs-render-comment';

    const button = document.createElement('button');
    button.className = 'ycs-open-reply';
    button.textContent = '+';
    button.title = 'Open replies to the comment';
    button.dataset.idcom = commentId;
    container.appendChild(button);

    document.body.appendChild(container);
    return { container, button };
}

function click(button: HTMLElement): void {
    button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
}

function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

test('full-cache mode (no deps): unchanged local-only expand behavior', async () => {
    const parent = buildParentComment('c1', 2);
    const reply1 = buildReplyComment('c1r1', parent, 1);
    const reply2 = buildReplyComment('c1r2', parent, 2);
    let comments: Record<string, any>[] = [parent, reply1, reply2];

    const { container, button } = buildCommentContainer('c1');
    try {
        const stateAccessor: CommentStateAccessor = { getComments: () => comments };
        registerCommentInteractions(container, stateAccessor, () => '');

        click(button);
        await flush();

        assert.equal(button.classList.contains('ycs-reply-loading'), false);
        assert.equal(button.title, 'Close replies to the comment');
        const repliesWrap = container.querySelector('.ycs-com-replies-c1');
        assert.notEqual(repliesWrap, null);
    } finally {
        container.remove();
    }
});

test('instant mode: collected < expected replyCount fetches missing replies and merges into accessor', async () => {
    const parent = buildParentComment('c1', 3);
    const inlineReply = buildReplyComment('c1r1', parent, 1);
    let comments: Record<string, any>[] = [parent, inlineReply];

    const { container, button } = buildCommentContainer('c1');
    try {
        const stateAccessor: CommentStateAccessor = { getComments: () => comments };

        let resolveFetch: (() => void) | undefined;
        const fetchCalls: Array<[string, Record<string, any>]> = [];
        const deps: CommentInteractionsDeps = {
            fetchMissingReplies: (commentId, parentItem) => {
                fetchCalls.push([commentId, parentItem]);
                return new Promise((resolve) => {
                    resolveFetch = () => {
                        comments = [
                            parent,
                            inlineReply,
                            buildReplyComment('c1r2', parent, 2),
                            buildReplyComment('c1r3', parent, 3)
                        ];
                        resolve([]);
                    };
                });
            }
        };

        registerCommentInteractions(container, stateAccessor, () => '', deps);

        click(button);
        await flush();

        // Loading state applied synchronously while the fetch is in flight.
        // The "+" glyph stays put; the loading visual is CSS-only (dim + delayed shimmer).
        assert.equal(button.classList.contains('ycs-reply-loading'), true);
        assert.equal(button.textContent, '+');
        assert.equal(button.title, 'Loading replies…');
        assert.equal(fetchCalls.length, 1);
        assert.equal(fetchCalls[0][0], 'c1');

        // Double-click guard: a second click while loading must not call fetchMissingReplies again.
        click(button);
        await flush();
        assert.equal(fetchCalls.length, 1);

        resolveFetch?.();
        await flush();

        assert.equal(button.classList.contains('ycs-reply-loading'), false);
        assert.equal(button.title, 'Close replies to the comment');
        const repliesWrap = container.querySelector('.ycs-com-replies-c1');
        assert.notEqual(repliesWrap, null);
    } finally {
        container.remove();
    }
});

test('instant mode: quota error restores button and invokes onReplyQuotaExceeded', async () => {
    const parent = buildParentComment('c1', 5);
    let comments: Record<string, any>[] = [parent];

    const { container, button } = buildCommentContainer('c1');
    try {
        const stateAccessor: CommentStateAccessor = { getComments: () => comments };

        let quotaCalled = 0;
        const quotaError = new Error('quota exceeded') as Error & { isQuotaExceeded: boolean };
        quotaError.isQuotaExceeded = true;

        const deps: CommentInteractionsDeps = {
            fetchMissingReplies: async () => {
                throw quotaError;
            },
            onReplyQuotaExceeded: () => {
                quotaCalled += 1;
            }
        };

        registerCommentInteractions(container, stateAccessor, () => '', deps);

        click(button);
        await flush();
        await flush();

        assert.equal(quotaCalled, 1);
        assert.equal(button.classList.contains('ycs-reply-loading'), false);
        assert.equal(button.textContent, '+');
        assert.equal(button.title, 'Open replies to the comment');
        assert.equal(container.querySelector('.ycs-com-replies-c1'), null);
    } finally {
        container.remove();
    }
});

test('instant mode: AbortError restores button silently (no quota callback, no throw)', async () => {
    const parent = buildParentComment('c1', 5);
    const comments: Record<string, any>[] = [parent];

    const { container, button } = buildCommentContainer('c1');
    try {
        const stateAccessor: CommentStateAccessor = { getComments: () => comments };

        let quotaCalled = 0;
        const deps: CommentInteractionsDeps = {
            fetchMissingReplies: async () => {
                throw new DOMException('Aborted', 'AbortError');
            },
            onReplyQuotaExceeded: () => {
                quotaCalled += 1;
            }
        };

        registerCommentInteractions(container, stateAccessor, () => '', deps);

        click(button);
        await flush();
        await flush();

        assert.equal(quotaCalled, 0);
        assert.equal(button.classList.contains('ycs-reply-loading'), false);
        assert.equal(button.textContent, '+');
    } finally {
        container.remove();
    }
});

test('instant mode: fetchMissingReplies skipped when local replies already meet replyCount', async () => {
    const parent = buildParentComment('c1', 1);
    const inlineReply = buildReplyComment('c1r1', parent, 1);
    const comments: Record<string, any>[] = [parent, inlineReply];

    const { container, button } = buildCommentContainer('c1');
    try {
        const stateAccessor: CommentStateAccessor = { getComments: () => comments };

        let fetchCalled = 0;
        const deps: CommentInteractionsDeps = {
            fetchMissingReplies: async () => {
                fetchCalled += 1;
                return [];
            }
        };

        registerCommentInteractions(container, stateAccessor, () => '', deps);

        click(button);
        await flush();

        assert.equal(fetchCalled, 0);
        assert.notEqual(container.querySelector('.ycs-com-replies-c1'), null);
    } finally {
        container.remove();
    }
});

test('instant mode: replyCount as a numeric string still triggers a fetch when local replies fall short', async () => {
    // Data API renderer.replyCount can arrive as `number | string` - getExpectedReplyCount must
    // coerce it correctly rather than treating "3" as falsy/NaN and silently skipping the fetch.
    const parent = buildParentComment('c1', '3');
    const inlineReply = buildReplyComment('c1r1', parent, 1);
    const comments: Record<string, any>[] = [parent, inlineReply];

    const { container, button } = buildCommentContainer('c1');
    try {
        const stateAccessor: CommentStateAccessor = { getComments: () => comments };

        let fetchCalled = 0;
        const deps: CommentInteractionsDeps = {
            fetchMissingReplies: async () => {
                fetchCalled += 1;
                return [];
            }
        };

        registerCommentInteractions(container, stateAccessor, () => '', deps);

        click(button);
        await flush();

        assert.equal(fetchCalled, 1);
    } finally {
        container.remove();
    }
});
