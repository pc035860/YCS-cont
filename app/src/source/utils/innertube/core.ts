import type { GetParams, InnertubeRequestParams } from '../interfaces/i_assist';
import { GlobalStore, getCleanUrlVideo, getVideoId, getPostId } from '../common';
import { updateAccessRestrictionStatus } from './memberOnly';
import { buildSapSidAuthorizationHeader } from './authHeaders';
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

async function fetchPageCfgData(url: string, signal?: AbortSignal): Promise<PageCfgData | undefined> {
    try {
        const response = await fetch(url, {
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
    const postId = getPostId(url);

    if (videoId) {
        if (!pageCfgDataPool[videoId]) {
            pageCfgDataPool[videoId] = fetchPageCfgData(`https://www.youtube.com/watch?v=${videoId}`, signal);
        }
        try {
            return await pageCfgDataPool[videoId];
        } catch (error) {
            console.error(error);
            return undefined;
        }
    } else if (postId) {
        if (!pageCfgDataPool[postId]) {
            pageCfgDataPool[postId] = fetchPageCfgData(`https://www.youtube.com/post/${postId}`, signal);
        }
        try {
            return await pageCfgDataPool[postId];
        } catch (error) {
            console.error(error);
            return undefined;
        }
    } else {
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

    // Generate authorization header for PBJ and HTML fallback requests
    const authHeader = buildSapSidAuthorizationHeader({ context: globalContext });
    if (authHeader) {
        headers.authorization = authHeader;
    }

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
): Promise<object | undefined> {
    try {
        if (!url || url.includes('post')) return undefined;

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

        if (!res.ok) {
            console.warn(`[YCS] [Core] getInitYtData HTTP error: ${res.status} ${res.statusText}`);
            return undefined;
        }

        // Handle YouTube's anti-JSON hijacking prefix: )]}'
        // This prefix is added by Google to prevent JSON hijacking attacks
        // and is commonly returned for unauthenticated users
        let text = await res.text();
        const JSON_SECURITY_PREFIX = ")]}'\n";
        if (text.startsWith(JSON_SECURITY_PREFIX)) {
            text = text.slice(JSON_SECURITY_PREFIX.length);
        }

        const result = JSON.parse(text) as object;

        // Modern PBJ is an object with top-level 'response' (and usually 'playerResponse').
        // Legacy array PBJ is rare and normalized elsewhere; non-PBJ falls back to HTML.
        if (!isValidPbjResponse(result)) {
            console.log('[YCS] [Core] getInitYtData: PBJ response missing required data, falling back to HTML parsing');
            return getInitYtDataFromHtml(url, signal, globalContext);
        }

        (GlobalStore as any).getInitYtData = result;

        // Update members-only and age-restricted status
        console.log('[YCS] [Core] getInitYtData: Updating access restriction status from ytInitialData');
        updateAccessRestrictionStatus(result);

        return result;
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

export function isValidPbjResponse(result: unknown): result is { response: object } {
    return !!result && typeof result === 'object' && 'response' in result;
}

/**
 * Extract a JSON object from HTML content using brace-counting algorithm.
 * Handles string escaping and nested structures safely.
 *
 * @param html - The HTML content to search
 * @param tag - The variable declaration tag (e.g., 'var ytInitialData = ')
 * @returns The parsed JSON object, or undefined if not found/invalid
 */
export function extractJsonObjectFromHtml(html: string, tag: string): object | undefined {
    const start = html.indexOf(tag);
    if (start === -1) {
        return undefined;
    }

    const searchStart = start + tag.length;
    let braceCount = 0;
    let endIndex = -1;
    let foundStart = false;
    let inString = false;
    let stringChar = '';
    let escapeNext = false;

    // Loop is bounded by html.length, no additional iteration limit needed
    for (let i = searchStart; i < html.length; i++) {
        const ch = html[i];

        if (escapeNext) {
            escapeNext = false;
            continue;
        }

        if (ch === '\\') {
            escapeNext = true;
            continue;
        }

        if (ch === '"' || ch === "'" || ch === '`') {
            if (!inString) {
                inString = true;
                stringChar = ch;
            } else if (ch === stringChar) {
                inString = false;
                stringChar = '';
            }
            continue;
        }

        if (!inString) {
            if (ch === '{') {
                braceCount++;
                foundStart = true;
            } else if (ch === '}') {
                braceCount--;
                if (foundStart && braceCount === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
        }
    }

    if (endIndex === -1) {
        return undefined;
    }

    const jsonStr = html.substring(searchStart, endIndex);
    try {
        return JSON.parse(jsonStr) as object;
    } catch {
        return undefined;
    }
}

export async function getInitYtDataFromHtml(
    url: string,
    signal: AbortSignal | undefined,
    globalContext: Window & typeof globalThis = window
): Promise<{ response: object; playerResponse?: object } | undefined> {
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

        // Do not use pbj=1 parameter, fetch raw HTML directly
        const targetUrl = url.includes('post') ? url : (getCleanUrlVideo(url) ?? url);
        const res = await fetch(targetUrl, { ...requestInit, signal, cache: 'no-store' });
        const html = await res.text();

        // Extract ytInitialData (required)
        const ytInitialData = extractJsonObjectFromHtml(html, 'var ytInitialData = ');
        if (!ytInitialData) {
            console.error('[YCS] [Core] getInitYtDataFromHtml: Failed to extract ytInitialData from HTML');
            return undefined;
        }

        // Extract ytInitialPlayerResponse (optional, for live broadcast details)
        const ytInitialPlayerResponse = extractJsonObjectFromHtml(html, 'var ytInitialPlayerResponse = ');

        // Build result matching PBJ format structure
        const result: { response: object; playerResponse?: object } = {
            response: ytInitialData,
            ...(ytInitialPlayerResponse && { playerResponse: ytInitialPlayerResponse })
        };

        (GlobalStore as any).getInitYtData = result;

        // Update members-only and age-restricted status
        console.log('[YCS] [Core] getInitYtDataFromHtml: Updating access restriction status from ytInitialData');
        updateAccessRestrictionStatus(result);

        return result;
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

export type { InnertubeRequestParams };
