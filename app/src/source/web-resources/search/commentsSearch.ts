import Fuse from '../../../../node_modules/fuse.js/dist/fuse';

import { buildKeysSignature, buildOptionsSignature, cloneFuseOptions } from './fuseCacheUtils';

import { applyFilters } from '../../utils/filters/engine';
import {
    createVerifiedFilter,
    createMemberFilter,
    createCreatorHeartFilter,
    createLinksFilter,
    createTimelineFilter,
    createDonatedFilter,
    createChannelOwnerFilter,
    createOriginalCommentsFilter,
    createEmojiCommentsFilter
} from '../../utils/filters/commentsAgg';
import { ICommentsFuseResult, IParamSearch } from '../../utils/interfaces/i_types';
import { getComments, WebResourcesState } from '../state';
import { SearchContext } from './types';
import { FilterConfig } from '../../utils/filters/types';

export interface SearchButtonState {
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

function sortByTimestamp(results: ICommentsFuseResult[]): ICommentsFuseResult[] {
    return results.sort((a, b) => {
        const getFirstTimestamp = (item: any): number => {
            const runs = item.commentRenderer?.contentText?.runs;
            if (runs && runs.length > 0) {
                for (const run of runs) {
                    if (run.navigationEndpoint?.watchEndpoint?.startTimeSeconds >= 0) {
                        return run.navigationEndpoint.watchEndpoint.startTimeSeconds * 1000;
                    }
                }
            }
            return 0;
        };
        return getFirstTimestamp(a.item) - getFirstTimestamp(b.item);
    });
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

    if (trimmedQuery) {
        const fuse = getFuseInstance(comments, options);
        resultSearch = mapFuseResults(fuse.search(trimmedQuery));
    } else {
        // Handle empty query by returning all results
        resultSearch = comments.map((item, index) => ({
            item,
            refIndex: index,
            score: 0
        }));
        if (param.sortOrder === 'relevance') {
            // No such thing as sorting by relevance for empty query, default to newest
            param.sortOrder = 'newest';
        }
    }

    const filterConfigs = [] as FilterConfig[];
    for (const key of Object.keys(param)) {
        switch (key) {
            case 'links':
                filterConfigs.push(createLinksFilter(true));
                break;
            case 'members':
                filterConfigs.push(createMemberFilter(true));
                break;
            case 'donated':
                filterConfigs.push(createDonatedFilter(true));
                break;
            case 'author':
                filterConfigs.push(createChannelOwnerFilter(true));
                break;
            case 'heart':
                filterConfigs.push(createCreatorHeartFilter(true));
                break;
            case 'verified':
                filterConfigs.push(createVerifiedFilter(true));
                break;
            case 'timestamp':
                filterConfigs.push(createTimelineFilter(true));
                break;
            case 'origin':
                filterConfigs.push(createOriginalCommentsFilter(true));
                break;
            case 'emoji':
                filterConfigs.push(createEmojiCommentsFilter(true));
                break;
            default:
                break;
        }
    }

    if (filterConfigs.length > 0) {
        const agg = applyFilters(comments, filterConfigs);
        resultSearch = applyTextMatches(
            agg.items.map((item) => ({ item, refIndex: (item as any)?._index ?? 0 })),
            matches
        );
    }

    if (param.random && resultSearch.length > 1) {
        resultSearch = [resultSearch[Math.floor(Math.random() * resultSearch.length)]];
    }

    if (resultSearch.length > 1) {
        if (context.timestampSort == true && param.sortOrder === 'newest') {
            resultSearch = sortByTimestamp(resultSearch);
        } else if (context.timestampSort == true && param.sortOrder === 'oldest') {
            resultSearch = sortByTimestamp(resultSearch).reverse();
        } else if (param.sortOrder === 'newest') {
            resultSearch.sort((a, b) => a.refIndex - b.refIndex);
        } else if (param.sortOrder === 'oldest') {
            resultSearch.sort((a, b) => b.refIndex - a.refIndex);
        } else if (param.sortOrder === 'most_likes') {
            resultSearch.sort(
                (a, b) => (b.item as any)?.commentRenderer?.likeCount - (a.item as any)?.commentRenderer?.likeCount
            );
        } else if (param.sortOrder === 'least_likes') {
            resultSearch.sort(
                (a, b) => (a.item as any)?.commentRenderer?.likeCount - (b.item as any)?.commentRenderer?.likeCount
            );
        } else if (param.sortOrder === 'most_replies') {
            resultSearch.sort(
                (a, b) =>
                    ((b.item as any)?.commentRenderer?.replyCount ?? 0) -
                    ((a.item as any)?.commentRenderer?.replyCount ?? 0)
            );
        } else if (param.sortOrder === 'least_replies') {
            resultSearch.sort(
                (a, b) =>
                    ((a.item as any)?.commentRenderer?.replyCount ?? 0) -
                    ((b.item as any)?.commentRenderer?.replyCount ?? 0)
            );
        } else if (param.sortOrder === 'author_az') {
            resultSearch.sort((a, b) =>
                (a.item as any)?.commentRenderer?.authorText?.simpleText.localeCompare(
                    (b.item as any)?.commentRenderer?.authorText?.simpleText
                )
            );
        } else if (param.sortOrder === 'author_za') {
            resultSearch.sort((a, b) =>
                (b.item as any)?.commentRenderer?.authorText?.simpleText.localeCompare(
                    (a.item as any)?.commentRenderer?.authorText?.simpleText
                )
            );
        } else if (param.sortOrder === 'longest') {
            resultSearch.sort(
                (a, b) =>
                    (b.item as any)?.commentRenderer?.contentText?.fullText.length -
                    (a.item as any)?.commentRenderer?.contentText?.fullText.length
            );
        } else if (param.sortOrder === 'shortest') {
            resultSearch.sort(
                (a, b) =>
                    (a.item as any)?.commentRenderer?.contentText?.fullText.length -
                    (b.item as any)?.commentRenderer?.contentText?.fullText.length
            );
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
