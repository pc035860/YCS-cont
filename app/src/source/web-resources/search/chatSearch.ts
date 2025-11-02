import Fuse from '../../../../node_modules/fuse.js/dist/fuse';

import { buildKeysSignature, buildOptionsSignature, cloneFuseOptions } from './fuseCacheUtils';

import { filterChatNewestFirst } from '../../utils/filters/chat';
import {
    applyChatFilters,
    createChatAuthorFilter,
    createChatMembersFilter,
    createChatDonatedFilter,
    createChatVerifiedFilter,
    createChatLinksFilter,
    DerivedChatMessage
} from '../../utils/filters/chatAgg';
import type { ChatItem, FuseSupportedItem, ICommentsFuseResult, IParamSearch } from '../../utils/interfaces/i_types';
import { getCommentsChat, WebResourcesState } from '../state';
import { SearchContext } from './types';

export interface SearchButtonState {
    order?: 'newest' | 'oldest';
    title?: string;
    label?: string;
    dataset?: Record<string, string>;
}

export interface ChatSearchResult {
    results: ICommentsFuseResult[];
    total: number;
    summary: string;
    query: string;
    buttonStates: Record<string, SearchButtonState>;
}

const UNSUPPORTED_FILTERS: (keyof IParamSearch)[] = ['heart', 'likes', 'replied', 'random', 'quickTranscript'];

// Fuse cache for the full chat array (subsets still use transient instances).
interface ChatFuseCache<T> {
    instance: Fuse<T>;
    dataRef: T[];
    dataLength: number;
    keysSig: string;
    optionsSig: string;
}

let chatFuseCache: ChatFuseCache<any> | null = null;

function getChatFuseInstance<T>(base: T[], options: Fuse.IFuseOptions<any>): Fuse<T> {
    const keysSig = buildKeysSignature(options.keys);
    const optionsSig = buildOptionsSignature(options);
    if (
        chatFuseCache &&
        chatFuseCache.dataRef === base &&
        chatFuseCache.dataLength === base.length &&
        chatFuseCache.keysSig === keysSig &&
        chatFuseCache.optionsSig === optionsSig
    ) {
        return chatFuseCache.instance as Fuse<T>;
    }

    const instance = new Fuse<T>(base, options);
    chatFuseCache = { instance: instance as any, dataRef: base, dataLength: base.length, keysSig, optionsSig };
    return instance;
}

export function clearChatFuseCache(): void {
    chatFuseCache = null;
}

function mapFuseResults<T extends FuseSupportedItem>(raw: readonly Fuse.FuseResult<T>[]): ICommentsFuseResult<T>[] {
    return raw.map((result) => ({
        item: result.item,
        refIndex: (result.item as { _index?: number })?._index ?? result.refIndex ?? 0,
        score: result.score
    }));
}

function ensureSortOrder(order?: 'newest' | 'oldest'): 'newest' | 'oldest' {
    return order === 'oldest' ? 'oldest' : 'newest';
}

function mapDerivedToResults(items: DerivedChatMessage[]): ICommentsFuseResult<ChatItem>[] {
    return items.map((entry) => ({
        item: entry.origin,
        refIndex: Number.isFinite(entry.timestamp) ? entry.timestamp : 0,
        score: 0
    }));
}

function filterWithQuery<T extends FuseSupportedItem>(
    items: ICommentsFuseResult<T>[],
    query: string,
    options: Fuse.IFuseOptions<any>,
    reverseBase = false
): ICommentsFuseResult<T>[] {
    if (!query.trim()) {
        return reverseBase ? items.slice().reverse() : items;
    }

    const source = reverseBase ? items.slice().reverse() : items;
    const base = source.map((entry) => entry.item);
    const fuse = new Fuse<T>(base, options);
    return mapFuseResults(fuse.search(query.trim()));
}

const toTimestampRef = (value: string | number | undefined): number => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

