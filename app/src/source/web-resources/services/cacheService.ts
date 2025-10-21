import { sendGetCacheInIDB, setCacheToIDB, sendMsgToBadge } from '../../utils/dom';

interface CacheMeta {
    url: string;
    title: string;
}

interface CacheData {
    comments: any[];
    commentsChat: string;
    commentsTrVideo: unknown;
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
