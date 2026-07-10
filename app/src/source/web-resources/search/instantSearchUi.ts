import { escapeHtml } from '../../utils/common';
import type { IParamSearch } from '../../utils/interfaces/i_types';
import type { ExportFormat } from '../services/exportService';
import { FILTER_BUTTONS } from '../ui/filters';
import type { FilterParamKey } from '../ui/filters';

export const INSTANT_DEGRADED_TOOLTIP = 'Needs all comments loaded — click to load';

export const INSTANT_SHOW_MORE_TOOLTIP = 'Fetch next page from YouTube (~1 quota unit)';

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

export function buildInstantResultsStatusText(query: string, count: number): string {
    const trimmed = query.trim();
    return `${count} matches for "${trimmed}" · Load all comments for filters & export`;
}

function wrapInstantChipHtml(bodyHtml: string): string {
    return `<span class="ycs-instant-chip">⚡ Instant</span> ${bodyHtml} · <button type="button" class="ycs-instant-load-all-cta">Load all comments for filters &amp; export</button>`;
}

export function buildInstantResultsStatusHtml(query: string, count: number): string {
    const trimmed = query.trim();
    return wrapInstantChipHtml(`${count} matches for &quot;${escapeHtml(trimmed)}&quot;`);
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

function setDegraded(element: HTMLElement, degraded: boolean): void {
    if (degraded) {
        element.classList.add('ycs-btn-degraded');
        element.setAttribute('title', INSTANT_DEGRADED_TOOLTIP);
    } else {
        element.classList.remove('ycs-btn-degraded');
        if (element.getAttribute('title') === INSTANT_DEGRADED_TOOLTIP) {
            element.removeAttribute('title');
        }
    }
}

/**
 * Sync degraded-control visuals for instant mode.
 * When `sessionComplete` is true, only always-degraded filters (+ export/extended/open-window)
 * stay marked degraded; unlockable filters have their degraded styling removed.
 */
export function syncInstantDegradedControls(active: boolean, options?: { sessionComplete?: boolean }): void {
    const sessionComplete = Boolean(options?.sessionComplete);

    if (active && sessionComplete) {
        for (const elementId of DEGRADED_ELEMENT_IDS) {
            const element = document.getElementById(elementId);
            if (!element) continue;
            const degraded = !UNLOCKABLE_FILTER_ELEMENT_IDS.includes(elementId);
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
            event.preventDefault();
            event.stopImmediatePropagation();
            options.onAction(action);
        },
        true
    );
}
