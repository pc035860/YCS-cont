/**
 * YouTube Shorts Support Module
 *
 * Provides functions for adjusting YCS UI layout on YouTube Shorts pages.
 */

import { isShortsPage } from '../../utils/common';

/**
 * Adjust search result max-height for Shorts pages
 * Calculates available height based on anchored-panel and ycs-search position
 */
export function adjustSearchResultHeightForShorts(): void {
    if (!isShortsPage()) return;

    // Skip calculation if app is collapsed (hidden by default)
    // When collapsed, #ycs-search is hidden and getBoundingClientRect() returns incorrect values
    const app = document.querySelector('.ycs-app') as HTMLElement;
    if (app && app.classList.contains('ycs-collapsed')) {
        return;
    }

    const anchoredPanel = document.querySelector('#anchored-panel') as HTMLElement;
    const ycsSearch = document.querySelector('#ycs-search') as HTMLElement;
    const searchResult = document.querySelector('#ycs-search-result') as HTMLElement;

    if (!anchoredPanel || !ycsSearch || !searchResult) return;

    try {
        // Get anchored-panel height
        const panelHeight = anchoredPanel.offsetHeight;

        // Get ycs-search bottom position relative to anchored-panel top
        const ycsSearchRect = ycsSearch.getBoundingClientRect();
        const panelRect = anchoredPanel.getBoundingClientRect();
        const ycsSearchBottom = ycsSearchRect.bottom - panelRect.top;

        // Calculate available height
        const availableHeight = panelHeight - ycsSearchBottom;

        // Set max-height with some padding (20px)
        if (availableHeight > 100) {
            searchResult.style.maxHeight = `${availableHeight - 20}px`;
        }
    } catch (error) {
        console.error('YCS: Failed to adjust search result height for Shorts', error);
    }
}

/**
 * Adjust engagement panel content height and min-height for Shorts pages
 * Dynamically calculates height by subtracting .ycs-app height from the base calculation
 * Always subtracts .ycs-app height regardless of collapsed/expanded state
 */
export function adjustEngagementPanelHeightForShorts(): void {
    if (!isShortsPage()) return;

    const app = document.querySelector('.ycs-app') as HTMLElement;
    const engagementPanelContent = document.querySelector(
        '#content.ytd-engagement-panel-section-list-renderer'
    ) as HTMLElement;

    if (!engagementPanelContent || !app) return;

    try {
        // Get .ycs-app current height (even when collapsed, it still has height for toggle button)
        const ycsAppHeight = app.offsetHeight;

        // Set height and min-height using calc() expression
        // Original: calc(var(--ytd-engagement-panel-content-height) - 56px)
        // New: calc(var(--ytd-engagement-panel-content-height) - 56px - [.ycs-app height]px)
        engagementPanelContent.style.height = `calc(var(--ytd-engagement-panel-content-height) - 56px - ${ycsAppHeight}px)`;
        engagementPanelContent.style.minHeight = `calc(var(--ytd-engagement-panel-content-min-height) - 56px - ${ycsAppHeight}px)`;
    } catch (error) {
        console.error('YCS: Failed to adjust engagement panel height for Shorts', error);
    }
}
