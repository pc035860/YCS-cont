/* eslint-disable @typescript-eslint/no-explicit-any */

import Mark, { MarkOptions } from 'mark.js';
// @ts-expect-error [No have types]
import objectScan from 'object-scan';
import Queue from 'p-queue';

import urlRegex from 'url-regex';

import { GetParams, ISheetChatComments, ISheetChatDetails, ISheetComments, ISheetCommentsParam, ISheetDetails, ISheetDetailsChatParam, ISheetDetailsParam, ISheetDetailsTrVideoParam, ISheetReplies, ISheetRepliesParam, ISheetTrVideo, ISheetTrVideoDetails } from './interfaces/i_assist';
import { ICommentItem, ICommentsFuseResult } from './interfaces/i_types';
import { fetchR } from './libs';

const GlobalStore = ((): any => {

    const store = {};

    return (): any => store;

})();

function randomString(len: number): string {

    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const charactersLength = characters.length;
    for (let i = 0; i < len; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * charactersLength)
        );
    }
    return result;

}

function getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function isNumeric(digit: string | number): boolean {
    if (typeof digit != 'string' && typeof digit != 'number') return false;

    return ( !isNaN(digit as any) && !isNaN(parseFloat(digit as any)) );
}

function oIsEmpty(obj: object): boolean {
    return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
}

function removeClass(elms: object, s: string): void {

    try {

        if (oIsEmpty(elms) || typeof s !== 'string') return;

        const els: Array<HTMLElement> = (Object as any).values(elms);

        for (const e of els) {
            e.classList.remove(s);
        }

    } catch (err) {
        console.error(err);
    }

}

function getObj(obj: object, path: string | [], def: any): object {
    
    function stringToPath(p: string | []): [] {
        if (typeof p !== 'string') return p;

        const result: any = [];

        p.split('.').forEach(function (v) {
            v.split(/\[([^}]+)\]/g).forEach(function (key) {
                if (key.length > 0) {
                    result.push(key);
                }
            });
        });

        return result;
    }

    try {
    
        const paths = stringToPath(path);
    
        let resultObj = obj;
    
        for (let i = 0; i < paths.length; i++) {
            if (!resultObj[paths[i]]) return def;
    
            resultObj = resultObj[paths[i]];
        }
    
        return resultObj;

    } catch (err) {
        console.error(err);
        return def;
    }

}

function wrapTryCatch(fn: (...args: any) => any): any {
    try {
        return fn();
    } catch (e) {
        // console.info(e);
        return undefined;
    }
}

function deepFindObjKey(obj: object, key: string): Array<any> {
    const matches: any[] = [];

    try {

        const iterate = function iterate(object: any, path?: unknown): void {
            let match: any, item;
    
            const newPath = function (add: unknown): string | unknown {
                return path ? (path + '.' + add) : add;
            };
    
            // eslint-disable-next-line no-prototype-builtins
            if (object?.hasOwnProperty(key)) {
                match = {};

                match[newPath(key) as string] = object[key];
                
                matches.push(match);
            }
    
            for (item in object) {
                // eslint-disable-next-line no-prototype-builtins
                if (object?.hasOwnProperty(item) && typeof (object as any)[item] === 'object') {
                    
                    iterate(object[item], newPath(item));
                }
            }
    
        };
    
        iterate(obj);

    } catch (err) {
        console.error(err);
        return [];
    }

    return matches;

}

function getVideoId(url: string): string | undefined {
    
    try {
        if (typeof url !== 'string') return;

        const u = new URL(url);
        return u.searchParams.get('v') as any;
    
    } catch (e) {
        console.error(e);
        return;
    }
  
}

function isWatchVideo(): boolean {
    // return window.location.href.match(/https:\/\/www.youtube.com\/watch\?v=/g);
    return window.location.href.includes('/watch?');
}

function showLoadComments(number: number, showNode: HTMLElement): void {
    if (!showNode) return;

    showNode.textContent = number.toString();
}

// https://www.youtube.com/watch?v=cq2Ef6rvL6g&test=sdfasdf&zvzxvczv;afdasdvasdf
function getCleanUrlVideo(url: string): string | undefined {
    
    try {
        if (typeof url !== 'string') return;

        const u = new URL(url);
        const vParam = u.searchParams.get('v');
    
        if (vParam) {

            const cleanUrl = new URL(u.origin);
            cleanUrl.pathname = '/watch';
            cleanUrl.searchParams.set('v', vParam);

            return cleanUrl.href;
        }

        return;

    } catch (e) {
        console.error(e);
        // throw new Error(e);
        return;
    }
  
}

function findInitYParams(initData: [object]): string | undefined {

    try {

        if (initData) {
            let param;
            for (const obj of initData) {
                const findObj = deepFindObjKey(obj, 'serializedShareEntity')[0];
                console.log('findObj: ', findObj);
    
                if (findObj) {
                    [, param] = (Object as any).entries(findObj)[0];
                    console.log('findObj param: ', param);
                }
    
                if (param) break;
            }
            console.log('INIT PARAMS: ', param);
            return param;
        }
        
    } catch (e) {
        console.error(e);
        return;
    }

    return;
}

function getParams(w: any): GetParams {
    return JSON.parse(JSON.stringify({
        ctoken: null,
        continuation: null,
        itct: null,
        params: {
            'credentials': 'include',
            'headers': {
                'accept': '*/*',
                'accept-language': w.ytcfg?.data_?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'cache-control': 'no-cache',
                'content-type': 'application/x-www-form-urlencoded',
                'pragma': 'no-cache',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'x-spf-previous': getCleanUrlVideo(w.location.href),
                'x-spf-referer': getCleanUrlVideo(w.location.href),
                'x-youtube-identity-token': w.ytcfg?.data_?.ID_TOKEN,
                'x-youtube-client-name': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_VERSION,
                'x-youtube-device': w.ytcfg?.data_?.DEVICE || 'cbr=Chrome&cplatform=DESKTOP',
                'x-youtube-page-cl': w.ytcfg?.data_?.PAGE_CL,
                'x-youtube-page-label': w.ytcfg?.data_?.PAGE_BUILD_LABEL,
                'x-youtube-time-zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
                'x-youtube-utc-offset': Math.abs((new Date).getTimezoneOffset()),
                'x-youtube-variants-checksum': w.ytcfg?.data_?.VARIANTS_CHECKSUM
            },
            'referrer': getCleanUrlVideo(w.location.href),
            'referrerPolicy': 'origin-when-cross-origin',
            'body': `session_token=${w.ytcfg?.data_?.XSRF_TOKEN}`,
            'method': 'POST',
            'mode': 'cors'
        }
    }));
}

async function getInitYtData(url: string, signal: AbortSignal | undefined): Promise<[object] | undefined> {

    try {
        
        if (!url) return;

        const getFirstParam = (getParams(window)).params as RequestInit;

        getFirstParam.method = 'GET';
        delete (getFirstParam.headers as any)['content-type'];
        delete getFirstParam.body;

        console.log('GET FIRST PARAM: ', getFirstParam);

        const res = await fetch(`${getCleanUrlVideo(url)}&pbj=1`, { ...getFirstParam, signal, cache: 'no-store' });

        const result = await res.json();
        GlobalStore.getInitYtData = result;

        return result;
        
    } catch (e) {
        console.error(e);
        return;
    }
    
}

async function delayMs(ms: number): Promise<void> {
    return await new Promise(resolve => setTimeout(resolve, ms));
}

function getParamsForChat(w: any, cLiveChat: any, pOffsetMs: number): object | undefined {

    if (!cLiveChat) return;
    
    try {

        return JSON.parse(JSON.stringify({
            'headers': {
                'accept': '*/*',
                'accept-language': w.ytcfg?.data_?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'content-type': 'application/json',
                'pragma': 'no-cache',
                'cache-control': 'no-store',
                'x-youtube-client-name': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_VERSION
            },
            'referrerPolicy': 'strict-origin-when-cross-origin',
            'body': JSON.stringify({ context: { client: w.ytcfg?.data_?.INNERTUBE_CONTEXT?.client }, continuation: cLiveChat.continuation, currentPlayerState: { playerOffsetMs: pOffsetMs.toString()}}),
            'method': 'POST',
            'mode': 'cors',
            'credentials': 'include'
        }));

    } catch (e) {
        console.error(e);
        return;
    }

}

async function getDetailsVideoIDV2(w: any, url: string, signal: AbortSignal): Promise<object | undefined> {
    
    try {
        if (typeof url !== 'string') return;

        const params = JSON.parse(JSON.stringify({
            'headers': {
                'accept': '*/*',
                'accept-language': w.ytcfg?.data_?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'content-type': 'application/json',
                'pragma': 'no-cache',
                'cache-control': 'no-store',
                'x-youtube-client-name': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_VERSION
            },
            'referrer': url,
            'referrerPolicy': 'strict-origin-when-cross-origin',
            'body': JSON.stringify({ context: { client: w.ytcfg?.data_?.INNERTUBE_CONTEXT?.client }, videoId: getVideoId(url)}),
            'method': 'POST',
            'mode': 'cors',
            'credentials': 'include'
        }));

        console.log('getDetailsVideoIDV2 PARAMS: ', params);

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const res = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${getInnertubeApiKey()}`, { ...params, signal, cache: 'no-store' } as RequestInit);

        const data = await res.json();
        console.log('getDetailsVideoIDV2 DATA: ', data);

        return data;

    } catch (err) {
        console.error(err);
        return;
    }

}

async function getDetailsCommentsVideoIDV2(w: any, ps: any, signal: AbortSignal): Promise<object | undefined> {

    try {
        if (typeof ps !== 'object') return;

        const params = JSON.parse(JSON.stringify({
            'headers': {
                'accept': '*/*',
                'accept-language': w.ytcfg?.data_?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'content-type': 'application/json',
                'pragma': 'no-cache',
                'cache-control': 'no-store',
                'x-youtube-client-name': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_VERSION
            },
            'referrer': ps.url,
            'referrerPolicy': 'strict-origin-when-cross-origin',
            'body': JSON.stringify({ context: { client: w.ytcfg?.data_?.INNERTUBE_CONTEXT?.client }, clickTracking: { clickTrackingParams: '' }, continuation: ps.continue}),
            'method': 'POST',
            'mode': 'cors',
            'credentials': 'include'
        }));

        console.log('getDetailsCommentsVideoIDV2 PARAMS: ', params);

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const res = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${getInnertubeApiKey()}`, { ...params, signal, cache: 'no-store' } as RequestInit);

        const data = await res.json();
        console.log('getDetailsCommentsVideoIDV2 DATA: ', data);

        return data;

    } catch (err) {
        console.error(err);
        return;
    }

}

function getParamsForComments(w: any, params: any): object | undefined {
    
    try {

        return JSON.parse(JSON.stringify({
            'headers': {
                'accept': '*/*',
                'accept-language': w.ytcfg?.data_?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'content-type': 'application/json',
                'pragma': 'no-cache',
                'cache-control': 'no-store',
                'x-youtube-client-name': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_VERSION
            },
            'referrerPolicy': 'strict-origin-when-cross-origin',
            'body': JSON.stringify({ context: { client: w.ytcfg?.data_?.INNERTUBE_CONTEXT?.client }, clickTracking: { clickTrackingParams: params.clickTrackingParams }, continuation: params.continue}),
            'method': 'POST',
            'mode': 'cors',
            'credentials': 'include'
        }));

    } catch (e) {
        console.error(e);
        return;
    }

}

function getParamsForReplies(w: any, params: any): object | undefined {
    
    try {

        return JSON.parse(JSON.stringify({
            'headers': {
                'accept': '*/*',
                'accept-language': w.ytcfg?.data_?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'content-type': 'application/json',
                'pragma': 'no-cache',
                'cache-control': 'no-store',
                'x-youtube-client-name': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_VERSION
            },
            'referrerPolicy': 'strict-origin-when-cross-origin',
            'body': JSON.stringify({ context: { client: w.ytcfg?.data_?.INNERTUBE_CONTEXT?.client }, clickTracking: { clickTrackingParams: params.clickTracking }, continuation: params.continue}),
            'method': 'POST',
            'mode': 'cors',
            'credentials': 'include'
        }));

    } catch (e) {
        console.error(e);
        return;
    }

}

