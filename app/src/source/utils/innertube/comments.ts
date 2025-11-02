import Queue from 'p-queue';

import { showLoadComments } from '../dom';
import { getVideoId } from '../common';
import {
    applyFrameworkUpdatesToComment,
    dedupeParentComments,
    extractNextContinuation,
    fetchContinuationBatch,
    fetchInitialCommentBatch,
    fetchRepliesBatch,
    generateCommentObjectFromFW,
    processParentComment,
    scheduleReplyFetches,
    type CommentBatchResult,
    type ReplyContinuation
} from './comments/pipeline';

async function getAllCommentsModeV2(
    elShowLoading: HTMLElement,
    signal: AbortSignal | undefined = undefined,
    container: object[] | undefined = undefined,
    maxComments = 500000
): Promise<object[]> {
    const comments: object[] = container || [];
    const replyQueue = new Queue({ concurrency: 4 });
    const currentVideoId = String(getVideoId(window.location.href) || '');

    let batch: CommentBatchResult | undefined = await fetchInitialCommentBatch({
        windowRef: window,
        signal
    });

    let limitReached = false;
    while (batch && !limitReached) {
        const parentResults: object[] = [];
        const replyContinuations: ReplyContinuation[] = [];

        for (const item of batch.comments || []) {
            const processed = processParentComment({
                item,
                frameworkUpdates: batch.frameworkUpdates,
                currentVideoId
            });
            parentResults.push(...processed.comments);
            replyContinuations.push(...processed.replyContinuations);
        }

        for (const comment of parentResults) {
            if (comments.length >= maxComments) {
                limitReached = true;
                break;
            }
            comments.push(comment);
            showLoadComments(comments.length, elShowLoading);
        }

        if (!limitReached && replyContinuations.length > 0) {
            void scheduleReplyFetches({
                continuations: replyContinuations,
                queue: replyQueue,
                currentVideoId,
                fetchContinuation: (continuation) => fetchRepliesBatch({ windowRef: window, signal, continuation }),
                onReply: (reply) => {
                    if (comments.length < maxComments) {
                        comments.push(reply);
                        showLoadComments(comments.length, elShowLoading);
                    }
                }
            });
        }

        const nextContinuation = !limitReached ? batch.continuations.shift() : undefined;
        if (nextContinuation) {
            batch = await fetchContinuationBatch({
                windowRef: window,
                signal,
                continuation: nextContinuation
            });
        } else {
            batch = undefined;
        }
    }

    await replyQueue.onIdle();

    const deduplicated = dedupeParentComments(comments);
    comments.length = 0;
    comments.push(...deduplicated);

    for (let idx = 0; idx < comments.length; idx++) {
        (comments[idx] as any)._index = idx;
    }

    if (comments.length >= maxComments) {
        console.warn(`[YCS] Reached comment limit: ${maxComments} for video ${currentVideoId}`);
    }
    return comments;
}

export { getAllCommentsModeV2, extractNextContinuation, applyFrameworkUpdatesToComment, generateCommentObjectFromFW };