export function runSearch(
    query: string,
    filters: IParamSearch | undefined,
    state: WebResourcesState,
    context: SearchContext
): ChatSearchResult {
    const trimmedQuery = query?.trim?.() ?? '';
    const param = filters ?? {};

    if (UNSUPPORTED_FILTERS.some((key) => Boolean(param[key as keyof IParamSearch]))) {
        return {
            results: [],
            total: 0,
            summary: '(Chat replay) Found: 0',
            query: trimmedQuery,
            buttonStates: {}
        };
    }

    const commentsChat = getCommentsChat(state);
    if (!commentsChat || commentsChat.size === 0) {
        return {
            results: [],
            total: 0,
            summary: '(Chat replay) Found: 0',
            query: trimmedQuery,
            buttonStates: {}
        };
    }

    const cmntsChat = [...commentsChat.values()];

    let fuseOptions = cloneFuseOptions();
    let fuseKeys = [
        'replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.authorName.simpleText',
        'replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.message.fullText'
    ];

    if (context.extendedSearch.enabled) {
        fuseOptions = cloneFuseOptions();
        fuseOptions.useExtendedSearch = true;

        if (context.extendedSearch.title) {
            fuseKeys = [
                'replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.authorName.simpleText'
            ];
        }

        if (context.extendedSearch.main) {
            fuseKeys = [
                'replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.message.fullText'
            ];
        }
    }

    const options: Fuse.IFuseOptions<any> = {
        ...fuseOptions,
        keys: fuseKeys
    };

    const buttonStates: Record<string, SearchButtonState> = {};
    let resultSearch: ICommentsFuseResult<ChatItem>[] = [];

    const updateButtonState = (id: string, order: 'newest' | 'oldest', title: string, label?: string): void => {
        buttonStates[id] = {
            order,
            title,
            label,
            dataset: {
                sortChat: order,
                sort: order
            }
        };
    };

    if (param.author) {
        const derived = applyChatFilters(cmntsChat, [createChatAuthorFilter()]);
        resultSearch = mapDerivedToResults(derived);

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.chat['ycs_btn_author']);
            if (resolvedOrder === 'oldest') {
                resultSearch = Array.from(resultSearch).reverse();
            }

            updateButtonState(
                'ycs_btn_author',
                resolvedOrder,
                resolvedOrder === 'oldest'
                    ? 'Show comments, replies, chat from the author (Oldest)'
                    : 'Show comments, replies, chat from the author (Newest)',
                'Author'
            );
        }
    } else if (param.donated) {
        const derived = applyChatFilters(cmntsChat, [createChatDonatedFilter()]);
        resultSearch = mapDerivedToResults(derived);

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.chat['ycs_btn_donated']);
            if (resolvedOrder === 'newest') {
                resultSearch = filterWithQuery(resultSearch, trimmedQuery, options);
            } else {
                resultSearch = filterWithQuery(resultSearch, trimmedQuery, options, true);
            }

            updateButtonState(
                'ycs_btn_donated',
                resolvedOrder,
                resolvedOrder === 'oldest'
                    ? 'Show chat comments from users who have donated (Oldest)'
                    : 'Show chat comments from users who have donated (Newest)',
                'Donated'
            );
        }
    } else if (param.members) {
        const derived = applyChatFilters(cmntsChat, [createChatMembersFilter()]);
        resultSearch = mapDerivedToResults(derived);

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.chat['ycs_btn_members']);
            if (resolvedOrder === 'newest') {
                resultSearch = filterWithQuery(resultSearch, trimmedQuery, options);
            } else {
                resultSearch = filterWithQuery(resultSearch, trimmedQuery, options, true);
            }

            updateButtonState(
                'ycs_btn_members',
                resolvedOrder,
                resolvedOrder === 'oldest'
                    ? 'Show comments, replies, chat from channel members (Oldest)'
                    : 'Show comments, replies, chat from channel members (Newest)',
                'Members'
            );
        }
    } else if (param.timestamp) {
        const timestampOptions: Fuse.IFuseOptions<any> = {
            ...options,
            keys: ['replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.isTimeLine']
        };

        const fuse = getChatFuseInstance<ChatItem>(cmntsChat, timestampOptions);
        resultSearch = mapFuseResults(fuse.search('timeline'));

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.chat['ycs_btn_timestamps']);
            if (resolvedOrder === 'oldest') {
                resultSearch = Array.from(resultSearch).reverse();
            }

            updateButtonState(
                'ycs_btn_timestamps',
                resolvedOrder,
                resolvedOrder === 'oldest'
                    ? 'Show comments, replies, chat with time stamps (Oldest)'
                    : 'Show comments, replies, chat with time stamps (Newest)',
                'Time stamps'
            );
        }
    } else if (param.sortFirst) {
        resultSearch = filterChatNewestFirst(commentsChat) ?? [];

        if (trimmedQuery) {
            try {
                const fuseBase = getChatFuseInstance<ChatItem>(cmntsChat, options);
                const matched = new Set<ChatItem>(fuseBase.search(trimmedQuery).map((entry) => entry.item));
                resultSearch = resultSearch.filter((entry) => matched.has(entry.item));
            } catch (error) {
                console.error(error);
            }
        }

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.chat['ycs_btn_sort_first']);
            if (resolvedOrder === 'oldest') {
                resultSearch = Array.from(resultSearch).reverse();
            }

            updateButtonState(
                'ycs_btn_sort_first',
                resolvedOrder,
                resolvedOrder === 'oldest'
                    ? 'Show all comments, chat, video transcript sorted by date (Oldest)'
                    : 'Show all comments, chat, video transcript sorted by date (Newest)',
                'All'
            );
        }
    } else if (param.verified) {
        const derived = applyChatFilters(cmntsChat, [createChatVerifiedFilter()]);
        resultSearch = mapDerivedToResults(derived);

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.chat['ycs_btn_verified']);
            if (resolvedOrder === 'newest') {
                // Use query to further filter if present
                if (trimmedQuery) {
                    resultSearch = filterWithQuery(resultSearch, trimmedQuery, options);
                }
            } else {
                resultSearch = filterWithQuery(resultSearch, trimmedQuery, options, true);
            }

            updateButtonState(
                'ycs_btn_verified',
                resolvedOrder,
                resolvedOrder === 'oldest'
                    ? 'Show comments, replies and chat from verified authors (Oldest)'
                    : 'Show comments, replies and chat from verified authors (Newest)'
            );
        }
    } else if (param.links) {
        const derived = applyChatFilters(cmntsChat, [createChatLinksFilter()]);
        resultSearch = mapDerivedToResults(derived);

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.chat['ycs_btn_links']);
            if (resolvedOrder === 'newest') {
                resultSearch = filterWithQuery(resultSearch, trimmedQuery, options);
            } else {
                resultSearch = filterWithQuery(resultSearch, trimmedQuery, options, true);
            }

            updateButtonState(
                'ycs_btn_links',
                resolvedOrder,
                resolvedOrder === 'oldest'
                    ? 'Shows links in comments, replies, chat, video transcript (Oldest)'
                    : 'Shows links in comments, replies, chat, video transcript (Newest)',
                'Links'
            );
        }
    } else {
        // Convert all chat items to search results format
        const allResults: ICommentsFuseResult<ChatItem>[] = cmntsChat.map((item, _index) => {
            const firstAction = item.replayChatItemAction.actions?.[0];
            const liveChatRenderer = firstAction?.addChatItemAction?.item?.liveChatTextMessageRenderer;

            return {
                item,
                refIndex: toTimestampRef(liveChatRenderer?.timestampUsec),
                score: 0
            };
        });

        // Use filterWithQuery to handle empty queries properly
        resultSearch = filterWithQuery(allResults, trimmedQuery, options);

        // Apply sorting for quickChat filter
        if (param.quickChat && resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.chat['ycs_btn_quick_chat']);
            if (resolvedOrder === 'oldest') {
                resultSearch = Array.from(resultSearch).reverse();
            }

            updateButtonState(
                'ycs_btn_quick_chat',
                resolvedOrder,
                resolvedOrder === 'oldest' ? 'Show chat replay (Oldest)' : 'Show chat replay (Newest)',
                'Chat'
            );
        }
    }

    const total = resultSearch.length;
    return {
        results: resultSearch,
        total,
        summary: `(Chat replay) Found: ${total}`,
        query: trimmedQuery,
        buttonStates
    };
}
