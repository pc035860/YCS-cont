import Fuse from '../../../../node_modules/fuse.js/dist/fuse';

import { buildKeysSignature, buildOptionsSignature, cloneFuseOptions } from './fuseCacheUtils';

import { getRandomComment } from '../../utils/dom';
import { filterNewestFirst } from '../../utils/filters/comments';
import { applyFilters } from '../../utils/filters/engine';
import {
    createLikesFilter,
    createRepliesFilter,
    createVerifiedFilter,
    createMemberFilter,
    createCreatorHeartFilter,
    createLinksFilter,
    createTimelineFilter,
    createDonatedFilter,
    createChannelOwnerFilter
} from '../../utils/filters/commentsAgg';
import { ICommentsFuseResult, IParamSearch } from '../../utils/interfaces/i_types';
import { getComments, WebResourcesState } from '../state';
import { SearchContext } from './types';

export interface SearchButtonState {
    order?: 'newest' | 'oldest';
    title?: string;
    label?: string;
    dataset?: Record<string, string>;
}

export interface CommentsSearchResult {
    results: ICommentsFuseResult[];
    total: number;
    summary: string;
    query: string;
    buttonStates: Record<string, SearchButtonState>;
}

// Fuse cache keyed by data reference, length, and key signature.
interface FuseCache {
    instance: Fuse<any>;
    dataRef: any[];
    dataLength: number;
    keysSig: string;
    optionsSig: string;
}

let fuseCache: FuseCache | null = null;

function getFuseInstance(base: any[], options: Fuse.IFuseOptions<any>): Fuse<any> {
    const keysSig = buildKeysSignature(options.keys);
    const optionsSig = buildOptionsSignature(options);
    if (
        fuseCache &&
        fuseCache.dataRef === base &&
        fuseCache.dataLength === base.length &&
        fuseCache.keysSig === keysSig &&
        fuseCache.optionsSig === optionsSig
    ) {
        return fuseCache.instance;
    }

    const instance = new Fuse(base, options);
    fuseCache = { instance, dataRef: base, dataLength: base.length, keysSig, optionsSig };
    return instance;
}

export function clearCommentsFuseCache(): void {
    fuseCache = null;
}

function mapFuseResults(raw: readonly Fuse.FuseResult<any>[]): ICommentsFuseResult[] {
    return raw.map((result) => ({
        item: result.item,
        refIndex: (result.item as any)?._index ?? result.refIndex ?? 0,
        score: result.score
    }));
}

function applyTextMatches(results: ICommentsFuseResult[], matches: Set<any> | null): ICommentsFuseResult[] {
    if (!matches) {
        return results;
    }

    return results.filter((entry) => matches.has(entry.item));
}

function ensureSortOrder(order?: 'newest' | 'oldest'): 'newest' | 'oldest' {
    return order === 'oldest' ? 'oldest' : 'newest';
}

function searchWithinSubset(
    subset: ICommentsFuseResult[],
    options: Fuse.IFuseOptions<any>,
    query: string
): ICommentsFuseResult[] {
    if (!query.trim()) {
        return subset;
    }

    const base = subset.map((entry) => entry.item);
    const fuse = new Fuse(base, options);
    return mapFuseResults(fuse.search(query.trim())) as ICommentsFuseResult[];
}

