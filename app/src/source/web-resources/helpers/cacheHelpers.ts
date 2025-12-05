/**
 * Cache and UI Helper Functions
 *
 * Provides utility functions for cache metadata building, button state management,
 * and UI-related helper operations.
 */

import type { ExportMeta } from '../services/exportService';

/**
 * Cache metadata structure
 */
export interface CacheMeta {
    url: string;
    title: string;
}

/**
 * Build cache metadata with optional overrides
 */
export const buildCacheMeta = (override?: { url?: string; title?: string }): CacheMeta => ({
    url: override?.url ?? window.location.href,
    title: override?.title ?? document.title
});

/**
 * Build export metadata for file downloads and window opens
 * @param videoUrl - Clean video URL (from getCleanUrlVideo)
 * @param broadcastStartTime - Live broadcast start time as ISO string (optional)
 */
export const buildExportMeta = (
    videoUrl: string | null | undefined,
    broadcastStartTime?: string | null
): ExportMeta => ({
    url: videoUrl ?? window.location.href,
    title: document.title,
    generatedAt: new Date(),
    broadcastStartTime: broadcastStartTime ?? undefined
});

/**
 * Append cached info badge to target elements
 * @param timestamp - Cache timestamp
 * @param targets - Array of target elements to append cache info badge
 */
export const appendCachedInfo = (
    timestamp: number | string | null | undefined,
    targets: (HTMLElement | null)[]
): void => {
    // Guard: validate timestamp to avoid "Invalid Date" in tooltip
    const cacheDate = timestamp != null ? new Date(timestamp) : null;
    const isValidDate = cacheDate && !isNaN(cacheDate.getTime());
    const cacheTitle = isValidDate ? cacheDate.toLocaleString() : '';

    for (const target of targets) {
        if (!target) continue;

        target.querySelector('.ycs-title-cache-info')?.remove();
        target.insertAdjacentHTML(
            'beforeend',
            `
            <span class="ycs-title-cache-info" title="${cacheTitle}">Cached</span>
        `
        );
    }
};

/**
 * Clear button label dataset (removes data-label-html attribute)
 */
export const clearButtonLabelDataset = (button: HTMLButtonElement): void => {
    if (!button) return;
    if (button.dataset.labelHtml !== undefined) {
        delete button.dataset.labelHtml;
        button.removeAttribute('data-label-html');
    }
};

/**
 * Reset a load button's label to default text
 */
export const resetLoadButtonLabel = (buttonId: string, label: string): void => {
    const button = document.getElementById(buttonId) as HTMLButtonElement | null;
    if (!button) return;
    clearButtonLabelDataset(button);
    button.textContent = label;
};

/**
 * Reset all load buttons to their default labels
 * Prevents stale dataset.labelHtml from reintroducing HTML into load buttons after rerenders
 */
export const resetLoadButtonLabels = (): void => {
    resetLoadButtonLabel('ycs-load-cmnts', 'load');
    resetLoadButtonLabel('ycs-load-chat', 'load');
    resetLoadButtonLabel('ycs-load-transcript-video', 'load');
    resetLoadButtonLabel('ycs-load-all', 'Load all');
    resetLoadButtonLabel('ycs_load_stop', 'stop');
};
