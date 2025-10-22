import type { GetParams, InnertubeRequestParams } from '../interfaces/i_assist';
import { GlobalStore, getCleanUrlVideo, getVideoId } from '../common';
import type { YtcfgData } from './request';

export interface PageCfgData extends YtcfgData {
    ID_TOKEN?: string;
    INNERTUBE_API_KEY?: string;
    VARIANTS_CHECKSUM?: string;
    PAGE_CL?: string;
    PAGE_BUILD_LABEL?: string;
    DEVICE?: string;
    XSRF_TOKEN?: string;
    WEB_PLAYER_CONTEXT_CONFIGS?: Record<string, { innertubeApiKey?: string }>;
    GOOGLE_FEEDBACK_PRODUCT_DATA?: {
        accept_language?: string;
    };
    [key: string]: unknown;
}

const pageCfgDataPool: Record<string, Promise<PageCfgData | undefined> | PageCfgData | undefined> = {};

async function fetchPageCfgData(videoId: string, signal?: AbortSignal): Promise<PageCfgData | undefined> {
    try {
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            method: 'GET',
            mode: 'no-cors',
            credentials: 'include',
            signal,
            cache: 'default'
        } as RequestInit);

        const html = await response.text();
        const splittedHtml = html.split('window.ytplayer={};\nytcfg.set(');

        if (splittedHtml.length <= 1) {
            throw new Error('Failed to load video html');
        }

        try {
            return JSON.parse(
                splittedHtml[1].split('); window.ytcfg.obfuscatedData_')[0].replace('\n', '')
            ) as PageCfgData;
        } catch (error) {
            console.error(error);
            return undefined;
        }
    } catch (error) {
        console.error(error);
        return undefined;
    }
}

export async function getPageCfgData(
    globalContext: Window & typeof globalThis,
    signal?: AbortSignal,
    optUrl?: string
): Promise<PageCfgData | undefined> {
    const existingData = (globalContext as any)?.ytcfg?.data_ ?? null;
    if (existingData) {
        return existingData as PageCfgData;
    }

    const url = optUrl ?? globalContext.location?.href ?? window.location.href;
    const videoId = getVideoId(url);

    if (!videoId) {
        return undefined;
    }

    if (!pageCfgDataPool[videoId]) {
        pageCfgDataPool[videoId] = fetchPageCfgData(videoId, signal);
    }

    try {
        return await pageCfgDataPool[videoId];
    } catch (error) {
        console.error(error);
        return undefined;
    }
}

export async function getParams(globalContext: Window & typeof globalThis, signal?: AbortSignal): Promise<GetParams> {
    const ytcfgData = await getPageCfgData(globalContext, signal);
    const cleanUrl = getCleanUrlVideo(globalContext.location.href) ?? globalContext.location.href;

    const headers: Record<string, string> = {
        accept: '*/*',
        'accept-language': ytcfgData?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        'content-type': 'application/x-www-form-urlencoded',
        pragma: 'no-cache',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-spf-previous': cleanUrl,
        'x-spf-referer': cleanUrl,
        'x-youtube-identity-token': ytcfgData?.ID_TOKEN ?? '',
        'x-youtube-client-name': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
        'x-youtube-client-version': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_VERSION || '',
        'x-youtube-device': (ytcfgData as any)?.DEVICE || 'cbr=Chrome&cplatform=DESKTOP',
        'x-youtube-page-cl': (ytcfgData as any)?.PAGE_CL,
        'x-youtube-page-label': (ytcfgData as any)?.PAGE_BUILD_LABEL,
        'x-youtube-time-zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        'x-youtube-utc-offset': Math.abs(new Date().getTimezoneOffset()).toString(),
        'x-youtube-variants-checksum': (ytcfgData as any)?.VARIANTS_CHECKSUM
    };

    const params: InnertubeRequestParams = {
        credentials: 'include',
        headers,
        referrer: cleanUrl,
        referrerPolicy: 'origin-when-cross-origin',
        body: `session_token=${ytcfgData?.XSRF_TOKEN ?? ''}`,
        method: 'POST',
        mode: 'cors'
    };

    return {
        ctoken: null,
        continuation: null,
        itct: null,
        params
    };
}

export function getInnertubeApiKey(globalContext: Window & typeof globalThis = window): string | undefined {
    try {
        const contextAny = globalContext as any;
        const ytcfgData = contextAny?.ytcfg?.data_ ?? contextAny?.ytcfg;

        const innertubeApiKey =
            ytcfgData?.INNERTUBE_API_KEY ||
            ytcfgData?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_WATCH?.innertubeApiKey ||
            ytcfgData?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_CHANNEL_TRAILER
                ?.innertubeApiKey ||
            ytcfgData?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_PLAYLIST_OVERVIEW
                ?.innertubeApiKey ||
            ytcfgData?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_VERTICAL_LANDING_PAGE_PROMO
                ?.innertubeApiKey ||
            ytcfgData?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_SPONSORSHIPS_OFFER
                ?.innertubeApiKey ||
            contextAny?.ytplayer?.web_player_context_config?.innertubeApiKey ||
            contextAny?.ytcfg?.INNERTUBE_API_KEY;

        return innertubeApiKey;
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

export async function getInitYtData(
    url: string,
    signal: AbortSignal | undefined,
    globalContext: Window & typeof globalThis = window
): Promise<[object] | undefined> {
    try {
        if (!url) return undefined;

        const paramsTemplate = (await getParams(globalContext, signal)).params;
        const headers = { ...paramsTemplate.headers };
        delete headers['content-type'];

        const requestInit: InnertubeRequestParams = {
            ...paramsTemplate,
            method: 'GET',
            headers
        };

        delete (requestInit as Partial<InnertubeRequestParams>).body;

        const targetUrl = `${getCleanUrlVideo(url) ?? url}&pbj=1`;
        const res = await fetch(targetUrl, { ...requestInit, signal, cache: 'no-store' });

        const result = (await res.json()) as [object];
        (GlobalStore as any).getInitYtData = result;

        return result;
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

export type { InnertubeRequestParams };
