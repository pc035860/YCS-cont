/**
 * YouTube Data API v3 Module
 *
 * Provides functionality to fetch YouTube comments using the official YouTube Data API v3.
 * This is an alternative to the Innertube API when users provide their own API key.
 *
 * Usage:
 * ```typescript
 * import { getAllCommentsYouTubeApi, isQuotaExceeded, isInvalidApiKey } from './youtubeDataApi';
 *
 * try {
 *     const result = await getAllCommentsYouTubeApi(videoId, apiKey, el, signal, [], 10000);
 *     console.log(`Fetched ${result.totalCount} comments, used ${result.quotaUsed} quota units`);
 * } catch (error) {
 *     if (isQuotaExceeded(error)) {
 *         console.log('Quota exceeded! Try again tomorrow.');
 *     } else if (isInvalidApiKey(error)) {
 *         console.log('Invalid API key. Please check your settings.');
 *     }
 * }
 * ```
 */

// Client exports
export {
    YouTubeDataApiError,
    isQuotaExceeded,
    isInvalidApiKey,
    fetchCommentThreads,
    fetchCommentReplies
} from './client';

// Comment fetching exports
export { getAllCommentsYouTubeApi } from './comments';
export type { YouTubeApiCommentsResult } from './comments';

// Transform exports
export { transformThreadToCommentItems, transformReplyToCommentItem } from './transform';
