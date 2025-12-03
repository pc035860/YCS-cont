/**
 * YouTube Data API v3 Client
 *
 * Provides a wrapper around the YouTube Data API v3 for fetching comments.
 * https://developers.google.com/youtube/v3/docs
 */

import type {
    YouTubeApiCommentThreadListResponse,
    YouTubeApiCommentListResponse,
    YouTubeApiError
} from '../interfaces/i_types';

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * YouTube Data API error with additional context
 */
export class YouTubeDataApiError extends Error {
    code: number;
    reason: string;
    isQuotaExceeded: boolean;
    isInvalidApiKey: boolean;
    isUnsupported: boolean;

    constructor(error: YouTubeApiError['error']) {
        super(error.message);
        this.name = 'YouTubeDataApiError';
        this.code = error.code;
        this.reason = error.errors?.[0]?.reason ?? 'unknown';
        this.isQuotaExceeded = this.reason === 'quotaExceeded' || this.reason === 'dailyLimitExceeded';
        this.isInvalidApiKey = this.code === 400 || this.reason === 'keyInvalid';
        // Unsupported: comments disabled or video not found (not forbidden - may be fixable)
        this.isUnsupported = this.reason === 'commentsDisabled' || this.reason === 'videoNotFound';
    }
}

/**
 * Check if an error is a quota exceeded error
 */
export function isQuotaExceeded(error: unknown): boolean {
    return error instanceof YouTubeDataApiError && error.isQuotaExceeded;
}

/**
 * Check if an error is an invalid API key error
 */
export function isInvalidApiKey(error: unknown): boolean {
    return error instanceof YouTubeDataApiError && error.isInvalidApiKey;
}

/**
 * Fetch comment threads for a video
 *
 * @param videoId - YouTube video ID
 * @param apiKey - YouTube Data API key
 * @param pageToken - Optional page token for pagination
 * @param signal - Optional abort signal
 * @returns Comment threads list response
 */
export async function fetchCommentThreads(
    videoId: string,
    apiKey: string,
    pageToken?: string,
    signal?: AbortSignal
): Promise<YouTubeApiCommentThreadListResponse> {
    const params = new URLSearchParams({
        part: 'snippet,replies',
        videoId: videoId,
        maxResults: '100',
        textFormat: 'html',
        key: apiKey
    });

    if (pageToken) {
        params.set('pageToken', pageToken);
    }

    const url = `${YOUTUBE_API_BASE_URL}/commentThreads?${params.toString()}`;

    const response = await fetch(url, { signal });

    if (!response.ok) {
        const errorData = (await response.json()) as YouTubeApiError;
        throw new YouTubeDataApiError(errorData.error);
    }

    return response.json() as Promise<YouTubeApiCommentThreadListResponse>;
}

/**
 * Fetch replies for a specific comment
 *
 * @param parentId - Parent comment ID
 * @param apiKey - YouTube Data API key
 * @param pageToken - Optional page token for pagination
 * @param signal - Optional abort signal
 * @returns Comments list response
 */
export async function fetchCommentReplies(
    parentId: string,
    apiKey: string,
    pageToken?: string,
    signal?: AbortSignal
): Promise<YouTubeApiCommentListResponse> {
    const params = new URLSearchParams({
        part: 'snippet',
        parentId: parentId,
        maxResults: '100',
        textFormat: 'html',
        key: apiKey
    });

    if (pageToken) {
        params.set('pageToken', pageToken);
    }

    const url = `${YOUTUBE_API_BASE_URL}/comments?${params.toString()}`;

    const response = await fetch(url, { signal });

    if (!response.ok) {
        const errorData = (await response.json()) as YouTubeApiError;
        throw new YouTubeDataApiError(errorData.error);
    }

    return response.json() as Promise<YouTubeApiCommentListResponse>;
}
