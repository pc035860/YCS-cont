import { showLoadComments } from '../dom';
import { fetchR } from '../libs';
import { deepFindObjKey, getCleanUrlVideo, getVideoId, wrapTryCatch } from '../common';
import type { ChatContinuationResult } from '../interfaces/i_assist';
import { buildInnertubeBody, buildInnertubeHeaders } from './request';
import { processLiveChatActions } from './chat/liveChat';
import { processReplayBatch } from './chat/replayChat';
import type { ChatProcessingContext } from './chat/utils';
import { getInitYtData, getInnertubeApiKey, getPageCfgData, type InnertubeRequestParams } from './core';

export async function getParamsForChat(
    globalContext: Window & typeof globalThis,
    cLiveChat: any,
    signal?: AbortSignal,
    useLegacyApi = false,
    playerOffsetMs = 0
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
            currentPlayerState: useLegacyApi
                ? {
                      playerOffsetMs: playerOffsetMs.toString()
                  }
                : undefined
        });

        return {
            headers: buildInnertubeHeaders(ytcfgData),
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
            headers: buildInnertubeHeaders(ytcfgData),
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

async function getLiveChat(signal: AbortSignal): Promise<object[] | undefined> {
    try {
        const result = await getCDChat(signal);

        if (!result.continuationData) {
            console.log('No continuation data available for live chat');
            return undefined;
        }

        const params = await getParamsForLiveChat(window, result.continuationData, signal);

        if (params) {
            const res = await fetch(
                `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${getInnertubeApiKey()}`,
                { ...params, signal, cache: 'no-store' }
            );

            const cmnts = await res.json();

            return cmnts?.continuationContents?.liveChatContinuation;
        }

        return undefined;
    } catch (e) {
        console.error(e);
        return undefined;
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

        const continuationData = result.continuationData;
        const useLegacyApi = result.apiVersion === 'old';

        console.log(`[getChatComments] Detected API version: ${result.apiVersion}`);
        console.log(`[getChatComments] Source path: ${result.sourcePath}`);

        const chatCmnts = container || new Map<number, object>();
        const currentVideoId = (getVideoId(window.location.href) || undefined) as string | undefined;

        const context: ChatProcessingContext = {
            chatMap: chatCmnts,
            currentVideoId,
            onCommentAdded: (count: number) => showLoadComments(count, elShowLoading)
        };

        const liveChatData: any = await getLiveChat(signal);

        if (liveChatData?.actions?.length > 0) {
            console.log('IS LIVECHAT!!!!!', liveChatData);
            processLiveChatActions(liveChatData.actions, context);
            return chatCmnts;
        }

        if (useLegacyApi) {
            let currentOffsetTimeMsec = 0;
            let next = true;

            while (next) {
                console.log('Loop chat comments (Legacy API)');
                const params = await getParamsForChat(window, continuationData, signal, true, currentOffsetTimeMsec);

                if (!params) {
                    next = false;
                    break;
                }

                const res = await fetchR(
                    `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?key=${getInnertubeApiKey()}`,
                    { ...params, signal, cache: 'no-store' }
                );

                const response = await res.json();
                const cmnts = response?.continuationContents?.liveChatContinuation?.actions;
                console.log('Chat comments (Legacy): ', cmnts);

                if (cmnts && cmnts.length > 0) {
                    const lastOffsetTimeInCmnts = wrapTryCatch(() => {
                        const offsetData = deepFindObjKey(cmnts[cmnts.length - 1], 'videoOffsetTimeMsec')[0];
                        return (Object as any).entries(offsetData)[0][1];
                    }) as number | undefined;

                    console.log('lastOffsetTimeInCmnts: ', lastOffsetTimeInCmnts);

                    if (currentOffsetTimeMsec === lastOffsetTimeInCmnts) {
                        console.log('BREAK! Reached end of chat replay (Legacy API)');
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

        let nextContinuation: any = continuationData;

        while (nextContinuation) {
            console.log('Loop chat comments (New API)');
            const params = await getParamsForChat(window, nextContinuation, signal, false);

            if (!params) break;

            const res = await fetchR(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay`, {
                ...params,
                signal,
                cache: 'no-store'
            });

            const response = await res.json();
            const cmnts = response?.continuationContents?.liveChatContinuation?.actions;
            console.log('Chat comments (New): ', cmnts);

            if (Array.isArray(cmnts) && cmnts.length > 0) {
                processReplayBatch(cmnts, context);
            }

            const continuations = response?.continuationContents?.liveChatContinuation?.continuations;
            const continuationToken = continuations?.[0]?.liveChatReplayContinuationData?.continuation;

            if (continuationToken) {
                nextContinuation = { continuation: continuationToken };
            } else {
                console.log('No more continuation, finished loading chat');
                break;
            }
        }

        return chatCmnts;
    } catch (e) {
        console.error(e);
        return undefined;
    }
}