export function runSearch(
    query: string,
    filters: IParamSearch | undefined,
    state: WebResourcesState,
    context: SearchContext
): CommentsSearchResult {
    const comments = getComments(state);
    const trimmedQuery = query?.trim?.() ?? '';

    if (!comments || comments.length === 0) {
        return {
            results: [],
            total: 0,
            summary: '(Comments) Found: 0',
            query: trimmedQuery,
            buttonStates: {}
        };
    }

    let fuseOptions = cloneFuseOptions();
    let fuseKeys = ['commentRenderer.authorText.simpleText', 'commentRenderer.contentText.fullText'];

    if (context.extendedSearch.enabled) {
        fuseOptions = cloneFuseOptions();
        fuseOptions.useExtendedSearch = true;

        if (context.extendedSearch.title) {
            fuseKeys = ['commentRenderer.authorText.simpleText'];
        }

        if (context.extendedSearch.main) {
            fuseKeys = ['commentRenderer.contentText.fullText'];
        }
    }

    const options: Fuse.IFuseOptions<any> = {
        ...fuseOptions,
        keys: fuseKeys
    };

    const matches: Set<any> | null = trimmedQuery
        ? new Set(
              getFuseInstance(comments, options)
                  .search(trimmedQuery)
                  .map((result) => result.item)
          )
        : null;

    const param = filters ?? {};
    const buttonStates: Record<string, SearchButtonState> = {};
    let resultSearch: ICommentsFuseResult[] = [];

    const updateButtonState = (id: string, order: 'newest' | 'oldest', title: string, label?: string): void => {
        buttonStates[id] = {
            order,
            title,
            label
        };
    };

    if (param.likes) {
        const agg = applyFilters(comments, [createLikesFilter({})]);
        resultSearch = applyTextMatches(
            agg.items.map((item) => ({ item, refIndex: (item as any)?._index ?? 0 })),
            matches
        );
        resultSearch.sort((a, b) => {
            const likesA = (a.item as any)?.commentRenderer?.likesForSort || 0;
            const likesB = (b.item as any)?.commentRenderer?.likesForSort || 0;
            if (likesB !== likesA) return likesB - likesA;
            return (a.refIndex || 0) - (b.refIndex || 0);
        });
    } else if (param.links) {
        const agg = applyFilters(comments, [createLinksFilter(true)]);
        resultSearch = applyTextMatches(
            agg.items.map((item) => ({ item, refIndex: (item as any)?._index ?? 0 })),
            matches
        );

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            let sortOrder = param.sortOrder ?? context.sortOrders.comments['ycs_btn_links'];
            if (sortOrder === undefined && trimmedQuery) {
                resultSearch = searchWithinSubset(resultSearch, options, trimmedQuery);
                sortOrder = 'newest';
            }

            const resolvedOrder = ensureSortOrder(sortOrder);
            if (resolvedOrder === 'oldest') {
                resultSearch = Array.from(resultSearch).reverse();
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
    } else if (param.members) {
        const agg = applyFilters(comments, [createMemberFilter(true)]);
        resultSearch = applyTextMatches(
            agg.items.map((item) => ({ item, refIndex: (item as any)?._index ?? 0 })),
            matches
        );

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.comments['ycs_btn_members']);
            if (resolvedOrder === 'oldest') {
                resultSearch = Array.from(resultSearch).reverse();
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
    } else if (param.donated) {
        const agg = applyFilters(comments, [createDonatedFilter(true)]);
        resultSearch = applyTextMatches(
            agg.items.map((item) => ({ item, refIndex: (item as any)?._index ?? 0 })),
            matches
        );

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.comments['ycs_btn_donated']);
            if (resolvedOrder === 'oldest') {
                resultSearch = Array.from(resultSearch).reverse();
            }

            updateButtonState(
                'ycs_btn_donated',
                resolvedOrder,
                resolvedOrder === 'oldest'
                    ? 'Show comments from users who have donated (Oldest)'
                    : 'Show comments from users who have donated (Newest)',
                'Donated'
            );
        }
    } else if (param.replied) {
        const agg = applyFilters(comments, [createRepliesFilter({ min: 1 })]);
        resultSearch = applyTextMatches(
            agg.items.map((item) => ({ item, refIndex: (item as any)?._index ?? 0 })),
            matches
        );
        resultSearch.sort((a, b) => {
            const repliedA = (a.item as any)?.commentRenderer?.repliedForSort || 0;
            const repliedB = (b.item as any)?.commentRenderer?.repliedForSort || 0;
            if (repliedB !== repliedA) return repliedB - repliedA;
            return (a.refIndex || 0) - (b.refIndex || 0);
        });
    } else if (param.author) {
        const agg = applyFilters(comments, [createChannelOwnerFilter(true)]);
        resultSearch = applyTextMatches(
            agg.items.map((item) => ({ item, refIndex: (item as any)?._index ?? 0 })),
            matches
        );

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.comments['ycs_btn_author']);
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
    } else if (param.heart) {
        const agg = applyFilters(comments, [createCreatorHeartFilter(true)]);
        resultSearch = applyTextMatches(
            agg.items.map((item) => ({ item, refIndex: (item as any)?._index ?? 0 })),
            matches
        );

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.comments['ycs_btn_heart']);
            if (resolvedOrder === 'oldest') {
                resultSearch = Array.from(resultSearch).reverse();
            }

            updateButtonState(
                'ycs_btn_heart',
                resolvedOrder,
                resolvedOrder === 'oldest'
                    ? 'Show comments and replies that the author likes (Oldest)'
                    : 'Show comments and replies that the author likes (Newest)'
            );
        }
    } else if (param.verified) {
        const agg = applyFilters(comments, [createVerifiedFilter(true)]);
        resultSearch = applyTextMatches(
            agg.items.map((item) => ({ item, refIndex: (item as any)?._index ?? 0 })),
            matches
        );

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.comments['ycs_btn_verified']);
            if (resolvedOrder === 'oldest') {
                resultSearch = Array.from(resultSearch).reverse();
            }

            updateButtonState(
                'ycs_btn_verified',
                resolvedOrder,
                resolvedOrder === 'oldest'
                    ? 'Show comments, replies and chat from verified authors (Oldest)'
                    : 'Show comments, replies and chat from verified authors (Newest)'
            );
        }
    } else if (param.random) {
        if (trimmedQuery) {
            const subset = Array.from(matches ?? []);
            if (subset.length > 0) {
                const pick = subset[Math.floor(Math.random() * subset.length)];
                resultSearch = [
                    {
                        item: pick,
                        refIndex: (pick as any)?._index ?? 0
                    }
                ];
            } else {
                resultSearch = [];
            }
        } else {
            resultSearch = getRandomComment(comments) as ICommentsFuseResult[];
        }
    } else if (param.timestamp) {
        const agg = applyFilters(comments, [createTimelineFilter(true)]);
        resultSearch = applyTextMatches(
            agg.items.map((item) => ({ item, refIndex: (item as any)?._index ?? 0 })),
            matches
        );

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.comments['ycs_btn_timestamps']);
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
        const newest = filterNewestFirst(comments) || [];
        resultSearch = applyTextMatches(newest, matches);

        if (resultSearch.length > 0) {
            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.comments['ycs_btn_sort_first']);
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
    } else {
        if (trimmedQuery) {
            const fuse = getFuseInstance(comments, options);
            resultSearch = mapFuseResults(fuse.search(trimmedQuery));
        } else {
            resultSearch = [];
        }
    }

    // Deduplicate search results by commentId
    const seenCommentIds = new Set<string>();
    const uniqueResults: ICommentsFuseResult[] = [];
    for (const result of resultSearch) {
        const commentId = (result.item as any)?.commentRenderer?.commentId;
        if (commentId) {
            if (!seenCommentIds.has(commentId)) {
                seenCommentIds.add(commentId);
                uniqueResults.push(result);
            }
        } else {
            // Keep items without commentId (should happen rarely, if ever)
            uniqueResults.push(result);
        }
    }

    return {
        results: uniqueResults,
        total: uniqueResults.length,
        summary: `(Comments) Found: ${uniqueResults.length}`,
        query: trimmedQuery,
        buttonStates
    };
}
