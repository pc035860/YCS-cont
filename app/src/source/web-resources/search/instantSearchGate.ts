import { GlobalStore } from '../../utils/common';
import { getComments } from '../state';
import type { WebResourcesState } from '../state';

export interface InstantSearchFlags {
    hasYoutubeApiKey?: boolean;
    youtubeApiEnabled?: boolean;
    youtubeApiInstantSearch?: boolean;
}

export function resolveInstantSearchEnabled(flags: InstantSearchFlags): boolean {
    return flags.youtubeApiInstantSearch !== false;
}

export function instantEligible(flags: InstantSearchFlags = GlobalStore): boolean {
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
}): boolean {
    return instantEligible({
        hasYoutubeApiKey: Boolean(opts.youtubeApiKey?.trim()),
        youtubeApiEnabled: opts.youtubeApiEnabled,
        youtubeApiInstantSearch: opts.youtubeApiInstantSearch
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