function getParamsForLiveChat(w: any, cLiveChat: any): object | undefined {

    if (!cLiveChat) return;
    
    try {

        return JSON.parse(JSON.stringify({
            'headers': {
                'accept': '*/*',
                'accept-language': w.ytcfg?.data_?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'content-type': 'application/json',
                'pragma': 'no-cache',
                'cache-control': 'no-store',
                'x-youtube-client-name': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_VERSION
            },
            'referrerPolicy': 'strict-origin-when-cross-origin',
            'body': JSON.stringify({ context: { client: w.ytcfg?.data_?.INNERTUBE_CONTEXT?.client }, continuation: cLiveChat.continuation }),
            'method': 'POST',
            'mode': 'cors',
            'credentials': 'include'
        }));

    } catch (e) {
        console.error(e);
        return;
    }

}

function getInnertubeApiKey(): string | undefined {

    try {

        return (window as any)?.ytcfg.data_?.INNERTUBE_API_KEY ||
            (window as any)?.ytcfg?.data_?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_WATCH?.innertubeApiKey ||
            (window as any)?.ytcfg?.data_?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_CHANNEL_TRAILER?.innertubeApiKey ||
            (window as any)?.ytcfg?.data_?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_PLAYLIST_OVERVIEW?.innertubeApiKey ||
            (window as any)?.ytcfg?.data_?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_VERTICAL_LANDING_PAGE_PROMO?.innertubeApiKey ||
            (window as any)?.ytcfg?.data_?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_SPONSORSHIPS_OFFER?.innertubeApiKey ||
            (window as any)?.ytplayer?.web_player_context_config?.innertubeApiKey;
        
    } catch (e) {
        console.error(e);
        return;
    }

}

async function getCDChat(signal: AbortSignal): Promise<object | undefined> {
    
    try {

        const ytData = await getInitYtData(window.location.href, signal) as any;

        if (ytData) {

            if (wrapTryCatch(() => ytData[3].response.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.header.liveChatHeaderRenderer.viewSelector.sortFilterSubMenuRenderer.subMenuItems[1].continuation.reloadContinuationData)) {
                return wrapTryCatch(() => ytData[3].response.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.header.liveChatHeaderRenderer.viewSelector.sortFilterSubMenuRenderer.subMenuItems[1].continuation.reloadContinuationData);
            }

            const rCData = deepFindObjKey(ytData, 'reloadContinuationData');
            if (rCData.length > 0) {
               
                // @ts-expect-error [ES2017]
                return Object.values(rCData[rCData.length - 1])[0] as object;
            }

        }

        return;
        
    } catch (e) {
        console.error(e);
        return;
    }

}

async function getLiveChat(signal: AbortSignal): Promise<object[] | undefined> {

    try {

        const cDChat = await getCDChat(signal);
        const params = getParamsForLiveChat(window, cDChat);

        if (params) {
            
            const res = await fetch(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${getInnertubeApiKey()}`, { ...params, signal, cache: 'no-store' });
        
            const cmnts = await res.json();

            return cmnts?.continuationContents?.liveChatContinuation;

        }

        return;
        
    } catch (e) {
        console.error(e);
        return;
    }

}

async function getChatComments(signal: AbortSignal, elShowLoading: HTMLElement, container: Map<number, object> | undefined = undefined): Promise<Map<number, object> | undefined> {

    try {

        const _prepareFieldsChatComments = (cmnt: any): object => {

            try {
    
                if (wrapTryCatch(() => cmnt.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorBadges[0].liveChatAuthorBadgeRenderer.icon.iconType.indexOf('VERIFIED') >= 0) || wrapTryCatch(() => cmnt.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorBadges[0].liveChatAuthorBadgeRenderer.icon.iconType.indexOf('CHECK') >= 0) ||
                wrapTryCatch(() => cmnt.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorBadges[0].liveChatAuthorBadgeRenderer.tooltip.indexOf('Verified') >= 0)) {

                    try {

                        cmnt.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.verifiedAuthor = true; 
                        
                    } catch (err) {
                        console.error(err);
                    }

                }
                
                return cmnt;
            } catch (err) {
                console.error(err);
                return cmnt;
            }
        
        };

        const cDChat = await getCDChat(signal);
        if (!cDChat) {
            console.log('STOP CHAT CD!!!!');
            return;
        }

        const chatCmnts = container || new Map<number, object>();

        const liveChatData: any = await getLiveChat(signal);

        if (liveChatData) {

            try {

                if (liveChatData?.actions?.length > 0) {
                    console.log('IS LIVECHAT!!!!!', liveChatData);
        
                    for (const c of liveChatData.actions) {

                        try {

                            const protoComment = {
                                replayChatItemAction: {
                                    actions: [{
                                        addChatItemAction: {}
                                    }]
                                }
                            };
            
                            protoComment.replayChatItemAction.actions[0] = c;
                            const comment: any = protoComment;
    
                            if (!wrapTryCatch(() => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.timestampUsec)) {
    
                                if (wrapTryCatch(() => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatPaidMessageRenderer)) {
        
                                    comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer = comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatPaidMessageRenderer;
                                    console.log('Done! Added liveChatPaidMessageRenderer: ', comment);
        
                                } else if (wrapTryCatch(() => comment.replayChatItemAction.actions[0].addBannerToLiveChatCommand.bannerRenderer.liveChatBannerRenderer.contents.liveChatTextMessageRenderer)) {
        
                                    comment.replayChatItemAction.actions[0].addChatItemAction = { item: { liveChatTextMessageRenderer: {} } };
                                    comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer = comment.replayChatItemAction.actions[0].addBannerToLiveChatCommand.bannerRenderer.liveChatBannerRenderer.contents.liveChatTextMessageRenderer;
                                    console.log('Done! Added liveChatBannerRenderer: ', comment);
        
                                } else if (wrapTryCatch(() => comment.replayChatItemAction.actions[0].addLiveChatTickerItemAction.item.liveChatTickerPaidMessageItemRenderer.showItemEndpoint.showLiveChatItemEndpoint.renderer.liveChatPaidMessageRenderer)) {
        
                                    comment.replayChatItemAction.actions[0].addChatItemAction = { item: { liveChatTextMessageRenderer: {} } };
                                    comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer = comment.replayChatItemAction.actions[0].addLiveChatTickerItemAction.item.liveChatTickerPaidMessageItemRenderer.showItemEndpoint.showLiveChatItemEndpoint.renderer.liveChatPaidMessageRenderer;
                                    console.log('Done! Added LiveChatTickerItemAction: ', comment);
                                    
                                } else {
        
                                    // console.log('deepFindObjKey: ', deepFindObjKey(comment, 'timestampUsec'));
                                    const pathComment = wrapTryCatch(() => Object.keys(deepFindObjKey(comment, 'timestampUsec')[0])[0].split('.').slice(0, -1).join('.')) as string | undefined;
                                    // console.log('pathComment: ', pathComment);
                                    if (pathComment) {
                                        const findedComment = getObj(comment, pathComment, undefined) as any;
                                        console.log('-----------------> GET OBJECT LIVE CHAT COMMENT: ', findedComment);
        
                                        if (findedComment && findedComment?.authorName && findedComment?.message) {
                                            console.log('-----------------> FINDED LIVE CHAT COMMENT: ', findedComment);
                                            comment.replayChatItemAction.actions[0].addChatItemAction = { item: { liveChatTextMessageRenderer: {} } };
                                            comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer = findedComment;
                                        }
        
                                    }
        
                                }
    
                            }
    
            
                            const timestampUsec: string | undefined = wrapTryCatch(() => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.timestampUsec) as any;
                            
                            if (timestampUsec && !chatCmnts.has(parseInt(timestampUsec, 10))) {
            
                                const chatMsgs = wrapTryCatch(() => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.runs) as any || [];
            
                                let fullText = '';
                                let renderFullTextComment = '';
    
                                if (wrapTryCatch(() => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText)) {
                                    console.log('Added purchaseAmountText for chat');
                                    renderFullTextComment += `<span class="ycs-chat_donation ycs-chat_donation__title">Donated: </span><span class="ycs-chat_donation ycs-chat_donation__bg">${comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText}</span><br><br>`;
                                    fullText += `${comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText} `;
                                }
            
                                for (const msg of chatMsgs) {
    
                                    try {
    
                                        fullText += msg?.text || '';
            
                                        if (parseInt(msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds) >= 0) {
                                            renderFullTextComment += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${msg?.navigationEndpoint?.watchEndpoint?.videoId}&t=${msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}s" data-offsetvideo="${msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}">${msg?.text || ''}</a>`;
    
                                            if (wrapTryCatch(() => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer)) {
                                                comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.isTimeLine = 'timeline';
                                            }
    
                                        } else if (msg?.navigationEndpoint) {
                                            renderFullTextComment += `<a class="ycs-cpointer ycs-comment-link" href="${msg?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || msg?.navigationEndpoint?.urlEndpoint?.url || msg?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || msg?.text || '#'}" target="_blank">${msg?.text || ''}</a>`;

                                        } else if (wrapTryCatch(() => (msg as any).emoji)) {
                                            const url = wrapTryCatch(() => {
                                                const thumbnails = (msg as any).emoji.image.thumbnails;
                                                return thumbnails[thumbnails.length - 1].url;
                                            }) || '';
                                            const alt = (wrapTryCatch(() => (msg as any).emoji.shortcuts?.[0]) as string) || '';
                                            const style = `margin-left: 2px; margin-right: 2px;`;
                                            renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="24" height="24" style="${style}" class="ycs-attachment">`;

                                        } else if (wrapTryCatch(() => (msg as any).attachment?.image)) {
                                            const image: any = wrapTryCatch(() => (msg as any).attachment.image);
                                            const url = image?.url || '';
                                            const width = image?.width || 24;
                                            const height = image?.height || 24;
                                            const margin = image?.margin || { left: 0, right: 0 };
                                            const style = `margin-left: ${margin.left || 0}px; margin-right: ${margin.right || 0}px;`;
                                            const alt = (msg as any)?.text || '';
                                            renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="${width}" height="${height}" style="${style}" class="ycs-attachment">`;

                                        } else {
                                            renderFullTextComment += msg?.text || '';
                                        }
    
                                    } catch (e) {
                                        console.error(e);
                                        renderFullTextComment += msg?.text || '';
                                    }
            
                                }
    
                                if (fullText) {
            
                                    comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.fullText = fullText;
            
                                    comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.renderFullText = renderFullTextComment || fullText;
            
                                }
            
                                if (wrapTryCatch(() => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorName)) {
                                    chatCmnts.set(parseInt(timestampUsec, 10), _prepareFieldsChatComments(comment));
                                    showLoadComments(chatCmnts.size, elShowLoading);
                                }

                            }
                        } catch (err) {
                            console.error(err);
                            continue;
                        }
        
                    }
        
                }
    
            } catch (e) {
                console.error(e);
                return chatCmnts;
            }
    
        } else {

            try {

                let currentOffsetTimeMsec = 0;
                let next = true;
    
                while (next) {
    
                    console.log('Loop chat comments');
                    const params = getParamsForChat(window, cDChat, currentOffsetTimeMsec);
                    console.log('currentOffsetTimeMsec: ', currentOffsetTimeMsec);
        
                    if (params) {
        
                        const res = await fetchR(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?key=${getInnertubeApiKey()}`, { ...params, signal, cache: 'no-store' });
        
                        let cmnts = await res.json();
                        cmnts = cmnts?.continuationContents?.liveChatContinuation?.actions;
                        console.log('Chat comments: ', cmnts);
        
                        if (cmnts && cmnts.length > 0) {
        
                            const [, lastOffsetTimeInCmnts] = (Object as any).entries(deepFindObjKey(cmnts[cmnts.length - 1], 'videoOffsetTimeMsec')[0])[0];
                            
                            console.log('lastOffsetTimeInCmnts: ', lastOffsetTimeInCmnts);
        
                            if (currentOffsetTimeMsec === lastOffsetTimeInCmnts) {
                                console.log('BREAK!');
                                console.log('currentOffsetTimeMsec: ', currentOffsetTimeMsec);
                                console.log('lastOffsetTimeInCmnts: ', lastOffsetTimeInCmnts);
                                next = false;
                                break;
                            }
    
                            for (const comment of cmnts) {

                                try {

                                    if (!wrapTryCatch(() => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.timestampUsec)) {

                                        if (wrapTryCatch(() => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatPaidMessageRenderer)) {
                
                                            comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer = comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatPaidMessageRenderer;
                                            console.log('Done! Added liveChatPaidMessageRenderer: ', comment);
                
                                        } else if (wrapTryCatch(() => comment.replayChatItemAction.actions[0].addBannerToLiveChatCommand.bannerRenderer.liveChatBannerRenderer.contents.liveChatTextMessageRenderer)) {
                
                                            comment.replayChatItemAction.actions[0].addChatItemAction = { item: { liveChatTextMessageRenderer: {} } };
                                            comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer = comment.replayChatItemAction.actions[0].addBannerToLiveChatCommand.bannerRenderer.liveChatBannerRenderer.contents.liveChatTextMessageRenderer;
                                            console.log('Done! Added liveChatBannerRenderer: ', comment);
                
                                        } else if (wrapTryCatch(() => comment.replayChatItemAction.actions[0].addLiveChatTickerItemAction.item.liveChatTickerPaidMessageItemRenderer.showItemEndpoint.showLiveChatItemEndpoint.renderer.liveChatPaidMessageRenderer)) {
                
                                            comment.replayChatItemAction.actions[0].addChatItemAction = { item: { liveChatTextMessageRenderer: {} } };
                                            comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer = comment.replayChatItemAction.actions[0].addLiveChatTickerItemAction.item.liveChatTickerPaidMessageItemRenderer.showItemEndpoint.showLiveChatItemEndpoint.renderer.liveChatPaidMessageRenderer;
                                            console.log('Done! Added LiveChatTickerItemAction: ', comment);
                                            
                                        } else {
                
                                            // console.log('deepFindObjKey: ', deepFindObjKey(comment, 'timestampUsec'));
                                            const pathComment = wrapTryCatch(() => Object.keys(deepFindObjKey(comment, 'timestampUsec')[0])[0].split('.').slice(0, -1).join('.')) as string | undefined;
                                            // console.log('pathComment: ', pathComment);
                                            if (pathComment) {
                                                const findedComment = getObj(comment, pathComment, undefined) as any;
                                                console.log('-----------------> GET OBJECT CHAT COMMENT: ', findedComment);
                
                                                if (findedComment && findedComment?.authorName && findedComment?.message) {
                                                    console.log('-----------------> FINDED CHAT COMMENT: ', findedComment);
                                                    comment.replayChatItemAction.actions[0].addChatItemAction = { item: { liveChatTextMessageRenderer: {} } };
                                                    comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer = findedComment;
                                                }
                
                                            }
                
                                        }
            
                                    }
    
                                    const timestampUsec: string | undefined = wrapTryCatch(() => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.timestampUsec) as any;
    
                                    if (timestampUsec && !chatCmnts.has(parseInt(timestampUsec, 10))) {
        
                                        const chatMsgs = wrapTryCatch(() => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.runs) as any || [];
        
                                        let fullText = '';
                                        let renderFullTextComment = '';
    
                                        if (wrapTryCatch(() => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText)) {
                                            console.log('Added purchaseAmountText for chat');
                                            renderFullTextComment += `<span class="ycs-chat_donation ycs-chat_donation__title">Donated: </span><span class="ycs-chat_donation ycs-chat_donation__bg">${comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText}</span><br><br>`;
                                            fullText += `${comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText} `;
                                        }
        
                                        for (const msg of chatMsgs) {
    
                                            try {
    
                                                fullText += msg?.text || '';
        
                                                if (parseInt(msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds) >= 0) {
                                                    renderFullTextComment += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${msg?.navigationEndpoint?.watchEndpoint?.videoId}&t=${msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}s" data-offsetvideo="${msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}">${msg?.text || ''}</a>`;
    
                                                    if (wrapTryCatch(() => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer)) {
                                                        comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.isTimeLine = 'timeline';
                                                    }
    
                                                } else if (msg?.navigationEndpoint) {
                                                    renderFullTextComment += `<a class="ycs-cpointer ycs-comment-link" href="${msg?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || msg?.navigationEndpoint?.urlEndpoint?.url || msg?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || msg?.text || '#'}" target="_blank">${msg?.text || ''}</a>`;

                                                } else if (wrapTryCatch(() => (msg as any).emoji)) {
                                                    const url = wrapTryCatch(() => {
                                                        const thumbnails = (msg as any).emoji.image.thumbnails;
                                                        return thumbnails[thumbnails.length - 1].url;
                                                    }) || '';
                                                    const alt = (wrapTryCatch(() => (msg as any).emoji.shortcuts?.[0]) as string) || '';
                                                    const style = `margin-left: 2px; margin-right: 2px;`;
                                                    renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="24" height="24" style="${style}" class="ycs-attachment">`;

                                                } else if (wrapTryCatch(() => (msg as any).attachment?.image)) {
                                                    const image: any = wrapTryCatch(() => (msg as any).attachment.image);
                                                    const url = image?.url || '';
                                                    const width = image?.width || 24;
                                                    const height = image?.height || 24;
                                                    const margin = image?.margin || { left: 0, right: 0 };
                                                    const style = `margin-left: ${margin.left || 0}px; margin-right: ${margin.right || 0}px;`;
                                                    const alt = (msg as any)?.text || '';
                                                    renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="${width}" height="${height}" style="${style}" class="ycs-attachment">`;

                                                } else {
                                                    renderFullTextComment += msg?.text || '';
                                                }
    
                                            } catch (e) {
                                                console.error(e);
                                                renderFullTextComment += msg?.text || '';
                                            }
                                        }
        
                                        if (fullText) {
        
                                            comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.fullText = fullText;
        
                                            comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.renderFullText = renderFullTextComment || fullText;
        
                                        }
        
                                        if (wrapTryCatch(() => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorName)) {
                                            chatCmnts.set(parseInt(timestampUsec, 10), _prepareFieldsChatComments(comment));
                                            showLoadComments(chatCmnts.size, elShowLoading);
                                        }
                                    }

                                } catch (err) {
                                    console.error(err);
                                    continue;
                                }
    
                            }
                            
                            currentOffsetTimeMsec = lastOffsetTimeInCmnts;
                        }
        
                    } else {
                        next = false;
                        return chatCmnts;
                    }
    
                }
    
                return chatCmnts;
    
            } catch (e) {
                console.error(e);
                return chatCmnts;
            }

        }
        
    } catch (e) {
        console.error(e);
        return;
    }

    return;

}

