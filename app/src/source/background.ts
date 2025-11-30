import { options } from './config/options';
import { IStorageEstimate, CommentItem } from './utils/interfaces/i_types';
import { idb } from './utils/libs';
import PQueue from 'p-queue';
import { fetchCommentThreads, fetchCommentReplies, YouTubeDataApiError } from './utils/youtubeDataApi/client';
import { transformThreadToCommentItems, transformReplyToCommentItem } from './utils/youtubeDataApi/transform';

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
    maxComments: number;
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
        if (comments.length >= fetchState.maxComments) break;

        try {
            const response = await fetchCommentReplies(parentId, apiKey, pageToken, fetchState.signal);
            fetchState.quotaUsed += 1;

            for (const apiComment of response.items) {
                if (comments.length >= fetchState.maxComments) break;
                const replyItem = transformReplyToCommentItem(apiComment, videoId, parentItem);
                comments.push(replyItem);
            }

            pageToken = response.nextPageToken;
        } catch (error) {
            console.error(`[YCS Background] Failed to fetch replies for ${parentId}:`, error);
            fetchState.replyFetchErrors += 1;
            break;
        }
    } while (pageToken && comments.length < fetchState.maxComments && !fetchState.signal?.aborted);
}

/**
 * Fetch all comments for a video using YouTube Data API v3 (background version)
 */
async function fetchAllCommentsBackground(
    videoId: string,
    apiKey: string,
    tabId: number,
    requestId: string,
    signal: AbortSignal
): Promise<void> {
    const comments: CommentItem[] = [];
    let pageToken: string | undefined;
    const maxComments = 500000;

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
            if (comments.length >= maxComments) break;

            const response = await fetchCommentThreads(videoId, apiKey, pageToken, signal);
            fetchState.quotaUsed += 1;

            for (const thread of response.items) {
                if (comments.length >= maxComments) break;

                const threadItems = transformThreadToCommentItems(thread, videoId);
                const parentItem = threadItems[0];
                comments.push(parentItem);

                // Add inline replies
                const inlineReplies = threadItems.slice(1);
                for (const reply of inlineReplies) {
                    if (comments.length >= maxComments) break;
                    comments.push(reply);
                }

                // Queue additional replies if needed
                const totalReplyCount = thread.snippet.totalReplyCount;
                const inlineReplyCount = thread.replies?.comments?.length ?? 0;

                if (totalReplyCount > inlineReplyCount && comments.length < maxComments) {
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
        } while (pageToken && comments.length < maxComments && !signal.aborted);

        // Wait for all reply fetches
        await Promise.all(replyPromises);
        await replyQueue.onIdle();

        // Assign indices sequentially
        for (let idx = 0; idx < comments.length; idx++) {
            comments[idx]._index = idx;
        }

        // Send completion (with incomplete flag if any reply fetches failed)
        await safeSendMessage(tabId, {
            type: 'YCS_YT_API_COMMENTS_COMPLETE',
            body: {
                requestId,
                comments,
                totalCount: comments.length,
                quotaUsed: fetchState.quotaUsed,
                incomplete: fetchState.replyFetchErrors > 0,
                replyFetchErrors: fetchState.replyFetchErrors
            }
        });

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

        // Send error with partial results
        await safeSendMessage(tabId, {
            type: 'YCS_YT_API_COMMENTS_ERROR',
            body: {
                requestId,
                error: mapYouTubeApiError(error),
                partialComments: comments.length > 0 ? comments : undefined
            }
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

        if (message?.body && message.body.videoId) {
            // console.log('111111111 message:', message);

            const db = await idb;
            const cache = await db.get(STORE_CACHE_YCS, message.body.videoId);

            if (sender?.tab?.id) {
                if (cache) {
                    // console.log('sender TAB, cache:', sender?.tab?.id, cache);
                    chrome.tabs.sendMessage(sender.tab?.id as number, {
                        type: 'YCS_CACHE_STORAGE_GET_SEND',
                        body: cache.body
                    });
                } else {
                    const opts = await chrome.storage.local.get('autoload');

                    if (opts.autoload) {
                        // console.log('sender TAB NO CACHE! sendMessage AUTOLOAD');
                        chrome.tabs.sendMessage(sender.tab?.id as number, { type: 'YCS_AUTOLOAD' });
                    }
                }
            }
        }
    }

    if (message?.type === 'YCS_CACHE_STORAGE_SET') {
        // console.log('YCS_CACHE_STORAGE_SET BG RESPONSE [MESSAGE]: ', message);

        if (message?.body && message.body.videoId) {
            const opts = (await chrome.storage.local.get(['cache', 'autoClear'])) as {
                cache: string;
                autoClear: number;
            };

            if (!opts?.cache) return;

            const quotaBytes = opts.autoClear * 1000000 || 200 * 1000000;

            const infoUseStorage = (await navigator.storage.estimate()) as IStorageEstimate;

            const db = await idb;

            if ((infoUseStorage.usage as number) < quotaBytes) {
                await db.put(STORE_CACHE_YCS, message, message.body.videoId);
            } else if ((infoUseStorage.usage as number) >= quotaBytes) {
                await db.clear(STORE_CACHE_YCS);
                await db.put(STORE_CACHE_YCS, message, message.body.videoId);
            }
        }
    }

    // YouTube Data API: Start loading comments
    if (message?.type === 'YCS_YT_API_COMMENTS_START') {
        const { videoId, requestId } = message.body ?? {};
        const tabId = sender.tab?.id;

        if (!tabId || !videoId || !requestId) {
            console.warn('[YCS Background] Invalid YCS_YT_API_COMMENTS_START message:', message);
            return;
        }

        // Read API key from storage (secure - never sent to web page)
        const opts = await chrome.storage.local.get(['youtubeApiKey', 'youtubeApiEnabled']);
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
        fetchAllCommentsBackground(videoId, apiKey, tabId, requestId, controller.signal).then(
            () => activeYouTubeApiRequests.delete(requestId),
            () => activeYouTubeApiRequests.delete(requestId)
        );
    }

    // YouTube Data API: Abort loading
    if (message?.type === 'YCS_YT_API_COMMENTS_ABORT') {
        const { requestId } = message.body ?? {};
        const request = activeYouTubeApiRequests.get(requestId);
        if (request) {
            request.controller.abort();
            activeYouTubeApiRequests.delete(requestId);
            console.log('[YCS Background] Aborted request:', requestId);
        }
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
