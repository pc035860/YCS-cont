import assert from 'node:assert';
import test from 'node:test';
import {
    dedupeParentComments,
    processParentComment,
    scheduleReplyFetches,
    type ReplyContinuation
} from '../src/source/utils/innertube/comments/pipeline';

const createStubQueue = () => {
    const pending: Promise<unknown>[] = [];
    return {
        add<T>(fn: () => Promise<T>): Promise<T> {
            const task = fn();
            pending.push(task);
            return task;
        },
        async onIdle(): Promise<void> {
            await Promise.all(pending);
        }
    } as any;
};

const createParentThread = (overrides: Partial<any> = {}) => ({
    commentThreadRenderer: {
        comment: {
            commentRenderer: {
                commentId: 'parent-1',
                contentText: { runs: [{ text: 'Parent comment' }] },
                publishedTimeText: { runs: [{ text: '1 day ago' }] },
                ...overrides
            }
        }
    }
});

test('processParentComment builds parent without continuations', () => {
    const thread = createParentThread();

    const result = processParentComment({ item: thread, frameworkUpdates: {}, currentVideoId: 'video-1' });

    assert.strictEqual(result.comments.length, 1);
    const parent: any = result.comments[0];
    assert.strictEqual(parent.typeComment, 'C');
    assert.strictEqual(parent.commentRenderer.contentText.fullText, 'Parent comment');
    assert.strictEqual(parent.commentRenderer.contentText.renderFullText, 'Parent comment');
    assert.deepStrictEqual(result.replyContinuations, []);
});

test('processParentComment collects replies and reply continuations', () => {
    const thread = createParentThread();
    thread.commentThreadRenderer.replies = {
        commentRepliesRenderer: {
            contents: [
                {
                    commentRenderer: {
                        commentId: 'reply-1',
                        contentText: { runs: [{ text: 'First reply' }] },
                        publishedTimeText: { runs: [{ text: '1 hour ago' }] }
                    }
                }
            ],
            continuations: [
                {
                    nextContinuationData: {
                        continuation: 'reply-token-1',
                        clickTrackingParams: 'tracking-1'
                    }
                }
            ]
        }
    };

    const result = processParentComment({ item: thread, frameworkUpdates: {}, currentVideoId: 'video-1' });

    assert.strictEqual(result.comments.length, 2);
    const parent: any = result.comments[0];
    const reply: any = result.comments[1];
    assert.strictEqual(reply.typeComment, 'R');
    assert.strictEqual(reply.commentRenderer.contentText.fullText, 'First reply');
    assert.strictEqual(reply.originComment, parent);
    assert.strictEqual(result.replyContinuations.length, 1);
    assert.deepStrictEqual(result.replyContinuations[0], {
        token: 'reply-token-1',
        clickTrackingParams: 'tracking-1',
        originComment: parent
    });
});

test('processParentComment applies framework updates for creator flag', () => {
    const thread = createParentThread();
    const frameworkUpdates = {
        'parent-1': {
            author: { isCreator: true }
        }
    };

    const result = processParentComment({ item: thread, frameworkUpdates, currentVideoId: 'video-1' });

    const parent: any = result.comments[0];
    assert.strictEqual(parent.commentRenderer.authorIsChannelOwner, true);
});

test('scheduleReplyFetches returns empty when no continuations', async () => {
    const replies = await scheduleReplyFetches({
        continuations: [],
        queue: createStubQueue(),
        currentVideoId: 'video-1',
        fetchContinuation: async () => undefined
    });

    assert.deepStrictEqual(replies, []);
});

test('scheduleReplyFetches processes reply continuations', async () => {
    const parentThread = createParentThread();
    const parentResult = processParentComment({ item: parentThread, frameworkUpdates: {}, currentVideoId: 'video-1' });
    const parent: any = parentResult.comments[0];

    const replyContinuation: ReplyContinuation = {
        token: 'token-1',
        originComment: parent
    };

    const replies = await scheduleReplyFetches({
        continuations: [replyContinuation],
        queue: createStubQueue(),
        currentVideoId: 'video-1',
        fetchContinuation: async () => ({
            comments: [
                {
                    commentRenderer: {
                        commentId: 'child-1',
                        contentText: { runs: [{ text: 'Nested reply' }] },
                        publishedTimeText: { runs: [{ text: 'just now' }] }
                    }
                }
            ],
            continuations: [],
            frameworkUpdates: {}
        })
    });

    assert.strictEqual(replies.length, 1);
    const reply: any = replies[0];
    assert.strictEqual(reply.typeComment, 'R');
    assert.strictEqual(reply.originComment, parent);
    assert.strictEqual(reply.commentRenderer.contentText.fullText, 'Nested reply');
});

test('dedupeParentComments keeps first parent and rewires replies', () => {
    const parentThread = createParentThread();
    const processed = processParentComment({ item: parentThread, frameworkUpdates: {}, currentVideoId: 'video-1' });
    const parentA: any = processed.comments[0];
    const parentB: any = { ...parentA, _copy: true };
    parentB.commentRenderer = { ...parentA.commentRenderer };

    const reply: any = {
        typeComment: 'R',
        commentRenderer: {
            commentId: 'reply-duplicate'
        },
        originComment: parentB
    };

    const deduped = dedupeParentComments([parentA, parentB, reply]);

    assert.strictEqual(deduped.length, 2);
    assert.strictEqual(deduped[0], parentA);
    assert.strictEqual((deduped[1] as any).originComment, parentA);
});
