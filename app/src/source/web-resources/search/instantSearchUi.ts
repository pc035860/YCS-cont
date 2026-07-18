import { escapeHtml } from '../../utils/common';
import type { IParamSearch } from '../../utils/interfaces/i_types';
import type { ExportFormat } from '../services/exportService';
import { FILTER_BUTTONS } from '../ui/filters';
import type { FilterParamKey } from '../ui/filters';

export const INSTANT_DEGRADED_TOOLTIP = 'Needs all comments loaded — click to load';

export const INSTANT_SHOW_MORE_TOOLTIP = 'Fetch next page from YouTube (~1 quota unit)';

export const INSTANT_FETCH_ALL_LABEL = 'Fetch all matches';

export const INSTANT_FETCH_ALL_TOOLTIP_UNKNOWN = 'Fetch every remaining page (1 quota unit per 100 matches)';

/** Re-entry guard class shared by the Show more and Fetch all blocks while a page fetch is in flight. */
export const INSTANT_FETCHING_CLASS = 'ycs-instant-fetching';

/**
 * Filters that can never work on instant (Data API) data — the required fields
 * (creatorHeart, verifiedAuthor, sponsorCommentBadge, donatedChip, authorIsChannelOwner)
 * are absent from Data API responses regardless of session completeness.
 */
export const INSTANT_ALWAYS_DEGRADED_FILTER_PARAMS: FilterParamKey[] = [
    'heart',
    'verified',
    'members',
    'donated',
    'author',
    'timestampViz'
];

/** Filters that unlock once the instant session is complete (all API pages fetched). */
export const INSTANT_UNLOCKABLE_FILTER_PARAMS: FilterParamKey[] = [
    'random',
    'links',
    'likes',
    'replied',
    'timestamp',
    'sortFirst'
];

/** Filters that need the full local archive — not supported by YouTube searchTerms alone. */
export const DEGRADED_FILTER_PARAMS: FilterParamKey[] = [
    ...INSTANT_ALWAYS_DEGRADED_FILTER_PARAMS,
    ...INSTANT_UNLOCKABLE_FILTER_PARAMS
];

function toFilterEntries(params: FilterParamKey[]): Array<{ elementId: string; param: FilterParamKey }> {
    return params.map((param) => {
        const config = FILTER_BUTTONS.find((entry) => entry.param === param);
        if (!config) {
            throw new Error(`Missing FILTER_BUTTONS entry for degraded filter: ${param}`);
        }
        return { elementId: config.elementId, param };
    });
}

export const DEGRADED_FILTERS: Array<{ elementId: string; param: FilterParamKey }> =
    toFilterEntries(DEGRADED_FILTER_PARAMS);

export const INSTANT_ALWAYS_DEGRADED_FILTERS: Array<{ elementId: string; param: FilterParamKey }> = toFilterEntries(
    INSTANT_ALWAYS_DEGRADED_FILTER_PARAMS
);

export const INSTANT_UNLOCKABLE_FILTERS: Array<{ elementId: string; param: FilterParamKey }> = toFilterEntries(
    INSTANT_UNLOCKABLE_FILTER_PARAMS
);

export const DEGRADED_FILTER_ELEMENT_IDS: string[] = DEGRADED_FILTERS.map((entry) => entry.elementId);

export const UNLOCKABLE_FILTER_ELEMENT_IDS: string[] = INSTANT_UNLOCKABLE_FILTERS.map((entry) => entry.elementId);

export const DEGRADED_EXPORT_ELEMENT_IDS: string[] = ['ycs_save_all_comments'];

export const DEGRADED_EXTENDED_SEARCH_ID = 'ycs_extended_search';

export const DEGRADED_OPEN_COMMENTS_WINDOW_ID = 'ycs_open_all_comments_window';

const DEGRADED_ELEMENT_IDS = [
    ...DEGRADED_FILTER_ELEMENT_IDS,
    ...DEGRADED_EXPORT_ELEMENT_IDS,
    DEGRADED_EXTENDED_SEARCH_ID,
    DEGRADED_OPEN_COMMENTS_WINDOW_ID
];

export interface PendingUpgradeIntent {
    filterParam?: IParamSearch;
    exportIntent?: { format: ExportFormat };
    /** Enable `#ycs_extended_search` after upgrade (native toggle was blocked by capture). */
    enableExtendedSearch?: boolean;
    /** Open the full-archive comments window after upgrade completes. */
    openCommentsWindow?: boolean;
}

export interface PendingUpgradeStore {
    set(intent: PendingUpgradeIntent): void;
    consume(): PendingUpgradeIntent | null;
    peek(): PendingUpgradeIntent | null;
    clear(): void;
}

