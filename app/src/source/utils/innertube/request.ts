export interface BuildInnertubeHeadersOverrides {
    [header: string]: string | undefined;
}

export interface BuildInnertubeBodyOptions {
    ytcfgData: any | undefined;
    continuation?: string | null;
    clickTrackingParams?: string | null;
    videoId?: string;
    params?: string;
    currentPlayerState?: Record<string, unknown>;
    clientOverride?: Record<string, unknown>;
    clientFallback?: Record<string, unknown>;
    extra?: Record<string, unknown>;
}

export function buildInnertubeHeaders(
    ytcfgData: any | undefined,
    overrides: BuildInnertubeHeadersOverrides = {}
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

    const normalizedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (value !== undefined) {
            normalizedHeaders[key] = value;
        }
    }

    return normalizedHeaders;
}

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

    if (continuation !== undefined) {
        payload.continuation = continuation;
    }

    if (clickTrackingParams !== undefined) {
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
