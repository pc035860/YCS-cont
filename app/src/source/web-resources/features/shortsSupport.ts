/**
 * YouTube Shorts Support Module
 *
 * Provides functions for adjusting YCS UI layout on YouTube Shorts pages.
 */

import { isShortsPage } from '../../utils/common';

const SHORTS_COMMENTS_CONTENT_SELECTOR =
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"] #content.ytd-engagement-panel-section-list-renderer';
const SHORTS_COMMENTS_NATIVE_FOOTER_SELECTOR =
    'ytd-section-list-renderer[panel-target-id="engagement-panel-comments-section"]';
const YCS_SHORTS_FOOTER_HIDDEN_ATTR = 'data-ycs-shorts-footer-hidden';
const YCS_SHORTS_FOOTER_ORIGINAL_DISPLAY_ATTR = 'data-ycs-shorts-footer-original-display';
const SHORTS_SEARCH_RESULTS_BASE_PADDING_PX = 20;
const SHORTS_SEARCH_RESULTS_EXTRA_BOTTOM_PADDING_PX = 20;

const getShortsNativeFooterElements = (): HTMLElement[] => {
    const commentsContent = document.querySelector(SHORTS_COMMENTS_CONTENT_SELECTOR) as HTMLElement | null;
    if (!commentsContent) return [];

    return Array.from(commentsContent.querySelectorAll(SHORTS_COMMENTS_NATIVE_FOOTER_SELECTOR)).filter((child) => {
        if (!(child instanceof HTMLElement)) return false;
        if (child.classList.contains('ycs-app')) return false;
        if (child.closest('.ycs-app')) return false;
        if (child.getAttribute(YCS_SHORTS_FOOTER_HIDDEN_ATTR) === '1') return true;

        const rectHeight = Math.ceil(child.getBoundingClientRect().height);
        return rectHeight > 0;
    }) as HTMLElement[];
};

const getVisibleShortsNativeFooterHeight = (): number => {
    const footerEls = getShortsNativeFooterElements();
    return footerEls.reduce((sum, footer) => {
        const style = window.getComputedStyle(footer);
        if (style.display === 'none' || style.visibility === 'hidden') return sum;

        return sum + Math.ceil(footer.getBoundingClientRect().height);
    }, 0);
};

export function syncShortsNativeFooterVisibility(shouldHide: boolean): void {
    if (!isShortsPage()) return;

    const footerEls = getShortsNativeFooterElements();
    footerEls.forEach((footer) => {
        if (shouldHide) {
            if (!footer.hasAttribute(YCS_SHORTS_FOOTER_ORIGINAL_DISPLAY_ATTR)) {
                footer.setAttribute(YCS_SHORTS_FOOTER_ORIGINAL_DISPLAY_ATTR, footer.style.display || '');
            }
            footer.style.display = 'none';
            footer.setAttribute(YCS_SHORTS_FOOTER_HIDDEN_ATTR, '1');
            return;
        }

        if (footer.getAttribute(YCS_SHORTS_FOOTER_HIDDEN_ATTR) !== '1') return;

        const originalDisplay = footer.getAttribute(YCS_SHORTS_FOOTER_ORIGINAL_DISPLAY_ATTR) ?? '';
        if (originalDisplay) {
            footer.style.display = originalDisplay;
        } else {
            footer.style.removeProperty('display');
        }
        footer.removeAttribute(YCS_SHORTS_FOOTER_ORIGINAL_DISPLAY_ATTR);
        footer.removeAttribute(YCS_SHORTS_FOOTER_HIDDEN_ATTR);
    });
}

export function restoreShortsNativeFooterVisibility(): void {
    syncShortsNativeFooterVisibility(false);
}

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
    const commentsContent = document.querySelector(SHORTS_COMMENTS_CONTENT_SELECTOR) as HTMLElement | null;

    if (!anchoredPanel || !ycsSearch || !searchResult) return;

    try {
        const targetContainer = commentsContent ?? anchoredPanel;
        const panelHeight = targetContainer.offsetHeight;
        const footerHeight = getVisibleShortsNativeFooterHeight();

        // Get ycs-search bottom position relative to target container top
        const ycsSearchRect = ycsSearch.getBoundingClientRect();
        const panelRect = targetContainer.getBoundingClientRect();
        const ycsSearchBottom = ycsSearchRect.bottom - panelRect.top;

        // Calculate available height
        const availableHeight = panelHeight - ycsSearchBottom - footerHeight;

        // Set max-height with padding plus a Shorts-specific extra safety gap.
        if (availableHeight > 100) {
            const totalPaddingPx =
                SHORTS_SEARCH_RESULTS_BASE_PADDING_PX + SHORTS_SEARCH_RESULTS_EXTRA_BOTTOM_PADDING_PX;
            searchResult.style.maxHeight = `${Math.max(80, availableHeight - totalPaddingPx)}px`;
        }
    } catch (error) {
        console.error('YCS: Failed to adjust search result height for Shorts', error);
    }
}

/**
 * Adjust YCS app container height for Shorts pages.
 * Keeps sizing isolated to YCS UI and does not modify other YouTube panels.
 */
export function adjustEngagementPanelHeightForShorts(): void {
    if (!isShortsPage()) return;

    const app = document.querySelector('.ycs-app') as HTMLElement;
    if (!app) return;

    const commentsContent = app.closest('#content.ytd-engagement-panel-section-list-renderer') as HTMLElement | null;
    const appMain = app.querySelector('.ycs-app-main') as HTMLElement | null;

    try {
        if (!commentsContent) return;

        const containerHeight = commentsContent.clientHeight;
        if (containerHeight <= 0) return;

        const appRect = app.getBoundingClientRect();
        const containerRect = commentsContent.getBoundingClientRect();
        const topOffset = Math.max(0, appRect.top - containerRect.top);
        const availableHeight = Math.floor(containerHeight - topOffset - 8);

        if (availableHeight > 120) {
            app.style.maxHeight = `${availableHeight}px`;
            app.style.overflowY = 'auto';
            app.style.overflowX = 'hidden';

            if (appMain) {
                appMain.style.maxHeight = `${Math.max(80, availableHeight - 48)}px`;
                appMain.style.overflow = 'hidden';
            }
        } else {
            app.style.removeProperty('max-height');
            app.style.removeProperty('overflow-y');
            app.style.removeProperty('overflow-x');
            if (appMain) {
                appMain.style.removeProperty('max-height');
                appMain.style.removeProperty('overflow');
            }
        }
    } catch (error) {
        console.error('YCS: Failed to adjust engagement panel height for Shorts', error);
    }
}
