import Fuse from '../../../../node_modules/fuse.js/dist/fuse';

import { getRandomComment } from '../../utils/dom';
import {
    filterAuthorComments,
    filterDonatedComments,
    filterHeartComments,
    filterLikesComments,
    filterLinksComments,
    filterMemberComments,
    filterNewestFirst,
    filterRepliedComments,
    filterVerifiedComments
} from '../../utils/filters/comments';
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
        ? new Set(new Fuse(comments, options).search(trimmedQuery).map((result) => result.item))
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
        resultSearch = applyTextMatches(filterLikesComments(comments), matches);
        resultSearch.sort((a, b) => {
            const likesA = (a.item as any)?.commentRenderer?.likesForSort || 0;
            const likesB = (b.item as any)?.commentRenderer?.likesForSort || 0;
            if (likesB !== likesA) return likesB - likesA;
            return (a.refIndex || 0) - (b.refIndex || 0);
        });
    } else if (param.links) {
        resultSearch = applyTextMatches(filterLinksComments(comments), matches);

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
        resultSearch = applyTextMatches(filterMemberComments(comments), matches);

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
        resultSearch = applyTextMatches(filterDonatedComments(comments), matches);

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
        resultSearch = applyTextMatches(filterRepliedComments(comments), matches);
        resultSearch.sort((a, b) => {
            const repliedA = (a.item as any)?.commentRenderer?.repliedForSort || 0;
            const repliedB = (b.item as any)?.commentRenderer?.repliedForSort || 0;
            if (repliedB !== repliedA) return repliedB - repliedA;
            return (a.refIndex || 0) - (b.refIndex || 0);
        });
    } else if (param.author) {
        resultSearch = applyTextMatches(filterAuthorComments(comments), matches);

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
        resultSearch = applyTextMatches(filterHeartComments(comments), matches);

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
        resultSearch = applyTextMatches(filterVerifiedComments(comments), matches);

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
        resultSearch = comments
            .filter((comment: any) => comment?.commentRenderer?.isTimeLine === 'timeline')
            .map((comment: any) => ({
                item: comment,
                refIndex: (comment as any)?._index ?? 0
            }));

        resultSearch = applyTextMatches(resultSearch, matches);

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
            const fuse = new Fuse(comments, options);
            resultSearch = mapFuseResults(fuse.search(trimmedQuery));
        } else {
            resultSearch = [];
        }
    }

    const total = resultSearch.length;
    return {
        results: resultSearch,
        total,
        summary: `(Comments) Found: ${total}`,
        query: trimmedQuery,
        buttonStates
    };
}
