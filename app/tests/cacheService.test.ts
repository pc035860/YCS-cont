import { strict as assert } from 'node:assert';
import test from 'node:test';

import { stripReplyTokens } from '../src/source/web-resources/services/cacheService';

function makeComment(overrides: Record<string, any> = {}): any {
    return {
        typeComment: 'C',
        commentRenderer: {
            commentId: 'comment-1',
            authorText: { simpleText: 'User' },
            contentText: { runs: [{ text: 'Hello' }] },
            ...overrides
        }
    };
}

function makeReply(originComment: any, overrides: Record<string, any> = {}): any {
    return {
        typeComment: 'R',
        originComment,
        commentRenderer: {
            commentId: 'reply-1',
            authorText: { simpleText: 'Replier' },
            contentText: { runs: [{ text: 'Reply' }] },
            ...overrides
        }
    };
}

test('stripReplyTokens removes top-level createReplyParams', () => {
    const comments = [makeComment({ createReplyParams: 'token-abc' })];
    const result = stripReplyTokens(comments);

    assert.equal(result[0].commentRenderer.createReplyParams, undefined);
    assert.equal(result[0].commentRenderer.commentId, 'comment-1');
    assert.equal(result[0].commentRenderer.authorText.simpleText, 'User');
});

test('stripReplyTokens removes token from originComment (depth 1)', () => {
    const parent = makeComment({ createReplyParams: 'parent-token' });
    const reply = makeReply(parent, { createReplyParams: 'reply-token' });
    const result = stripReplyTokens([parent, reply]);

    assert.equal(result[0].commentRenderer.createReplyParams, undefined);
    assert.equal(result[1].commentRenderer.createReplyParams, undefined);
    assert.equal(result[1].originComment.commentRenderer.createReplyParams, undefined);
    assert.equal(result[1].originComment.commentRenderer.commentId, 'comment-1');
});

test('stripReplyTokens removes token from nested originComment chain (depth 2+)', () => {
    const grandparent = makeComment({ createReplyParams: 'gp-token' });
    const parent = {
        ...makeReply(grandparent, { createReplyParams: 'p-token' }),
        commentRenderer: {
            ...makeReply(grandparent).commentRenderer,
            commentId: 'reply-mid',
            createReplyParams: 'p-token'
        }
    };
    const child = makeReply(parent, { createReplyParams: 'c-token' });
    child.commentRenderer.commentId = 'reply-deep';

    const result = stripReplyTokens([grandparent, parent, child]);

    assert.equal(result[2].commentRenderer.createReplyParams, undefined);
    assert.equal(result[2].originComment.commentRenderer.createReplyParams, undefined);
    assert.equal(result[2].originComment.originComment.commentRenderer.createReplyParams, undefined);

    assert.equal(result[2].originComment.commentRenderer.commentId, 'reply-mid');
    assert.equal(result[2].originComment.originComment.commentRenderer.commentId, 'comment-1');
});

test('stripReplyTokens passes through comments without tokens unchanged', () => {
    const plain = makeComment();
    const comments = [plain];
    const result = stripReplyTokens(comments);

    assert.deepEqual(result[0], plain);
});

test('stripReplyTokens handles empty array', () => {
    assert.deepEqual(stripReplyTokens([]), []);
});

test('stripReplyTokens preserves all non-token fields', () => {
    const comment = makeComment({
        createReplyParams: 'token-xyz',
        publishedTimeText: { runs: [{ text: '1 day ago' }] },
        likeCount: 42,
        replyCount: 5,
        verifiedAuthor: true
    });
    const result = stripReplyTokens([comment]);

    assert.equal(result[0].commentRenderer.createReplyParams, undefined);
    assert.equal(result[0].commentRenderer.publishedTimeText.runs[0].text, '1 day ago');
    assert.equal(result[0].commentRenderer.likeCount, 42);
    assert.equal(result[0].commentRenderer.replyCount, 5);
    assert.equal(result[0].commentRenderer.verifiedAuthor, true);
    assert.equal(result[0].typeComment, 'C');
});
