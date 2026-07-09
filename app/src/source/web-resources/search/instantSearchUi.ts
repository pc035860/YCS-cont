import { escapeHtml } from '../../utils/common';
import type { IParamSearch } from '../../utils/interfaces/i_types';
import type { ExportFormat } from '../services/exportService';
import { FILTER_BUTTONS } from '../ui/filters';
import type { FilterParamKey } from '../ui/filters';

export const INSTANT_DEGRADED_TOOLTIP = 'Needs all comments loaded — click to load';

export const INSTANT_SHOW_MORE_TOOLTIP = 'Fetch next page from YouTube (~1 quota unit)';

/** Filters that need the full local archive — not supported by YouTube searchTerms alone. */
export const DEGRADED_FILTER_PARAMS: FilterParamKey[] = [
    'heart',
    'verified',
    'members',
    'donated',
    'random',
    'timestampViz',
    'links',
    'likes',
    'replied',
    'author',
    'timestamp',
    'sortFirst'
];

export const DEGRADED_FILTERS: Array<{ elementId: string; param: FilterParamKey }> = DEGRADED_FILTER_PARAMS.map(
    (param) => {
        const config = FILTER_BUTTONS.find((entry) => entry.param === param);
        if (!config) {
            throw new Error(`Missing FILTER_BUTTONS entry for degraded filter: ${param}`);
        }
        return { elementId: config.elementId, param };
    }
);

export const DEGRADED_FILTER_ELEMENT_IDS: string[] = DEGRADED_FILTERS.map((entry) => entry.elementId);

export const DEGRADED_EXPORT_ELEMENT_IDS: string[] = ['ycs_save_all_comments'];

export const DEGRADED_EXTENDED_SEARCH_ID = 'ycs_extended_search';

const DEGRADED_ELEMENT_IDS = [
    ...DEGRADED_FILTER_ELEMENT_IDS,
    ...DEGRADED_EXPORT_ELEMENT_IDS,
    DEGRADED_EXTENDED_SEARCH_ID
];

export interface PendingUpgradeIntent {
    filterParam?: IParamSearch;
    exportIntent?: { format: ExportFormat };
    /** Enable `#ycs_extended_search` after upgrade (native toggle was blocked by capture). */
    enableExtendedSearch?: boolean;
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

export function buildInstantResultsStatusHtml(query: string, count: number): string {
    const trimmed = query.trim();
    return `<span class="ycs-instant-chip">⚡ Instant</span> ${count} matches for &quot;${escapeHtml(trimmed)}&quot; · <button type="button" class="ycs-instant-load-all-cta">Load all comments for filters &amp; export</button>`;
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

export function buildUpgradingStatusText(instantCount: number, progressPercent?: number): string {
    if (progressPercent !== undefined && Number.isFinite(progressPercent)) {
        return `Instant: ${instantCount} matches · Loading full archive (${Math.round(progressPercent)}%)…`;
    }
    return `Instant: ${instantCount} matches · Loading full archive…`;
}

export function buildUpgradedStatusText(count: number): string {
    return `(Comments) Found: ${count}`;
}

export const UPGRADE_MODAL_TITLE = 'Load all comments?';

export const UPGRADE_MODAL_MESSAGE =
    'This filter needs the full comment archive. Load all comments now? Your instant results stay visible while loading.';

export const UPGRADE_EXPORT_MODAL_MESSAGE =
    'Export needs the full comment archive. Load all comments now? Your instant results stay visible while loading.';

export function syncInstantDegradedControls(active: boolean): void {
    for (const elementId of DEGRADED_ELEMENT_IDS) {
        const element = document.getElementById(elementId);
        if (!element) continue;

        if (active) {
            element.classList.add('ycs-btn-degraded');
            element.setAttribute('title', INSTANT_DEGRADED_TOOLTIP);
        } else {
            element.classList.remove('ycs-btn-degraded');
            if (element.getAttribute('title') === INSTANT_DEGRADED_TOOLTIP) {
                element.removeAttribute('title');
            }
        }
    }
}

export type InstantDegradedAction =
    | { kind: 'filter'; elementId: string; param: FilterParamKey }
    | { kind: 'export' }
    | { kind: 'extended' };

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

    return null;
}

export function bindInstantDegradedCapture(
    root: HTMLElement,
    options: {
        isActive: () => boolean;
        onAction: (action: InstantDegradedAction) => void;
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
            event.preventDefault();
            event.stopImmediatePropagation();
            options.onAction(action);
        },
        true
    );
}
