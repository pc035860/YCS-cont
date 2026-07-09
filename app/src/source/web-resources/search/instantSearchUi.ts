import type { IParamSearch } from '../../utils/interfaces/i_types';
import type { ExportFormat } from '../services/exportService';
import type { FilterParamKey } from '../ui/filters';

export const INSTANT_DEGRADED_TOOLTIP = 'Needs all comments loaded — click to load';

export const INSTANT_SHOW_MORE_TOOLTIP = 'Fetch next page from YouTube (~1 quota unit)';

export const DEGRADED_FILTER_PARAMS: FilterParamKey[] = [
    'heart',
    'verified',
    'members',
    'donated',
    'random',
    'timestampViz'
];

export const DEGRADED_FILTER_ELEMENT_IDS: string[] = [
    'ycs_btn_heart',
    'ycs_btn_verified',
    'ycs_btn_members',
    'ycs_btn_donated',
    'ycs_btn_random',
    'ycs_btn_timestamp_viz'
];

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

export function buildInstantResultsStatusHtml(query: string, count: number): string {
    const trimmed = query.trim();
    return `<span class="ycs-instant-chip">⚡ Instant</span> ${count} matches for &quot;${escapeHtml(trimmed)}&quot; · <button type="button" class="ycs-instant-load-all-cta">Load all comments for filters &amp; export</button>`;
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

function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
