/**
 * YouTube Shorts Support Module
 *
 * Provides functions for adjusting YCS UI layout on YouTube Shorts pages.
 */

import { isShortsPage } from '../../utils/common';

const SHORTS_COMMENTS_CONTENT_SELECTORS = [
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"] #content.ytd-engagement-panel-section-list-renderer',
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"] #content'
] as const;
const SHORTS_COMMENTS_NATIVE_FOOTER_SELECTOR =
    'ytd-section-list-renderer[panel-target-id="engagement-panel-comments-section"]';
const YCS_SHORTS_FOOTER_HIDDEN_ATTR = 'data-ycs-shorts-footer-hidden';
const YCS_SHORTS_FOOTER_ORIGINAL_DISPLAY_ATTR = 'data-ycs-shorts-footer-original-display';
const SHORTS_SEARCH_RESULTS_TOTAL_PADDING_PX = 40;

/**
 * Find the matching Shorts comments content selector using fallback list.
 */
export const findShortsCommentsContentSelector = (): string | null => {
    for (const selector of SHORTS_COMMENTS_CONTENT_SELECTORS) {
        if (document.querySelector(selector)) return selector;
    }
    return null;
};

/**
 * Find the Shorts comments content container element using fallback selectors.
 */
const findShortsCommentsContent = (): HTMLElement | null => {
    const selector = findShortsCommentsContentSelector();
    return selector ? (document.querySelector(selector) as HTMLElement | null) : null;
};

const getShortsNativeFooterElements = (): HTMLElement[] => {
    const commentsContent = findShortsCommentsContent();
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

    for (const footer of getShortsNativeFooterElements()) {
        if (shouldHide) {
            if (!footer.hasAttribute(YCS_SHORTS_FOOTER_ORIGINAL_DISPLAY_ATTR)) {
                footer.setAttribute(YCS_SHORTS_FOOTER_ORIGINAL_DISPLAY_ATTR, footer.style.display || '');
            }
            footer.style.display = 'none';
            footer.setAttribute(YCS_SHORTS_FOOTER_HIDDEN_ATTR, '1');
            continue;
        }

        if (footer.getAttribute(YCS_SHORTS_FOOTER_HIDDEN_ATTR) !== '1') continue;

        const originalDisplay = footer.getAttribute(YCS_SHORTS_FOOTER_ORIGINAL_DISPLAY_ATTR) ?? '';
        if (originalDisplay) {
            footer.style.display = originalDisplay;
        } else {
            footer.style.removeProperty('display');
        }
        footer.removeAttribute(YCS_SHORTS_FOOTER_ORIGINAL_DISPLAY_ATTR);
        footer.removeAttribute(YCS_SHORTS_FOOTER_HIDDEN_ATTR);
    }
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
    const commentsContent = findShortsCommentsContent();

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

        if (availableHeight > 100) {
            searchResult.style.maxHeight = `${Math.max(80, availableHeight - SHORTS_SEARCH_RESULTS_TOTAL_PADDING_PX)}px`;
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

    const commentsContent = findShortsCommentsContent();
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