export function createPendingUpgradeStore(): PendingUpgradeStore {
    let intent: PendingUpgradeIntent | null = null;

    return {
        set(next: PendingUpgradeIntent) {
            intent = next;
        },
        consume() {
            const value = intent;
            intent = null;
            return value;
        },
        peek() {
            return intent;
        },
        clear() {
            intent = null;
        }
    };
}

export function isDegradedFilterParam(param: FilterParamKey): boolean {
    return DEGRADED_FILTER_PARAMS.includes(param);
}

/**
 * Two-tier classification: always-degraded filters stay blocked regardless of session
 * completeness; unlockable filters are only blocked while the instant session is incomplete.
 */
export function isInstantBlockedFilterParam(param: FilterParamKey, sessionComplete: boolean): boolean {
    if (!isDegradedFilterParam(param)) return false;
    if (!sessionComplete) return true;
    return INSTANT_ALWAYS_DEGRADED_FILTER_PARAMS.includes(param);
}

export function buildInstantEmptyQueryStatusText(): string {
    return 'Type something to search instantly, or click Load all to browse every comment.';
}

export function buildInstantZeroResultsStatusText(query: string): string {
    const trimmed = query.trim();
    return `No instant matches for "${trimmed}". Try different words, or Load all for fuzzy search.`;
}

export function buildInstantResultsStatusText(query: string, count: number, sessionComplete = false): string {
    const trimmed = query.trim();
    const cta = sessionComplete ? 'Load all comments' : 'Load all comments for filters & export';
    return `${count} matches for "${trimmed}" · ${cta}`;
}

const INSTANT_BOLT_SVG =
    '<svg class="ycs-instant-bolt" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M8.7 21.3c-.8.6-1.9-.2-1.6-1.1l2-6.2H5.3c-.8 0-1.2-1-.7-1.6L15.3 2.7c.8-.6 1.9.2 1.6 1.1l-2 6.2h3.8c.8 0 1.2 1 .7 1.6L8.7 21.3z"/></svg>';

/** Shared instant chip markup (SVG bolt + "Instant" label) — reused by the status line and the fetch-all block. */
export function buildInstantChipHtml(): string {
    return `<span class="ycs-instant-chip">${INSTANT_BOLT_SVG} Instant</span>`;
}

/**
 * Once the instant session is complete (all searchTerms pages fetched), the long CTA label is
 * misleading (unlockable filters no longer need "Load all") and needlessly long for sidebar
 * mode, so it shortens with an explanatory tooltip instead. Incomplete sessions keep today's
 * markup verbatim (no `title` attribute).
 *
 * Export is served directly from the accumulated instant results in the complete state
 * (see `syncInstantDegradedControls` / save-dropdown fallback), so the tooltip only
 * references the always-degraded filters that still require the full local archive.
 */
function loadAllCtaHtml(sessionComplete: boolean): string {
    if (sessionComplete) {
        return `<button type="button" class="ycs-instant-load-all-cta" title="For remaining filters">Load all comments</button>`;
    }
    return `<button type="button" class="ycs-instant-load-all-cta">Load all comments for filters &amp; export</button>`;
}

function wrapInstantChipHtml(bodyHtml: string, sessionComplete = false): string {
    // Separator + CTA wrap as one unit so narrow layouts (sidebar mode) never leave a dangling "·"
    return `${buildInstantChipHtml()} ${bodyHtml} <span class="ycs-instant-load-all-wrap">· ${loadAllCtaHtml(sessionComplete)}</span>`;
}

export function buildInstantResultsStatusHtml(query: string, count: number, sessionComplete = false): string {
    const trimmed = query.trim();
    return wrapInstantChipHtml(`${count} matches for &quot;${escapeHtml(trimmed)}&quot;`, sessionComplete);
}

/**
 * All-mode combined status (`comments + chat + transcript`) with the ⚡ Instant chip preserved —
 * the chip must not be overwritten by plain text when other sources render alongside instant
 * comments. Takes the pre-formatted, filter-specific result text so all-mode labels
 * (e.g. "Links, found: N") stay intact.
 */
export function buildInstantAllModeStatusHtml(combinedText: string, sessionComplete = false): string {
    return wrapInstantChipHtml(escapeHtml(combinedText), sessionComplete);
}

export function buildInstantStatusText(query: string, count: number): string {
    const trimmed = query.trim();
    if (!trimmed) {
        return buildInstantEmptyQueryStatusText();
    }
    if (count === 0) {
        return buildInstantZeroResultsStatusText(trimmed);
    }
    return buildInstantResultsStatusText(trimmed, count);
}

/**
 * Tooltip for the "Fetch all matches" auto-paginate block. When `totalResults` (Data API
 * `pageInfo.totalResults`) is known, estimates remaining pages at 100 results/page (min 1);
 * otherwise falls back to a generic per-100-matches quota note.
 */