function getParamsForTranscript(w: any, param: string): object | undefined {
    
    try {
        
        return JSON.parse(JSON.stringify({
            'headers': {
                'accept': '*/*',
                'accept-language': w.ytcfg?.data_?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'content-type': 'application/json',
                'pragma': 'no-cache',
                'cache-control': 'no-store',
                'x-youtube-client-name': w.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': w.ytcfg.data_.INNERTUBE_CONTEXT_CLIENT_VERSION
            },
            'referrer': getCleanUrlVideo(w.location.href),
            'referrerPolicy': 'origin-when-cross-origin',
            'body': JSON.stringify({ context: { client: w.ytcfg.data_.INNERTUBE_CONTEXT.client }, params: param }),
            'method': 'POST',
            'mode': 'cors',
            'credentials': 'include'
        }));

    } catch (e) {
        console.error(e);
        return;
    }

}

function getTranscriptPot(): string | undefined {
    try {
        const bodyHtml = document.documentElement?.innerHTML || '';
        const matches = bodyHtml.match(/https?:[^\s"']+pot=[^\s"']+/g) || [];
        if (matches.length === 0) return;
        const buf = new URL(matches[0] as string).searchParams.get('pot');
        return buf ? encodeURIComponent(buf) : undefined;
    } catch (e) {
        console.error(e);
        return;
    }
}

async function getTranscriptBaseUrl(w: any, signal: AbortSignal): Promise<string> {
    const baseUrl = getCleanUrlVideo(w.location.href) as string;
    const htmlResp = await fetch(baseUrl, { signal, cache: 'no-store' } as RequestInit);
    const html = await htmlResp.text();
    const splitted = html.split('"captions":');
    if (splitted.length <= 1) throw new Error('Fail to load video html');
    const captions = JSON.parse(splitted[1].split(',"videoDetails')[0].replace('\n', '')).playerCaptionsTracklistRenderer;
    const generatedTracks = captions.captionTracks.filter(({ kind }: any) => kind === 'asr');
    const base = (generatedTracks.length === 0 ? captions.captionTracks[0].baseUrl : generatedTracks[0].baseUrl) as string;
    return base;
}

function buildTranscriptFromTimedText(xmlText: string): object | undefined {
    try {
        // extremely lightweight: extract plain text cues as fallback structure
        const entries: any[] = [];
        const regex = /<text start="([0-9.]+)" dur="([0-9.]+)">([\s\S]*?)<\/text>/g;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(xmlText))) {
            const start = parseFloat(m[1]);
            const dur = parseFloat(m[2]);
            const text = m[3].replace(/<\/?\w+[^>]*>/g, '');
            entries.push({ start, duration: dur, text });
        }
        const cueGroups = entries.map(({ text, start, duration }) => ({
            transcriptCueGroupRenderer: {
                formattedStartOffset: { simpleText: toFormatted(start) },
                cues: [ { transcriptCueRenderer: { startOffsetMs: start * 1000, cue: { simpleText: text } } } ],
            },
        }));
        return {
            actions: [
                {
                    updateEngagementPanelAction: {
                        content: {
                            transcriptRenderer: {
                                body: {
                                    transcriptBodyRenderer: { cueGroups },
                                },
                            },
                        },
                    },
                },
            ],
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

function toFormatted(sec: number): string {
    try {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        const sStr = (s < 10 ? `0${s}` : String(s));
        return `${m}:${sStr}`;
    } catch {
        return '0:00';
    }
}

async function getTranscriptVideo(signal: AbortSignal): Promise<object | undefined> {

    try {

        const initData = await getInitYtData(getCleanUrlVideo(window.location.href) as any, signal);

        if (initData) {
            
            const ytInitParam = findInitYParams(initData) as string;

            
            const params = getParamsForTranscript(window, ytInitParam);
            console.log('PARAMS for TRANSCRIPT', params);
            try {
                const transcript = await fetch(`https://www.youtube.com/youtubei/v1/get_transcript?key=${getInnertubeApiKey()}`, { ...params, signal, cache: 'no-store'});
                const result = await transcript.json();
                return result;
            } catch (e) {
                console.error('getTranscript via youtubei failed, trying fallback with pot param...', e);
                const pot = getTranscriptPot();
                if (pot) {
                    try {
                        const base = await getTranscriptBaseUrl(window, signal);
                        const viaTimedText = await fetch(`${base}&potc=1&pot=${pot}&c=WEB`, { signal, cache: 'no-store' } as RequestInit);
                        const text = await viaTimedText.text();
                        return buildTranscriptFromTimedText(text);
                    } catch (e2) {
                        console.error('fallback timedtext failed', e2);
                    }
                }
                return;
            }
        }
        
    } catch (e) {
        console.error(e);
        return;
    }

    return;
}

function removeNodeList(selector: string): void {
    if (typeof selector !== 'string') return;

    const nodeList = document.querySelectorAll(selector);
    for (const node of nodeList) {
        node.remove();
    }
}

async function getAllCommentsModeV2(elShowLoading: HTMLElement, signal: AbortSignal | undefined = undefined, container: object[] | undefined = undefined): Promise<object[]> {

    const _getTokensComments = async (): Promise<any | undefined> => {

        try {

            const detailsVideoV2 = await getDetailsVideoIDV2(window, getCleanUrlVideo(window.location.href) as string, signal as AbortSignal);
            const detailsVideoV2Token = objectScan(['**.contents.twoColumnWatchNextResults.results.results.contents[?].itemSectionRenderer.contents[?].continuationItemRenderer.continuationEndpoint.continuationCommand.token'], { joined: true, rtn: 'value', abort: true })(detailsVideoV2);
            console.log('objectScan detailsVideoV2Token: ', detailsVideoV2Token);

            const detailsCmntsVIDV2 = await getDetailsCommentsVideoIDV2(window, {
                url: getCleanUrlVideo(window.location.href),
                continue: detailsVideoV2Token
            }, signal as AbortSignal);

            console.log('detailsCmntsVIDV2: ', detailsCmntsVIDV2);

            const findPtrn = [
                '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.clickTrackingParams',
                '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.continuationCommand.command.clickTrackingParams',
                '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].trackingParams'
            ];

            let tokenComments;
            for (const ptrn of findPtrn) {

                try {
                    
                    tokenComments = objectScan([`${ptrn}`], { joined: true, rtn: 'value', abort: true })(detailsCmntsVIDV2);

                    if (tokenComments) break;

                } catch (err) {
                    console.error(err);
                    continue;
                }

            }

            const nextToken = objectScan(['**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.continuationCommand.token'], { joined: true, rtn: 'value', abort: true })(detailsCmntsVIDV2);

            return {
                continue: nextToken,
                clickTrackingParams: tokenComments
            };
            
        } catch (err) {
            console.error(err);
            return;
        }

    };

    const _prepareFieldsComment = (cmnt: any): object => {

        try {

            if(wrapTryCatch(() => cmnt.commentRenderer.actionButtons.commentActionButtonsRenderer.creatorHeart)) {

                try {
                    
                    cmnt.commentRenderer.creatorHeart = {
                        name: wrapTryCatch(() => cmnt.commentRenderer.actionButtons.commentActionButtonsRenderer.creatorHeart.creatorHeartRenderer.creatorThumbnail.accessibility.accessibilityData.label)
                    };

                } catch (err) {
                    console.error(err);
                }

            }

            if (wrapTryCatch(() => cmnt.commentRenderer.authorCommentBadge.authorCommentBadgeRenderer.icon.iconType.indexOf('CHECK') >= 0) ||
                wrapTryCatch(() => cmnt.commentRenderer.authorCommentBadge.authorCommentBadgeRenderer.iconTooltip.indexOf('Verified') >= 0)) {

                try {

                    cmnt.commentRenderer.verifiedAuthor = true; 
                    
                } catch (err) {
                    console.error(err);
                }

            }
            
            const fields = ['actionButtons', 'authorCommentBadge', 'collapseButton', 'expandButton', 'loggingDirectives', 'voteStatus', 'trackingParams', 'isLiked'];
    
            for (const f of fields) {
                wrapTryCatch(() => delete cmnt.commentRenderer[f]);
            }
    
            wrapTryCatch(() => delete cmnt.commentRenderer.authorThumbnail.accessibility);
            wrapTryCatch(() => cmnt.commentRenderer.authorThumbnail.thumbnails.length = 1);
            wrapTryCatch(() => delete cmnt.commentRenderer.authorThumbnail.thumbnails[0].height);
            wrapTryCatch(() => delete cmnt.commentRenderer.authorThumbnail.thumbnails[0].width);

            
            wrapTryCatch(() => delete cmnt.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.rootVe);
            wrapTryCatch(() => delete cmnt.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.webPageType);
            

            wrapTryCatch(() => delete cmnt.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.watchEndpoint.params);

            wrapTryCatch(() => delete cmnt.commentRenderer.authorEndpoint.clickTrackingParams);

            wrapTryCatch(() => delete cmnt.commentRenderer.authorEndpoint.commandMetadata.webCommandMetadata.apiUrl);
            wrapTryCatch(() => delete cmnt.commentRenderer.authorEndpoint.commandMetadata.webCommandMetadata.rootVe);
            wrapTryCatch(() => delete cmnt.commentRenderer.authorEndpoint.commandMetadata.webCommandMetadata.webPageType);

            wrapTryCatch(() => delete cmnt.commentRenderer.authorEndpoint.browseEndpoint.browseId);


            wrapTryCatch(() => delete cmnt.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.clickTrackingParams);

            if (wrapTryCatch(() => cmnt.commentRenderer.contentText.runs.length > 0)) {
                for (const [i, textPart] of cmnt.commentRenderer.contentText.runs.entries()) {
    
                    if (textPart.navigationEndpoint) {
                        wrapTryCatch(() => delete cmnt.commentRenderer.contentText.runs[i].navigationEndpoint.commandMetadata.webCommandMetadata.apiUrl);
                        wrapTryCatch(() => delete cmnt.commentRenderer.contentText.runs[i].navigationEndpoint.commandMetadata.webCommandMetadata.rootVe);
                        wrapTryCatch(() => delete cmnt.commentRenderer.contentText.runs[i].navigationEndpoint.commandMetadata.webCommandMetadata.webPageType);
                        
                        wrapTryCatch(() => delete cmnt.commentRenderer.contentText.runs[i].navigationEndpoint.clickTrackingParams);

                        wrapTryCatch(() => delete cmnt.commentRenderer.contentText.runs[i].text);
                    } else {
                        wrapTryCatch(() => delete cmnt.commentRenderer.contentText.runs[i]);
                    }

                }
            }
            
            return cmnt;
        } catch (err) {
            console.error(err);
            return cmnt;
        }
    
    };

    const comments: object[] = container || [];

    const replyQueue = new Queue({ concurrency: 4 });

    /**
     * Проходит в первой пачки комментариев и добаляет их в [comments] массив, предварительно соединив текст => fullText.
     * Также смотрит есть ли ответы (replies), добавляет их в массив 
     */
    // eslint-disable-next-line require-await
    async function _getAllRepliesComment(cmnts: any, nodeStatusLoading: HTMLElement): Promise<void> {
        if (!cmnts) return;

        // For authorized and unauthorized users
        const cmts: any = cmnts;
        console.log('cmts: ', cmts);

        for (const c of cmts) {

            try {

                if (c.commentThreadRenderer?.comment) {

                    let fullTextComment = '';
                    let renderFullTextComment = '';
    
                    const contentText = c.commentThreadRenderer?.comment?.commentRenderer?.contentText?.runs || [];
                    for (const partTextComment of contentText) {

                        fullTextComment += partTextComment?.text || '';
    
                        try {

                            if (parseInt(partTextComment?.navigationEndpoint?.watchEndpoint?.startTimeSeconds) >= 0) {
                                renderFullTextComment += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${partTextComment?.navigationEndpoint?.watchEndpoint?.videoId}&t=${partTextComment?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}s" data-offsetvideo="${partTextComment?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}">${partTextComment?.text || ''}</a>`;

                                if (c.commentThreadRenderer?.comment?.commentRenderer) {
                                    c.commentThreadRenderer.comment.commentRenderer.isTimeLine = 'timeline';
                                }

                            } else if (partTextComment?.navigationEndpoint) {
                                renderFullTextComment += `<a class=\"ycs-cpointer ycs-comment-link\" href=\"${partTextComment?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || partTextComment?.navigationEndpoint?.urlEndpoint?.url || partTextComment?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || partTextComment?.text || '#'}\" target=\"_blank\">${partTextComment?.text || ''}</a>`;
                                
                            } else if (wrapTryCatch(() => (partTextComment as any).emoji)) {
                                const url = wrapTryCatch(() => {
                                    const thumbnails = (partTextComment as any).emoji.image.thumbnails;
                                    return thumbnails[thumbnails.length - 1].url;
                                }) || '';
                                const alt = (wrapTryCatch(() => (partTextComment as any).emoji.shortcuts?.[0]) as string) || '';
                                const style = `margin-left: 2px; margin-right: 2px;`;
                                renderFullTextComment += `<img src=\"${url}\" alt=\"${alt}\" title=\"${alt}\" width=\"24\" height=\"24\" style=\"${style}\" class=\"ycs-attachment\">`;

                            } else if (wrapTryCatch(() => (partTextComment as any).attachment?.image)) {
                                const image: any = wrapTryCatch(() => (partTextComment as any).attachment.image);
                                const url = image?.url || '';
                                const width = image?.width || 24;
                                const height = image?.height || 24;
                                const margin = image?.margin || { left: 0, right: 0 };
                                const style = `margin-left: ${margin.left || 0}px; margin-right: ${margin.right || 0}px;`;
                                const alt = (partTextComment as any)?.text || '';
                                renderFullTextComment += `<img src=\"${url}\" alt=\"${alt}\" title=\"${alt}\" width=\"${width}\" height=\"${height}\" style=\"${style}\" class=\"ycs-attachment\">`;

                            } else {
                                renderFullTextComment += partTextComment?.text || '';
                            }

                        } catch (e) {
                            console.error(e);
                            renderFullTextComment += partTextComment?.text || '';
                            continue;
                        }
    
                    }
    
                    if (c.commentThreadRenderer?.comment?.commentRenderer?.contentText) {
                        c.commentThreadRenderer.comment.commentRenderer.contentText.fullText = fullTextComment;
                        c.commentThreadRenderer.comment.commentRenderer.contentText.renderFullText = renderFullTextComment;
                    }
    
                    if (c.commentThreadRenderer?.comment?.commentRenderer) {
                        c.commentThreadRenderer.comment.typeComment = 'C';
                        comments.push(_prepareFieldsComment(c.commentThreadRenderer.comment));
                        showLoadComments(comments.length, nodeStatusLoading);
                    }

                }
                

                const nextComments = {
                    token: wrapTryCatch(() => c.commentThreadRenderer.replies.commentRepliesRenderer.continuations[0].nextContinuationData.continuation) ||
                    wrapTryCatch(() => c.commentThreadRenderer.replies.commentRepliesRenderer.contents[0].continuationItemRenderer.continuationEndpoint.continuationCommand.token),
                    cTrParams: wrapTryCatch(() => c.commentThreadRenderer.replies.commentRepliesRenderer.continuations[0].nextContinuationData.clickTrackingParams) ||
                    wrapTryCatch(() => c.commentThreadRenderer.replies.commentRepliesRenderer.contents[0].continuationItemRenderer.continuationEndpoint.clickTrackingParams)
                };


                if (nextComments.token) {
    
                    replyQueue.add(async () => {
    
                        try {

                            const prms = {
                                continue: nextComments.token,
                                clickTracking: nextComments.cTrParams
                            };
    
                            const paramsCmnts = getParamsForReplies(window, prms);
                            const res = await fetchR(`https://www.youtube.com/youtubei/v1/next?key=${getInnertubeApiKey()}`, { ...paramsCmnts, signal, cache: 'no-store' } as RequestInit);
                            let data = await res.json();
                            console.log('Queue replies: ', data);
        
                            if (wrapTryCatch(() => data.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems)) {
        
                                const replies: any = wrapTryCatch(() => data.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems) || [];
                                for (const comment of replies) {

                                    if (!comment?.commentRenderer) continue;
        
                                    let fullTextComment = '';
                                    let renderFullTextComment = '';
        
                                    const contentText = comment.commentRenderer?.contentText?.runs || [];
                                    for (const partTextComment of contentText) {

                                        try {

                                            fullTextComment += partTextComment?.text || '';
        
                                            if (parseInt(partTextComment?.navigationEndpoint?.watchEndpoint?.startTimeSeconds) >= 0) {
            
                                                renderFullTextComment += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${partTextComment?.navigationEndpoint?.watchEndpoint?.videoId}&t=${partTextComment?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}s" data-offsetvideo="${partTextComment?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}">${partTextComment?.text || ''}</a>`;

                                                if (comment.commentRenderer) {
                                                    comment.commentRenderer.isTimeLine = 'timeline';
                                                }
            
                                            } else if (partTextComment?.navigationEndpoint) {
                                                renderFullTextComment += `<a class=\"ycs-cpointer ycs-comment-link\" href=\"${partTextComment?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || partTextComment?.navigationEndpoint?.urlEndpoint?.url || partTextComment?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || partTextComment?.text || '#'}\" target=\"_blank\">${partTextComment?.text || ''}</a>`;

                                            } else if (wrapTryCatch(() => (partTextComment as any).emoji)) {
                                                const url = wrapTryCatch(() => {
                                                    const thumbnails = (partTextComment as any).emoji.image.thumbnails;
                                                    return thumbnails[thumbnails.length - 1].url;
                                                }) || '';
                                                const alt = (wrapTryCatch(() => (partTextComment as any).emoji.shortcuts?.[0]) as string) || '';
                                                const style = `margin-left: 2px; margin-right: 2px;`;
                                                renderFullTextComment += `<img src=\"${url}\" alt=\"${alt}\" title=\"${alt}\" width=\"24\" height=\"24\" style=\"${style}\" class=\"ycs-attachment\">`;

                                            } else if (wrapTryCatch(() => (partTextComment as any).attachment?.image)) {
                                                const image: any = wrapTryCatch(() => (partTextComment as any).attachment.image);
                                                const url = image?.url || '';
                                                const width = image?.width || 24;
                                                const height = image?.height || 24;
                                                const margin = image?.margin || { left: 0, right: 0 };
                                                const style = `margin-left: ${margin.left || 0}px; margin-right: ${margin.right || 0}px;`;
                                                const alt = (partTextComment as any)?.text || '';
                                                renderFullTextComment += `<img src=\"${url}\" alt=\"${alt}\" title=\"${alt}\" width=\"${width}\" height=\"${height}\" style=\"${style}\" class=\"ycs-attachment\">`;

                                            } else {
                                                renderFullTextComment += partTextComment?.text || '';
                                            }

                                        } catch (e) {
                                            console.error(e);
                                            renderFullTextComment += partTextComment?.text || '';
                                        }
                                        
                                    }
        
                                    if (comment?.commentRenderer?.contentText) {
                                        comment.commentRenderer.contentText.fullText = fullTextComment;
                                        comment.commentRenderer.contentText.renderFullText = renderFullTextComment;
                                    }
        
                                    comment.typeComment = 'R';
                                    comment.originComment = c.commentThreadRenderer.comment;
                                    comments.push(_prepareFieldsComment(comment));

                                    showLoadComments(comments.length, nodeStatusLoading);
                                }
        
                            }
        
                            while (wrapTryCatch(() => data.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems[data.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems.length - 1].continuationItemRenderer.button.buttonRenderer.command.continuationCommand)) {
                                
                                const rPrms = {
                                    continue: wrapTryCatch(() => data.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems[data.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems.length - 1].continuationItemRenderer.button.buttonRenderer.command.continuationCommand.token),
                                    clickTracking: wrapTryCatch(() => data.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems[data.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems.length - 1].continuationItemRenderer.button.buttonRenderer.command.clickTrackingParams)
                                };
                                
                                const rParamsCmnts = getParamsForReplies(window, rPrms);
        
                                const resReplies = await fetchR(`https://www.youtube.com/youtubei/v1/next?key=${getInnertubeApiKey()}`, { ...rParamsCmnts, signal, cache: 'no-store' } as RequestInit);
                                data = await resReplies.json();
        
                                if (wrapTryCatch(() => data.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems)) {
        
                                    const replies: any = wrapTryCatch(() => data.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems) || [];
                                    for (const comment of replies) {

                                        if (!comment?.commentRenderer) continue;
        
                                        let fullTextComment = '';
                                        let renderFullTextComment = '';
        
                                        const contentText = comment.commentRenderer?.contentText?.runs || [];
                                        for (const partTextComment of contentText) {

                                            try {

                                                if (partTextComment.text) {
                                                    fullTextComment += partTextComment?.text || '';
                                                }
            
                                                if (parseInt(partTextComment?.navigationEndpoint?.watchEndpoint?.startTimeSeconds) >= 0) {
            
                                                    renderFullTextComment += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${partTextComment?.navigationEndpoint?.watchEndpoint?.videoId}&t=${partTextComment?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}s" data-offsetvideo="${partTextComment?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}">${partTextComment?.text || ''}</a>`;
    
                                                    if (comment.commentRenderer) {
                                                        comment.commentRenderer.isTimeLine = 'timeline';
                                                    }
                
                                                } else if (partTextComment?.navigationEndpoint) {
                                                    renderFullTextComment += `<a class="ycs-cpointer ycs-comment-link" href="${partTextComment?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || partTextComment?.navigationEndpoint?.urlEndpoint?.url || partTextComment?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || partTextComment?.text || '#'}" target="_blank">${partTextComment?.text || ''}</a>`;

                                                } else {
                                                    renderFullTextComment += partTextComment?.text || '';
                                                }

                                            } catch (e) {
                                                console.error(e);
                                                renderFullTextComment += partTextComment?.text || '';
                                            }

                                        }
        
                                        if (comment?.commentRenderer?.contentText) {
                                            comment.commentRenderer.contentText.fullText = fullTextComment;
                                            comment.commentRenderer.contentText.renderFullText = renderFullTextComment;
                                        }
                                        
                                        comment.typeComment = 'R';
                                        comment.originComment = c.commentThreadRenderer.comment;
                                        comments.push(_prepareFieldsComment(comment));
                                        showLoadComments(comments.length, nodeStatusLoading);
                                    }

                                }
                            }
        
                        } catch (e) {
                            console.error(e);
                        }
                    
                    });
    
                }

            } catch (e) {
                console.error(e);
                continue;
            }

        }

    }

    try {
        
        let response, data: any;
        try {

            console.log('Try get comments with inner tube api key');

            const tokensComments = await _getTokensComments();
            console.log('_getTokenComments(): ', tokensComments);

            console.log('tokenComments: ', tokensComments);

            let paramsCmnts;
            if (tokensComments.clickTrackingParams) {

                paramsCmnts = getParamsForComments(window, {
                    continue: tokensComments.continue,
                    clickTrackingParams: tokensComments.clickTrackingParams
                });

                console.log('WITHOUT REFRESH!');

            } else {

                paramsCmnts = getParamsForComments(window, {
                    continue: wrapTryCatch(() => objectScan(['**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.continuationCommand.token'], { joined: true, rtn: 'value', abort: true })((window as any).ytInitialData)),
                    clickTrackingParams: wrapTryCatch(() => objectScan(['**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.clickTrackingParams'], { joined: true, rtn: 'value', abort: true })((window as any).ytInitialData))
                });

                console.log('objectScan REFRESH: ', wrapTryCatch(() => objectScan(['**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.continuationCommand.token'], { joined: true, rtn: 'value', abort: true })((window as any).ytInitialData)));
            }

            if (paramsCmnts) {
                response = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${getInnertubeApiKey()}`, { ...paramsCmnts, signal, cache: 'no-store' } as RequestInit);
            }

            if (response?.status === 200) {
                
                const res = await response.json();
                console.log('response: ', response);
                data = res;
                console.log('data; ', data);
                
            } else {
                // removeNodeList('.iframe_ytInitialData');
                return [];
            }

        } catch (err) {
            console.error(err);
            // removeNodeList('.iframe_ytInitialData');
            return [];
        }

        let cmnts: any = wrapTryCatch(() => data.onResponseReceivedEndpoints[1].reloadContinuationItemsCommand.continuationItems);

        while (cmnts?.length > 0) {

            await _getAllRepliesComment(cmnts, elShowLoading);

            const lastComment = cmnts[cmnts.length - 1];
            console.log('last comment: ', lastComment);
            if (lastComment?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token) {
                        
                console.log('Comment next Token: ', lastComment?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token);

                const prms = {
                    continue: lastComment?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token
                };
    
                const paramsCmnts = getParamsForComments(window, prms);
                const res = await fetchR(`https://www.youtube.com/youtubei/v1/next?key=${getInnertubeApiKey()}`, { ...paramsCmnts, signal, cache: 'no-store' } as RequestInit);
    
                if (res?.status === 200) {
                    
                    const resJson = await res.json();
                    console.log('resJson: ', resJson);
                    cmnts = wrapTryCatch(() => resJson.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems) || [];
                    console.log('cmnts; ', cmnts);
                    
                } else {
                    cmnts = [];
                }

            } else {
                cmnts = [];
                console.log('else last comment: ', cmnts);
            }

            console.log('iteration comments: ', comments.length);

        }
        console.log('END iteration push, now comments size is: ', comments.length);


    } catch (e) {
        console.error(e);
        // console.log('errorRequestComments: ', errorRequestComments);
        return comments;
    }

    // console.log('reply Queue: ', replyQueue);

    await replyQueue.onIdle();
    // console.log('errorRequestComments: ', errorRequestComments);

    return comments;

}

function msToRoundSec(msNumber: string | number): number | undefined {
    
    try {

        const value = typeof msNumber === 'string' ? parseFloat(msNumber) : msNumber;
        if (!Number.isNaN(value) && value > 0) {
            return parseInt((value / 1000) as any, 10);
        }

        return;
        
    } catch (e) {
        console.error(e);
        return;
    }

}

function msToShareVideo(msNumber: string | number): string | undefined {

    try {

        const u = new URL(window.location.href);
        const vParam = u.searchParams.get('v');

        const shareUrl = `https://youtu.be/${vParam}?t=${msToRoundSec(msNumber) || 0}`;

        return shareUrl;
        
    } catch (e) {
        console.error(e);
        return;
    }

}

function sendMsgToBadge(typeMsg: string, msg: string | number): void {

    try {

        if ((typeof msg === 'string' || typeof msg === 'number') &&
             typeof typeMsg === 'string') {
            window.postMessage({ type: typeMsg.toString(), text: msg.toString() }, window.location.origin);
        }

        
    } catch (e) {
        console.error(e);
    }

}

function tmUsecToDateTime(microSec: string | number): string {

    const value = typeof microSec === 'string' ? parseFloat(microSec) : microSec;
    if (!Number.isNaN(value) && value > 0) {
        const dateTime = new Date((value as any) / 1000);

        return `${dateTime.toISOString().split('T')[0]}, ${dateTime.toISOString().split('T')[1].split('.')[0].slice(0, 5)}`;
    }

    return '';
}

function downloadFile(content: string, fileName: string, type: string): void {

    try {
        
        const a = document.createElement('a');
        const file = new Blob([content], {type: type});
        
        a.href= URL.createObjectURL(file);
        a.download = fileName;
        a.click();

        URL.revokeObjectURL(a.href);

    } catch (e) {
        console.error(e);
        return;
    }

}

function openComments(comments: any): WindowProxy | undefined {
    if (!comments.count && !comments.html) return;

    try {
        
        const commentsNewWindow = window.open('', 'CommentsNewWindow', 'width=640,height=700,menubar=0,toolbar=0,location=0,status=0,resizable=1,scrollbars=1,directories=0,channelmode=0,titlebar=0,top=25,left=25');

        if (commentsNewWindow) {
            commentsNewWindow.document.title = `Comments, ${document.title} (${comments.count})`;
            const elWrapPre = document.createElement('pre');
            elWrapPre.style.cssText = 'word-wrap: break-word; white-space: pre-wrap;';
            elWrapPre.insertAdjacentText('afterbegin', `
YCS - YouTube Comment Search

Comments
File created by ${new Date().toString()}
Video URL: ${getCleanUrlVideo(window.location.href)}
Title: ${document.title}
Total: ${comments.count}\n${comments.html}`);
            commentsNewWindow.document.body.textContent = '';
            commentsNewWindow.document.body.appendChild(elWrapPre);
            return commentsNewWindow;
        }

        return;

    } catch (e) {
        console.error(e);
        return;
    }

}

function openCommentsChat(comments: any): WindowProxy | undefined {
    if (!comments.count && !comments.html) return;

    try {
        
        const commentsNewWindow = window.open('', 'CommentsChatNewWindow', 'width=640,height=700,menubar=0,toolbar=0,location=0,status=0,resizable=1,scrollbars=1,directories=0,channelmode=0,titlebar=0,top=50,left=50');

        if (commentsNewWindow) {
            commentsNewWindow.document.title = `Comments chat, ${document.title} (${comments.count})`;
            const elWrapPre = document.createElement('pre');
            elWrapPre.style.cssText = 'word-wrap: break-word; white-space: pre-wrap;';
            elWrapPre.insertAdjacentText('afterbegin', `
YCS - YouTube Comment Search

Comments chat
File created by ${new Date().toString()}
Video URL: ${getCleanUrlVideo(window.location.href)}
Title: ${document.title}
Total: ${comments.count}\n${comments.html}`);
            commentsNewWindow.document.body.textContent = '';
            commentsNewWindow.document.body.appendChild(elWrapPre);
            return commentsNewWindow;
        }

        return;

    } catch (e) {
        console.error(e);
        return;
    }

}

function openCommentsTrVideo(comments: any): WindowProxy | undefined {
    if (!comments.count && !comments.html) return;

    try {
        
        const commentsNewWindow = window.open('', 'CommentsTrVideoNewWindow', 'width=640,height=700,menubar=0,toolbar=0,location=0,status=0,resizable=1,scrollbars=1,directories=0,channelmode=0,titlebar=0,top=75,left=75');

        if (commentsNewWindow) {
            commentsNewWindow.document.title = `Transcript video, ${document.title} (${comments.count})`;
            const elWrapPre = document.createElement('pre');
            elWrapPre.style.cssText = 'word-wrap: break-word; white-space: pre-wrap;';
            elWrapPre.insertAdjacentText('afterbegin', `
YCS - YouTube Comment Search

Transcript video
File created by ${new Date().toString()}
Video URL: ${getCleanUrlVideo(window.location.href)}
Title: ${document.title}
Total: ${comments.count}\n${comments.html}`);
            commentsNewWindow.document.body.textContent = '';
            commentsNewWindow.document.body.appendChild(elWrapPre);
            return commentsNewWindow;
        }

        return;

    } catch (e) {
        console.error(e);
        return;
    }

}

function getCommentsHtmlText(comments: any): any | undefined {
    if (!Array.isArray(comments)) return;

    try {
        
        let html = '';
        let countComment = 0;

        const cmnts: Set<any> = new Set(),
            replies: Set<any> = new Set();

        for (const c of comments) {

            if (c?.typeComment === 'C') {
                c.commentRenderer.ycsReplies = [];
                cmnts.add(c);
            } else if (c?.typeComment === 'R') {
                replies.add(c);
            }

        }

        console.log('cmnts: ', cmnts);
        console.log('replies: ', replies);
        for (const c of cmnts) {

            if (wrapTryCatch(() => c.commentRenderer.replyCount > 0)) {

                for (const r of replies) {
    
                    if (r?.originComment.commentRenderer.commentId === c.commentRenderer.commentId) {
                        c.commentRenderer.ycsReplies.push(r);
                        // console.log('push to ycsReplies: ', r);
                        replies.delete(r);
                    }
    
                }
                
            }

        }

        const getUserMember = (cmnt: any): string => {

            try {

                if (cmnt?.commentRenderer?.sponsorCommentBadge?.sponsorCommentBadgeRenderer?.tooltip) {
                    const tooltip = cmnt.commentRenderer.sponsorCommentBadge.sponsorCommentBadgeRenderer.tooltip;
                    return ` | member: ${tooltip}`;
                }
                
                return '';

            } catch (err) {
                console.error(err);
                return '';
            }

        };

        const renderTypeComment = (cmnt: any): string => {

            try {

                if (cmnt?.typeComment === 'C') {
                    return '[COMMENT]';
                } else if (cmnt?.typeComment === 'R') {
                    return '[REPLY]';
                }
                
                return '';

            } catch (err) {
                console.error(err);
                return '';
            }

        };

        const renderCountReply = (cmnt: any): string => {

            try {

                if (cmnt?.typeComment === 'C') {
                    return ` | reply: ${cmnt?.commentRenderer?.replyCount || 0}`;
                }
                
                return '';

            } catch (err) {
                console.error(err);
                return '';
            }

        };

        const renderReplies = (cmnt: any): string => {

            try {

                // console.log('cmnt: ', cmnt);

                if (cmnt?.commentRenderer?.ycsReplies?.length > 0) {

                    let resReplies = '\nReplies:\n';
                    
                    for (const c of cmnt.commentRenderer.ycsReplies) {
                        countComment++;

                        resReplies += `
${renderTypeComment(c)}
${c?.commentRenderer?.authorText?.simpleText || ''}
youtube.com${c?.commentRenderer?.authorEndpoint?.commandMetadata?.webCommandMetadata?.url || ''}\n
youtube.com${wrapTryCatch(() => c.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url) || ''}
${wrapTryCatch(() => c.commentRenderer.publishedTimeText.runs[0].text) || ''} | like: ${c?.commentRenderer?.likeCount || c?.commentRenderer?.voteCount?.simpleText || 0}${renderCountReply(c)}${getUserMember(c)}\n
${c?.commentRenderer?.contentText?.fullText || ''}\n
                        `;
                    }

                    return resReplies;
                }
                
                return '';

            } catch (err) {
                console.error(err);
                return '';
            }

        };

        console.log('Comments: ', comments);

        for (const c of cmnts) {
    
            try {

                countComment++;

                html += `
\n#####\n
${renderTypeComment(c)}
${c?.commentRenderer?.authorText?.simpleText || ''}
youtube.com${c?.commentRenderer?.authorEndpoint?.commandMetadata?.webCommandMetadata?.url || ''}\n
youtube.com${wrapTryCatch(() => c.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url) || ''}
${wrapTryCatch(() => c.commentRenderer.publishedTimeText.runs[0].text) || ''} | like: ${c?.commentRenderer?.likeCount || c?.commentRenderer?.voteCount?.simpleText || 0}${renderCountReply(c)}${getUserMember(c)}\n
${c?.commentRenderer?.contentText?.fullText || ''}
${renderReplies(c)}
#####\n`;

            } catch (e) {
                console.error(e);
                continue;
            }
    
        }

        // cmnts.clear();
        // replies.clear();
        
        return {
            count: countComment,
            html: html
        };

    } catch (e) {
        console.error(e);
        return;
    }

}

function getCommentsChatHtmlText(comments: any): any | undefined {
    if (!Array.isArray(comments)) return;

    try {
        
        let html = '';
        let countComment = 0;

        for (const c of comments) {
    
            try {

                countComment++;

                html += `
\n#####\n
${wrapTryCatch(() => c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorName.simpleText) || ''}
youtube.com/channel/${wrapTryCatch(() => c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorExternalChannelId) || ''}\n
date: ${wrapTryCatch(() => new Date(c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.timestampUsec / 1000).toISOString().slice(0, -5)) || ''}\n
${wrapTryCatch(() => c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText) ? 'donated: ' + c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText + '\n' : ''}
${wrapTryCatch(() => c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.fullText) || ''}
\n#####\n`;

            } catch (e) {
                console.error(e);
                continue;
            }
    
        }
        
        return {
            count: countComment,
            html: html
        };

    } catch (e) {
        console.error(e);
        return;
    }

}

function getCommentsTrVideoHtmlText(comments: any): any | undefined {
    if (!Array.isArray(comments)) return;

    try {
        
        let html = '';
        let countComment = 0;

        for (const c of comments) {
    
            try {

                countComment++;

                html += `
\n#####\n
Time: ${c?.transcriptCueGroupRenderer?.formattedStartOffset?.simpleText || 0}\n
${wrapTryCatch(() => c.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.cue.simpleText) || ''}
\n#####\n`;

            } catch (e) {
                console.error(e);
                continue;
            }
    
        }
        
        return {
            count: countComment,
            html: html
        };

    } catch (e) {
        console.error(e);
        return;
    }

}

function filterAuthorComments(comments: any): [] {

    if (comments.length === 0) return [];

    try {
        const fAuthor: any = [];

        for (const [i, c] of comments.entries()) {
            if (c?.commentRenderer?.authorIsChannelOwner) {
                
                fAuthor.push({ item: c, refIndex: i });
            }
        }

        return fAuthor;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function filterAuthorChat(comments: any): [] {

    if (comments.length === 0) return [];

    try {
        const fAuthor: any = [];
        const channelID = wrapTryCatch(() => GlobalStore.getInitYtData[2].playerResponse.videoDetails.channelId);

        if (channelID) {

            for (const [i, c] of comments.entries()) {

                try {

                    const authorExternalChannelId = wrapTryCatch(() => c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorExternalChannelId);
                    if (authorExternalChannelId === channelID) {
                        fAuthor.push({ item: c, refIndex: i });
                    }
                
                } catch (err) {
                    console.error(err);
                    continue;
                }

            }

        } else {
            console.log('Not AUTHOR FOR CHAT COMMENTS!');
        }


        console.log('GlobalStore.getInitYtData: ', GlobalStore.getInitYtData);

        return fAuthor;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function filterLikesComments(comments: any): [] {

    if (comments.length === 0) return [];

    try {

        const fLike: any = [];
        const cmntsBigLikes = []; 
        
        for (const [i, c] of comments.entries()) {

            let likes = c?.commentRenderer?.voteCount?.simpleText || c?.commentRenderer?.likeCount;

            if (isNumeric(likes)) {

                likes = parseInt(likes);
                
            } else if (typeof likes === 'string' || typeof likes === 'number') {

                const bigLike = parseFloat(likes as any) * 1000;

                if (bigLike === bigLike) {
                    likes = bigLike;
                } else if (typeof likes === 'string') {
                    console.log('LIKES IS STRING!', likes);
                    cmntsBigLikes.push({ item: c, refIndex: i });
                }
            }
            
            if (typeof likes === 'number' && likes === likes) {
                c.commentRenderer.likesForSort = likes;
                fLike.push({ item: c, refIndex: i });
            }

        }

        if (fLike.length > 0) {

            fLike.sort((first: any, second: any) => {                
                return second.item.commentRenderer.likesForSort - first.item.commentRenderer.likesForSort;
            });

        }

        if (cmntsBigLikes.length > 0) {
            console.log('cmntsBigLikes: ', cmntsBigLikes);

            cmntsBigLikes.sort((f: any, s: any) => {
                if (f.item.commentRenderer.voteCount.simpleText > s.item.commentRenderer.voteCount.simpleText) {
                    return 1;
                }

                if (f.item.commentRenderer.voteCount.simpleText < s.item.commentRenderer.voteCount.simpleText) {
                    return -1;
                }

                return 0;
            });

            for (const bc of cmntsBigLikes) {
                fLike.unshift(bc);
            }
        }

        return fLike;

    } catch (err) {
        console.error(err);
        return [];
    }

}

function filterRepliedComments(comments: any): [] {

    if (comments.length === 0) return [];

    try {

        const fReplied: any = [];
        
        for (const [i, c] of comments.entries()) {

            let replied = c?.commentRenderer?.replyCount;
            replied = parseInt(replied);
            
            if (replied) {
                c.commentRenderer.repliedForSort = replied;
                fReplied.push({ item: c, refIndex: i });
            }

        }

        if (fReplied.length > 0) {

            fReplied.sort((first: any, second: any) => {
                return second.item.commentRenderer.repliedForSort - first.item.commentRenderer.repliedForSort;
            });

            return fReplied;

        }

        return [];

    } catch (err) {
        console.error(err);
        return [];
    }

}

function filterMemberComments(comments: any): [] {

    if (comments.length === 0) return [];

    try {

        const fMembers: any = [];

        for (const [i, c] of comments.entries()) {

            const member = c?.commentRenderer?.sponsorCommentBadge?.sponsorCommentBadgeRenderer?.tooltip;
            
            if (member) {
                fMembers.push({ item: c, refIndex: i });
            }

        }

        return fMembers;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function filterMembersChat(comments: any): [] {

    if (comments.length === 0) return [];

    try {

        const fMembers: any = [];

        for (const c of comments) {

            const authorBadge: any =  wrapTryCatch(() => c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorBadges);
            let member: any;

            console.log('FILTER authorBadge: ', authorBadge);

            if (authorBadge?.length > 0) {

                for (const m of authorBadge) {
                    if (m?.liveChatAuthorBadgeRenderer?.customThumbnail) {
                        member = m;
                        break;
                    }
                }

            }

            if (member) {
                fMembers.push({ item: c });
            }

        }

        return fMembers;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function filterDonatedChat(comments: any): [] {

    if (comments.length === 0) return [];

    try {

        const fDonated: any = [];

        for (const c of comments) {

            if (wrapTryCatch(() => c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText)) {
                fDonated.push({ item: c });
            }

        }


        console.log('Donated CHAT: ', fDonated);
        return fDonated;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function initShowBarFAQ(): void {

    try {

        const hCloseModalOut = (e: Event): void => {

            try {

                const elModalWindow = document.getElementById('ycs_modal_window') as HTMLElement;

                if (e.target == elModalWindow) {
                    elModalWindow.style.display = 'none';

                    const elYCSApp = document.getElementsByClassName('ycs-app')[0];
                    elYCSApp?.removeEventListener('click', hCloseModalOut);
                }

            } catch (err) {
                console.error(err);
            }

        };

        const hOpenModal = (): void => {

            try {
                
                const elModalWindow = document.getElementById('ycs_modal_window') as HTMLElement;
                elModalWindow.style.display = 'block';

                const elYCSApp = document.getElementsByClassName('ycs-app')[0];
                elYCSApp?.addEventListener('click', hCloseModalOut);

            } catch (err) {
                console.error(err);
            }

        };

        const hCloseModal = (): void => {

            try {
                
                const elModalWindow = document.getElementById('ycs_modal_window') as HTMLElement;
                elModalWindow.style.display = 'none';

            } catch (err) {
                console.error(err);
            }

        };

        const btnCloseModal = document.getElementById('ycs_btn_close_modal');
        const btnOpenModal = document.getElementById('ycs_btn_open_modal');

        btnCloseModal?.addEventListener('click', hCloseModal);
        btnOpenModal?.addEventListener('click', hOpenModal);


    } catch (err) {
        console.error(err);
    }

}

function filterHeartComments(comments: any): [] {

    if (comments.length === 0) return [];

    try {
        const fHeart: any = [];

        for (const [i, c] of comments.entries()) {
            if (c?.commentRenderer?.creatorHeart) {
                
                fHeart.push({ item: c, refIndex: i });
            }
        }

        return fHeart;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function filterLinksComments(comments: any): [] {

    if (comments.length === 0) return [];

    try {
        const fLinks: any = [];

        for (const [i, c] of comments.entries()) {

            try {

                if (urlRegex().test(c.commentRenderer.contentText.fullText)) {
                    fLinks.push({ item: c, refIndex: i });
                }

            } catch (err) {
                console.error(err);
                continue;
            }
            
        }

        return fLinks;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function filterVerifiedComments(comments: any): [] {

    if (comments.length === 0) return [];

    try {
        const fVerified: any = [];

        for (const [i, c] of comments.entries()) {
            if (c.commentRenderer.verifiedAuthor) {
                
                fVerified.push({ item: c, refIndex: i });
            }
        }

        return fVerified;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function filterLinksChatComments(comments: any): [] {

    if (comments.length === 0) return [];

    try {
        const fLinks: any = [];

        for (const [i, c] of comments.entries()) {
            if (wrapTryCatch(() => urlRegex().test(c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.fullText))) {
                fLinks.push({ item: c, refIndex: i });
            }
        }

        return fLinks;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function filterVerifiedChatComments(comments: any): [] {

    if (comments.length === 0) return [];

    try {
        const fVerified: any = [];

        for (const [i, c] of comments.entries()) {
            if (wrapTryCatch(() => c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.verifiedAuthor)) {
                console.log('filterVerifiedChatComments refIndex: ', i);
                console.log('filterVerifiedChatComments comments: ', c);
                fVerified.push({ item: c, refIndex: i });
            }
        }

        return fVerified;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function filterLinksTrpVideoComments(comments: any): [] {

    if (comments.length === 0) return [];

    try {
        const fLinks: any = [];

        for (const c of comments) {

            try {

                if (urlRegex().test(c.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.cue.simpleText)) {
                    fLinks.push({ item: c, refIndex: c.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.startOffsetMs });
                }

            } catch (err) {
                console.error(err);
                continue;
            }
            
        }

        return fLinks;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function filterAllTrpVideoComments(comments: any): [] {

    if (comments.length === 0) return [];

    try {
        const fAllTrpVideo: any = [];

        for (const c of comments) {

            try {
                
                fAllTrpVideo.push({ item: c, refIndex: c.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.startOffsetMs });

            } catch (err) {
                console.error(err);
                continue;
            }
            
        }

        return fAllTrpVideo;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function getPiP(): {
    supported: boolean;
    request: (v: HTMLVideoElement) => Promise<PictureInPictureWindow>;
    exit: (v?: any) => Promise<void>;
    isActive: (v: HTMLVideoElement) => boolean;
    } {

    try {
        
        if (typeof document === 'undefined') return { supported: false } as any;

        const video = document.createElement('video') as any;
    
        // Chrome
        // https://developers.google.com/web/updates/2018/10/watch-video-using-picture-in-picture
        if (document.pictureInPictureEnabled && !video.disablePictureInPicture) {
            return {
                supported: true,
                request: (v: HTMLVideoElement): Promise<PictureInPictureWindow> => {
                    return v.requestPictureInPicture();
                },
                exit: (): Promise<void> => {
                    return document.exitPictureInPicture();
                },
                isActive: (v: HTMLVideoElement): boolean => {
                    return v === document.pictureInPictureElement;
                },
            };
        }
    
        // Safari
        // https://developer.apple.com/documentation/webkitjs/adding_picture_in_picture_to_your_safari_media_controls
        if (typeof video.webkitSetPresentationMode === 'function') {
            // Mobile safari says it supports webkitPresentationMode, but you can't pip there.
            if (/ipad|iphone/i.test(window.navigator.userAgent)) {
                return { supported: false } as any;
            }
            return {
                supported: true,
                request: (v: any): any => {
                    return v.webkitSetPresentationMode('picture-in-picture');
                },
                exit: (v: any): any => {
                    return v.webkitSetPresentationMode('inline');
                },
                isActive: (v: any): boolean => {
                    return v.webkitPresentationMode === 'picture-in-picture';
                },
            };
        }
    
        // No firefox JS API https://github.com/mozilla/standards-positions/issues/72
        return {
            supported: false,
        } as any;

    } catch (err) {
        console.error(err);
        return { supported: false } as any;
    }

}

function initShowViewMode(): void {

    try {

        if (!getPiP().supported) return;

        const _initHotKey = (): void => {

            try {

                const hPressHotKey = async (e: KeyboardEvent): Promise<void> => {

                    try {

                        if (e.altKey && e.code === 'Backquote') {
                            // eslint-disable-next-line @typescript-eslint/no-use-before-define
                            await hViewMode();
                        }
                        
                    } catch (err) {
                        console.error(err);
                    }

                };
                
                document.addEventListener('keyup', hPressHotKey, false);

            } catch (err) {
                console.error(err);
            }

        };

        const hViewMode = async (): Promise<void> => {

            try {

                const anchorJump = (id: string): void => {
                    const anchorTop = (document.getElementById(id) as HTMLInputElement).offsetTop as number;
                    window.scrollTo(0, anchorTop);   
                };
                
                const elVideo = document.getElementsByTagName('video')[0] as HTMLVideoElement;
                
                const videoPip = getPiP();

                if (elVideo && videoPip.supported) {

                    if (videoPip.isActive(elVideo)) {
                        await videoPip.exit();
                        window.scrollTo(0, 0);
                        document.getElementById('ycs-input-search')?.blur();
                        document.getElementById('search')?.focus();
                    } else {
                        await videoPip.request(elVideo);
                        document.getElementById('ycs-input-search')?.focus();
                        anchorJump('ycs_anchor_vmode');
                    }

                }


            } catch (err) {
                console.error(err);
            }

        };
        
        const elBtnViewMode = document.getElementById('ycs_view_mode');
        elBtnViewMode?.addEventListener('click', hViewMode);

        _initHotKey();
    } catch (err) {
        console.error(err);
    }

}

function getRandomComment(comments: any): [] {

    if (comments.length === 0) return [];

    try {

        const authors = new Map;

        for (const [i, cmnt] of comments.entries()) {

            if (cmnt?.typeComment === 'C') {
                
                if (authors.has(wrapTryCatch(() => cmnt.commentRenderer.authorEndpoint.browseEndpoint.canonicalBaseUrl))) {

                    const cmntsPos = authors.get(cmnt.commentRenderer.authorEndpoint.browseEndpoint.canonicalBaseUrl);
                    cmntsPos.add(i);

                } else if (wrapTryCatch(() => cmnt.commentRenderer.authorEndpoint.browseEndpoint.canonicalBaseUrl)) {

                    authors.set(cmnt.commentRenderer.authorEndpoint.browseEndpoint.canonicalBaseUrl, (new Set).add(i));
                }

            }

        }

        console.log('get Random Comment, Authors: ', authors);

        if (authors.size > 0) {

            const authorPos = getRandomInt(0, authors.size - 1);

            console.log('authorPos: ', authorPos);

            let i = 0;
            for (const [, posIndex] of authors.entries()) {
                if (i === authorPos) {
                    
                    const authorCommentPos = getRandomInt(0, posIndex.size - 1);
                    console.log('posIndex: ', posIndex);
                    console.log('authorCommentPos: ', authorCommentPos);

                    let index = 0;
                    for (const [, authorCommentPosIndex] of posIndex.entries()) {
                        if (index === authorCommentPos) {

                            console.log('authorCommentPosIndex: ', authorCommentPosIndex);
                            console.log('[{ item: comments[authorCommentPosIndex], refIndex: authorCommentPosIndex }]: ', [{ item: comments[authorCommentPosIndex], refIndex: authorCommentPosIndex }]);
                            return [{ item: comments[authorCommentPosIndex], refIndex: authorCommentPosIndex }] as any;
                        }

                        index++;
                        continue;
                    }
                    break;
                }

                i++;
                continue;
            }

        } else {
            return [];
        }

        return [];
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function filterNewestFirst(comments: any): ICommentsFuseResult[] | void {

    try {
        
        if (comments && comments.length === 0) return;

        const res: ICommentsFuseResult[] = [];

        for (const [i, comment] of comments.entries()) {

            try {

                if (comment?.typeComment === 'C') {
                    
                    res.push({
                        item: comment as ICommentItem,
                        refIndex: i as number
                    });

                }

                
            } catch (err) {
                console.error(err);
                continue;
            }

        }

        if (res.length > 0) {
            return res;
        }

    } catch (err) {
        console.error(err);
    }

}

function filterChatNewestFirst(comments: Map<number, object>): ICommentsFuseResult[] | void {

    try {
        
        if (comments.size === 0) return;

        const res: ICommentsFuseResult[] = [];

        for (const [i, comment] of comments.entries()) {

            try {

                res.push({
                    item: comment as ICommentItem,
                    refIndex: i as number
                });

            } catch (err) {
                console.error(err);
                continue;
            }

        }

        if (res?.length > 0) {
            return res;
        }

    } catch (err) {
        console.error(err);
    }

}

function markTextComment(sel: string | HTMLElement, text: string): void {

    try {

        if (!text || !sel || !GlobalStore?.highlightText) return;

        const elExtSearch = document.getElementById('ycs_extended_search') as HTMLInputElement;
        if (elExtSearch.checked) return;

        const sliceStringForMark = (str: string): string | void => {

            try {
                
                if (typeof str != 'string') return;

                let query = '';

                if (str.length <= 2) {
                    console.log('text slice 0, 0-2');
                    console.log('text length: ', str.length);
                    query = str;
                } else if (str.length >= 3 && str.length <= 5) {
                    console.log('text slice 1, 3-5');
                    console.log('text length: ', str.length);
                    query = str.slice(0, -1);
                } else if (str.length >= 6 && str.length <= 8) {
                    console.log('text slice 3, 6-8');
                    console.log('text length: ', str.length);
                    query = str.slice(0, -3);
                } else if (str.length >= 9) {
                    console.log('text slice 4, 9-*');
                    console.log('text length: ', str.length);
                    query = str.slice(0, -4);
                }

                return query;

            } catch (err) {
                console.error(err);
                return str;
            }

        };

        if (text.split(' ').length === 1) {

            text = sliceStringForMark(text) || text;

        } else if (text.split(' ').length > 1) {

            let query = '';
            for (const str of text.split(' ')) {
                query += sliceStringForMark(str) + ' ';
            }

            text = query?.trim();
        }

        console.log('TEXT query for MARK: ', text);

        const opts: MarkOptions = {
            element: 'span',
            className: 'ycs-mark-words'
        };
        
        console.log('==================> MARK TEXT');
        console.log('markTextComment params, sel, text: ', sel, text);
        // const markText = new Mark('#ycs-search-result .ycs-render-comment');
        if (typeof sel !== 'string') {
            const markTextTitle = new Mark((sel as HTMLElement)?.querySelectorAll('.ycs-head__title'));
            const markTextMain = new Mark((sel as HTMLElement)?.querySelectorAll('.ycs-comment__main-text'));
            markTextTitle.mark(text, opts);
            markTextMain.mark(text, opts);
        } else {
            console.log('${sel} .ycs-head__title: ', `${sel} .ycs-head__title`);
            console.log('${sel} .ycs-comment__main-text: ', `${sel} .ycs-comment__main-text`);
            const markTextTitle = new Mark(`${sel} .ycs-head__title`);
            const markTextMain = new Mark(`${sel} .ycs-comment__main-text`);
            markTextTitle.mark(text, opts);
            markTextMain.mark(text, opts);
        }


    } catch (err) {
        console.error(err);
    }

}

function setCacheToIDB(value: any, url: string, title: string): void {

    try {

        console.log('setCacheToIDB()', value, url);
        
        window.postMessage({ type: 'YCS_CACHE_STORAGE_SET', body: {
            url: url,
            videoId: getVideoId(getCleanUrlVideo(url) as string),
            date: new Date().getTime(),
            titleVideo: title,
            comments: value.comments,
            commentsChat: value.commentsChat,
            commentsTrVideo: value.commentsTrVideo
        } }, window.location.origin);

    } catch (err) {
        console.log(err);
    }

}

function sendGetCacheInIDB(url: string): void {

    try {

        console.log('sendGetCacheInIDB:', url);
        
        window.postMessage({ type: 'YCS_CACHE_STORAGE_GET', body: { videoId: getVideoId(getCleanUrlVideo(url) as string) } }, window.location.origin);

    } catch (err) {
        console.log(err);
    }

}

function formatBytes(bytes: number, decimals = 2): string | void {

    try {

        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];

    } catch (err) {
        console.error(err);
    }
    
}

function getPaginate(
    totalItems: number,
    currentPage = 1,
    pageSize = 10,
    maxPages = 10
): {
    totalItems: number;
    currentPage: number;
    pageSize: number;
    totalPages: number;
    startPage: number;
    endPage: number;
    startIndex: number;
    endIndex: number;
    pages: number[];
} {
    // calculate total pages
    const totalPages = Math.ceil(totalItems / pageSize);

    // ensure current page isn't out of range
    if (currentPage < 1) {
        currentPage = 1;
    } else if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    let startPage: number, endPage: number;
    if (totalPages <= maxPages) {
        // total pages less than max so show all pages
        startPage = 1;
        endPage = totalPages;
    } else {
        // total pages more than max so calculate start and end pages
        const maxPagesBeforeCurrentPage = Math.floor(maxPages / 2);
        const maxPagesAfterCurrentPage = Math.ceil(maxPages / 2) - 1;
        if (currentPage <= maxPagesBeforeCurrentPage) {
            // current page near the start
            startPage = 1;
            endPage = maxPages;
        } else if (currentPage + maxPagesAfterCurrentPage >= totalPages) {
            // current page near the end
            startPage = totalPages - maxPages + 1;
            endPage = totalPages;
        } else {
            // current page somewhere in the middle
            startPage = currentPage - maxPagesBeforeCurrentPage;
            endPage = currentPage + maxPagesAfterCurrentPage;
        }
    }

    // calculate start and end item indexes
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize - 1, totalItems - 1);

    // create an array of pages to ng-repeat in the pager control
    const pages = Array.from(Array(endPage + 1 - startPage).keys()).map(
        (i) => startPage + i
    );

    // return object with all pager properties required by the view
    return {
        totalItems: totalItems,
        currentPage: currentPage,
        pageSize: pageSize,
        totalPages: totalPages,
        startPage: startPage,
        endPage: endPage,
        startIndex: startIndex,
        endIndex: endIndex,
        pages: pages,
    };
}

function getSheetDetails(cmnts: ISheetDetailsParam): ISheetDetails | void {

    try {

        if (typeof cmnts !== 'object') return;

        return {
            'Cache timestamp': Number(cmnts?.cachedDate),
            URL: cmnts?.urlVideo,
            'Video ID': cmnts?.videoId,
            Title: cmnts?.titleVideo,
            'Total Comments': Number(cmnts?.totalComments),
            'Total Replies': Number(cmnts?.totalReplies),
            Total: Number(cmnts?.total)
        };
        
    } catch (err) {
        console.error(err);
    }

}

function getSheetChatDetails(cmnts: ISheetDetailsChatParam): ISheetChatDetails | void {

    try {

        if (typeof cmnts !== 'object') return;

        return {
            'Cache timestamp': Number(cmnts?.cachedDate),
            URL: cmnts?.urlVideo,
            'Video ID': cmnts?.videoId,
            Title: cmnts?.titleVideo,
            Total: Number(cmnts?.total)
        };
        
    } catch (err) {
        console.error(err);
    }

}

function getSheetComments(cmnts: Array<ISheetCommentsParam>): Array<ISheetComments> | [] {

    try {

        if (!Array.isArray(cmnts)) return [];

        const sheetCmnts: Array<ISheetComments> = [];

        for (const cmnt of cmnts) {
            sheetCmnts.push({
                URL: cmnt.commentUrl,
                'Author name': cmnt?.author?.nameAuthor,
                'Author Channel': cmnt?.author?.channel,
                'Comment message': cmnt?.commentMessage,
                'Channel owner': cmnt?.author?.authorIsChannelOwner,
                Member: cmnt?.member,
                Published: cmnt?.publishedTimeText,
                'Total likes': Number(cmnt?.totalLikes),
                Replies: Number(cmnt?.commentReplies?.replies?.length) | 0
            });
        }

        return sheetCmnts;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function getSheetChatComments(cmnts: ISheetDetailsChatParam): Array<ISheetChatComments> | [] {

    try {

        if (typeof cmnts !== 'object') return [];

        const sheetCmnts: Array<ISheetChatComments> = [];

        for (const cmnt of cmnts.commentsChat) {

            const [m, s] = cmnt.timestampText.split(':');
            const second = (Number(m) * 60) + Number(s);

            sheetCmnts.push({
                'Timestamp Usec': Number(cmnt?.timestampUsec),
                URL: `https://youtu.be/${cmnts.videoId}?t=${second || 0}`,
                'Author name': cmnt?.author?.nameAuthor,
                'Author Channel': cmnt?.author?.channel,
                Member: cmnt?.author?.member,
                'Comment message': cmnt?.commentMessage,
                'Timestamp comment': cmnt?.timestampText
            });
        }

        return sheetCmnts;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function getSheetReplies(cmnts: Array<ISheetRepliesParam>): Array<ISheetReplies> | [] {

    try {

        if (!Array.isArray(cmnts)) return [];

        const sheetReplies: Array<ISheetReplies> = [];

        for (const cmnt of cmnts) {

            if (cmnt?.commentReplies?.replies?.length > 0) {

                for (const reply of cmnt.commentReplies.replies) {

                    sheetReplies.push({
                        'Сommented URL': cmnt?.commentUrl,
                        'URL Reply': reply?.commentUrl,
                        'Author name': reply?.author?.nameAuthor,
                        Channel: reply?.author?.channel,
                        'Reply message': reply?.commentMessage,
                        Member: reply?.member,
                        Published: reply?.publishedTimeText,
                        'Total likes': Number(reply?.totalLikes)
                    });

                }
                
            }
            
            
        }

        return sheetReplies;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

function getSheetTrVideoDetails(trVideo: ISheetDetailsTrVideoParam): ISheetTrVideoDetails | void {

    try {

        if (typeof trVideo !== 'object') return;

        return {
            'Cache timestamp': Number(trVideo?.cachedDate),
            URL: trVideo?.urlVideo,
            Title: trVideo?.titleVideo,
            'Video ID': trVideo?.videoId,
            'Title transcript': trVideo?.titleTrVideo,
            Total: Number(trVideo?.total)
        };
        
    } catch (err) {
        console.error(err);
    }

}

function getSheetTrVideo(trVideo: ISheetDetailsTrVideoParam): Array<ISheetTrVideo> | [] {

    try {

        if (typeof trVideo !== 'object') return [];

        const sheetCmnts: Array<ISheetTrVideo> = [];

        for (const tr of trVideo.trVideo) {

            sheetCmnts.push({
                URL: tr?.urlShare,
                'Video timestamp': tr?.formattedStartOffset,
                'Start Offset Ms.': Number(tr?.startOffsetMs),
                'Duration Ms.': Number(tr?.durationMs),
                Message: tr?.message
            });
        }

        return sheetCmnts;
        
    } catch (err) {
        console.error(err);
        return [];
    }

}

export {
    isWatchVideo,
    getCleanUrlVideo,
    removeNodeList,
    getParams,
    getAllCommentsModeV2,
    getTranscriptVideo,
    getParamsForChat,
    getChatComments,
    showLoadComments,
    getInitYtData,
    deepFindObjKey,
    msToShareVideo,
    sendMsgToBadge,
    tmUsecToDateTime,
    getCommentsHtmlText,
    getCommentsChatHtmlText,
    getCommentsTrVideoHtmlText,
    openComments,
    openCommentsChat,
    openCommentsTrVideo,
    downloadFile,
    wrapTryCatch,
    filterAuthorComments,
    filterAuthorChat,
    GlobalStore,
    filterLikesComments,
    filterRepliedComments,
    filterMemberComments,
    filterMembersChat,
    filterDonatedChat,
    filterHeartComments,
    filterVerifiedComments,
    filterVerifiedChatComments,
    filterLinksComments,
    filterLinksChatComments,
    filterLinksTrpVideoComments,
    filterAllTrpVideoComments,
    removeClass,
    initShowBarFAQ,
    initShowViewMode,
    getRandomComment,
    filterNewestFirst,
    filterChatNewestFirst,
    markTextComment,
    randomString,
    getPiP,
    setCacheToIDB,
    sendGetCacheInIDB,
    formatBytes,
    isNumeric,
    getPaginate,
    delayMs,
    msToRoundSec,
    getSheetDetails,
    getSheetComments,
    getSheetReplies,
    getSheetChatDetails,
    getSheetChatComments,
    getSheetTrVideoDetails,
    getSheetTrVideo
};