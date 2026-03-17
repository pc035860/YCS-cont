import { buildInnertubeHeaders, buildInnertubeBody } from './request';
import { getPageCfgData, getInnertubeApiKey } from './core';

const RATE_LIMIT_INTERVAL_MS = 30_000;
let lastReplyTimestamp = 0;

export interface ReplyResult {
    success: boolean;
    error?: string;
    rateLimited?: boolean;
    responseData?: any;
}

export function canSendReply(): { allowed: boolean; waitMs: number } {
    const now = Date.now();
    const elapsed = now - lastReplyTimestamp;
    if (elapsed < RATE_LIMIT_INTERVAL_MS) {
        return { allowed: false, waitMs: RATE_LIMIT_INTERVAL_MS - elapsed };
    }
    return { allowed: true, waitMs: 0 };
}

export async function sendCommentReply(params: {
    createReplyParams: string;
    commentText: string;
    globalContext: Window & typeof globalThis;
    signal?: AbortSignal;
}): Promise<ReplyResult> {
    const { createReplyParams, commentText, globalContext, signal } = params;

    const rateCheck = canSendReply();
    if (!rateCheck.allowed) {
        return {
            success: false,
            error: `Please wait ${Math.ceil(rateCheck.waitMs / 1000)}s`,
            rateLimited: true
        };
    }

    lastReplyTimestamp = Date.now();

    try {
        const ytcfgData = await getPageCfgData(globalContext, signal);
        const apiKey = getInnertubeApiKey(globalContext);

        const headers = buildInnertubeHeaders(ytcfgData, {}, globalContext, { disableAuth: false });
        const body = buildInnertubeBody({
            ytcfgData,
            extra: { commentText, createReplyParams }
        });

        const url = `https://www.youtube.com/youtubei/v1/comment/create_comment_reply?prettyPrint=false${apiKey ? `&key=${apiKey}` : ''}`;

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            credentials: 'include',
            mode: 'cors',
            signal
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                return { success: false, error: 'Authentication failed. Please sign in to YouTube.' };
            }
            if (response.status === 429) {
                return { success: false, error: 'Rate limited by YouTube. Please wait.', rateLimited: true };
            }
            if (response.status === 400) {
                return { success: false, error: 'Reply params expired. Please reload comments.' };
            }
            return { success: false, error: `Request failed (${response.status})` };
        }

        const data = await response.json();
        const status = data?.actionResult?.status;

        if (status === 'STATUS_SUCCEEDED') {
            return { success: true, responseData: data };
        }

        return { success: false, error: `Unexpected status: ${status || 'unknown'}` };
    } catch (e) {
        if ((e as Error).name === 'AbortError') {
            return { success: false, error: 'Request cancelled' };
        }
        console.error('[YCS] Reply error:', e);
        return { success: false, error: 'Network error' };
    }
}
