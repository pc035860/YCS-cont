export interface BuildInnertubeHeadersOverrides {
    [header: string]: string | undefined;
}

export interface BuildInnertubeHeadersOptions {
    disableAuth?: boolean; // When true, do not include Authorization header even if globalContext is provided
}

import { buildSapSidAuthorizationHeader } from './authHeaders';

export interface YtcfgData {
    GOOGLE_FEEDBACK_PRODUCT_DATA?: {
        accept_language?: string;
    };
    INNERTUBE_CONTEXT_CLIENT_NAME?: string;
    INNERTUBE_CONTEXT_CLIENT_VERSION?: string;
    INNERTUBE_CONTEXT?: {
        client?: Record<string, unknown>;
    };
}

export interface BuildInnertubeBodyOptions {
    ytcfgData: YtcfgData | undefined;
    continuation?: string | null;
    clickTrackingParams?: string | null;
    videoId?: string;
    params?: string;
    currentPlayerState?: Record<string, unknown>;
    clientOverride?: Record<string, unknown>;
    clientFallback?: Record<string, unknown>;
    extra?: Record<string, unknown>;
}

/**
 * Builds the default headers for Innertube API requests and allows overriding individual fields.
 *
 * @param ytcfgData - YTCFG configuration data captured from the page context.
 * @param overrides - Header overrides, for example to adjust x-youtube-client-version.
 * @param globalContext - Optional window context for generating authorization headers.
 * @param options - Optional configuration, including disableAuth flag.
 * @returns Headers object that can be used with fetch requests.
 */
export function buildInnertubeHeaders(
    ytcfgData: YtcfgData | undefined,
    overrides: BuildInnertubeHeadersOverrides = {},
    globalContext?: Window & typeof globalThis,
    options?: BuildInnertubeHeadersOptions
): Record<string, string> {
    const headers: Record<string, string | undefined> = {
        accept: '*/*',
        'accept-language': ytcfgData?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
        'content-type': 'application/json',
        pragma: 'no-cache',
        'cache-control': 'no-store',
        'x-youtube-client-name': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
        'x-youtube-client-version': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_VERSION,
        ...overrides
    };

    // Generate authorization header if globalContext is provided and disableAuth is not true
    if (globalContext && options?.disableAuth !== true) {
        const authHeader = buildSapSidAuthorizationHeader({ context: globalContext });
        if (authHeader) {
            headers.authorization = authHeader;
        }
    }

    const normalizedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (value !== undefined) {
            normalizedHeaders[key] = value;
        }
    }

    return normalizedHeaders;
}

/**
 * Builds a shared Innertube API request body, keeping only provided parameters while allowing additional fields.
 *
 * @param options - Collection of parameters used to assemble the request body.
 * @returns Request payload filtered to include only supplied values.
 */
export function buildInnertubeBody({
    ytcfgData,
    continuation,
    clickTrackingParams,
    videoId,
    params,
    currentPlayerState,
    clientOverride,
    clientFallback,
    extra
}: BuildInnertubeBodyOptions): Record<string, unknown> {
    const client = clientOverride ?? ytcfgData?.INNERTUBE_CONTEXT?.client ?? clientFallback;

    const payload: Record<string, unknown> = {
        context: { client }
    };

    if (continuation != null) {
        payload.continuation = continuation;
    }

    if (clickTrackingParams != null) {
        payload.clickTracking = { clickTrackingParams };
    }

    if (videoId !== undefined) {
        payload.videoId = videoId;
    }

    if (params !== undefined) {
        payload.params = params;
    }

    if (currentPlayerState !== undefined) {
        payload.currentPlayerState = currentPlayerState;
    }

    if (extra) {
        Object.assign(payload, extra);
    }

    return payload;
}