export function buildInstantFetchAllTooltip(totalResults: number | undefined, loadedCount: number): string {
    if (totalResults === undefined || !Number.isFinite(totalResults)) {
        return INSTANT_FETCH_ALL_TOOLTIP_UNKNOWN;
    }
    const remainingPages = Math.max(1, Math.ceil((totalResults - loadedCount) / 100));
    return `Fetch every remaining page (~${remainingPages} quota units)`;
}

/** Progress label shown on the fetch-all block while the auto-paginate loop is running. */
export function buildInstantFetchAllProgressLabel(loadedCount?: number): string {
    if (loadedCount === undefined) {
        return 'Fetching all matches…';
    }
    return `Fetching all matches… (${loadedCount} loaded)`;
}

export function buildUpgradingStatusText(instantCount: number, loadedCount?: number): string {
    if (loadedCount !== undefined && Number.isFinite(loadedCount) && loadedCount > 0) {
        return `Instant: ${instantCount} matches · Loading full archive… (${loadedCount} loaded)`;
    }
    return `Instant: ${instantCount} matches · Loading full archive…`;
}

export function buildUpgradedStatusText(count: number): string {
    return `(Comments) Found: ${count}`;
}

export function buildUpgradeCompleteNotifyMessage(options?: {
    filterLabel?: string;
    query?: string;
    exportUnlocked?: boolean;
}): string {
    const query = options?.query?.trim();
    let message: string;
    if (options?.filterLabel) {
        message = `All comments loaded — applied ${options.filterLabel} filter locally.`;
    } else if (query) {
        message = `All comments loaded — showing local results for "${query}".`;
    } else {
        message = 'All comments loaded — showing local results.';
    }
    if (options?.exportUnlocked) {
        message += ' Export unlocked — use save ▾ to export the full archive.';
    }
    return message;
}

export const UPGRADE_MODAL_TITLE = 'Load all comments?';

export const UPGRADE_MODAL_MESSAGE =
    'This filter needs the full comment archive. Load all comments now? Your instant results stay visible while loading.';

export const UPGRADE_EXPORT_MODAL_MESSAGE =
    'Export needs the full comment archive. Load all comments now? Your instant results stay visible while loading.';

export const UPGRADE_OPEN_WINDOW_MODAL_MESSAGE =
    'Opening all comments needs the full comment archive. Load all comments now? Your instant results stay visible while loading.';

export const UPGRADE_OPEN_REPLIES_MODAL_MESSAGE =
    'Viewing all replies needs the full comment archive. Load all comments now? Your instant results stay visible while loading.';

/**
 * Instant-mode export choice modal (shown when the user clicks save ▾ while the
 * instant search session is not yet complete). Two-option UX:
 *   - primary (Load all matches):   auto-paginate the current instant query;
 *                                    ~1 quota unit per remaining page. Faster,
 *                                    only fetches matches for the search term.
 *   - secondary (Load all comments): fetch the full local comment archive
 *                                    (existing "Load all" flow); unlocks all
 *                                    filters + export.
 */
export const EXPORT_CHOICE_MODAL_TITLE = 'Export instant results?';

export function buildExportChoiceModalMessage(query: string): string {
    const trimmed = query.trim();
    if (!trimmed) {
        return 'Export needs a complete result set. Load all matches for the current instant query, or load the full comment archive?';
    }
    return `Export needs a complete result set. Load all matches for "${trimmed}" (faster), or load the full comment archive?`;
}

export function buildExportChoicePrimaryLabel(query: string): string {
    const trimmed = query.trim();
    if (!trimmed) {
        return 'Load all matches';
    }
    return `Load all matches for "${trimmed}"`;
}

export const EXPORT_CHOICE_SECONDARY_LABEL = 'Load all comments';

export type InstantExportChoice = 'primary' | 'secondary' | 'cancel';

/**
 * Pure dispatch: given the user's modal choice (primary = Load all matches,
 * secondary = Load all comments, cancel = close) and whether the on-page
 * "Fetch all matches" auto-paginate block is currently mounted, decide which
 * action the caller should trigger. Extracted for testability — the caller
 * still owns the DOM-side click / full-load invocation.
 */
export function resolveInstantExportAction(
    choice: InstantExportChoice,
    fetchAllBlockPresent: boolean
): 'click-fetch-all' | 'begin-full-upgrade' | 'noop' {
    if (choice === 'cancel') return 'noop';
    if (choice === 'secondary') return 'begin-full-upgrade';
    // primary = Load all matches. Fall back to full upgrade if the auto-paginate
    // block is not on the page (e.g. the user hasn't scrolled it into view yet).
    if (fetchAllBlockPresent) return 'click-fetch-all';
    return 'begin-full-upgrade';
}

