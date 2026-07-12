import { GlobalStore } from '../../utils/common';
import { getComments, getRemoteSearch } from '../state';
import type { WebResourcesState } from '../state';

export interface InstantSearchFlags {
    hasYoutubeApiKey?: boolean;
    youtubeApiEnabled?: boolean;
    youtubeApiInstantSearch?: boolean;
    isCommunityPost?: boolean;
}

export function resolveInstantSearchEnabled(flags: InstantSearchFlags): boolean {
    return flags.youtubeApiInstantSearch !== false;
}

export function instantEligible(flags: InstantSearchFlags = GlobalStore): boolean {
    // Instant search needs a video-scoped context (watch/live/Shorts): getVideoId() returns
    // undefined on community posts, so instant search would silently no-op there.
    // See filter-search-behavior-regression-spec.md §12.1.
    if (flags.isCommunityPost) return false;
    // Instant search needs an API key only. youtubeApiEnabled gates full Data API load, not SEARCH.
    return Boolean(flags.hasYoutubeApiKey) && resolveInstantSearchEnabled(flags);
}

export function shouldSkipAutoload(flags: InstantSearchFlags = GlobalStore): boolean {
    return instantEligible(flags);
}

export function shouldSkipAutoloadFromStorage(opts: {
    youtubeApiKey?: string;
    youtubeApiEnabled?: boolean;
    youtubeApiInstantSearch?: boolean;
    isCommunityPost?: boolean;
}): boolean {
    return instantEligible({
        hasYoutubeApiKey: Boolean(opts.youtubeApiKey?.trim()),
        youtubeApiEnabled: opts.youtubeApiEnabled,
        youtubeApiInstantSearch: opts.youtubeApiInstantSearch,
        isCommunityPost: opts.isCommunityPost
    });
}

export function isInstantBrowseMode(state: WebResourcesState, flags: InstantSearchFlags = GlobalStore): boolean {
    return instantEligible(flags) && getComments(state).length === 0;
}

export function shouldUseInstantSearch(
    query: string,
    state: WebResourcesState,
    flags: InstantSearchFlags = GlobalStore
): boolean {
    const trimmed = query.trim();
    if (!trimmed) return false;
    if (!instantEligible(flags)) return false;
    if (getComments(state).length > 0) return false;
    return true;
}

/**
 * True once the instant result set covers the whole API-side match set for the active query:
 * an active session, at least one result, and no further page to fetch.
 * Unlocks locally-servable filters/sort — see instantSearchUi's two-tier filter classification.
 */
export function isInstantSessionComplete(state: WebResourcesState): boolean {
    const session = getRemoteSearch(state);
    return session.active && session.results.length > 0 && !session.pageToken;
}
