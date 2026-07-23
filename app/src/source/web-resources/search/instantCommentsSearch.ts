import type { CommentItem, ICommentsFuseResult } from '../../utils/interfaces/i_types';
import { requestYouTubeApiCommentSearch } from '../handlers/youtubeDataApiHandler';
import type { CommentsSearchResult } from './commentsSearch';
import { isInstantSessionComplete } from './instantSearchGate';
import { buildInstantResultsStatusHtml, buildInstantStatusText } from './instantSearchUi';
import {
    createInitialRemoteSearch,
    getController,
    getRemoteSearch,
    resetController,
    resetRemoteSearch,
    setRemoteSearch,
    type RemoteSearchSession,
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

/**
 * Build a fresh session from the first-page response. Pure — no side effects — so totalResults
 * propagation is unit-testable without mocking the background message channel.
 */
export function buildInitialRemoteSearchSession(
    query: string,
    items: CommentItem[],
    response: { nextPageToken?: string; totalResults?: number }
): RemoteSearchSession {
    return {
        ...createInitialRemoteSearch(),
        active: true,
        query,
        results: items,
        pageToken: response.nextPageToken,
        totalResults: response.totalResults
    };
}

/**
 * Merge a fetched page into an existing session. `totalResults` refreshes from the latest
 * response when present, otherwise the previously known value is kept.
 */
export function mergeRemoteSearchSession(
    session: RemoteSearchSession,
    mergedResults: CommentItem[],
    response: { nextPageToken?: string; totalResults?: number }
): RemoteSearchSession {
    return {
        ...session,
        results: mergedResults,
        pageToken: response.nextPageToken,
        totalResults: response.totalResults ?? session.totalResults
    };
}

export async function runInstantCommentSearch(
    query: string,
    state: WebResourcesState,
    deps: InstantCommentSearchDeps
): Promise<{ state: WebResourcesState; result: CommentsSearchResult }> {
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
    const session = buildInitialRemoteSearchSession(trimmed, indexedItems, response);

    const nextState = setRemoteSearch(state, session);
    const result = buildInstantSearchResult(trimmed, indexedItems);

    return {
        state: nextState,
        result
    };
}

export function abortInFlightCommentLoad(state: WebResourcesState): WebResourcesState {
    getController(state).abort();
    return resetRemoteSearch(resetController(state));
}

export function abortInFlightInstantSearch(state: WebResourcesState): WebResourcesState {
    getController(state).abort();
    return resetController(state);
}

export function mergeInstantPageResults(existing: CommentItem[], incoming: CommentItem[]): CommentItem[] {
    const startIndex = existing.length;
    return [
        ...existing,
        ...incoming.map((item, offset) => {
            item._index = startIndex + offset;
            return item;
        })
    ];
}

export async function fetchNextInstantSearchPage(
    state: WebResourcesState,
    videoId: string
): Promise<{ state: WebResourcesState; appendedCount: number; statusHtml: string }> {
    const session = getRemoteSearch(state);
    if (!session.active || !session.pageToken) {
        return {
            state,
            appendedCount: 0,
            statusHtml: buildInstantResultsStatusHtml(
                session.query,
                session.results.length,
                isInstantSessionComplete(state)
            )
        };
    }

    const controller = getController(state);
    let response;
    try {
        response = await requestYouTubeApiCommentSearch({
            videoId,
            searchTerms: session.query,
            pageToken: session.pageToken,
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

    const merged = mergeInstantPageResults(session.results, response.items);
    const nextSession = mergeRemoteSearchSession(session, merged, response);

    const nextState = setRemoteSearch(state, nextSession);
    return {
        state: nextState,
        appendedCount: response.items.length,
        statusHtml: buildInstantResultsStatusHtml(session.query, merged.length, !response.nextPageToken)
    };
}

export function buildInstantSearchResult(query: string, items: CommentItem[]): CommentsSearchResult {
    const fuseResults = toFuseResults(items);
    const trimmed = query.trim();
    return {
        results: fuseResults,
        total: fuseResults.length,
        summary: buildInstantStatusText(trimmed, fuseResults.length),
        query: trimmed,
        buttonStates: {}
    };
}
