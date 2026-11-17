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
            // `isReplay` marks a finished broadcast: its continuation is a replay token, so the
            // live chat endpoint rejects it with HTTP 400. Callers use this to skip that probe.
            const isReplay =
                wrapTryCatch(
                    () => ytData.response.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.isReplay
                ) === true;

            const newApiData = wrapTryCatch(
                () =>
                    ytData.response.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.continuations[0]
                        .reloadContinuationData
            );

            if (newApiData) {
                return {
                    continuationData: newApiData,
                    apiVersion: 'new',
                    sourcePath: 'continuations[0].reloadContinuationData',
                    isReplay
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
                        '[3].response.header.viewSelector.sortFilterSubMenuRenderer.subMenuItems[1].continuation.reloadContinuationData',
                    isReplay
                };
            }

            const rCData = deepFindObjKey(ytData, 'reloadContinuationData');
            if (rCData.length > 0) {
                const fallbackData = Object.values(rCData[rCData.length - 1])[0] as object;
                return {
                    continuationData: fallbackData,
                    apiVersion: 'fallback',
                    sourcePath: 'deepSearch(reloadContinuationData)',
                    isReplay
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

/**
 * Chat mode values reported by the live chat API in `liveChatCurrentFilter`.
 * DEFAULT is the "Top chat" mode, which drops messages YouTube considers spam.
 */
const LIVE_CHAT_FILTER_MODE_DEFAULT = 'LIVE_CHAT_FILTER_MODE_DEFAULT';

/**
 * Extract the "Live chat" (all messages) reload continuation from a live chat response.
 *
 * The response carries both modes under
 * `header.liveChatHeaderRenderer.viewSelector.sortFilterSubMenuRenderer.subMenuItems`,
 * with `selected: true` marking the mode currently in use. Titles are localized, so the
 * non-selected item is picked by flag rather than by label.
 *
 * Only tokens returned by a `get_live_chat` response work here: the ones on the watch page
 * are mode-selector stubs that the endpoint rejects with HTTP 400.
 */
function extractUnfilteredContinuation(liveChatData: any): { continuation: string } | null {
    const subMenuItems = wrapTryCatch(
        () => liveChatData.header.liveChatHeaderRenderer.viewSelector.sortFilterSubMenuRenderer.subMenuItems
    ) as any[] | undefined;

    if (!Array.isArray(subMenuItems)) return null;

    const candidate =
        subMenuItems.find(
            (item) => item?.selected === false && item?.continuation?.reloadContinuationData?.continuation
        ) ?? subMenuItems[1];

    const continuation = candidate?.continuation?.reloadContinuationData?.continuation;
    return continuation ? { continuation } : null;
}

/**
 * Fetch live chat with the "Live chat" (all messages) mode instead of "Top chat".
 *
 * The continuation from ytInitialData
 * (`conversationBar.liveChatRenderer.continuations[0]`) selects YouTube's default "Top chat"
 * mode, so the first response only holds server-side filtered messages. That same response
 * carries the "Live chat" continuation, so one extra request replaces the filtered batch.
 *
 * Falls back to the "Top chat" batch whenever the unfiltered mode is unavailable, so a
 * failure here never loses messages.
 */
async function getLiveChatUnfiltered(continuationData: any, signal: AbortSignal): Promise<LiveChatFetchResult> {
    const filtered = await getLiveChat(continuationData, signal);

    if (!filtered.success || filtered.data?.liveChatCurrentFilter !== LIVE_CHAT_FILTER_MODE_DEFAULT) {
        return filtered;
    }

    const unfilteredContinuation = extractUnfilteredContinuation(filtered.data);
    if (!unfilteredContinuation) {
        console.warn('[YCS] getLiveChat: "Live chat" continuation not found, keeping "Top chat"');
        return filtered;
    }

    const unfiltered = await getLiveChat(unfilteredContinuation, signal);
    if (!unfiltered.success || !unfiltered.data) {
        console.warn('[YCS] getLiveChat: "Live chat" fetch failed, keeping "Top chat" batch');
        return filtered;
    }

    if (unfiltered.data.liveChatCurrentFilter === LIVE_CHAT_FILTER_MODE_DEFAULT) {
        console.warn('[YCS] getLiveChat: server stayed in "Top chat" mode, keeping the first batch');
        return filtered;
    }

    return unfiltered;
}

/**
 * Fetch one page of chat replay.
 *
 * @param playerOffsetMs When provided, the request is sent in playerSeek mode with that offset;
 *   omit it to follow a plain `liveChatReplayContinuationData` token.
 * @returns The `liveChatContinuation` payload, or null when the request could not be made.
 */
async function fetchReplayPage(
    continuationData: any,
    signal: AbortSignal,
    playerOffsetMs?: number
): Promise<any | null> {
    const usePlayerSeek = playerOffsetMs !== undefined;
    const params = await getParamsForChat(window, continuationData, signal, false, playerOffsetMs ?? 0, usePlayerSeek);

    if (!params) return null;

    const res = await fetchR(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?prettyPrint=false`, {
        ...params,
        signal,
        cache: 'no-store'
    });

    if (!res.ok) {
        console.warn(`[YCS] chat replay HTTP error: ${res.status} ${res.statusText}`);
        return null;
    }

    try {
        const response = await res.json();
        return response?.continuationContents?.liveChatContinuation ?? null;
    } catch (e) {
        // A malformed body must not discard the messages already collected
        console.warn('[YCS] chat replay: failed to parse response', e);
        return null;
    }
}

/**
 * Read the `liveChatReplayContinuationData` token that paginates the replay.
 * Unlike the seek token, this one always advances to the next page.
 */
function extractReplayContinuation(liveChatContinuation: any): string | null {
    const continuation = liveChatContinuation?.continuations?.find((c: any) => c.liveChatReplayContinuationData)
        ?.liveChatReplayContinuationData?.continuation;

    return typeof continuation === 'string' && continuation ? continuation : null;
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

        // A replay continuation is rejected by the live chat endpoint (HTTP 400), so only probe
        // for an ongoing broadcast.
        if (!result.isReplay) {
            const fetchResult = await getLiveChatUnfiltered(result.continuationData, signal);

            if (fetchResult.success && fetchResult.data?.actions?.length > 0) {
                console.debug('IS LIVECHAT!!!!!', fetchResult.data);
                processLiveChatActions(fetchResult.data.actions, context);
                return chatCmnts;
            }
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

        // Stage 1: initial response — carries the playerSeek token used to pin the start position
        const initialPage = await fetchReplayPage(continuationData, signal);
        if (!initialPage) {
            console.warn('[YCS] chat replay: initial request failed');
            return chatCmnts;
        }

        const seekToken = initialPage.continuations?.find((c: any) => c.playerSeekContinuationData)
            ?.playerSeekContinuationData?.continuation;

        // Stage 2: first batch from offset 0, then paginate with liveChatReplayContinuationData.
        // The seek token only guarantees the replay starts at the video beginning; it must not be
        // used to advance the cursor. `get_live_chat_replay` answers a range of playerOffsetMs
        // values with the same page, so an offset-driven loop can stall mid-stream and mistake the
        // stall for the end of the chat (see docs/innertube-chat-replay-api-changes.md).
        let nextContinuation: string | null = null;

        if (seekToken) {
            const firstPage = await fetchReplayPage({ continuation: seekToken }, signal, 0);
            if (firstPage && Array.isArray(firstPage.actions) && firstPage.actions.length > 0) {
                processReplayBatch(firstPage.actions, context);
                nextContinuation = extractReplayContinuation(firstPage);
            } else {
                console.warn('[YCS] chat replay: seek(0) request failed, using the initial batch');
            }
        }

        if (!nextContinuation) {
            // No playerSeek support (or the seek request failed): the initial response is the first batch
            if (Array.isArray(initialPage.actions) && initialPage.actions.length > 0) {
                processReplayBatch(initialPage.actions, context);
            }
            nextContinuation = extractReplayContinuation(initialPage);
        }

        // Stage 3: paginate until the server stops offering a replay continuation
        while (nextContinuation) {
            const page = await fetchReplayPage({ continuation: nextContinuation }, signal);
            if (!page) {
                console.warn('[YCS] chat replay: request failed, stopping pagination');
                break;
            }

            if (Array.isArray(page.actions) && page.actions.length > 0) {
                processReplayBatch(page.actions, context);
            }

            const following = extractReplayContinuation(page);
            if (!following || following === nextContinuation) break;
            nextContinuation = following;
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
        // A finished broadcast is never an ongoing stream; skip the probe, which answers HTTP 400
        if (result.isReplay) return false;

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

        const fetchResult = await getLiveChatUnfiltered(continuationData, signal);

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
