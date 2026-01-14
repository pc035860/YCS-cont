import Fuse from '../../../../node_modules/fuse.js/dist/fuse';

import { buildKeysSignature, buildOptionsSignature, cloneFuseOptions } from './fuseCacheUtils';

import {
    applyChatFilters,
    createChatAuthorFilter,
    createChatMembersFilter,
    createChatDonatedFilter,
    createChatVerifiedFilter,
    createChatLinksFilter,
    DerivedChatMessage,
    ChatFilterConfig
} from '../../utils/filters/chatAgg';
import type { ChatItem, FuseSupportedItem, ICommentsFuseResult, IParamSearch } from '../../utils/interfaces/i_types';
import { getCommentsChat, WebResourcesState } from '../state';
import { SearchContext } from './types';
import { FilterConfig } from '../../utils/filters/types';

export interface SearchButtonState {
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

const UNSUPPORTED_FILTERS: (keyof IParamSearch)[] = ['heart', 'random', 'origin'];

const UNSUPPORTED_SORTS: IParamSearch['sortOrder'][] = ['most_likes', 'least_likes', 'most_replies', 'least_replies'];

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
    if (param.sortOrder === 'relevance' && trimmedQuery.length === 0) {
        // No such thing as sorting by relevance for empty query, default to newest
        param.sortOrder = 'newest';
    }

    const filterConfigs = [] as ChatFilterConfig[];
    for (const key of Object.keys(param)) {
        switch (key) {
            case 'author':
                filterConfigs.push(createChatAuthorFilter());
                break;
            case 'donated':
                filterConfigs.push(createChatDonatedFilter());
                break;
            case 'members':
                filterConfigs.push(createChatMembersFilter());
                break;
            case 'timestamp': {
                const timestampOptions: Fuse.IFuseOptions<any> = {
                    ...options,
                    keys: ['replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.isTimeLine']
                };
                const fuse = getChatFuseInstance<ChatItem>(cmntsChat, timestampOptions);
                resultSearch = mapFuseResults(fuse.search('timeline'));
                break;
            }
            case 'verified':
                filterConfigs.push(createChatVerifiedFilter());
                break;
            case 'links':
                filterConfigs.push(createChatLinksFilter());
                break;
            default:
                break;
        }
    }

    if (filterConfigs.length > 0) {
        const derived = applyChatFilters(cmntsChat, filterConfigs);
        resultSearch = mapDerivedToResults(derived);
    }

    if (resultSearch.length > 1) {
        if (param.sortOrder === 'oldest') {
            resultSearch.sort((a, b) => b.refIndex - a.refIndex);
        } else if (param.sortOrder === 'longest') {
            resultSearch.sort(
                (a, b) =>
                    ((b.item as any)?.replayChatItemAction?.actions?.[0]?.addChatItemAction?.item
                        ?.liveChatTextMessageRenderer?.message?.fullText?.length ?? '') -
                    ((a.item as any)?.replayChatItemAction?.actions?.[0]?.addChatItemAction?.item
                        ?.liveChatTextMessageRenderer?.message?.fullText?.length ?? '')
            );
        } else if (param.sortOrder === 'shortest') {
            resultSearch.sort(
                (a, b) =>
                    ((a.item as any)?.replayChatItemAction?.actions?.[0]?.addChatItemAction?.item
                        ?.liveChatTextMessageRenderer?.message?.fullText?.length ?? '') -
                    ((b.item as any)?.replayChatItemAction?.actions?.[0]?.addChatItemAction?.item
                        ?.liveChatTextMessageRenderer?.message?.fullText?.length ?? '')
            );
        } else if (param.sortOrder === 'author_az') {
            resultSearch.sort((a, b) =>
                (
                    (a.item as any)?.replayChatItemAction?.actions?.[0]?.addChatItemAction?.item
                        ?.liveChatTextMessageRenderer?.authorName?.simpleText ?? ''
                ).localeCompare(
                    (b.item as any)?.replayChatItemAction?.actions?.[0]?.addChatItemAction?.item
                        ?.liveChatTextMessageRenderer?.authorName?.simpleText ?? ''
                )
            );
        } else if (param.sortOrder === 'author_za') {
            resultSearch.sort((a, b) =>
                (
                    (b.item as any)?.replayChatItemAction?.actions?.[0]?.addChatItemAction?.item
                        ?.liveChatTextMessageRenderer?.authorName?.simpleText ?? ''
                ).localeCompare(
                    (a.item as any)?.replayChatItemAction?.actions?.[0]?.addChatItemAction?.item
                        ?.liveChatTextMessageRenderer?.authorName?.simpleText ?? ''
                )
            );
        } else if (param.sortOrder === 'newest' || UNSUPPORTED_SORTS.some((key) => param.sortOrder === key)) {
            // Unsupported sorts default to newest
            resultSearch.sort((a, b) => a.refIndex - b.refIndex);
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
