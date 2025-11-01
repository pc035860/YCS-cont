import urlRegex from 'url-regex';

import { extractChannelId, wrapTryCatch } from '../common';
import type { ChatItem } from '../interfaces/i_types';

export interface DerivedChatMessage {
    origin: ChatItem;
    timestamp: number;
    authorChannelId?: string;
    isMember: boolean;
    isDonated: boolean;
    isVerified: boolean;
    hasLinks: boolean;
}

export interface ChatFilterConfig<T = any> {
    id: string;
    enabled: boolean;
    options?: T;
    filter: (item: DerivedChatMessage, options?: T) => boolean;
}

export function createChatFilter<T = any>(
    id: string,
    filter: (item: DerivedChatMessage, options?: T) => boolean,
    options?: T
): ChatFilterConfig<T> {
    return { id, enabled: true, filter, options };
}

function getTextRenderer(item: ChatItem): Record<string, any> | undefined {
    return wrapTryCatch(
        () => item?.replayChatItemAction?.actions?.[0]?.addChatItemAction?.item?.liveChatTextMessageRenderer
    );
}

function deriveChatMessage(item: ChatItem): DerivedChatMessage {
    const renderer = getTextRenderer(item) || {};

    const timestampRaw = renderer?.timestampUsec ?? renderer?.timestampText?.simpleText ?? 0;
    const timestamp = Number.parseInt(String(timestampRaw), 10);
    const authorChannelId = renderer?.authorExternalChannelId;

    const authorBadges = renderer?.authorBadges as Array<any> | undefined;
    const isMember = Boolean(
        authorBadges && authorBadges.some((badge) => badge?.liveChatAuthorBadgeRenderer?.customThumbnail != null)
    );

    const purchaseAmount = renderer?.purchaseAmountText?.simpleText;
    const isDonated = Boolean(purchaseAmount);

    const isVerified = Boolean(renderer?.verifiedAuthor);

    const messageText = renderer?.message?.fullText || renderer?.message?.simpleText || '';
    const hasLinks = urlRegex().test(String(messageText));

    return {
        origin: item,
        timestamp: Number.isFinite(timestamp) ? timestamp : 0,
        authorChannelId: authorChannelId ? String(authorChannelId) : undefined,
        isMember,
        isDonated,
        isVerified,
        hasLinks
    };
}

export function applyChatFilters(items: ChatItem[], filters: ChatFilterConfig<any>[]): DerivedChatMessage[] {
    if (!items.length) return [];

    const enabled = filters.filter((f) => f.enabled);
    if (enabled.length === 0) {
        return items.map((item) => deriveChatMessage(item));
    }

    const results: DerivedChatMessage[] = [];

    for (const item of items) {
        const derived = deriveChatMessage(item);
        let keep = true;
        for (const filter of enabled) {
            try {
                if (!filter.filter(derived, filter.options)) {
                    keep = false;
                    break;
                }
            } catch (error) {
                console.error('[YCS] Chat filter error', filter.id, error);
            }
        }
        if (keep) {
            results.push(derived);
        }
    }

    return results;
}

export function createChatAuthorFilter(): ChatFilterConfig<string | undefined> {
    const channelId = extractChannelId();
    return createChatFilter<string | undefined>(
        'chatAuthor',
        (item, currentChannelId) => {
            if (!currentChannelId) return false;
            return item.authorChannelId === currentChannelId;
        },
        channelId ?? undefined
    );
}

export function createChatMembersFilter(): ChatFilterConfig<boolean> {
    return createChatFilter('chatMember', (item, flag) => (!flag ? true : item.isMember), true);
}

export function createChatDonatedFilter(): ChatFilterConfig<boolean> {
    return createChatFilter('chatDonated', (item, flag) => (!flag ? true : item.isDonated), true);
}

export function createChatVerifiedFilter(): ChatFilterConfig<boolean> {
    return createChatFilter('chatVerified', (item, flag) => (!flag ? true : item.isVerified), true);
}

export function createChatLinksFilter(): ChatFilterConfig<boolean> {
    return createChatFilter('chatLinks', (item, flag) => (!flag ? true : item.hasLinks), true);
}