function setDegraded(element: HTMLElement, degraded: boolean): void {
    if (degraded) {
        // Snapshot the native title on the first transition into degraded so
        // we can restore it on unlock — otherwise repeated syncs would keep
        // overwriting the snapshot with our own degraded copy.
        if (!element.classList.contains('ycs-btn-degraded')) {
            const nativeTitle = element.getAttribute('title');
            if (nativeTitle !== null && nativeTitle !== INSTANT_DEGRADED_TOOLTIP) {
                element.dataset.ycsNativeTitle = nativeTitle;
            }
        }
        element.classList.add('ycs-btn-degraded');
        element.setAttribute('title', INSTANT_DEGRADED_TOOLTIP);
    } else {
        element.classList.remove('ycs-btn-degraded');
        if (element.getAttribute('title') === INSTANT_DEGRADED_TOOLTIP) {
            const nativeTitle = element.dataset.ycsNativeTitle;
            if (nativeTitle !== undefined) {
                element.setAttribute('title', nativeTitle);
                delete element.dataset.ycsNativeTitle;
            } else {
                element.removeAttribute('title');
            }
        }
    }
}

/**
 * Element IDs that unlock once the instant session is complete (all API pages fetched).
 * Combines unlockable filters with the comments-save dropdown — export runs directly
 * against the accumulated instant results in that state, so the degraded prompt no
 * longer applies.
 */
const SESSION_COMPLETE_UNLOCK_IDS = new Set<string>([...UNLOCKABLE_FILTER_ELEMENT_IDS, ...DEGRADED_EXPORT_ELEMENT_IDS]);

/**
 * Sync degraded-control visuals for instant mode.
 * When `sessionComplete` is true, only always-degraded filters (+ extended/open-window)
 * stay marked degraded; unlockable filters AND the export dropdown have their degraded
 * styling removed.
 */
export function syncInstantDegradedControls(active: boolean, options?: { sessionComplete?: boolean }): void {
    const sessionComplete = Boolean(options?.sessionComplete);

    if (active && sessionComplete) {
        for (const elementId of DEGRADED_ELEMENT_IDS) {
            const element = document.getElementById(elementId);
            if (!element) continue;
            const degraded = !SESSION_COMPLETE_UNLOCK_IDS.has(elementId);
            setDegraded(element, degraded);
        }
        return;
    }

    for (const elementId of DEGRADED_ELEMENT_IDS) {
        const element = document.getElementById(elementId);
        if (!element) continue;
        setDegraded(element, active);
    }
}

export type InstantDegradedAction =
    | { kind: 'filter'; elementId: string; param: FilterParamKey }
    | { kind: 'export' }
    | { kind: 'extended' }
    | { kind: 'openWindow' };

function asClosestElement(target: EventTarget | null): { closest(selectors: string): Element | null } | null {
    if (!target || typeof (target as Element).closest !== 'function') return null;
    return target as Element;
}

export function resolveInstantDegradedAction(target: EventTarget | null): InstantDegradedAction | null {
    const element = asClosestElement(target);
    if (!element) return null;

    for (const { elementId, param } of DEGRADED_FILTERS) {
        if (element.closest(`#${elementId}`)) {
            return { kind: 'filter', elementId, param };
        }
    }

    for (const elementId of DEGRADED_EXPORT_ELEMENT_IDS) {
        if (element.closest(`#${elementId}`)) {
            return { kind: 'export' };
        }
    }

    if (element.closest(`#${DEGRADED_EXTENDED_SEARCH_ID}`)) {
        return { kind: 'extended' };
    }

    if (element.closest(`#${DEGRADED_OPEN_COMMENTS_WINDOW_ID}`)) {
        return { kind: 'openWindow' };
    }

    return null;
}

export function bindInstantDegradedCapture(
    root: HTMLElement,
    options: {
        isActive: () => boolean;
        onAction: (action: InstantDegradedAction) => void;
        isFilterUnlocked?: (param: FilterParamKey) => boolean;
        isExportUnlocked?: () => boolean;
    }
): void {
    const flagged = root as HTMLElement & { __ycsInstantDegradedBound?: boolean };
    if (flagged.__ycsInstantDegradedBound) return;
    flagged.__ycsInstantDegradedBound = true;

    root.addEventListener(
        'click',
        (event: Event) => {
            if (!options.isActive()) return;
            const action = resolveInstantDegradedAction(event.target);
            if (!action) return;
            if (action.kind === 'filter' && options.isFilterUnlocked?.(action.param)) {
                // Unlocked filter: let the native handler run (keeps sort-order toggling free).
                return;
            }
            if (action.kind === 'export' && options.isExportUnlocked?.()) {
                // Instant session complete: let the save dropdown open its native menu, whose
                // handler falls back to the accumulated instant results (see appController).
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            options.onAction(action);
        },
        true
    );
}
