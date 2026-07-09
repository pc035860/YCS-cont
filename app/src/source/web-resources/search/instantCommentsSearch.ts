import type { CommentItem, ICommentsFuseResult } from '../../utils/interfaces/i_types';
import { requestYouTubeApiCommentSearch } from '../handlers/youtubeDataApiHandler';
import type { CommentsSearchResult } from './commentsSearch';
import {
    createInitialRemoteSearch,
    getController,
    getRemoteSearch,
    resetController,
    resetRemoteSearch,
    setRemoteSearch,
    setCommentsDataSource,
    type WebResourcesState
} from '../state';

export class InstantSearchQuotaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InstantSearchQuotaError';
    }
}

export interface InstantCommentSearchDeps {
    videoId: string;
}

function assignResultIndexes(items: CommentItem[]): CommentItem[] {
    return items.map((item, index) => {
        item._index = index;
        return item;
    });
}

function toFuseResults(items: CommentItem[]): ICommentsFuseResult[] {
    return items.map((item, index) => ({
        item,
        refIndex: item._index ?? index,
        score: 0
    }));
}

export function buildInstantStatusText(query: string, count: number): string {
    const trimmed = query.trim();
    if (!trimmed) {
        return 'Type something to search instantly, or click Load all to browse every comment.';
    }
    if (count === 0) {
        return `No instant matches for "${trimmed}". Try different words, or Load all for fuzzy search.`;
    }
    return `⚡ Instant: ${count} matches for "${trimmed}" · Load all comments for filters & export`;
}

export async function runInstantCommentSearch(
    query: string,
    state: WebResourcesState,
    deps: InstantCommentSearchDeps
): Promise<{ state: WebResourcesState; result: CommentsSearchResult; statusText: string }> {
    const trimmed = query.trim();
    const controller = getController(state);

    let response;
    try {
        response = await requestYouTubeApiCommentSearch({
            videoId: deps.videoId,
            searchTerms: trimmed,
            signal: controller.signal
        });
    } catch (error) {
        if ((error as Error & { isQuotaExceeded?: boolean }).isQuotaExceeded) {
            throw new InstantSearchQuotaError(
                'YouTube API quota exceeded. Instant search unavailable — you can still load comments normally.'
            );
        }
        throw error;
    }

    const indexedItems = assignResultIndexes(response.items);
    const session = {
        ...createInitialRemoteSearch(),
        active: true,
        query: trimmed,
        results: indexedItems,
        pageToken: response.nextPageToken,
        hasMore: Boolean(response.nextPageToken),
        quotaUsed: 1
    };

    let nextState = setRemoteSearch(state, session);
    nextState = setCommentsDataSource(nextState, 'ytapi_instant');

    const fuseResults = toFuseResults(indexedItems);
    const result: CommentsSearchResult = {
        results: fuseResults,
        total: fuseResults.length,
        summary: buildInstantStatusText(trimmed, fuseResults.length),
        query: trimmed,
        buttonStates: {}
    };

    return {
        state: nextState,
        result,
        statusText: result.summary
    };
}

export function abortInFlightCommentLoad(state: WebResourcesState): WebResourcesState {
    getController(state).abort();
    return resetRemoteSearch(resetController(state));
}

export function getInstantResultAccessor(state: WebResourcesState): { getComments: () => CommentItem[] } {
    return {
        getComments: () => getRemoteSearch(state).results
    };
}
