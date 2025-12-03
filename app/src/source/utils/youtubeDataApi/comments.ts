/**
 * YouTube Data API v3 Comments Fetching
 *
 * Fetches comments using the official YouTube Data API v3.
 * This is an alternative to the Innertube API when users provide their API key.
 */

import PQueue from 'p-queue';
import type { CommentItem } from '../interfaces/i_types';
import { fetchCommentThreads, fetchCommentReplies, YouTubeDataApiError } from './client';
import { transformThreadToCommentItems, transformReplyToCommentItem } from './transform';
import { showLoadComments } from '../dom';

/**
 * Result of comment fetching operation
 */
export interface YouTubeApiCommentsResult {
    comments: CommentItem[];
    quotaUsed: number;
    totalCount: number;
}

/**
 * Shared state for tracking fetch progress across async operations
 */
interface FetchState {
    quotaUsed: number;
    maxComments: number;
    signal: AbortSignal | undefined;
}

/**
 * Fetch all comments for a video using YouTube Data API v3
 *
 * @param videoId - YouTube video ID
 * @param apiKey - YouTube Data API key
 * @param elShowLoading - Element to show loading progress
 * @param signal - AbortSignal for cancellation
 * @param container - Optional existing comments array to append to
 * @param maxComments - Maximum number of comments to fetch (default: 500000)
 * @returns Promise resolving to comments result
 */
export async function getAllCommentsYouTubeApi(
    videoId: string,
    apiKey: string,
    elShowLoading: HTMLElement,
    signal: AbortSignal | undefined,
    container: CommentItem[] = [],
    maxComments = 500000
): Promise<YouTubeApiCommentsResult> {
    const comments: CommentItem[] = container;
    let pageToken: string | undefined;

    // Shared state for tracking across async operations
    const fetchState: FetchState = {
        quotaUsed: 0,
        maxComments,
        signal
    };

    // Queue for fetching additional replies (when thread has more than inline replies)
    const replyQueue = new PQueue({ concurrency: 4 });
    const replyPromises: Promise<void>[] = [];

    try {
        // Fetch comment threads page by page
        do {
            if (signal?.aborted) {
                break;
            }

            // Check if we've reached the limit
            if (comments.length >= maxComments) {
                break;
            }

            // Fetch a page of comment threads
            const response = await fetchCommentThreads(videoId, apiKey, pageToken, signal);
            fetchState.quotaUsed += 1; // commentThreads.list costs 1 unit

            // Process each thread
            for (const thread of response.items) {
                // Check limit before adding each comment
                if (comments.length >= maxComments) {
                    break;
                }

                // Transform thread to CommentItems
                const threadItems = transformThreadToCommentItems(thread, videoId);
                const parentItem = threadItems[0];

                // Add parent comment
                comments.push(parentItem);

                // Add inline replies (YouTube API includes up to 5 replies in the thread response)
                const inlineReplies = threadItems.slice(1);
                for (const reply of inlineReplies) {
                    if (comments.length >= maxComments) {
                        break;
                    }
                    comments.push(reply);
                }

                // Check if we need to fetch additional replies
                const totalReplyCount = thread.snippet.totalReplyCount;
                const inlineReplyCount = thread.replies?.comments?.length ?? 0;

                if (totalReplyCount > inlineReplyCount && comments.length < maxComments) {
                    // Queue fetching of remaining replies
                    const parentId = thread.snippet.topLevelComment.id;

                    const replyPromise = replyQueue.add(async () => {
                        await fetchAllReplies(parentId, apiKey, videoId, parentItem, comments, fetchState);
                    });

                    replyPromises.push(replyPromise as Promise<void>);
                }
            }

            // Update loading indicator
            showLoadComments(comments.length, elShowLoading);

            // Get next page token
            pageToken = response.nextPageToken;
        } while (pageToken && comments.length < maxComments && !signal?.aborted);

        // Wait for all reply fetches to complete
        await Promise.all(replyPromises);
        await replyQueue.onIdle();

        // Assign indices sequentially after all fetching completes
        // This ensures correct ordering regardless of async completion order
        for (let idx = 0; idx < comments.length; idx++) {
            comments[idx]._index = idx;
        }

        // Final count update
        showLoadComments(comments.length, elShowLoading);

        return {
            comments,
            quotaUsed: fetchState.quotaUsed,
            totalCount: comments.length
        };
    } catch (error) {
        // Re-throw YouTubeDataApiError for proper handling upstream
        if (error instanceof YouTubeDataApiError) {
            throw error;
        }

        // Handle abort
        if (error instanceof DOMException && error.name === 'AbortError') {
            return {
                comments,
                quotaUsed: fetchState.quotaUsed,
                totalCount: comments.length
            };
        }

        // Re-throw other errors
        throw error;
    }
}

/**
 * Fetch all replies for a parent comment
 *
 * Uses comments.length for unique indices and respects maxComments limit.
 *
 * @param parentId - Parent comment ID
 * @param apiKey - YouTube Data API key
 * @param videoId - Video ID for transformation
 * @param parentItem - Parent CommentItem for linking
 * @param comments - Comments array to append to (shared, used for unique indices)
 * @param fetchState - Shared state for quota tracking and limits
 */
async function fetchAllReplies(
    parentId: string,
    apiKey: string,
    videoId: string,
    parentItem: CommentItem,
    comments: CommentItem[],
    fetchState: FetchState
): Promise<void> {
    let pageToken: string | undefined;

    do {
        if (fetchState.signal?.aborted) {
            break;
        }

        // Check maxComments limit before fetching more replies
        if (comments.length >= fetchState.maxComments) {
            break;
        }

        try {
            const response = await fetchCommentReplies(parentId, apiKey, pageToken, fetchState.signal);
            fetchState.quotaUsed += 1; // comments.list costs 1 unit

            // Transform and add replies
            for (const apiComment of response.items) {
                // Check limit before adding each reply
                if (comments.length >= fetchState.maxComments) {
                    break;
                }

                const replyItem = transformReplyToCommentItem(apiComment, videoId, parentItem);
                comments.push(replyItem);
            }

            pageToken = response.nextPageToken;
        } catch (error) {
            // Log error but don't fail the entire operation
            console.error(`[YCS] Failed to fetch replies for ${parentId}:`, error);
            break;
        }
    } while (pageToken && comments.length < fetchState.maxComments && !fetchState.signal?.aborted);
}
