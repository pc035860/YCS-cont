/**
 * YouTube Data API Handler Module
 *
 * Handles communication with background service worker for YouTube Data API v3 requests.
 * API key is securely stored in background and never exposed to the web page.
 */

import type { CommentItem } from '../../utils/interfaces/i_types';

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
    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
        // Timer ID for abort timeout cleanup
        let abortTimeoutId: ReturnType<typeof setTimeout> | undefined;
        // Timer ID for global request timeout (const because it's set once and cleared via cleanup)
        const globalTimeoutId: { current: ReturnType<typeof setTimeout> | undefined } = { current: undefined };

        // Chunk accumulation for large payloads
        const receivedChunks: CommentItem[][] = [];

        // Cleanup helper - clears all timeouts and removes listeners
        const cleanup = (): void => {
            if (abortTimeoutId) clearTimeout(abortTimeoutId);
            if (globalTimeoutId.current) clearTimeout(globalTimeoutId.current);
            signal?.removeEventListener('abort', abortHandler);
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
                    type: 'YCS_YT_API_COMMENTS_ABORT',
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

            switch (e.data.type) {
                case 'YCS_YT_API_COMMENTS_PROGRESS':
                    onProgress(e.data.body.totalCount);
                    break;

                case 'YCS_YT_API_COMMENTS_CHUNK': {
                    const { comments, chunkIndex, isLastChunk, isError, error } = e.data.body;
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
                                quotaUsed: e.data.body.quotaUsed || 0,
                                incomplete: e.data.body.incomplete || false,
                                replyFetchErrors: e.data.body.replyFetchErrors || 0
                            });
                        }
                    }
                    break;
                }

                // Keep for backward compatibility (small payloads may still use this)
                case 'YCS_YT_API_COMMENTS_COMPLETE':
                    cleanup();
                    resolve({
                        comments: e.data.body.comments,
                        quotaUsed: e.data.body.quotaUsed,
                        incomplete: e.data.body.incomplete || false,
                        replyFetchErrors: e.data.body.replyFetchErrors || 0
                    });
                    break;

                case 'YCS_YT_API_COMMENTS_ERROR': {
                    cleanup();
                    const error = e.data.body.error;
                    reject(
                        new YouTubeApiMessageError(error.type, error.message, e.data.body.partialComments, error.code)
                    );
                    break;
                }
            }
        };

        window.addEventListener('message', handleMessage);

        // Handle external abort signal (once: true as additional safety)
        signal?.addEventListener('abort', abortHandler, { once: true });

        // Global timeout: reject if no response within REQUEST_TIMEOUT_MS
        // This prevents Promise from never settling if background SW crashes
        globalTimeoutId.current = setTimeout(() => {
            cleanup();
            reject(new Error(`YouTube API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`));
        }, REQUEST_TIMEOUT_MS);

        // Send start request
        window.postMessage(
            {
                type: 'YCS_YT_API_COMMENTS_START',
                body: { videoId, requestId, maxComments }
            },
            window.location.origin
        );
    });
}
