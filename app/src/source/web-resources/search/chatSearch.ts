import Fuse from '../../../../node_modules/fuse.js/dist/fuse';

import {
    filterAuthorChat,
    filterChatNewestFirst,
    filterDonatedChat,
    filterLinksChatComments,
    filterMembersChat,
    filterVerifiedChatComments
} from '../../utils/filters/chat';
import { ICommentsFuseResult, IParamSearch } from '../../utils/interfaces/i_types';
import { wrapTryCatch } from '../../utils/common';
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

const BASE_FUSE_OPTIONS: Fuse.IFuseOptions<any> = {
    isCaseSensitive: false,
    findAllMatches: false,
    includeMatches: false,
    includeScore: true,
    ignoreLocation: true,
    useExtendedSearch: false,
    minMatchCharLength: 1,
    shouldSort: true,
    threshold: 0.15,
    distance: 100000
};

const UNSUPPORTED_FILTERS: (keyof IParamSearch)[] = ['heart', 'likes', 'replied', 'random'];

function cloneFuseOptions(): Fuse.IFuseOptions<any> {
    return JSON.parse(JSON.stringify(BASE_FUSE_OPTIONS));
}

function mapFuseResults(raw: readonly Fuse.FuseResult<any>[]): ICommentsFuseResult[] {
    return raw.map((result) => ({
        item: result.item,
        refIndex: (result.item as any)?._index ?? result.refIndex ?? 0,
        score: result.score
    }));
}

function ensureSortOrder(order?: 'newest' | 'oldest'): 'newest' | 'oldest' {
    return order === 'oldest' ? 'oldest' : 'newest';
}

function filterWithQuery(
    items: ICommentsFuseResult[],
    query: string,
    options: Fuse.IFuseOptions<any>,
    reverseBase = false
): ICommentsFuseResult[] {
    if (!query.trim()) {
        return reverseBase ? Array.from(items).reverse() : items;
    }

    const source = reverseBase ? Array.from(items).reverse() : items;
    const base = source.map((entry) => entry.item);
    const fuse = new Fuse(base, options);
    return mapFuseResults(fuse.search(query.trim()));
}

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
    let resultSearch: ICommentsFuseResult[] = [];

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
        resultSearch = filterAuthorChat(cmntsChat);

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
        resultSearch = filterDonatedChat(cmntsChat);

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
        resultSearch = filterMembersChat(cmntsChat);

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

        const fuse = new Fuse(cmntsChat, timestampOptions);
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
        resultSearch = (filterChatNewestFirst(commentsChat) as ICommentsFuseResult[]) || [];

        if (trimmedQuery) {
            try {
                const fuseBase = new Fuse(cmntsChat, options);
                const matched = new Set(fuseBase.search(trimmedQuery).map((entry) => entry.item));
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
        resultSearch = (filterVerifiedChatComments(commentsChat) as ICommentsFuseResult[]) || [];

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
        resultSearch = (filterLinksChatComments(commentsChat) as ICommentsFuseResult[]) || [];

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
        const fuse = new Fuse(cmntsChat, options);
        resultSearch = fuse.search(trimmedQuery).map((entry) => ({
            item: entry.item,
            refIndex:
                parseInt(
                    wrapTryCatch(
                        () =>
                            entry.item.replayChatItemAction.actions[0].addChatItemAction.item
                                .liveChatTextMessageRenderer.timestampUsec
                    ) as any,
                    10
                ) || 0,
            score: entry.score
        }));
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
