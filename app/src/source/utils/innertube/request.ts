export interface BuildInnertubeHeadersOverrides {
    [header: string]: string | undefined;
}

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
 * 產生向 Innertube API 發送請求時所需的預設標頭，並允許以覆寫方式調整個別欄位。
 *
 * @param ytcfgData - 由頁面取得的 ytcfg 設定資料。
 * @param overrides - 自訂標頭覆寫項目，例如調整 x-youtube-client-version。
 * @returns 適用於 fetch 請求的標頭物件。
 */
export function buildInnertubeHeaders(
    ytcfgData: YtcfgData | undefined,
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

/**
 * 建立 Innertube API 請求的共用 body，僅保留實際提供的參數並允許附加額外欄位。
 *
 * @param options - 組裝請求 body 所需的參數集合。
 * @returns 已根據提供參數過濾後的請求 payload。
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
