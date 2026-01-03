import { showLoadComments } from '../dom';
import { fetchR } from '../libs';
import { deepFindObjKey, getCleanUrlVideo, getVideoId, wrapTryCatch } from '../common';
import type { ChatContinuationResult } from '../interfaces/i_assist';
import { buildInnertubeBody, buildInnertubeHeaders } from './request';
import { processLiveChatActions } from './chat/liveChat';
import { processReplayBatch } from './chat/replayChat';
import type { ChatProcessingContext } from './chat/utils';
import { getInitYtData, getInnertubeApiKey, getPageCfgData, type InnertubeRequestParams } from './core';

/**
 * Result of a live chat fetch operation
 * Used to distinguish between success, HTTP errors, and parse errors
 */
export interface LiveChatFetchResult {
    data?: any;
    success: boolean;
    httpStatus: number;
    errorType?: 'http_error' | 'parse_error' | 'network_error';
}

/**
 * Result of a live chat poll operation
 * Used by pollLiveChat to provide detailed status to caller
 */
export interface LiveChatPollResult {
    /** Next continuation token (null if stream ended or error) */
    continuation: unknown;
    /** Whether the live stream has ended normally */
    isLiveEnded: boolean;
    /** Whether the poll was successful */
    success: boolean;
    /** Error type if unsuccessful */
    errorType?: 'http_error' | 'token_stale' | 'network_error' | 'parse_error';
    /** HTTP status code (if applicable) */
    httpStatus?: number;
}

