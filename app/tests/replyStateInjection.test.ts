import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { buildReplyCommentFromResponse } from '../src/source/utils/innertube/comments/pipeline';

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = dirname(__filename_local);
const fixturePath = resolve(__dirname_local, '../../specs/020-inline-reply/reply_response.json');
const replyResponse = JSON.parse(readFileSync(fixturePath, 'utf-8'));

function makeMockOriginComment(overrides: Record<string, any> = {}) {
    return {
        typeComment: 'C' as const,
        replyLevel: 0,
        commentRenderer: {
            commentId: 'UgxxvUx8QRUeztT-XR14AaABAg',
            authorText: { simpleText: 'OriginalAuthor' },
            contentText: { runs: [{ text: 'Original comment' }] },
            ...overrides
        }
    };
}

test('buildReplyCommentFromResponse returns a valid CommentItem from reply API response', () => {
    const origin = makeMockOriginComment();
    const result = buildReplyCommentFromResponse({
        response: replyResponse,
        originComment: origin,
        currentVideoId: 'ssnAEHGnQaw'
    });

    assert.ok(result, 'should return a non-undefined result');
    assert.equal(
        result.commentRenderer.commentId,
        'UgxxvUx8QRUeztT-XR14AaABAg.AUQ5wzeTgiLAURumv6UmUd'
    );
});

test('buildReplyCommentFromResponse sets typeComment to R', () => {
    const origin = makeMockOriginComment();
    const result = buildReplyCommentFromResponse({
        response: replyResponse,
        originComment: origin,
        currentVideoId: 'ssnAEHGnQaw'
    });

    assert.ok(result);
    assert.equal(result.typeComment, 'R');
});

test('buildReplyCommentFromResponse sets originComment reference', () => {
    const origin = makeMockOriginComment();
    const result = buildReplyCommentFromResponse({
        response: replyResponse,
        originComment: origin,
        currentVideoId: 'ssnAEHGnQaw'
    });

    assert.ok(result);
    assert.equal(result.originComment, origin);
});

test('buildReplyCommentFromResponse extracts replyLevel from FW data', () => {
    const origin = makeMockOriginComment();
    const result = buildReplyCommentFromResponse({
        response: replyResponse,
        originComment: origin,
        currentVideoId: 'ssnAEHGnQaw'
    });

    assert.ok(result);
    assert.equal(result.replyLevel, 3);
});

test('buildReplyCommentFromResponse extracts createReplyParams for chain replying', () => {
    const origin = makeMockOriginComment();
    const result = buildReplyCommentFromResponse({
        response: replyResponse,
        originComment: origin,
        currentVideoId: 'ssnAEHGnQaw'
    });

    assert.ok(result);
    assert.ok(
        result.commentRenderer.createReplyParams,
        'should have createReplyParams for chain replying'
    );
    assert.equal(typeof result.commentRenderer.createReplyParams, 'string');
});

test('buildReplyCommentFromResponse extracts content text', () => {
    const origin = makeMockOriginComment();
    const result = buildReplyCommentFromResponse({
        response: replyResponse,
        originComment: origin,
        currentVideoId: 'ssnAEHGnQaw'
    });

    assert.ok(result);
    assert.equal(result.commentRenderer.contentText.fullText, 'test6');
});

test('buildReplyCommentFromResponse falls back replyLevel when FW has no value', () => {
    const origin = makeMockOriginComment();
    origin.replyLevel = 2;

    const responseNoReplyLevel = JSON.parse(JSON.stringify(replyResponse));
    for (const m of responseNoReplyLevel.frameworkUpdates.entityBatchUpdate.mutations) {
        if (m.payload.commentEntityPayload?.properties) {
            delete m.payload.commentEntityPayload.properties.replyLevel;
        }
    }

    const result = buildReplyCommentFromResponse({
        response: responseNoReplyLevel,
        originComment: origin,
        currentVideoId: 'ssnAEHGnQaw'
    });

    assert.ok(result);
    assert.equal(result.replyLevel, 3);
});

test('buildReplyCommentFromResponse returns undefined for malformed response', () => {
    const origin = makeMockOriginComment();
    const result = buildReplyCommentFromResponse({
        response: { garbage: true },
        originComment: origin,
        currentVideoId: 'ssnAEHGnQaw'
    });

    assert.equal(result, undefined);
});
