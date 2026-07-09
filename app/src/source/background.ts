import { options } from './config/options';
import { IStorageEstimate, CommentItem } from './utils/interfaces/i_types';
import { idb } from './utils/libs';
import PQueue from 'p-queue';
import {
    fetchCommentThreads,
    fetchCommentReplies,
    YouTubeDataApiError,
    isQuotaExceeded
} from './utils/youtubeDataApi/client';
import { transformThreadToCommentItems, transformReplyToCommentItem } from './utils/youtubeDataApi/transform';
import { fetchCommentSearchPage } from './utils/youtubeDataApi/search';
import { shouldSkipAutoloadFromStorage } from './web-resources/search/instantSearchGate';

// Track active YouTube API requests for abort handling
interface ActiveRequest {
    controller: AbortController;
    tabId: number;
}
const activeYouTubeApiRequests = new Map<string, ActiveRequest>();

/**
 * Shared state for tracking fetch progress across async operations
 */
interface FetchState {
    quotaUsed: number;
    maxComments: number | undefined;
    signal: AbortSignal | undefined;
    replyFetchErrors: number; // Track failed reply fetches
}

/**
 * Map YouTube Data API errors to error response format
 */
function mapYouTubeApiError(error: unknown): { type: string; message: string; code?: number } {
    if (error instanceof YouTubeDataApiError) {
        if (error.isQuotaExceeded) {
            return { type: 'quotaExceeded', message: error.message, code: error.code };
        }
        if (error.isInvalidApiKey) {
            return { type: 'invalidApiKey', message: error.message, code: error.code };
        }
        if (error.isUnsupported) {
            return { type: 'unsupported', message: error.message, code: error.code };
        }
        return { type: 'apiError', message: error.message, code: error.code };
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
        return { type: 'aborted', message: 'Request was aborted' };
    }
    return { type: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' };
}

/**
 * Safely send message to tab, returning false if tab no longer exists
 */
async function safeSendMessage(tabId: number, message: unknown): Promise<boolean> {
    try {
        await chrome.tabs.sendMessage(tabId, message);
        return true;
    } catch {
        // Tab closed or navigated away - expected behavior
        return false;
    }
}

/**
 * Chunk size for splitting large comment arrays to avoid Chrome message size limits (~50-64 MB)
 */
const CHUNK_SIZE = 20000;

/**
 * Split an array into chunks of specified size
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Send comments in chunks to avoid Chrome's runtime message size limit.
 * Returns false if any chunk fails to send (tab closed).
 */
async function sendCommentsInChunks(
    tabId: number,
    requestId: string,
    comments: CommentItem[],
    metadata: {
        quotaUsed?: number;
        incomplete?: boolean;
        replyFetchErrors?: number;
        error?: { type: string; message: string; code?: number };
        isError?: boolean;
    }
): Promise<boolean> {
    // Handle empty array case - send single chunk with empty array
    if (comments.length === 0) {
        const success = await safeSendMessage(tabId, {
            type: 'YCS_YT_API_COMMENTS_CHUNK',
            body: {
                requestId,
                comments: [],
                chunkIndex: 0,
                totalChunks: 1,
                isLastChunk: true,
                ...(metadata.quotaUsed !== undefined && { quotaUsed: metadata.quotaUsed }),
                ...(metadata.incomplete !== undefined && { incomplete: metadata.incomplete }),
                ...(metadata.replyFetchErrors !== undefined && { replyFetchErrors: metadata.replyFetchErrors }),
                ...(metadata.error && { error: metadata.error, isError: true })
            }
        });
        if (!success) {
            console.warn('[YCS Background] Failed to send empty chunk - tab may be closed');
        }
        return success;
    }

    const chunks = chunkArray(comments, CHUNK_SIZE);
    const totalChunks = chunks.length;

    for (let i = 0; i < totalChunks; i++) {
        const isLastChunk = i === totalChunks - 1;
        const success = await safeSendMessage(tabId, {
            type: 'YCS_YT_API_COMMENTS_CHUNK',
            body: {
                requestId,
                comments: chunks[i],
                chunkIndex: i,
                totalChunks,
                isLastChunk,
                // Include metadata only in last chunk
                ...(isLastChunk && {
                    ...(metadata.quotaUsed !== undefined && { quotaUsed: metadata.quotaUsed }),
                    ...(metadata.incomplete !== undefined && { incomplete: metadata.incomplete }),
                    ...(metadata.replyFetchErrors !== undefined && { replyFetchErrors: metadata.replyFetchErrors }),
                    ...(metadata.error && { error: metadata.error, isError: true })
                })
            }
        });

        if (!success) {
            console.warn(`[YCS Background] Failed to send chunk ${i + 1}/${totalChunks} - tab may be closed`);
            return false;
        }
    }

    return true;
}

/**
 * Fetch all replies for a parent comment (background version)
 */
async function fetchAllRepliesBackground(
    parentId: string,
    apiKey: string,
    videoId: string,
    parentItem: CommentItem,
    comments: CommentItem[],
    fetchState: FetchState
): Promise<void> {
    let pageToken: string | undefined;

    do {
        if (fetchState.signal?.aborted) break;
        if (fetchState.maxComments && comments.length >= fetchState.maxComments) break;

        try {
            const response = await fetchCommentReplies(parentId, apiKey, pageToken, fetchState.signal);
            fetchState.quotaUsed += 1;

            for (const apiComment of response.items) {
                if (fetchState.maxComments && comments.length >= fetchState.maxComments) break;
                const replyItem = transformReplyToCommentItem(apiComment, videoId, parentItem);
                comments.push(replyItem);
            }

            pageToken = response.nextPageToken;
        } catch (error) {
            console.error(`[YCS Background] Failed to fetch replies for ${parentId}:`, error);
            fetchState.replyFetchErrors += 1;
            break;
        }
    } while (
        pageToken &&
        (!fetchState.maxComments || comments.length < fetchState.maxComments) &&
        !fetchState.signal?.aborted
    );
}

/**
 * Fetch all comments for a video using YouTube Data API v3 (background version)
 */
async function fetchAllCommentsBackground(
    videoId: string,
    apiKey: string,
    tabId: number,
    requestId: string,
    signal: AbortSignal,
    maxComments: number | undefined
): Promise<void> {
    const comments: CommentItem[] = [];
    let pageToken: string | undefined;

    const fetchState: FetchState = {
        quotaUsed: 0,
        maxComments,
        signal,
        replyFetchErrors: 0
    };

    const replyQueue = new PQueue({ concurrency: 4 });
    const replyPromises: Promise<void>[] = [];

    try {
        do {
            if (signal.aborted) break;
            if (maxComments && comments.length >= maxComments) break;

            const response = await fetchCommentThreads(videoId, apiKey, pageToken, signal);
            fetchState.quotaUsed += 1;

            for (const thread of response.items) {
                if (maxComments && comments.length >= maxComments) break;

                const threadItems = transformThreadToCommentItems(thread, videoId);
                const parentItem = threadItems[0];
                comments.push(parentItem);

                // Add inline replies
                const inlineReplies = threadItems.slice(1);
                for (const reply of inlineReplies) {
                    if (maxComments && comments.length >= maxComments) break;
                    comments.push(reply);
                }

                // Queue additional replies if needed
                const totalReplyCount = thread.snippet.totalReplyCount;
                const inlineReplyCount = thread.replies?.comments?.length ?? 0;

                if (totalReplyCount > inlineReplyCount && (!maxComments || comments.length < maxComments)) {
                    const parentId = thread.snippet.topLevelComment.id;
                    const replyPromise = replyQueue.add(async () => {
                        await fetchAllRepliesBackground(parentId, apiKey, videoId, parentItem, comments, fetchState);
                    });
                    replyPromises.push(replyPromise as Promise<void>);
                }
            }

            // Send progress update
            const tabExists = await safeSendMessage(tabId, {
                type: 'YCS_YT_API_COMMENTS_PROGRESS',
                body: {
                    requestId,
                    totalCount: comments.length,
                    quotaUsed: fetchState.quotaUsed
                }
            });
            if (!tabExists) {
                // Tab closed or navigated away - abort controller to cancel all in-flight requests
                const request = activeYouTubeApiRequests.get(requestId);
                if (request) {
                    request.controller.abort();
                }
                return;
            }

            pageToken = response.nextPageToken;
        } while (pageToken && (!maxComments || comments.length < maxComments) && !signal.aborted);

        // Wait for all reply fetches
        await Promise.all(replyPromises);
        await replyQueue.onIdle();

        // Assign indices sequentially
        for (let idx = 0; idx < comments.length; idx++) {
            comments[idx]._index = idx;
        }

        // Send completion in chunks (handles Chrome message size limit)
        const sendSuccess = await sendCommentsInChunks(tabId, requestId, comments, {
            quotaUsed: fetchState.quotaUsed,
            incomplete: fetchState.replyFetchErrors > 0,
            replyFetchErrors: fetchState.replyFetchErrors
        });

        // If send failed (tab closed or message size exceeded), abort gracefully
        if (!sendSuccess) {
            return;
        }

        if (fetchState.replyFetchErrors > 0) {
            console.warn(
                `[YCS Background] Completed with ${fetchState.replyFetchErrors} reply fetch errors - some replies may be missing`
            );
        }
    } catch (error) {
        // Assign indices to partial results before sending
        for (let idx = 0; idx < comments.length; idx++) {
            comments[idx]._index = idx;
        }

        // Send error with partial comments (if any) using unified chunking
        await sendCommentsInChunks(tabId, requestId, comments, {
            error: mapYouTubeApiError(error)
        });
    }
}

const STORE_CACHE_YCS = 'STORE_CACHE_YCS';

chrome.runtime.onInstalled.addListener(async () => {
    const optsStorage = await chrome.storage.local.get();

    await chrome.storage.local.set({
        ...options,
        ...optsStorage
    });

    chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
        for (const tab of tabs) {
            if (tab.id) {
                try {
                    console.log('BG tab.id: ', tab.id);

                    chrome.scripting.insertCSS({
                        target: { tabId: tab.id },
                        files: ['content-scripts/style.css']
                    });

                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content-scripts/cscripts.js']
                    });
                } catch (err) {
                    console.error(err);
                }
            }
        }
    });
});