export async function getParamsForChat(
    globalContext: Window & typeof globalThis,
    cLiveChat: any,
    signal?: AbortSignal,
    useLegacyApi = false,
    playerOffsetMs = 0,
    usePlayerSeek = false
): Promise<InnertubeRequestParams | undefined> {
    if (!cLiveChat) return undefined;

    try {
        const ytcfgData = await getPageCfgData(globalContext, signal);
        const referrer = getCleanUrlVideo(globalContext.location.href) ?? globalContext.location.href;

        if (!ytcfgData) {
            return undefined;
        }

        const bodyPayload = buildInnertubeBody({
            ytcfgData,
            continuation: cLiveChat.continuation,
            currentPlayerState:
                useLegacyApi || usePlayerSeek
                    ? {
                          playerOffsetMs: playerOffsetMs.toString()
                      }
                    : undefined
        });

        return {
            headers: buildInnertubeHeaders(ytcfgData, {}, globalContext),
            referrerPolicy: 'strict-origin-when-cross-origin',
            referrer,
            body: JSON.stringify(bodyPayload),
            method: 'POST',
            mode: 'cors',
            credentials: 'include'
        };
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

async function getParamsForLiveChat(
    globalContext: Window & typeof globalThis,
    cLiveChat: any,
    signal?: AbortSignal
): Promise<InnertubeRequestParams | undefined> {
    if (!cLiveChat) return undefined;

    try {
        const ytcfgData = await getPageCfgData(globalContext, signal);
        const referrer = getCleanUrlVideo(globalContext.location.href) ?? globalContext.location.href;

        if (!ytcfgData) {
            return undefined;
        }

        return {
            headers: buildInnertubeHeaders(ytcfgData, {}, globalContext),
            referrerPolicy: 'strict-origin-when-cross-origin',
            referrer,
            body: JSON.stringify(
                buildInnertubeBody({
                    ytcfgData,
                    continuation: cLiveChat.continuation
                })
            ),
            method: 'POST',
            mode: 'cors',
            credentials: 'include'
        };
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

async function getCDChat(signal: AbortSignal): Promise<ChatContinuationResult> {
    try {
        const ytData = (await getInitYtData(window.location.href, signal)) as any;

        if (ytData) {
            const newApiData = wrapTryCatch(
                () =>
                    ytData.response.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.continuations[0]
                        .reloadContinuationData
            );

            if (newApiData) {
                return {
                    continuationData: newApiData,
                    apiVersion: 'new',
                    sourcePath: 'continuations[0].reloadContinuationData'
                };
            }

            const oldApiData = wrapTryCatch(
                () =>
                    ytData[3].response.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.header
                        .liveChatHeaderRenderer.viewSelector.sortFilterSubMenuRenderer.subMenuItems[1].continuation
                        .reloadContinuationData
            );

            if (oldApiData) {
                return {
                    continuationData: oldApiData,
                    apiVersion: 'old',
                    sourcePath:
                        '[3].response.header.viewSelector.sortFilterSubMenuRenderer.subMenuItems[1].continuation.reloadContinuationData'
                };
            }

            const rCData = deepFindObjKey(ytData, 'reloadContinuationData');
            if (rCData.length > 0) {
                const fallbackData = Object.values(rCData[rCData.length - 1])[0] as object;
                return {
                    continuationData: fallbackData,
                    apiVersion: 'fallback',
                    sourcePath: 'deepSearch(reloadContinuationData)'
                };
            }
        }

        return {
            continuationData: null,
            apiVersion: 'fallback',
            sourcePath: undefined
        };
    } catch (e) {
        console.error(e);
        return {
            continuationData: null,
            apiVersion: 'fallback',
            sourcePath: undefined
        };
    }
}

async function getLiveChat(continuationData: any, signal: AbortSignal): Promise<LiveChatFetchResult> {
    try {
        if (!continuationData) {
            console.log('[YCS] getLiveChat: No continuation data available');
            return { success: false, httpStatus: 0, errorType: 'parse_error' };
        }

        const params = await getParamsForLiveChat(window, continuationData, signal);

        if (!params) {
            console.log('[YCS] getLiveChat: Failed to build request params');
            return { success: false, httpStatus: 0, errorType: 'parse_error' };
        }

        const res = await fetch(
            `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${getInnertubeApiKey()}`,
            { ...params, signal, cache: 'no-store' }
        );

        // Check HTTP status before parsing - 400/403 typically indicate stale token
        if (!res.ok) {
            console.warn(`[YCS] getLiveChat HTTP error: ${res.status} ${res.statusText}`);
            return {
                success: false,
                httpStatus: res.status,
                errorType: 'http_error'
            };
        }

        const cmnts = await res.json();
        const liveChatData = cmnts?.continuationContents?.liveChatContinuation;

        return {
            data: liveChatData,
            success: true,
            httpStatus: res.status
        };
    } catch (e) {
        // Network errors, AbortError, or JSON parse errors
        const isAbort = e instanceof DOMException && e.name === 'AbortError';
        if (!isAbort) {
            console.error('[YCS] getLiveChat error:', e);
        }
        return {
            success: false,
            httpStatus: 0,
            errorType: 'network_error'
        };
    }
}

export async function getChatComments(
    signal: AbortSignal,
    elShowLoading: HTMLElement,
    container: Map<number, object> | undefined = undefined
): Promise<Map<number, object> | undefined> {
    try {
        const result = await getCDChat(signal);
        if (!result.continuationData) {
            console.log('STOP CHAT CD!!!! No continuation data available');
            return undefined;
        }

        console.log('[getChatComments] continuationData', result.continuationData);

        const continuationData = result.continuationData;
        const useLegacyApi = result.apiVersion === 'old';

        console.log(`[getChatComments] Detected API version: ${result.apiVersion}`);
        console.log(`[getChatComments] Source path: ${result.sourcePath}`);

        const chatCmnts = container || new Map<number, object>();
        const currentVideoId = (getVideoId(window.location.href) || undefined) as string | undefined;

        // Fetch broadcast start time for live chat videoOffsetTimeMsec calculation
        const broadcastStartTime = await getLiveBroadcastStartTime(signal);
        if (broadcastStartTime) {
            console.log(`[getChatComments] Broadcast start time: ${broadcastStartTime}`);
        }

        const context: ChatProcessingContext = {
            chatMap: chatCmnts,
            currentVideoId,
            broadcastStartTime: broadcastStartTime ?? undefined,
            onCommentAdded: (count: number) => showLoadComments(count, elShowLoading)
        };

        const fetchResult = await getLiveChat(result.continuationData, signal);

        if (fetchResult.success && fetchResult.data?.actions?.length > 0) {
            console.log('IS LIVECHAT!!!!!', fetchResult.data);
            processLiveChatActions(fetchResult.data.actions, context);
            return chatCmnts;
        }

        if (useLegacyApi) {
            let currentOffsetTimeMsec = 0;
            let next = true;

            while (next) {
                const params = await getParamsForChat(window, continuationData, signal, true, currentOffsetTimeMsec);

                if (!params) {
                    next = false;
                    break;
                }

                const res = await fetchR(
                    `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?key=${getInnertubeApiKey()}`,
                    { ...params, signal, cache: 'no-store' }
                );

                if (!res.ok) {
                    console.warn(`[YCS] chat replay HTTP error (legacy): ${res.status} ${res.statusText}`);
                    break;
                }

                const response = await res.json();
                const cmnts = response?.continuationContents?.liveChatContinuation?.actions;

                if (cmnts && cmnts.length > 0) {
                    const lastOffsetTimeInCmnts = wrapTryCatch(() => {
                        const offsetData = deepFindObjKey(cmnts[cmnts.length - 1], 'videoOffsetTimeMsec')[0];
                        return (Object as any).entries(offsetData)[0][1];
                    }) as number | undefined;

                    if (currentOffsetTimeMsec === lastOffsetTimeInCmnts) {
                        next = false;
                        break;
                    }

                    processReplayBatch(cmnts, context);

                    if (lastOffsetTimeInCmnts !== undefined) {
                        currentOffsetTimeMsec = lastOffsetTimeInCmnts;
                    }
                } else {
                    next = false;
                }
            }

            return chatCmnts;
        }

        // Stage 1: Fetch initial response to get playerSeekContinuationData
        let playerSeekToken: any = null;
        let usePlayerSeekMode = true;

        {
            console.log('Fetching initial playerSeekContinuationData (New API)');
            const params = await getParamsForChat(window, continuationData, signal, false);

            if (!params) {
                console.error('Failed to get initial params');
                return chatCmnts;
            }

            const res = await fetchR(
                `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?prettyPrint=false`,
                {
                    ...params,
                    signal,
                    cache: 'no-store'
                }
            );

            if (!res.ok) {
                // Stage 1 failure → terminate entire flow (Stage 2 requires token from here)
                console.warn(`[YCS] chat replay HTTP error (initial): ${res.status} ${res.statusText}`);
                return chatCmnts;
            }

            const response = await res.json();
            const continuations = response?.continuationContents?.liveChatContinuation?.continuations;

            // Try to extract playerSeekContinuationData
            const playerSeekData = continuations?.find(
                (c: any) => c.playerSeekContinuationData
            )?.playerSeekContinuationData;

            if (playerSeekData?.continuation) {
                playerSeekToken = { continuation: playerSeekData.continuation };
                console.log('Got initial playerSeekContinuationData, using playerOffsetMs mode');
            } else {
                // Fallback: use liveChatReplayContinuationData
                console.warn(
                    'No playerSeekContinuationData found, falling back to liveChatReplayContinuationData mode'
                );
                const liveChatReplayData = continuations?.find(
                    (c: any) => c.liveChatReplayContinuationData
                )?.liveChatReplayContinuationData;

                if (liveChatReplayData?.continuation) {
                    // Process the first batch of actions before starting the fallback loop
                    const firstBatchActions = response?.continuationContents?.liveChatContinuation?.actions;
                    if (Array.isArray(firstBatchActions) && firstBatchActions.length > 0) {
                        console.log('Processing first batch in fallback mode:', firstBatchActions.length, 'actions');
                        processReplayBatch(firstBatchActions, context);
                    }

                    playerSeekToken = { continuation: liveChatReplayData.continuation };
                    usePlayerSeekMode = false;
                } else {
                    console.error('No continuation data found in initial response');
                    return chatCmnts;
                }
            }
        }

        // Stage 2: Iterate using playerSeek + playerOffsetMs or fallback mode
        if (usePlayerSeekMode) {
            // New mode: playerSeek + playerOffsetMs (similar to legacy API)
            let currentOffsetTimeMsec = 0;
            let next = true;

            while (next) {
                const params = await getParamsForChat(
                    window,
                    playerSeekToken,
                    signal,
                    false,
                    currentOffsetTimeMsec,
                    true // usePlayerSeek = true
                );

                if (!params) {
                    next = false;
                    break;
                }

                const res = await fetchR(
                    `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?prettyPrint=false`,
                    {
                        ...params,
                        signal,
                        cache: 'no-store'
                    }
                );

                if (!res.ok) {
                    console.warn(`[YCS] chat replay HTTP error (playerSeek): ${res.status} ${res.statusText}`);
                    break;
                }

                const response = await res.json();
                const cmnts = response?.continuationContents?.liveChatContinuation?.actions;

                if (Array.isArray(cmnts) && cmnts.length > 0) {
                    // Extract last offset time
                    const lastOffsetTimeInCmnts = wrapTryCatch(() => {
                        const offsetData = deepFindObjKey(cmnts[cmnts.length - 1], 'videoOffsetTimeMsec')[0];
                        return (Object as any).entries(offsetData)[0][1];
                    }) as number | undefined;

                    // Check termination condition
                    if (currentOffsetTimeMsec === lastOffsetTimeInCmnts) {
                        next = false;
                        break;
                    }

                    processReplayBatch(cmnts, context);

                    // Update offset
                    if (lastOffsetTimeInCmnts !== undefined) {
                        currentOffsetTimeMsec = lastOffsetTimeInCmnts;
                    }

                    // Update playerSeekToken
                    const continuations = response?.continuationContents?.liveChatContinuation?.continuations;
                    const playerSeekData = continuations?.find(
                        (c: any) => c.playerSeekContinuationData
                    )?.playerSeekContinuationData;

                    if (playerSeekData?.continuation) {
                        playerSeekToken = { continuation: playerSeekData.continuation };
                    } else {
                        console.warn('[YCS] No playerSeekContinuationData in response, stopping');
                        next = false;
                        break;
                    }
                } else {
                    next = false;
                }
            }
        } else {
            // Fallback mode: use liveChatReplayContinuationData (old logic)
            let nextContinuation: any = playerSeekToken;

            while (nextContinuation) {
                const params = await getParamsForChat(window, nextContinuation, signal, false);

                if (!params) break;

                const res = await fetchR(
                    `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?prettyPrint=false`,
                    {
                        ...params,
                        signal,
                        cache: 'no-store'
                    }
                );

                if (!res.ok) {
                    console.warn(`[YCS] chat replay HTTP error (fallback): ${res.status} ${res.statusText}`);
                    break;
                }

                const response = await res.json();
                const cmnts = response?.continuationContents?.liveChatContinuation?.actions;

                if (Array.isArray(cmnts) && cmnts.length > 0) {
                    processReplayBatch(cmnts, context);
                }

                const continuations = response?.continuationContents?.liveChatContinuation?.continuations;
                const continuationToken = continuations?.find((c: any) => c.liveChatReplayContinuationData)
                    ?.liveChatReplayContinuationData?.continuation;

                if (continuationToken) {
                    nextContinuation = { continuation: continuationToken };
                } else {
                    break;
                }
            }
        }

        return chatCmnts;
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

/**
 * Check if current video is a live stream (ongoing broadcast)
 * Live streams use invalidationContinuationData, replays use timedContinuationData
 * @returns true if live stream, false if replay or non-live
 */
export async function checkIsLiveStream(signal?: AbortSignal): Promise<boolean> {
    try {
        const result = await getCDChat(signal as AbortSignal);
        if (!result.continuationData) return false;

        const fetchResult = await getLiveChat(result.continuationData, signal as AbortSignal);

        // Check if fetch was successful
        if (!fetchResult.success || !fetchResult.data) return false;

        const liveChatData = fetchResult.data;

        // Live streams have actions with invalidationContinuationData
        if (liveChatData?.actions?.length > 0) {
            const continuations = liveChatData?.continuations;
            const hasInvalidationContinuation = continuations?.some((c: any) => c.invalidationContinuationData);
            return hasInvalidationContinuation === true;
        }

        return false;
    } catch (e) {
        console.error('[YCS] checkIsLiveStream error:', e);
        return false;
    }
}

/**
 * Get broadcast start timestamp from playerResponse
 * Path: playerResponse.microformat.playerMicroformatRenderer.liveBroadcastDetails.startTimestamp
 * @returns ISO timestamp string or null if not found
 */
export async function getLiveBroadcastStartTime(signal?: AbortSignal): Promise<string | null> {
    try {
        const ytData = (await getInitYtData(window.location.href, signal)) as any;
        if (!ytData) return null;

        // Priority 1: Modern PBJ format (has playerResponse at top level)
        let startTimestamp =
            ytData?.playerResponse?.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.startTimestamp;

        // Priority 2: Array format (legacy)
        if (!startTimestamp && Array.isArray(ytData)) {
            for (const item of ytData) {
                startTimestamp =
                    item?.playerResponse?.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.startTimestamp;
                if (startTimestamp) break;
            }
        }

        return startTimestamp || null;
    } catch (e) {
        console.error('[YCS] getLiveBroadcastStartTime error:', e);
        return null;
    }
}

/**
 * Extract next continuation token from API response
 * Prefers invalidationContinuationData (live) over timedContinuationData
 */
function extractNextContinuation(continuations: any[] | undefined): unknown {
    if (!continuations?.length) return null;
    return (
        continuations.find((c: any) => c.invalidationContinuationData)?.invalidationContinuationData ||
        continuations.find((c: any) => c.timedContinuationData)?.timedContinuationData ||
        null
    );
}

/**
 * Check if live stream has ended based on continuation types
 * Stream is ended when no invalidationContinuationData is present
 */
function checkIfLiveEnded(continuations: any[] | undefined): boolean {
    const hasContinuations = continuations && continuations.length > 0;
    const hasInvalidationContinuation = continuations?.some((c: any) => c.invalidationContinuationData) ?? false;
    const hasReloadContinuation = continuations?.some((c: any) => c.reloadContinuationData) ?? false;
    const hasTimedContinuation = continuations?.some((c: any) => c.timedContinuationData) ?? false;

    // Live stream is considered ended when:
    // 1. No invalidationContinuationData (live-only continuation type)
    // 2. AND one of: no continuations at all, reloadContinuationData, or timedContinuationData
    return !hasInvalidationContinuation && (!hasContinuations || hasReloadContinuation || hasTimedContinuation);
}

/**
 * Poll live chat for new messages during recording
 * Uses the same endpoint as getLiveChat but designed for incremental polling
 * @param existingContinuation - Continuation from previous poll (skips ytInitialData fetch)
 * @param forceTokenRefresh - Force re-fetch continuation from ytInitialData (for recovery)
 * @returns LiveChatPollResult with success status, continuation, and error details
 */
export async function pollLiveChat(
    signal: AbortSignal,
    existingChatMap: Map<number, object>,
    onNewMessages?: (newCount: number, totalCount: number) => void,
    broadcastStartTime?: string,
    existingContinuation?: unknown,
    forceTokenRefresh = false
): Promise<LiveChatPollResult> {
    try {
        let continuationData: unknown;

        // Token refresh: re-fetch from ytInitialData when forced or no existing token
        if (forceTokenRefresh || !existingContinuation) {
            if (forceTokenRefresh) {
                console.log('[YCS] pollLiveChat: Forcing token refresh from ytInitialData');
            }
            const result = await getCDChat(signal);
            if (!result.continuationData) {
                console.warn('[YCS] pollLiveChat: Failed to get fresh continuation from ytInitialData');
                return {
                    continuation: null,
                    isLiveEnded: false,
                    success: false,
                    errorType: 'token_stale'
                };
            }
            continuationData = result.continuationData;
        } else {
            continuationData = existingContinuation;
        }

        const fetchResult = await getLiveChat(continuationData, signal);

        // Handle HTTP errors (potential token expiration)
        if (!fetchResult.success) {
            // 400/403 typically indicate stale token
            const isTokenError = fetchResult.httpStatus === 400 || fetchResult.httpStatus === 403;
            return {
                continuation: existingContinuation, // Keep old token for caller's reference
                isLiveEnded: false,
                success: false,
                errorType: isTokenError ? 'token_stale' : fetchResult.errorType,
                httpStatus: fetchResult.httpStatus
            };
        }

        const liveChatData = fetchResult.data;

        if (!liveChatData?.actions?.length) {
            // No new messages - still successful, just no content
            const continuations = liveChatData?.continuations;
            const nextContinuation = extractNextContinuation(continuations);
            const isLiveEnded = checkIfLiveEnded(continuations);

            return {
                continuation: nextContinuation,
                isLiveEnded,
                success: true
            };
        }

        const currentVideoId = (getVideoId(window.location.href) || undefined) as string | undefined;
        const previousSize = existingChatMap.size;

        const context: ChatProcessingContext = {
            chatMap: existingChatMap,
            currentVideoId,
            broadcastStartTime,
            onCommentAdded: (count: number) => {
                if (onNewMessages) {
                    onNewMessages(count - previousSize, count);
                }
            }
        };

        // Process live chat actions
        processLiveChatActions(liveChatData.actions, context);

        // Get continuation for next poll
        const continuations = liveChatData?.continuations;
        const nextContinuation = extractNextContinuation(continuations);
        const isLiveEnded = checkIfLiveEnded(continuations);

        return {
            continuation: nextContinuation,
            isLiveEnded,
            success: true
        };
    } catch (e) {
        // Network errors, AbortError, or unexpected exceptions
        const isAbort = e instanceof DOMException && e.name === 'AbortError';
        if (!isAbort) {
            console.error('[YCS] pollLiveChat error:', e);
        }
        return {
            continuation: existingContinuation,
            isLiveEnded: false,
            success: false,
            errorType: 'network_error'
        };
    }
}
