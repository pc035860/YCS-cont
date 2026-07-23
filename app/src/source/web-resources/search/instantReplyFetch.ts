import type { CommentItem, YouTubeApiComment } from '../../utils/interfaces/i_types';
import { transformReplyToCommentItem } from '../../utils/youtubeDataApi/transform';
import { requestYouTubeApiCommentReplies, type RepliesResponse } from '../handlers/youtubeDataApiHandler';
import { getRemoteSearch, setRemoteSearch, type WebResourcesState } from '../state';

function getCommentId(item: CommentItem): string | undefined {
    return item.commentRenderer?.commentId;
}

/**
 * Merge freshly-fetched replies into an instant session's existing result list, deduping by
 * reply commentId. The Data API's `comments.list?parentId=` returns ALL replies to a parent,
 * which includes the same <=5 items the search response already inlined — those must not be
 * duplicated. Pure — no side effects — so it's unit-testable without mocking background
 * messaging.
 */
export function mergeFetchedReplies(existingResults: CommentItem[], fetchedReplies: CommentItem[]): CommentItem[] {
    const existingIds = new Set(existingResults.map(getCommentId).filter((id): id is string => Boolean(id)));

    const newReplies = fetchedReplies.filter((reply) => {
        const id = getCommentId(reply);
        // Replies missing a commentId can't be deduped reliably - keep them rather than drop.
        return id ? !existingIds.has(id) : true;
    });

    if (newReplies.length === 0) return existingResults;

    // Continue the session's `_index` sequence (same convention as mergeInstantPageResults) so
    // origin-chain / ref-index lookups keep working for these newly-appended items.
    const startIndex = existingResults.length;
    const indexedNewReplies = newReplies.map((reply, offset) => {
        reply._index = startIndex + offset;
        return reply;
    });

    return [...existingResults, ...indexedNewReplies];
}

export interface FetchAndMergeRepliesOptions {
    videoId: string;
    parentId: string;
    parentItem: CommentItem;
    /**
     * Read the CURRENT state at merge time (called once, right after the fetch resolves) rather
     * than a snapshot captured before the (possibly slow) network round-trip. Two reply fetches
     * can be in flight concurrently (different threads); reading fresh state here means whichever
     * resolves second merges on top of the first's already-applied results instead of overwriting
     * them with a stale pre-fetch snapshot.
     */
    getState: () => WebResourcesState;
    signal?: AbortSignal;
}

export interface FetchAndMergeRepliesResult {
    state: WebResourcesState;
    fetchedReplies: CommentItem[];
}

/** Injectable so callers (and tests) can stub the background round-trip. */
export type FetchRepliesFn = (options: {
    videoId: string;
    parentId: string;
    signal?: AbortSignal;
}) => Promise<RepliesResponse>;

/**
 * Fetch ALL remaining pages of replies for `parentId` via the background REPLIES message
 * family, transform them into `CommentItem[]` (`originComment` set to `parentItem`), and merge
 * (dedupe) into the instant session's `remoteSearch.results`. On the normal path, re-expanding
 * the same thread later is served entirely from the merged session state - no second API call.
 * Exception: a concurrent Show more / Fetch all page fetch (instantCommentsSearch.ts) can still
 * overwrite this merge with its own pre-fetch snapshot - see the regression spec's §12.9 "Known
 * accepted limitation" for the narrow, self-healing trigger and impact.
 */
export async function fetchAndMergeReplies(
    options: FetchAndMergeRepliesOptions,
    fetchReplies: FetchRepliesFn = requestYouTubeApiCommentReplies
): Promise<FetchAndMergeRepliesResult> {
    const response = await fetchReplies({
        videoId: options.videoId,
        parentId: options.parentId,
        signal: options.signal
    });

    const transformed = response.items.map((raw: YouTubeApiComment) =>
        transformReplyToCommentItem(raw, options.videoId, options.parentItem)
    );

    const currentState = options.getState();
    const session = getRemoteSearch(currentState);
    const mergedResults = mergeFetchedReplies(session.results, transformed);
    const nextState = setRemoteSearch(currentState, { ...session, results: mergedResults });

    return {
        state: nextState,
        fetchedReplies: transformed
    };
}