chrome.runtime.onMessage.addListener(async (message, sender) => {
    if (message?.type === 'YCS_SET_BADGE') {
        console.info('BG YCS_SET_BADGE:', message);
        chrome.action.setBadgeText({ text: message?.text?.toString(), tabId: sender.tab?.id });
        chrome.action.setBadgeBackgroundColor({ color: '#2f3640' });
    }

    if (message?.type === 'YCS_CACHE_STORAGE_GET') {
        // console.log('YCS_CACHE_STORAGE_GET BG RESPONSE [MESSAGE]: ', message);

        if (message?.body && (message.body.videoId || message.body.postId)) {
            // console.log('111111111 message:', message);

            const db = await idb;
            const cache = await db.get(STORE_CACHE_YCS, message.body.videoId ?? message.body.postId);

            if (sender?.tab?.id) {
                if (cache) {
                    // console.log('sender TAB, cache:', sender?.tab?.id, cache);
                    chrome.tabs.sendMessage(sender.tab?.id as number, {
                        type: 'YCS_CACHE_STORAGE_GET_SEND',
                        body: cache.body
                    });
                } else {
                    const opts = await chrome.storage.local.get([
                        'autoload',
                        'youtubeApiKey',
                        'youtubeApiEnabled',
                        'youtubeApiInstantSearch'
                    ]);

                    if (opts.autoload) {
                        if (!shouldSkipAutoloadFromStorage(opts)) {
                            chrome.tabs.sendMessage(sender.tab?.id as number, { type: 'YCS_AUTOLOAD' });
                        }
                    }
                }
            }
        }
    }

    if (message?.type === 'YCS_CACHE_STORAGE_SET') {
        // console.log('YCS_CACHE_STORAGE_SET BG RESPONSE [MESSAGE]: ', message);

        if (message?.body && (message.body.videoId || message.body.postId)) {
            const opts = (await chrome.storage.local.get(['cache', 'autoClear'])) as {
                cache: string;
                autoClear: number;
            };

            if (!opts?.cache) return;

            const quotaBytes = opts.autoClear * 1000000 || 200 * 1000000;

            const infoUseStorage = (await navigator.storage.estimate()) as IStorageEstimate;

            const db = await idb;

            if ((infoUseStorage.usage as number) < quotaBytes) {
                await db.put(STORE_CACHE_YCS, message, message.body.videoId ?? message.body.postId);
            } else if ((infoUseStorage.usage as number) >= quotaBytes) {
                await db.clear(STORE_CACHE_YCS);
                await db.put(STORE_CACHE_YCS, message, message.body.videoId ?? message.body.postId);
            }
        }
    }

    // YouTube Data API: Start loading comments
    if (message?.type === 'YCS_YT_API_COMMENTS_START') {
        const { videoId, requestId, maxComments } = message.body ?? {};
        const tabId = sender.tab?.id;

        if (!tabId || !videoId || !requestId) {
            console.warn('[YCS Background] Invalid YCS_YT_API_COMMENTS_START message:', message);
            return;
        }

        // Read API key from storage (secure - never sent to web page)
        const opts = await chrome.storage.local.get(['youtubeApiKey', 'youtubeApiEnabled', 'maxComments']);
        const apiKey = (opts.youtubeApiKey as string)?.trim();
        const apiEnabled = opts.youtubeApiEnabled !== false;

        if (!apiKey || !apiEnabled) {
            chrome.tabs.sendMessage(tabId, {
                type: 'YCS_YT_API_COMMENTS_ERROR',
                body: {
                    requestId,
                    error: { type: 'invalidApiKey', message: 'API key not configured or disabled' }
                }
            });
            return;
        }

        // Create AbortController for this request
        const controller = new AbortController();
        activeYouTubeApiRequests.set(requestId, { controller, tabId });

        // Execute fetch (non-blocking)
        fetchAllCommentsBackground(videoId, apiKey, tabId, requestId, controller.signal, maxComments).then(
            () => activeYouTubeApiRequests.delete(requestId),
            () => activeYouTubeApiRequests.delete(requestId)
        );
    }

    // YouTube Data API: Abort loading or instant search
    if (message?.type === 'YCS_YT_API_COMMENTS_ABORT' || message?.type === 'YCS_YT_API_SEARCH_ABORT') {
        const { requestId } = message.body ?? {};
        const request = activeYouTubeApiRequests.get(requestId);
        if (request) {
            request.controller.abort();
            activeYouTubeApiRequests.delete(requestId);
            console.log('[YCS Background] Aborted request:', requestId);
        }
    }

    // YouTube Data API: Instant search (single page)
    if (message?.type === 'YCS_YT_API_SEARCH_START') {
        const { videoId, searchTerms, pageToken, requestId } = message.body ?? {};
        const tabId = sender.tab?.id;

        if (!tabId || !videoId || typeof searchTerms !== 'string' || !searchTerms.trim() || !requestId) {
            console.warn('[YCS Background] Invalid YCS_YT_API_SEARCH_START message:', message);
            if (tabId && requestId) {
                chrome.tabs.sendMessage(tabId, {
                    type: 'YCS_YT_API_SEARCH_ERROR',
                    body: {
                        requestId,
                        error: 'Invalid search request',
                        isQuotaExceeded: false
                    }
                });
            }
            return;
        }

        const opts = await chrome.storage.local.get(['youtubeApiKey', 'youtubeApiEnabled']);
        const apiKey = (opts.youtubeApiKey as string)?.trim();
        const apiEnabled = opts.youtubeApiEnabled !== false;

        if (!apiKey || !apiEnabled) {
            chrome.tabs.sendMessage(tabId, {
                type: 'YCS_YT_API_SEARCH_ERROR',
                body: {
                    requestId,
                    error: 'API key not configured or disabled',
                    isQuotaExceeded: false
                }
            });
            return;
        }

        const controller = new AbortController();
        activeYouTubeApiRequests.set(requestId, { controller, tabId });

        (async () => {
            try {
                const result = await fetchCommentSearchPage({
                    videoId,
                    searchTerms,
                    apiKey,
                    pageToken,
                    signal: controller.signal
                });

                if (controller.signal.aborted) return;

                await safeSendMessage(tabId, {
                    type: 'YCS_YT_API_SEARCH_RESULT',
                    body: {
                        requestId,
                        items: result.items,
                        nextPageToken: result.nextPageToken,
                        totalResults: result.totalResults
                    }
                });
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') {
                    await safeSendMessage(tabId, {
                        type: 'YCS_YT_API_SEARCH_ERROR',
                        body: {
                            requestId,
                            error: 'Request was aborted',
                            isQuotaExceeded: false,
                            aborted: true
                        }
                    });
                    return;
                }

                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                await safeSendMessage(tabId, {
                    type: 'YCS_YT_API_SEARCH_ERROR',
                    body: {
                        requestId,
                        error: errorMessage,
                        isQuotaExceeded: isQuotaExceeded(error)
                    }
                });
            } finally {
                activeYouTubeApiRequests.delete(requestId);
            }
        })();
    }
});

// Abort all YouTube API requests when tab closes
chrome.tabs.onRemoved.addListener((closedTabId: number) => {
    for (const [requestId, request] of activeYouTubeApiRequests) {
        if (request.tabId === closedTabId) {
            request.controller.abort();
            activeYouTubeApiRequests.delete(requestId);
            console.log('[YCS Background] Aborted request due to tab close:', requestId);
        }
    }
});
