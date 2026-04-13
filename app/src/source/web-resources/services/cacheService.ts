import { sendGetCacheInIDB, setCacheToIDB, sendMsgToBadge } from '../../utils/dom';
import type { CommentItem, TranscriptData } from '../../utils/interfaces/i_types';

export type ChatSource = 'live-recording' | 'chat-replay';

interface CacheMeta {
    url: string;
    title: string;
}

interface CacheData {
    videoId?: string;
    comments: CommentItem[];
    commentsChat: string;
    commentsTrVideo?: TranscriptData;
    channelId?: string | null;
    chatSource?: ChatSource;
}

export function loadFromCache(url: string): void {
    if (!url) return;
    sendGetCacheInIDB(url);
}

function stripCommentToken(item: any): any {
    if (!item?.commentRenderer?.createReplyParams) return item;
    const { createReplyParams: _, ...rest } = item.commentRenderer;
    return { ...item, commentRenderer: rest };
}

function stripOriginChain(item: any): any {
    let result = stripCommentToken(item);
    if (result.originComment) {
        result = { ...result, originComment: stripOriginChain(result.originComment) };
    }
    return result;
}

export function stripReplyTokens(comments: CommentItem[]): CommentItem[] {
    return comments.map((c) => stripOriginChain(c) as CommentItem);
}

export function saveToCache(data: CacheData, meta: CacheMeta): void {
    if (!meta?.url || !meta?.title) return;

    const sanitized = { ...data, comments: stripReplyTokens(data.comments) };
    setCacheToIDB(sanitized, meta.url, meta.title);
}

export function updateBadge(type: string, value: string | number): void {
    if (!type) return;

    sendMsgToBadge(type, value);
}

export type { CacheMeta, CacheData };
