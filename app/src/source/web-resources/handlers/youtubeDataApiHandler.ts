/**
 * YouTube Data API Handler Module
 *
 * Handles communication with background service worker for YouTube Data API v3 requests.
 * API key is securely stored in background and never exposed to the web page.
 */

import type { CommentItem, YouTubeApiComment } from '../../utils/interfaces/i_types';

/**
 * Result type for YouTube API comments request
 */
export interface YouTubeApiCommentsResult {
    comments: CommentItem[];
    quotaUsed: number;
    incomplete: boolean;
    replyFetchErrors: number;
}

/**
 * Error class for YouTube API message-based errors
 */
export class YouTubeApiMessageError extends Error {
    type: string;
    code?: number;
    partialComments?: CommentItem[];

    constructor(type: string, message: string, partialComments?: CommentItem[], code?: number) {
        super(message);
        this.name = 'YouTubeApiMessageError';
        this.type = type;
        this.code = code;
        this.partialComments = partialComments;
    }

    get isQuotaExceeded(): boolean {
        return this.type === 'quotaExceeded';
    }

    get isInvalidApiKey(): boolean {
        return this.type === 'invalidApiKey';
    }

    get isUnsupported(): boolean {
        return this.type === 'unsupported';
    }
}

// Global timeout for request-level safety (5 minutes)
// Prevents Promise from never settling if background SW crashes or postMessage never returns
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

interface BackgroundRequestContext<T> {
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
    cleanup: () => void;
}

/**
 * Shared postMessage plumbing for background service worker requests:
 * requestId correlation, abort forwarding with 3s grace period, global timeout,
 * and listener cleanup. Message-specific handling is delegated to `onMessage`.
 */
function sendBackgroundRequest<T>(config: {
    startType: string;
    abortType: string;
    startBody: Record<string, unknown>;
    signal: AbortSignal | undefined;
    timeoutMessage: string;
    onMessage: (data: MessageEvent['data'], ctx: BackgroundRequestContext<T>) => void;
}): Promise<T> {
    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
        // Timer ID for abort timeout cleanup
        let abortTimeoutId: ReturnType<typeof setTimeout> | undefined;
        // Timer ID for global request timeout (const because it's set once and cleared via cleanup)
        const globalTimeoutId: { current: ReturnType<typeof setTimeout> | undefined } = { current: undefined };

        // Cleanup helper - clears all timeouts and removes listeners
        const cleanup = (): void => {
            if (abortTimeoutId) clearTimeout(abortTimeoutId);
            if (globalTimeoutId.current) clearTimeout(globalTimeoutId.current);
            config.signal?.removeEventListener('abort', abortHandler);
            window.removeEventListener('message', handleMessage);
        };

        // Named abort handler for proper cleanup on Promise settle
        const abortHandler = (): void => {
            // Clear global timeout to prevent it from firing after abort
            if (globalTimeoutId.current) {
                clearTimeout(globalTimeoutId.current);
                globalTimeoutId.current = undefined;
            }

            window.postMessage(
                {
                    type: config.abortType,
                    body: { requestId }
                },
                window.location.origin
            );
            // Don't reject immediately - wait for background to send partial results
            // Safety timeout: if background doesn't respond within 3 seconds, reject
            abortTimeoutId = setTimeout(() => {
                window.removeEventListener('message', handleMessage);
                reject(new DOMException('Aborted', 'AbortError'));
            }, 3000);
        };

        const handleMessage = (e: MessageEvent): void => {
            if (e.source !== window || e.origin !== window.location.origin) return;
            if (e.data?.body?.requestId !== requestId) return;

            config.onMessage(e.data, { resolve, reject, cleanup });
        };

        window.addEventListener('message', handleMessage);

        // Handle external abort signal (once: true as additional safety)
        config.signal?.addEventListener('abort', abortHandler, { once: true });

        // Global timeout: reject if no response within REQUEST_TIMEOUT_MS
        // This prevents Promise from never settling if background SW crashes
        globalTimeoutId.current = setTimeout(() => {
            cleanup();
            reject(new Error(config.timeoutMessage));
        }, REQUEST_TIMEOUT_MS);

        // Send start request
        window.postMessage(
            {
                type: config.startType,
                body: { ...config.startBody, requestId }
            },
            window.location.origin
        );
    });
}

/**
 * Request YouTube API comments via background service worker
 * API key is securely stored in background, never exposed to web page
 */
