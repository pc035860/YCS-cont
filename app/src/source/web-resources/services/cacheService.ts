import { sendGetCacheInIDB, setCacheToIDB, sendMsgToBadge } from '../../utils/dom';
import type { CommentItem, TranscriptData } from '../../utils/interfaces/i_types';

interface CacheMeta {
    url: string;
    title: string;
}

interface CacheData {
    comments: CommentItem[];
    commentsChat: string;
    commentsTrVideo?: TranscriptData;
    channelId?: string | null;
}

export function loadFromCache(url: string): void {
    if (!url) return;
    sendGetCacheInIDB(url);
}

export function saveToCache(data: CacheData, meta: CacheMeta): void {
    if (!meta?.url || !meta?.title) return;

    setCacheToIDB(data, meta.url, meta.title);
}

export function updateBadge(type: string, value: string | number): void {
    if (!type) return;

    sendMsgToBadge(type, value);
}

export type { CacheMeta, CacheData };