export function requestYouTubeApiComments(
    videoId: string,
    signal: AbortSignal | undefined,
    maxComments: number | undefined,
    onProgress: (count: number) => void
): Promise<YouTubeApiCommentsResult> {
    // Chunk accumulation for large payloads
    const receivedChunks: CommentItem[][] = [];

    return sendBackgroundRequest<YouTubeApiCommentsResult>({
        startType: 'YCS_YT_API_COMMENTS_START',
        abortType: 'YCS_YT_API_COMMENTS_ABORT',
        startBody: { videoId, maxComments },
        signal,
        timeoutMessage: `YouTube API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
        onMessage: (data, { resolve, reject, cleanup }) => {
            switch (data.type) {
                case 'YCS_YT_API_COMMENTS_PROGRESS':
                    onProgress(data.body.totalCount);
                    break;

                case 'YCS_YT_API_COMMENTS_CHUNK': {
                    const { comments, chunkIndex, isLastChunk, isError, error } = data.body;
                    receivedChunks[chunkIndex] = comments;

                    if (isLastChunk) {
                        // All chunks received - flatten and resolve/reject
                        const allComments: CommentItem[] = [];
                        for (const chunk of receivedChunks) {
                            if (chunk) allComments.push(...chunk);
                        }
                        cleanup();

                        if (isError && error) {
                            // Error with partial comments
                            reject(new YouTubeApiMessageError(error.type, error.message, allComments, error.code));
                        } else {
                            // Success
                            resolve({
                                comments: allComments,
                                quotaUsed: data.body.quotaUsed || 0,
                                incomplete: data.body.incomplete || false,
                                replyFetchErrors: data.body.replyFetchErrors || 0
                            });
                        }
                    }
                    break;
                }

                // Keep for backward compatibility (small payloads may still use this)
                case 'YCS_YT_API_COMMENTS_COMPLETE':
                    cleanup();
                    resolve({
                        comments: data.body.comments,
                        quotaUsed: data.body.quotaUsed,
                        incomplete: data.body.incomplete || false,
                        replyFetchErrors: data.body.replyFetchErrors || 0
                    });
                    break;

                case 'YCS_YT_API_COMMENTS_ERROR': {
                    cleanup();
                    const error = data.body.error;
                    reject(
                        new YouTubeApiMessageError(error.type, error.message, data.body.partialComments, error.code)
                    );
                    break;
                }
            }
        }
    });
}

export interface InstantSearchResponse {
    items: CommentItem[];
    nextPageToken?: string;
    totalResults?: number;
}

export function requestYouTubeApiCommentSearch(options: {
    videoId: string;
    searchTerms: string;
    pageToken?: string;
    signal?: AbortSignal;
}): Promise<InstantSearchResponse> {
    return sendBackgroundRequest<InstantSearchResponse>({
        startType: 'YCS_YT_API_SEARCH_START',
        abortType: 'YCS_YT_API_SEARCH_ABORT',
        startBody: {
            videoId: options.videoId,
            searchTerms: options.searchTerms,
            pageToken: options.pageToken
        },
        signal: options.signal,
        timeoutMessage: `YouTube API search request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
        onMessage: (data, { resolve, reject, cleanup }) => {
            switch (data.type) {
                case 'YCS_YT_API_SEARCH_RESULT':
                    cleanup();
                    if (options.signal?.aborted) {
                        reject(new DOMException('Aborted', 'AbortError'));
                        return;
                    }
                    resolve({
                        items: data.body.items,
                        nextPageToken: data.body.nextPageToken,
                        totalResults: data.body.totalResults
                    });
                    break;

                case 'YCS_YT_API_SEARCH_ERROR': {
                    cleanup();
                    if (data.body.aborted) {
                        reject(new DOMException('Aborted', 'AbortError'));
                        return;
                    }
                    const err = new Error(data.body.error);
                    (err as Error & { isQuotaExceeded: boolean }).isQuotaExceeded = data.body.isQuotaExceeded;
                    reject(err);
                    break;
                }
            }
        }
    });
}

/**
 * Response for an on-demand reply fetch: raw `youtube#comment` resources for a single parent
 * comment, across ALL pages of `comments.list?parentId=`. Transformation into `CommentItem`
 * happens page-side (the real parent `CommentItem` only exists there) via
 * `transformReplyToCommentItem`.
 */
export interface RepliesResponse {
    items: YouTubeApiComment[];
    quotaUsed: number;
}

/**
 * Request all remaining replies for a single comment thread via background service worker.
 * Used when instant search results only carry the Data API's inline reply subset (<=5) and the
 * user expands a thread whose true `replyCount` is higher. API key never leaves the background.
 */
export function requestYouTubeApiCommentReplies(options: {
    videoId: string;
    parentId: string;
    signal?: AbortSignal;
}): Promise<RepliesResponse> {
    return sendBackgroundRequest<RepliesResponse>({
        startType: 'YCS_YT_API_REPLIES_START',
        abortType: 'YCS_YT_API_REPLIES_ABORT',
        startBody: {
            videoId: options.videoId,
            parentId: options.parentId
        },
        signal: options.signal,
        timeoutMessage: `YouTube API replies request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
        onMessage: (data, { resolve, reject, cleanup }) => {
            switch (data.type) {
                case 'YCS_YT_API_REPLIES_RESULT':
                    cleanup();
                    if (options.signal?.aborted) {
                        reject(new DOMException('Aborted', 'AbortError'));
                        return;
                    }
                    resolve({
                        items: data.body.items,
                        quotaUsed: data.body.quotaUsed ?? 0
                    });
                    break;

                case 'YCS_YT_API_REPLIES_ERROR': {
                    cleanup();
                    if (data.body.aborted) {
                        reject(new DOMException('Aborted', 'AbortError'));
                        return;
                    }
                    const err = new Error(data.body.error);
                    (err as Error & { isQuotaExceeded: boolean }).isQuotaExceeded = data.body.isQuotaExceeded;
                    reject(err);
                    break;
                }
            }
        }
    });
}
