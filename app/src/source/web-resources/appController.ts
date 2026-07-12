import 'abort-controller/polyfill';

import {
    GlobalStore,
    extractChannelId,
    getCleanUrlVideo,
    getVideoId,
    isVideoPage,
    isShortsPage,
    isPostsPage,
    getPostId
} from '../utils/common';
import { setShortsSupport } from './bootstrap';
import {
    initShowBarFAQ,
    initShowViewMode,
    navigateVideoToTimestamp,
    removeNodeList,
    showLoadComments
} from '../utils/dom';
import {
    getAllCommentsModeV2,
    getChatComments,
    clearCurrentVideoMemberOnly,
    clearCurrentVideoAgeRestricted
} from '../utils/innertube';

import { IParamSearch, ISelectedSearch, IYCSOptions } from '../utils/interfaces/i_types';
import type { ChatItem, CommentItem } from '../utils/interfaces/i_types';

import { iconOk, iconReload, iconWarning, iconError, iconStop, iconInfo } from '../utils/icons';
import { renderLoadComments, renderSearch, loadFilterButtons } from '../utils/renderView';
import { loadFromCache, saveToCache, updateBadge } from './services/cacheService';
import type { CacheData } from './services/cacheService';
import { YouTubeApiMessageError, requestYouTubeApiComments } from './handlers/youtubeDataApiHandler';
import {
    buildCacheMeta,
    buildExportMeta,
    appendCachedInfo,
    clearButtonLabelDataset,
    resetLoadButtonLabels
} from './helpers/cacheHelpers';
import {
    adjustSearchResultHeightForShorts,
    adjustEngagementPanelHeightForShorts,
    restoreShortsNativeFooterVisibility,
    syncShortsNativeFooterVisibility,
    findShortsCommentsContentSelector
} from './features/shortsSupport';
import { createSearchIntentState } from './features/searchIntentState';
import { createLiveChatRecorder, LiveChatRecorderDeps } from './features/liveChatRecorder';
import {
    createTranscriptLoader,
    TranscriptLoaderDeps,
    extractCueGroups,
    getCueGroupCount
} from './features/transcriptLoader';
import { createCommentSortOrderSelector, CommentSortOrderSelectorDeps } from './features/commentSortOrderSelector';
import { createTimestampVizHandler, TimestampVizDeps } from './features/timestampVizHandler';
import {
    downloadChatFile,
    downloadCommentsFile,
    downloadTranscriptFile,
    openChatWindow,
    openCommentsWindow,
    openTranscriptWindow,
    downloadCommentsFileJSON,
    downloadCommentsFileXLSX,
    downloadChatFileJSON,
    downloadChatFileXLSX,
    downloadTranscriptFileJSON,
    downloadTranscriptFileSRT,
    downloadTranscriptFileXLSX,
    EXPORT_FORMAT,
    isExportFormat
} from './services/exportService';
import type { ExportFormat } from './services/exportService';
import {
    clearComments,
    clearCommentsChat,
    clearCommentsTrVideo,
    createState,
    getComments,
    getCommentsChat,
    getCommentsTrVideo,
    getController,
    getSelectedTranscriptLanguage,
    getSelectedCommentSortOrder,
    getTranscriptTracks as getStateTranscriptTracks,
    getCounts,
    getSearchCounts,
    resetController,
    resetSearchCounts,
    setComments,
    setCommentsChat,
    setCommentsTrVideo,
    setSelectedTranscriptLanguage,
    setSelectedCommentSortOrder,
    setTranscriptTracks,
    setCount,
    setSearchCount,
    WebResourcesState,
    getLiveRecording,
    setLiveRecording,
    resetLiveRecording,
    getChatSource,
    setChatSource,
    resetRemoteSearch,
    getRemoteSearch
} from './state';
import {
    isInstantBrowseMode,
    isInstantSessionComplete,
    shouldSkipAutoload,
    shouldUseInstantSearch
} from './search/instantSearchGate';
import {
    abortInFlightCommentLoad,
    abortInFlightInstantSearch,
    buildInstantSearchResult,
    fetchNextInstantSearchPage,
    InstantSearchQuotaError,
    runInstantCommentSearch
} from './search/instantCommentsSearch';
import {
    buildInstantAllModeStatusHtml,
    buildInstantEmptyQueryStatusText,
    buildInstantResultsStatusHtml,
    buildInstantZeroResultsStatusText,
    buildUpgradedStatusText,
    buildUpgradingStatusText,
    buildUpgradeCompleteNotifyMessage,
    bindInstantDegradedCapture,
    createPendingUpgradeStore,
    INSTANT_SHOW_MORE_TOOLTIP,
    isDegradedFilterParam,
    isInstantBlockedFilterParam,
    syncInstantDegradedControls,
    UPGRADE_EXPORT_MODAL_MESSAGE,
    UPGRADE_MODAL_MESSAGE,
    UPGRADE_MODAL_TITLE,
    UPGRADE_OPEN_WINDOW_MODAL_MESSAGE
} from './search/instantSearchUi';
import {
    FILTER_BUTTONS,
    FilterButtonRegistry,
    FilterParamKey,
    registerFilterButtons,
    getDynamicFilterButtonConfigs
} from './ui/filters';
import { registerCommentInteractions } from './ui/commentInteractions';
import { runSearch as runCommentsSearch, runSearchOnComments, clearCommentsFuseCache } from './search/commentsSearch';
import type { CommentsSearchResult } from './search/commentsSearch';
import { runSearch as runChatSearch, clearChatFuseCache } from './search/chatSearch';
import { runSearch as runTranscriptSearch, clearTranscriptFuseCache } from './search/transcriptSearch';
import { SearchContext, SortOrder } from './search/types';
import { renderCommentsResult, renderChatResult, renderTranscriptResult } from './ui/render';

const DEBUG = false;

const CHAT_UNSUPPORTED_FILTERS = ['heart', 'likes', 'replied', 'random', 'quickTranscript', 'timestampViz'] as const;
const TRANSCRIPT_UNSUPPORTED_FILTERS = [
    'heart',
    'likes',
    'replied',
    'random',
    'author',
    'donated',
    'members',
    'verified',
    'quickChat',
    'timestampViz'
] as const;
type SortAttribute = 'sort' | 'sortChat' | 'sortTrp';

const dropdownMenus = new Set<HTMLElement>();

let filterRegistry: FilterButtonRegistry | null = null;
let handleDocumentClick: ((ev: MouseEvent) => void) | null = null;

/**
 * Cleanup YCS UI on Shorts pages when support is disabled
 * Also updates bootstrap state to prevent retry loops
 */
const cleanupShortsUI = (): void => {
    // Update bootstrap state first to prevent MutationObserver from triggering retries
    setShortsSupport(false);
    restoreShortsNativeFooterVisibility();
    removeNodeList('.ycs-app');
    dropdownMenus.clear();
    if (handleDocumentClick) {
        document.removeEventListener('click', handleDocumentClick);
        handleDocumentClick = null;
    }
    console.log('YCS: YouTube Shorts support is disabled');
};

const getSortableButtonIds = (): string[] => {
    if (filterRegistry?.sortButtonIds?.length) {
        return filterRegistry.sortButtonIds;
    }

    return FILTER_BUTTONS.filter((config) => config.supportsSort).map((config) => config.elementId);
};

const parseSortOrder = (value: string | undefined): SortOrder | undefined => {
    if (value === 'newest' || value === 'oldest') {
        return value;
    }
    return undefined;
};

const readSortOrders = (attribute: SortAttribute): Partial<Record<string, SortOrder>> => {
    const map: Partial<Record<string, SortOrder>> = {};
    for (const id of getSortableButtonIds()) {
        const element = document.getElementById(id) as HTMLElement | null;
        if (!element) continue;
        const parsed = parseSortOrder(element.dataset?.[attribute]);
        if (parsed) {
            map[id] = parsed;
        }
    }
    return map;
};

const getParamByElementId = (elementId: string): FilterParamKey | undefined => {
    const mapped = filterRegistry?.idToCode?.[elementId];
    if (mapped) {
        return mapped;
    }

    return FILTER_BUTTONS.find((config) => config.elementId === elementId)?.param;
};

type CacheStorageBody = CacheData & { date?: string };

type ExtensionMessagePayload =
    | { type: 'YCS_OPTIONS'; text?: Partial<IYCSOptions> | null }
    | { type: 'YCS_CACHE_STORAGE_GET_RESPONSE'; body?: CacheStorageBody | null }
    | { type: 'YCS_AUTOLOAD' }
    | ({ type?: string } & Record<string, unknown>);

const buildSearchContext = (): SearchContext => {
    const extendedToggle = document.getElementById('ycs_extended_search') as HTMLInputElement | null;
    const extendedTitle = document.getElementById('ycs_extended_search_title') as HTMLInputElement | null;
    const extendedMain = document.getElementById('ycs_extended_search_main') as HTMLInputElement | null;

    return {
        extendedSearch: {
            enabled: Boolean(extendedToggle?.checked),
            title: Boolean(extendedTitle?.checked),
            main: Boolean(extendedMain?.checked)
        },
        sortOrders: {
            comments: readSortOrders('sort'),
            chat: readSortOrders('sortChat'),
            transcript: readSortOrders('sortTrp')
        }
    };
};

let appFunction: (() => boolean) | null = null;
let observeIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Gets the appropriate meta element for the current page type.
 * For Shorts pages, checks the comments content panel; otherwise checks #meta.style-scope.ytd-watch-flexy.
 */
export function getPageMetaElement(): Element | null {
    if (isShortsPage()) {
        const selector = findShortsCommentsContentSelector();
        return selector ? document.querySelector(selector) : null;
    }
    return document.querySelector('#meta.style-scope.ytd-watch-flexy');
}

export function retryApp(): boolean {
    if (!appFunction) {
        return false;
    }

    try {
        return appFunction();
    } catch (error) {
        console.error('YCS: app() retry failed', error);
        return false;
    }
}

export function initApp(): void {
    let handleMessageEvent: ((ev: MessageEvent<ExtensionMessagePayload>) => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;

    let state = createState();
    const searchIntentState = createSearchIntentState();

    function app(): void {
        if (!isVideoPage()) return;

        // Clear GlobalStore to prevent data leakage across videos
        delete GlobalStore.getInitYtData;
        clearCurrentVideoMemberOnly(); // Clear members-only status when switching videos
        clearCurrentVideoAgeRestricted(); // Clear age-restricted status when switching videos

        // Clear search caches whenever we switch videos or reinitialize.
        try {
            clearCommentsFuseCache();
            clearChatFuseCache();
            clearTranscriptFuseCache();
        } catch (e) {
            // non-fatal
            console.warn('[YCS] Failed to clear search caches', e);
        }

        if (handleMessageEvent) {
            window.removeEventListener('message', handleMessageEvent);
        }

        // Clean up ResizeObserver when switching videos
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }

        // Clean up recording timeouts/intervals unconditionally
        // (don't rely on isRecording flag to prevent edge case leaks)
        const liveRecording = getLiveRecording(state);
        if (liveRecording.pollTimeoutId !== null) {
            clearTimeout(liveRecording.pollTimeoutId);
        }
        if (liveRecording.timerIntervalId !== null) {
            clearInterval(liveRecording.timerIntervalId);
        }

        // Abort old controller BEFORE creating new state to prevent race conditions
        getController(state).abort();

        state = createState();

        /**
         * Show confirmation modal and return Promise<boolean>
         */
        function showConfirmModal(title: string, message: string): Promise<boolean> {
            return new Promise((resolve) => {
                const modal = document.getElementById('ycs_confirm_modal');
                const titleEl = document.getElementById('ycs_confirm_title');
                const messageEl = document.getElementById('ycs_confirm_message');
                const okBtn = document.getElementById('ycs_confirm_ok');
                const cancelBtn = document.getElementById('ycs_confirm_cancel');

                if (!modal || !titleEl || !messageEl || !okBtn || !cancelBtn) {
                    resolve(window.confirm(message)); // Fallback
                    return;
                }

                titleEl.textContent = title;
                messageEl.textContent = message;
                modal.style.display = 'block';

                const cleanup = () => {
                    modal.style.display = 'none';
                    okBtn.removeEventListener('click', onOk);
                    cancelBtn.removeEventListener('click', onCancel);
                    modal.removeEventListener('click', onBackdrop);
                };

                const onOk = () => {
                    cleanup();
                    resolve(true);
                };
                const onCancel = () => {
                    cleanup();
                    resolve(false);
                };
                const onBackdrop = (e: Event) => {
                    if (e.target === modal) {
                        cleanup();
                        resolve(false);
                    }
                };

                okBtn.addEventListener('click', onOk);
                cancelBtn.addEventListener('click', onCancel);
                modal.addEventListener('click', onBackdrop);
            });
        }

        updateBadge('NUMBER_COMMENTS', '');

        searchIntentState.resetExecution();
        restoreShortsNativeFooterVisibility();
        removeNodeList('.ycs-app');
        dropdownMenus.clear();
        if (handleDocumentClick) {
            document.removeEventListener('click', handleDocumentClick);
            handleDocumentClick = null;
        }

        // Handle Shorts pages differently
        // Note: enableShortsSupport check will be done in YCS_OPTIONS handler
        if (isShortsPage()) {
            const shortsCommentsSelector = findShortsCommentsContentSelector();

            if (shortsCommentsSelector) {
                renderLoadComments(shortsCommentsSelector, 'prepend');
            } else {
                console.warn('YCS: Shorts page detected but comments panel content not found');
                return;
            }
        } else if (isPostsPage()) {
            // Handle community posts pages
            if (document.querySelector('ytd-item-section-renderer#sections.style-scope.ytd-comments')) {
                renderLoadComments('ytd-item-section-renderer#sections.style-scope.ytd-comments', 'insertBefore');
            } else {
                console.warn(
                    'YCS: Posts page detected but ytd-item-section-renderer#sections.style-scope.ytd-comments not found'
                );
                return;
            }
        } else {
            // Priority: ytd-comments#comments (highest priority)
            if (document.querySelector('ytd-comments#comments')) {
                renderLoadComments('ytd-comments#comments', 'insertBefore');
            } else if (document.querySelector('#expandable-metadata.ytd-watch-flexy')) {
                // Try new insertion points first (between expandable-metadata and ticket-shelf)
                renderLoadComments('#expandable-metadata.ytd-watch-flexy', 'insertAfter');
            } else if (document.querySelector('#ticket-shelf')) {
                renderLoadComments('#ticket-shelf', 'insertAfter');
            } else if (document.querySelector('#meta.style-scope.ytd-watch-flexy')) {
                renderLoadComments('#meta.style-scope.ytd-watch-flexy');
            } else if (document.querySelector('#meta.style-scope')) {
                renderLoadComments('#meta.style-scope');
            } else if (document.querySelector('ytd-watch-metadata')) {
                renderLoadComments('ytd-watch-metadata', 'insertAfter');
            } else {
                return;
            }
        }

        let sidebarMountParent: HTMLElement | null = null;
        let sidebarMountNextSibling: ChildNode | null = null;

        const getSidebarMountTarget = (): HTMLElement | null => {
            return (
                (document.querySelector('#secondary-inner') as HTMLElement | null) ||
                (document.querySelector('#secondary') as HTMLElement | null)
            );
        };

        const getAppElement = (): HTMLElement | null => document.querySelector('.ycs-app') as HTMLElement | null;

        const moveYcsToSidebar = (): void => {
            const app = getAppElement();
            const sidebarTarget = getSidebarMountTarget();

            if (!app || !sidebarTarget) {
                return;
            }

            if (!sidebarMountParent) {
                sidebarMountParent = app.parentElement;
                sidebarMountNextSibling = app.nextSibling;
            }

            if (app.parentElement !== sidebarTarget) {
                sidebarTarget.prepend(app);
            }

            app.classList.add('ycs-in-sidebar', 'ycs-compact');
        };

        const restoreYcsFromSidebar = (): void => {
            const app = getAppElement();

            if (!app || !sidebarMountParent) {
                return;
            }

            if (!sidebarMountParent.isConnected) {
                sidebarMountParent = null;
                sidebarMountNextSibling = null;
                app.classList.remove('ycs-in-sidebar', 'ycs-compact');
                return;
            }

            if (sidebarMountNextSibling && sidebarMountNextSibling.parentNode === sidebarMountParent) {
                sidebarMountParent.insertBefore(app, sidebarMountNextSibling);
            } else {
                sidebarMountParent.appendChild(app);
            }

            app.classList.remove('ycs-in-sidebar', 'ycs-compact');
        };

        const elSearch = document.getElementById('ycs-search');
        if (elSearch) {
            renderSearch(elSearch);
            // Initial button loading (using default settings)
            loadFilterButtons();

            // Adjust height for Shorts pages
            if (isShortsPage()) {
                // Use setTimeout to ensure DOM is fully rendered
                setTimeout(() => {
                    adjustSearchResultHeightForShorts();
                    adjustEngagementPanelHeightForShorts();

                    // Set up ResizeObserver to watch .ycs-app height changes
                    const app = document.querySelector('.ycs-app') as HTMLElement;
                    if (app && typeof ResizeObserver !== 'undefined') {
                        // Clean up existing observer if any
                        if (resizeObserver) {
                            resizeObserver.disconnect();
                        }

                        // Create new ResizeObserver
                        resizeObserver = new ResizeObserver(() => {
                            // Debounce the adjustment to avoid excessive calls
                            setTimeout(() => {
                                adjustEngagementPanelHeightForShorts();
                            }, 50);
                        });

                        resizeObserver.observe(app);
                    }
                }, 100);
            } else {
                // Clean up ResizeObserver for non-Shorts pages
                if (resizeObserver !== null) {
                    (resizeObserver as ResizeObserver).disconnect();
                    resizeObserver = null;
                }
            }

            // Toggle collapsed/expand of app
            try {
                const toggles = document.getElementsByClassName('ycs-btn-toggle-app');
                for (const toggle of Array.from(toggles)) {
                    (toggle as HTMLElement).addEventListener(
                        'click',
                        () => {
                            const app = document.getElementsByClassName('ycs-app')[0] as HTMLElement;
                            if (app) {
                                app.classList.toggle('ycs-collapsed');
                                // Recalculate height when app is toggled on Shorts pages
                                if (isShortsPage()) {
                                    setTimeout(() => {
                                        syncShortsFooterBySearchState();
                                        adjustEngagementPanelHeightForShorts();
                                    }, 100);
                                }
                            }
                        },
                        false
                    );
                }

                const sidebarToggles = document.getElementsByClassName('ycs-btn-toggle-sidebar');
                for (const toggle of Array.from(sidebarToggles)) {
                    (toggle as HTMLElement).addEventListener(
                        'click',
                        () => {
                            const app = getAppElement();
                            if (!app) {
                                return;
                            }

                            if (app.classList.contains('ycs-in-sidebar')) {
                                restoreYcsFromSidebar();
                            } else {
                                moveYcsToSidebar();
                            }
                        },
                        false
                    );
                }
            } catch (err) {
                console.error(err);
            }
        }

        // Element references - declared early to be accessible by all search functions
        const elExtSearch = document.getElementById('ycs_extended_search') as HTMLInputElement;

        const hasActiveSearchFilter = (): boolean => document.querySelector('.ycs_btn_active') !== null;

        let shortsFooterResyncTimer: ReturnType<typeof setTimeout> | null = null;
        const syncShortsFooterBySearchState = (options?: { debounceResync?: boolean }): void => {
            if (!isShortsPage()) return;

            const app = document.querySelector('.ycs-app') as HTMLElement | null;
            const isCollapsed = app?.classList.contains('ycs-collapsed') ?? false;
            const shouldHideFooter = searchIntentState.isIntentActive({
                query: getSearchQuery(),
                hasActiveFilter: hasActiveSearchFilter(),
                isCollapsed
            });

            syncShortsNativeFooterVisibility(shouldHideFooter);
            adjustSearchResultHeightForShorts();

            if (options?.debounceResync) {
                if (shortsFooterResyncTimer !== null) {
                    clearTimeout(shortsFooterResyncTimer);
                }
                shortsFooterResyncTimer = setTimeout(() => {
                    shortsFooterResyncTimer = null;
                    syncShortsFooterBySearchState();
                }, 120);
            }
        };

        const pendingUpgrade = createPendingUpgradeStore();
        let instantUpgradeSnapshot: { query: string; matchCount: number } | null = null;
        let isUpgradingFromInstant = false;
        let instantSearchGeneration = 0;
        /** Bumped when a full comment load starts or is discarded for instant search. */
        let commentLoadGeneration = 0;

        const isInstantSessionActive = (): boolean => getRemoteSearch(state).active;
        const isInstantDegradedMode = (): boolean => isInstantSessionActive() || isInstantBrowseMode(state);

        /** Keep degraded-control visuals in sync with the current instant session completeness. */
        const syncInstantControlsFromState = (): void => {
            syncInstantDegradedControls(isInstantDegradedMode(), { sessionComplete: isInstantSessionComplete(state) });
        };

        /**
         * Click-time predicate for the two-tier filter unlock: session must be complete AND the
         * active query must still match the session's query (edited-then-clicked → upgrade modal).
         */
        const isInstantFilterUnlocked = (param: FilterParamKey): boolean => {
            const session = getRemoteSearch(state);
            if (!session.active || !isInstantSessionComplete(state)) return false;
            if (session.query !== getSearchQuery().trim()) return false;
            return !isInstantBlockedFilterParam(param, true);
        };

        const updateTotalResultDisplay = (text: string, forceShow = true): void => {
            const nodeTotalSearchResult = document.getElementById('ycs-search-total-result');
            if (nodeTotalSearchResult) {
                nodeTotalSearchResult.innerText = text;
                if (forceShow) {
                    nodeTotalSearchResult.classList.remove('ycs-hidden');
                } else {
                    nodeTotalSearchResult.classList.add('ycs-hidden');
                }
            }
            const searchCounts = getSearchCounts(state);
            const resTotalSearch = searchCounts.comments + searchCounts.commentsChat + searchCounts.commentsTrVideo;
            const btnClear = document.getElementById('ycs_btn_clear') as HTMLButtonElement | null;
            const hasActiveFilter = hasActiveSearchFilter();
            const hasQuery = getSearchQuery().trim().length > 0;
            if (btnClear)
                btnClear.style.visibility = (!hasQuery && resTotalSearch > 0) || hasActiveFilter ? 'visible' : 'hidden';

            syncShortsFooterBySearchState({ debounceResync: true });
        };

        const bindInstantStatusActions = (container: HTMLElement): void => {
            if ((container as HTMLElement & { __ycsInstantBound?: boolean }).__ycsInstantBound) return;
            (container as HTMLElement & { __ycsInstantBound?: boolean }).__ycsInstantBound = true;
            container.addEventListener('click', (event) => {
                const target = event.target as HTMLElement | null;
                if (target?.closest('.ycs-instant-load-all-cta')) {
                    event.preventDefault();
                    void beginInstantUpgrade();
                }
            });
        };

        const updateInstantStatusHtml = (html: string, forceShow = true): void => {
            const nodeTotalSearchResult = document.getElementById('ycs-search-total-result');
            if (!nodeTotalSearchResult) return;

            nodeTotalSearchResult.innerHTML = html;
            if (forceShow) {
                nodeTotalSearchResult.classList.remove('ycs-hidden');
            } else {
                nodeTotalSearchResult.classList.add('ycs-hidden');
            }
            bindInstantStatusActions(nodeTotalSearchResult);

            const searchCounts = getSearchCounts(state);
            const resTotalSearch = searchCounts.comments + searchCounts.commentsChat + searchCounts.commentsTrVideo;
            const btnClear = document.getElementById('ycs_btn_clear') as HTMLButtonElement | null;
            const hasActiveFilter = hasActiveSearchFilter();
            const hasQuery = getSearchQuery().trim().length > 0;
            if (btnClear)
                btnClear.style.visibility = (!hasQuery && resTotalSearch > 0) || hasActiveFilter ? 'visible' : 'hidden';

            syncShortsFooterBySearchState({ debounceResync: true });
        };

        const clearInstantSessionUi = (options?: { clearResultsDom?: boolean }): void => {
            instantSearchGeneration += 1;
            state = resetRemoteSearch(state);
            syncInstantControlsFromState();
            removeInstantShowMore();
            if (options?.clearResultsDom) {
                const elSearchRes = document.getElementById('ycs-search-result');
                if (elSearchRes) elSearchRes.textContent = '';
            }
        };

        const updateInstantUpgradeProgress = (loadedCount: number): void => {
            if (!isUpgradingFromInstant || !instantUpgradeSnapshot) return;
            updateTotalResultDisplay(buildUpgradingStatusText(instantUpgradeSnapshot.matchCount, loadedCount));
        };

        const beginInstantUpgrade = async (intent?: Parameters<typeof pendingUpgrade.set>[0]): Promise<void> => {
            if (intent) {
                pendingUpgrade.set(intent);
            }
            // Active instant results OR browse-mode upgrade (degraded filter/export before first search).
            if (isInstantSessionActive() || isInstantBrowseMode(state) || pendingUpgrade.peek()) {
                const session = getRemoteSearch(state);
                instantUpgradeSnapshot = {
                    query: session.active ? session.query : getSearchQuery().trim(),
                    matchCount: session.active ? session.results.length : 0
                };
                isUpgradingFromInstant = true;
                instantSearchGeneration += 1;
                if (session.active) {
                    state = abortInFlightInstantSearch(state);
                }
            }
            document.getElementById('ycs-load-all')?.click();
        };

        const completeInstantUpgrade = (): void => {
            if (!isUpgradingFromInstant || !instantUpgradeSnapshot) return;

            const savedQuery = instantUpgradeSnapshot.query;
            const intent = pendingUpgrade.consume();
            isUpgradingFromInstant = false;
            instantUpgradeSnapshot = null;

            state = resetRemoteSearch(state);
            syncInstantControlsFromState();
            syncInstantSearchPlaceholder();
            removeInstantShowMore();

            const inputSearch = document.getElementById('ycs-input-search') as HTMLInputElement | null;
            if (inputSearch && savedQuery) {
                inputSearch.value = savedQuery;
            }

            if (intent?.enableExtendedSearch) {
                const extendedToggle = document.getElementById('ycs_extended_search') as HTMLInputElement | null;
                if (extendedToggle) {
                    extendedToggle.checked = true;
                }
            }

            if (intent?.filterParam) {
                const paramKey = Object.keys(intent.filterParam).find(
                    (key) => key !== 'sortOrder' && (intent.filterParam as Record<string, unknown>)[key]
                ) as FilterParamKey | undefined;
                const elementId = paramKey
                    ? FILTER_BUTTONS.find((config) => config.param === paramKey)?.elementId
                    : undefined;
                const filterEl = elementId ? (document.getElementById(elementId) as HTMLElement | null) : null;
                if (paramKey) {
                    setActiveFilterByElement(paramKey, filterEl ?? undefined);
                }
                executeSearchBasedOnType(intent.filterParam);

                const filterLabel = (filterEl?.textContent || '').replace(/\s+/g, ' ').trim() || paramKey || 'selected';
                showInstantNotifyMessage(
                    buildUpgradeCompleteNotifyMessage({
                        filterLabel,
                        exportUnlocked: Boolean(intent.exportIntent)
                    })
                );
            } else {
                executeSearchBasedOnType();
                showInstantNotifyMessage(
                    buildUpgradeCompleteNotifyMessage({
                        query: savedQuery,
                        exportUnlocked: Boolean(intent?.exportIntent)
                    })
                );
            }

            const localCount = getSearchCounts(state).comments;
            updateTotalResultDisplay(buildUpgradedStatusText(localCount));

            if (intent?.openCommentsWindow) {
                const comments = getComments(state);
                if (comments.length > 0) {
                    try {
                        openCommentsWindow(comments, getExportMeta());
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        };

        const promptInstantUpgrade = async (
            message: string,
            intent: Parameters<typeof pendingUpgrade.set>[0]
        ): Promise<void> => {
            const confirmed = await showConfirmModal(UPGRADE_MODAL_TITLE, message);
            if (!confirmed) return;
            await beginInstantUpgrade(intent);
        };

        const getSearchQuery = (): string => {
            const inputSearch = document.getElementById('ycs-input-search') as HTMLInputElement | null;
            return inputSearch?.value ?? '';
        };

        const DEFAULT_SEARCH_PLACEHOLDER = 'Search';

        const syncInstantSearchPlaceholder = (): void => {
            const inputSearch = document.getElementById('ycs-input-search') as HTMLInputElement | null;
            if (!inputSearch) return;
            if (isInstantBrowseMode(state)) {
                inputSearch.placeholder = 'Search (instant via YouTube API)';
                if (!isInstantSessionActive() && getSearchQuery().trim().length === 0) {
                    updateTotalResultDisplay('', false);
                }
                syncInstantDegradedControls(true);
            } else {
                inputSearch.placeholder = DEFAULT_SEARCH_PLACEHOLDER;
                if (!isInstantSessionActive()) {
                    syncInstantDegradedControls(false);
                }
            }
        };

        let instantNotifyClearTimer: ReturnType<typeof setTimeout> | undefined;

        const showInstantNotifyMessage = (message: string, options?: { autoClearMs?: number }): void => {
            const notify = document.querySelector('.ycs_notify_box') as HTMLElement | null;
            if (!notify) return;
            if (instantNotifyClearTimer !== undefined) {
                clearTimeout(instantNotifyClearTimer);
                instantNotifyClearTimer = undefined;
            }
            notify.textContent = message;
            const autoClearMs = options?.autoClearMs ?? 8000;
            if (autoClearMs > 0) {
                instantNotifyClearTimer = setTimeout(() => {
                    if (notify.textContent === message) {
                        notify.textContent = '';
                    }
                    instantNotifyClearTimer = undefined;
                }, autoClearMs);
            }
        };

        const removeInstantShowMore = (): void => {
            document.getElementById('ycs_instant_show_more')?.remove();
        };

        const getInstantResultAccessor = (): { getComments: () => CommentItem[] } => ({
            getComments: () => getRemoteSearch(state).results
        });

        /** Shared post-render tail: record the comments search count and (re)bind comment interactions. */
        const finalizeCommentsRender = (
            result: { total: number },
            stateAccessor: { getComments: () => CommentItem[] },
            query: string
        ): void => {
            state = setSearchCount(state, 'comments', result.total);
            const commentsContainer = document.getElementById('ycs_wrap_comments');
            if (commentsContainer instanceof HTMLElement) {
                registerCommentInteractions(commentsContainer, stateAccessor, () => query);
            }
        };

        const renderInstantShowMore = (selector: string, query: string): void => {
            removeInstantShowMore();
            const session = getRemoteSearch(state);
            if (!session.active || !session.pageToken) return;
            // Wait until local DOM batch ("Show more, found comments") is exhausted.
            if (document.getElementById('ycs_search_show_more')) return;

            const target = document.querySelector(selector);
            const wrapper = target?.querySelector('#ycs_wrap_comments') ?? target;
            if (!(wrapper instanceof HTMLElement)) return;

            const showMore = document.createElement('div');
            showMore.id = 'ycs_instant_show_more';
            showMore.className = 'ycs-render-comment ycs-show_more_block';
            showMore.title = INSTANT_SHOW_MORE_TOOLTIP;

            const button = document.createElement('div');
            button.className = 'ycs-title';
            button.textContent = 'Show more instant results';
            showMore.appendChild(button);
            wrapper.appendChild(showMore);

            showMore.addEventListener('click', async () => {
                if (showMore.classList.contains('ycs-instant-fetching')) return;

                const videoId = getVideoId(window.location.href);
                if (!videoId) return;

                const requestGeneration = instantSearchGeneration;
                showMore.classList.add('ycs-instant-fetching');
                button.textContent = 'Fetching…';

                try {
                    const pageOutcome = await fetchNextInstantSearchPage(state, videoId);
                    if (requestGeneration !== instantSearchGeneration) {
                        return;
                    }
                    state = pageOutcome.state;
                    if (pageOutcome.appendedCount === 0) {
                        removeInstantShowMore();
                        // Even with zero new items, the API may have returned no nextPageToken,
                        // making the session complete — re-sync degraded controls so unlockable
                        // filters lose their locked visual state (click-time gate already allows
                        // this; keep the visuals in sync too).
                        syncInstantControlsFromState();
                        return;
                    }

                    const refreshed = buildInstantSearchResult(query, getRemoteSearch(state).results);
                    const stateAccessor = getInstantResultAccessor();
                    renderCommentsResult(selector, refreshed, {
                        stateAccessor,
                        onLocalBatchExhausted: () => renderInstantShowMore(selector, query)
                    });
                    finalizeCommentsRender(refreshed, stateAccessor, query);

                    updateInstantStatusHtml(pageOutcome.statusHtml);
                    syncInstantControlsFromState();
                } catch (error) {
                    if (error instanceof InstantSearchQuotaError) {
                        showInstantNotifyMessage(error.message);
                    } else if (!(error instanceof DOMException && error.name === 'AbortError')) {
                        console.error('[YCS] Instant pagination failed:', error);
                    }
                } finally {
                    showMore.classList.remove('ycs-instant-fetching');
                    if (getRemoteSearch(state).pageToken) {
                        button.textContent = 'Show more instant results';
                    }
                }
            });
        };

        const runInstantCommentsFlow = async (
            selector: string,
            query: string,
            param?: IParamSearch
        ): Promise<boolean> => {
            const trimmed = query.trim();
            if (!trimmed) {
                if (isInstantBrowseMode(state)) {
                    clearInstantSessionUi({ clearResultsDom: true });
                    updateTotalResultDisplay(buildInstantEmptyQueryStatusText());
                    return true;
                }
                const result = runCommentsPipeline(selector, query, param);
                updateTotalResultDisplay(result.summary);
                return false;
            }

            if (!shouldUseInstantSearch(query, state)) {
                const result = runCommentsPipeline(selector, query, param);
                updateTotalResultDisplay(result.summary);
                return false;
            }

            const activeSession = getRemoteSearch(state);
            if (activeSession.active && isInstantSessionComplete(state) && activeSession.query === trimmed) {
                // Complete session, same query: serve filters/sort locally instead of re-hitting
                // the API (which would replace the accumulated multi-page session with page 1).
                const result = runInstantLocalPipeline(selector, trimmed, param);
                updateInstantStatusHtml(buildInstantResultsStatusHtml(trimmed, result.total));
                syncInstantControlsFromState();
                return true;
            }

            const videoId = getVideoId(window.location.href);
            if (!videoId) {
                updateTotalResultDisplay('(Comments) Found: 0');
                return true;
            }

            state = abortInFlightCommentLoad(state);
            state = clearComments(state);
            instantSearchGeneration += 1;
            // Invalidate any in-flight full-load completion so partial archive cannot overwrite instant results.
            commentLoadGeneration += 1;

            const searchBtn = document.getElementById('ycs_btn_search') as HTMLButtonElement | null;
            if (searchBtn) searchBtn.disabled = true;
            updateTotalResultDisplay('Searching YouTube…');

            try {
                const outcome = await runInstantCommentSearch(query, state, { videoId });
                state = outcome.state;
                const stateAccessor = getInstantResultAccessor();
                renderCommentsResult(selector, outcome.result, {
                    stateAccessor,
                    onLocalBatchExhausted: () => renderInstantShowMore(selector, trimmed)
                });
                finalizeCommentsRender(outcome.result, stateAccessor, query);

                if (outcome.result.total > 0) {
                    updateInstantStatusHtml(buildInstantResultsStatusHtml(trimmed, outcome.result.total));
                } else {
                    removeInstantShowMore();
                    updateTotalResultDisplay(buildInstantZeroResultsStatusText(trimmed));
                }

                syncInstantControlsFromState();
                return true;
            } catch (error) {
                if (error instanceof InstantSearchQuotaError) {
                    showInstantNotifyMessage(error.message);
                    updateTotalResultDisplay('');
                } else if (error instanceof DOMException && error.name === 'AbortError') {
                    updateTotalResultDisplay('');
                } else {
                    console.error('[YCS] Instant search failed:', error);
                    updateTotalResultDisplay('Instant search failed. Try Load all or search again.');
                }
                syncInstantControlsFromState();
                removeInstantShowMore();
                return true;
            } finally {
                if (searchBtn) searchBtn.disabled = false;
            }
        };

        const setActiveFilterByElement = (param: FilterParamKey | null, el?: HTMLElement): void => {
            try {
                FILTER_BUTTONS.forEach(({ elementId }) => {
                    const button = document.getElementById(elementId);
                    button?.classList.remove('ycs_btn_active');
                });

                if (param && el) {
                    el.classList.add('ycs_btn_active');
                }
            } catch {
                // Silently ignore DOM manipulation errors
            }
        };

        // Removed applyActiveFilterFromStore: no restore from storage

        const getActiveFilterParam = (): IParamSearch | undefined => {
            try {
                const active = document.querySelector('.ycs_btn_active') as HTMLElement | null;
                const paramKey = active?.id ? getParamByElementId(active.id) : undefined;
                if (!paramKey) return undefined;

                const param: IParamSearch = { [paramKey]: true } as IParamSearch;

                // Get sort order from the active button's dataset
                if (active) {
                    const sortDatasetKeys: Array<'sort' | 'sortChat' | 'sortTrp'> = ['sort', 'sortChat', 'sortTrp'];

                    for (const key of sortDatasetKeys) {
                        const datasetOrder = active.dataset[key] as SortOrder | undefined;
                        if (datasetOrder === 'newest' || datasetOrder === 'oldest') {
                            param.sortOrder = datasetOrder;
                            break;
                        }
                    }
                }

                return param;
            } catch {
                return undefined;
            }
        };

        // Initialize Timestamp Visualization Handler with DI
        const timestampVizDeps: TimestampVizDeps = {
            state: {
                getComments: () => getComments(state),
                getState: () => state
            },
            callbacks: {
                updateTotalResultDisplay,
                getSearchQuery
            }
        };
        const handleTimestampViz = createTimestampVizHandler(timestampVizDeps);

        const executeSearchBasedOnType = (param?: IParamSearch, forceType?: ISelectedSearch): void => {
            const elSelectOptSearch = document.getElementById('ycs_search_select') as HTMLSelectElement | null;
            const query = getSearchQuery();
            searchIntentState.markSearchExecuted();
            syncShortsFooterBySearchState({ debounceResync: true });

            if (param && isInstantDegradedMode()) {
                const filterKey = (Object.keys(param) as Array<keyof IParamSearch>).find(
                    (key) => key !== 'sortOrder' && param[key]
                );
                if (
                    filterKey &&
                    filterKey !== 'quickChat' &&
                    filterKey !== 'quickTranscript' &&
                    isDegradedFilterParam(filterKey as FilterParamKey) &&
                    !isInstantFilterUnlocked(filterKey as FilterParamKey)
                ) {
                    void promptInstantUpgrade(UPGRADE_MODAL_MESSAGE, { filterParam: param });
                    return;
                }
            }

            // Special handling for timestampViz
            if (param?.timestampViz) {
                handleTimestampViz();
                return;
            }

            const selected =
                forceType ||
                (elSelectOptSearch
                    ? (elSelectOptSearch.options[elSelectOptSearch.options.selectedIndex].value as ISelectedSearch)
                    : 'all');

            switch (selected) {
                case 'comments': {
                    void runInstantCommentsFlow('#ycs-search-result', query, param);
                    break;
                }
                case 'chat': {
                    const result = runChatPipeline('#ycs-search-result', query, param);
                    updateTotalResultDisplay(result.summary);
                    break;
                }
                case 'video': {
                    const result = runTranscriptPipeline('#ycs-search-result', query, param);
                    updateTotalResultDisplay(result.summary);
                    break;
                }
                case 'all':
                default: {
                    void searchCommentsAll('#ycs-search-result', param);
                    break;
                }
            }
        };

        const initFilterButtons = (filterButtons?: Array<{ id: string; enabled: boolean }>): void => {
            try {
                const dynamicButtonConfigs = getDynamicFilterButtonConfigs(filterButtons);

                filterRegistry = registerFilterButtons({
                    state: {
                        get: () => state,
                        set: (nextState: WebResourcesState) => {
                            state = nextState;
                        }
                    },
                    executeSearch: executeSearchBasedOnType,
                    setActiveFilter: setActiveFilterByElement,
                    buttonConfigs: dynamicButtonConfigs
                });
            } catch (err) {
                console.error('Error loading dynamic filter button configs:', err);
                // If loading fails, use default configuration
                filterRegistry = registerFilterButtons({
                    state: {
                        get: () => state,
                        set: (nextState: WebResourcesState) => {
                            state = nextState;
                        }
                    },
                    executeSearch: executeSearchBasedOnType,
                    setActiveFilter: setActiveFilterByElement,
                    buttonConfigs: FILTER_BUTTONS
                });
            }

            const clearButton = document.getElementById('ycs_btn_clear');
            if (clearButton) {
                // Remove old event listeners (if they exist)
                const oldHandler = (clearButton as any).__ycsClearHandler;
                if (oldHandler) {
                    clearButton.removeEventListener('click', oldHandler);
                }

                const clearHandler = () => {
                    try {
                        setActiveFilterByElement(null);

                        state = resetSearchCounts(state);
                        clearInstantSessionUi({ clearResultsDom: true });

                        const eInputSearch = document.getElementById('ycs-input-search') as HTMLInputElement;

                        if (eInputSearch?.value && eInputSearch.value.trim()) {
                            requestAnimationFrame(() => {
                                const searchBtn = document.getElementById('ycs_btn_search');
                                searchBtn?.click();
                            });
                        } else {
                            searchIntentState.resetExecution();
                            const elSearchRes = document.getElementById('ycs-search-result');
                            const elSearchTotalRes = document.getElementById(
                                'ycs-search-total-result'
                            ) as HTMLElement | null;

                            if (elSearchRes && elSearchTotalRes) {
                                elSearchRes.innerText = '';
                                elSearchTotalRes.innerText = 'Search cleared';
                            }
                            syncShortsFooterBySearchState();
                        }

                        const btnClear = document.getElementById('ycs_btn_clear') as HTMLButtonElement | null;
                        if (btnClear) btnClear.style.visibility = 'hidden';
                    } catch (err) {
                        console.error(err);
                    }
                };

                // Store event handler reference for later removal
                (clearButton as any).__ycsClearHandler = clearHandler;
                clearButton.addEventListener('click', clearHandler);
            }

            syncInstantControlsFromState();
        };

        initFilterButtons();

        const elLiveApp = document.getElementsByClassName('ycs-app')[0];
        if (elLiveApp instanceof HTMLElement) {
            bindInstantDegradedCapture(elLiveApp, {
                isActive: isInstantDegradedMode,
                isFilterUnlocked: isInstantFilterUnlocked,
                onAction: (action) => {
                    if (action.kind === 'filter') {
                        const filterParam = { [action.param]: true } as IParamSearch;
                        void promptInstantUpgrade(UPGRADE_MODAL_MESSAGE, { filterParam });
                        return;
                    }
                    if (action.kind === 'export') {
                        void promptInstantUpgrade(UPGRADE_EXPORT_MODAL_MESSAGE, {
                            exportIntent: { format: EXPORT_FORMAT.TXT }
                        });
                        return;
                    }
                    if (action.kind === 'openWindow') {
                        void promptInstantUpgrade(UPGRADE_OPEN_WINDOW_MODAL_MESSAGE, {
                            openCommentsWindow: true
                        });
                        return;
                    }
                    void promptInstantUpgrade(UPGRADE_MODAL_MESSAGE, { enableExtendedSearch: true });
                }
            });
        }

        // No restore from storage; ensure clear button hidden initially
        try {
            const btnClearInit = document.getElementById('ycs_btn_clear') as HTMLButtonElement | null;
            if (btnClearInit) btnClearInit.style.visibility = 'hidden';
        } catch {
            // Silently ignore DOM initialization errors
        }

        const elCountComments = document.getElementById('ycs-count-load') as HTMLElement | null;
        const elCountCommentsCollapsed = document.getElementById('ycs-count-load-collapsed') as HTMLElement | null;

        const updateTitleCount = (value: number): void => {
            const formattedCount = `(${value})`;

            if (elCountComments) {
                elCountComments.textContent = formattedCount;
            }

            if (elCountCommentsCollapsed) {
                elCountCommentsCollapsed.textContent = formattedCount;
            }
        };

        // Helper to get export metadata with current state
        const getExportMeta = () => {
            const videoUrl = getCleanUrlVideo(window.location.href);
            const liveRecording = getLiveRecording(state);
            return buildExportMeta(videoUrl, liveRecording?.broadcastStartTime);
        };

        // Helper to append cached info to count elements
        const appendCachedInfoToCounters = (timestamp: number | string | null | undefined) => {
            appendCachedInfo(timestamp, [elCountComments, elCountCommentsCollapsed]);
        };

        resetLoadButtonLabels();

        const elLoadComments = document.getElementById('ycs-load-cmnts');
        if (elLoadComments) {
            elLoadComments.addEventListener('click', async function (e: MouseEvent): Promise<void> {
                if (!elLiveApp.parentNode || !elLiveApp.parentElement) return;

                // Capture URL and videoId/postId at the start of async operation
                const startUrl = window.location.href;
                const startVideoId = getVideoId(startUrl);
                const startPostId = getPostId(startUrl);

                state = clearComments(state);
                const remoteSession = getRemoteSearch(state);
                if (remoteSession.active) {
                    instantUpgradeSnapshot = {
                        query: remoteSession.query,
                        matchCount: remoteSession.results.length
                    };
                    isUpgradingFromInstant = true;
                    instantSearchGeneration += 1;
                    state = abortInFlightInstantSearch(state);
                    updateInstantUpgradeProgress(0);
                } else if (!isUpgradingFromInstant) {
                    state = resetRemoteSearch(state);
                }
                const comments = getComments(state);
                commentLoadGeneration += 1;
                const loadGeneration = commentLoadGeneration;

                const currentTarget = e.currentTarget as HTMLButtonElement;
                const defaultLabel = currentTarget.innerText;

                clearButtonLabelDataset(currentTarget);

                currentTarget.disabled = true;
                currentTarget.innerText = 'reload';

                try {
                    const elStatusCmnts = document.getElementById('ycs_status_cmnt');
                    const elLoadCmnts = document.getElementById('ycs_cmnts');

                    if (elLoadCmnts && elStatusCmnts) {
                        elLoadCmnts.textContent = '0';

                        elStatusCmnts.innerHTML = iconReload();

                        const controller = getController(state);

                        // Check if YouTube Data API key is configured and enabled
                        const hasApiKey = GlobalStore.hasYoutubeApiKey;
                        const apiEnabled = GlobalStore.youtubeApiEnabled;
                        // Track if YouTube API result was incomplete (for status icon)
                        let youtubeApiIncomplete = false;

                        if (hasApiKey && apiEnabled && startVideoId) {
                            // Use YouTube Data API v3 via background service worker
                            try {
                                console.log('[YCS] Using YouTube Data API v3 (via background)');
                                const result = await requestYouTubeApiComments(
                                    startVideoId,
                                    controller.signal,
                                    GlobalStore.autoload ? GlobalStore.maxComments : undefined,
                                    (count) => {
                                        showLoadComments(count, elLoadCmnts);
                                        updateInstantUpgradeProgress(count);
                                    }
                                );
                                comments.push(...result.comments);
                                console.log(
                                    `[YCS] YouTube API: ${result.comments.length} comments, ${result.quotaUsed} quota units used`
                                );

                                // Track incomplete state for status icon
                                if (result.incomplete) {
                                    youtubeApiIncomplete = true;
                                    console.warn(
                                        `[YCS] Some replies may be missing (${result.replyFetchErrors} fetch errors)`
                                    );
                                    elStatusCmnts.innerHTML = iconWarning('Some replies may be missing');
                                }
                            } catch (error) {
                                // Handle YouTube Data API specific errors
                                if (error instanceof YouTubeApiMessageError) {
                                    // If we have partial comments, keep them
                                    if (error.partialComments && error.partialComments.length > 0) {
                                        comments.push(...error.partialComments);
                                        console.log(`[YCS] Keeping ${error.partialComments.length} partial comments`);
                                    }

                                    if (error.isQuotaExceeded) {
                                        youtubeApiIncomplete = true;
                                        elStatusCmnts.innerHTML = iconWarning('Quota exceeded');
                                        console.error(
                                            '[YCS] YouTube Data API quota exceeded. Please try again tomorrow or use a different API key.'
                                        );
                                        alert(
                                            'YouTube Data API quota exceeded!\n\nYour daily quota (10,000 units) has been exhausted.\nPlease try again tomorrow or temporarily disable YouTube Data API in extension settings.'
                                        );
                                    } else if (error.isInvalidApiKey) {
                                        youtubeApiIncomplete = true;
                                        elStatusCmnts.innerHTML = iconError('Invalid API key');
                                        console.error(
                                            '[YCS] Invalid YouTube Data API key. Please check your API key in settings.'
                                        );
                                        alert(
                                            'Invalid YouTube Data API key!\n\nPlease check your API key in extension settings.'
                                        );
                                    } else if (error.type === 'aborted') {
                                        // User cancelled via STOP button - silently continue if we have partial comments
                                        console.log('[YCS] Fetch aborted by user');
                                        if (!error.partialComments || error.partialComments.length === 0) {
                                            return;
                                        }
                                        // Mark as incomplete so we don't show OK icon or cache as complete
                                        youtubeApiIncomplete = true;
                                        elStatusCmnts.innerHTML = iconStop('Stopped - partial results');
                                        // Continue to save partial results
                                    } else if (error.isUnsupported) {
                                        // Comments disabled or video not found - silently skip with info icon
                                        console.log(
                                            '[YCS] YouTube Data API not supported for this video:',
                                            error.message
                                        );
                                        elStatusCmnts.innerHTML = iconInfo('Comments unavailable');
                                        return;
                                    } else {
                                        youtubeApiIncomplete = true;
                                        elStatusCmnts.innerHTML = iconError('API error');
                                        console.error('[YCS] YouTube Data API error:', error.message);
                                        alert(
                                            `YouTube Data API error: ${error.message}\n\nYou can temporarily disable YouTube Data API in extension settings to use Innertube instead.`
                                        );
                                    }

                                    // If no partial comments, return early (for non-abort errors)
                                    if (
                                        error.type !== 'aborted' &&
                                        (!error.partialComments || error.partialComments.length === 0)
                                    ) {
                                        return;
                                    }
                                    // Otherwise continue to save partial results
                                } else if (error instanceof DOMException && error.name === 'AbortError') {
                                    // User cancelled, don't show error
                                    return;
                                } else {
                                    throw error; // Re-throw non-API errors
                                }
                            }
                        } else {
                            // Use Innertube API (default or when YouTube Data API is disabled)
                            const selectedSortOrder = getSelectedCommentSortOrder(state);
                            await getAllCommentsModeV2(
                                elLoadCmnts,
                                controller.signal,
                                comments,
                                GlobalStore.autoload ? GlobalStore.maxComments : undefined,
                                selectedSortOrder
                            );
                            if (isUpgradingFromInstant) {
                                updateInstantUpgradeProgress(comments.length);
                            }
                        }

                        // Stale load: instant search (or a newer Load) discarded this fetch — do not mix partials.
                        if (loadGeneration !== commentLoadGeneration) {
                            console.log('[YCS] Discarding stale comment load after abort/supersede');
                            return;
                        }

                        // Verify video or post hasn't changed before saving cache
                        const currentId = getVideoId(window.location.href) ?? getPostId(window.location.href);
                        if (
                            (startVideoId && currentId && startVideoId !== currentId) ||
                            (startPostId && currentId && startPostId !== currentId)
                        ) {
                            console.warn(
                                '[YCS] Id of video or post changed during comment loading, skipping cache save:',
                                startVideoId ?? startPostId,
                                '→',
                                currentId
                            );
                            return;
                        }

                        if (comments.length > 0) {
                            // Only show OK icon if result was complete (don't overwrite warning)
                            if (!youtubeApiIncomplete) {
                                elStatusCmnts.innerHTML = iconOk();
                            }
                            saveToCache(
                                {
                                    videoId: startVideoId ?? startPostId,
                                    comments,
                                    commentsChat: JSON.stringify(Array.from(getCommentsChat(state).entries())),
                                    commentsTrVideo: getCommentsTrVideo(state),
                                    channelId: extractChannelId()
                                },
                                buildCacheMeta()
                            );
                        }
                    }

                    if (loadGeneration !== commentLoadGeneration) {
                        return;
                    }

                    if (comments.length > 0) {
                        state = setCount(state, 'comments', comments.length);
                        state = setComments(state, comments);

                        if (isUpgradingFromInstant) {
                            completeInstantUpgrade();
                        } else {
                            state = resetRemoteSearch(state);
                            syncInstantControlsFromState();
                            syncInstantSearchPlaceholder();
                        }
                    }

                    const counts = getCounts(state);
                    const totalCount = counts.comments + counts.commentsChat + counts.commentsTrVideo;
                    updateBadge('NUMBER_COMMENTS', totalCount);

                    if (elLoadCmnts) {
                        elLoadCmnts.textContent = `${comments.length}`;
                    }

                    updateTitleCount(totalCount);
                } finally {
                    GlobalStore.autoload = false;
                    currentTarget.disabled = false;
                    currentTarget.innerText = defaultLabel;
                    if (isUpgradingFromInstant && getComments(state).length === 0) {
                        isUpgradingFromInstant = false;
                        instantUpgradeSnapshot = null;
                        pendingUpgrade.clear();
                        const session = getRemoteSearch(state);
                        if (session.active && session.query) {
                            updateInstantStatusHtml(
                                buildInstantResultsStatusHtml(session.query, session.results.length)
                            );
                        }
                    }
                }
            });
        }

        const elLoadCommentsChat = document.getElementById('ycs-load-chat');
        if (elLoadCommentsChat) {
            elLoadCommentsChat.addEventListener('click', async function (e: MouseEvent): Promise<void> {
                if (!elLiveApp.parentNode || !elLiveApp.parentElement) return;

                // Check for live recording data before proceeding
                const currentChatSource = getChatSource(state);
                const currentChatCount = getCommentsChat(state).size;

                if (currentChatSource === 'live-recording' && currentChatCount > 0) {
                    const confirmed = await showConfirmModal(
                        'Replace Recorded Chat?',
                        `You have previously recorded ${currentChatCount.toLocaleString()} live chat messages. Are you sure you want to replace them with new chat replay data?`
                    );

                    if (!confirmed) {
                        return; // User cancelled
                    }
                }

                // Capture URL and videoId at the start of async operation
                const startUrl = window.location.href;
                const startVideoId = getVideoId(startUrl);

                state = clearCommentsChat(state);
                state = setChatSource(state, undefined); // Clear source when loading new data
                const commentsChat = getCommentsChat(state);

                const currentTarget = e.currentTarget as HTMLButtonElement;
                const defaultLabel = currentTarget.innerText;

                clearButtonLabelDataset(currentTarget);

                currentTarget.disabled = true;
                currentTarget.innerText = 'reload';

                try {
                    const elStatusChat = document.getElementById('ycs_status_chat');
                    const elLoadChat = document.getElementById('ycs_cmnts_chat');

                    if (elLoadChat && elStatusChat) {
                        elLoadChat.textContent = '0';

                        elStatusChat.innerHTML = iconReload();

                        const controller = getController(state);

                        await getChatComments(controller.signal, elLoadChat, commentsChat);

                        // Verify video hasn't changed before saving cache
                        const currentVideoId = getVideoId(window.location.href);
                        if (startVideoId && currentVideoId && startVideoId !== currentVideoId) {
                            console.warn(
                                '[YCS] Video changed during chat loading, skipping cache save:',
                                startVideoId,
                                '→',
                                currentVideoId
                            );
                            return;
                        }

                        if (commentsChat.size > 0) {
                            elLoadChat.textContent = commentsChat.size.toString();
                            elStatusChat.innerHTML = iconOk();
                            state = setChatSource(state, 'chat-replay');
                            saveToCache(
                                {
                                    videoId: startVideoId,
                                    comments: getComments(state),
                                    commentsChat: JSON.stringify(Array.from(commentsChat.entries())),
                                    commentsTrVideo: getCommentsTrVideo(state),
                                    channelId: extractChannelId(),
                                    chatSource: 'chat-replay'
                                },
                                buildCacheMeta()
                            );
                        }
                    }

                    if (commentsChat.size > 0 && (elLiveApp.parentNode || elLiveApp.parentElement)) {
                        state = setCount(state, 'commentsChat', commentsChat.size);
                    }

                    const counts = getCounts(state);
                    const totalCount = counts.comments + counts.commentsChat + counts.commentsTrVideo;
                    updateBadge('NUMBER_COMMENTS', totalCount);

                    updateTitleCount(totalCount);
                } finally {
                    currentTarget.disabled = false;
                    currentTarget.innerText = defaultLabel;
                }
            });
        }

        // ============================================
        // Live Chat Recording
        // ============================================
        const elRecordChat = document.getElementById('ycs-record-chat') as HTMLButtonElement | null;
        const elRecordTimer = document.getElementById('ycs-record-timer');

        const liveChatRecorderDeps: LiveChatRecorderDeps = {
            state: {
                getState: () => state,
                setState: (newState) => {
                    state = newState;
                },
                getLiveRecording,
                setLiveRecording,
                resetLiveRecording,
                getCommentsChat,
                getComments,
                getCommentsTrVideo,
                getController,
                getCounts,
                setCount,
                clearCommentsChat,
                setChatSource,
                resetController
            },
            elements: {
                elRecordChat,
                elRecordTimer
            },
            callbacks: {
                updateTitleCount
            }
        };

        createLiveChatRecorder(liveChatRecorderDeps);

        // Transcript Loader DOM elements (DI initialization happens after dropdown helpers are defined)
        const elLoadTranscriptVideo = document.getElementById('ycs-load-transcript-video');
        const elTranscriptLangButton = document.getElementById('ycs_transcript_language');
        const elTranscriptLangMenu = document.getElementById('ycs_transcript_language_menu');

        // Comment Sort Order Selector DOM elements
        const elSortOrderButton = document.getElementById('ycs-comment-sort-order');
        const elSortOrderMenu = document.getElementById('ycs_comment_sort_order_menu');
        const isShorts = isShortsPage();
        if (isShorts) {
            if (elSortOrderButton instanceof HTMLElement) {
                elSortOrderButton.style.display = 'none';
            }
            if (elSortOrderMenu instanceof HTMLElement) {
                elSortOrderMenu.style.display = 'none';
            }
        }

        const elLoadAll = document.getElementById('ycs-load-all');
        if (elLoadAll) {
            elLoadAll.addEventListener('click', function (): void {
                const eLoadComments = document.getElementById('ycs-load-cmnts');
                const eLoadCommentsChat = document.getElementById('ycs-load-chat');
                const eLoadTranscriptVideo = document.getElementById('ycs-load-transcript-video');

                eLoadComments?.click();
                eLoadCommentsChat?.click();
                eLoadTranscriptVideo?.click();
            });
        }

        const elLoadAllStop = document.getElementById('ycs_load_stop');
        if (elLoadAllStop) {
            elLoadAllStop.addEventListener('click', () => {
                try {
                    getController(state).abort();
                    state = resetController(state);
                } catch (err) {
                    console.error(err);
                }
            });
        }

        const btnSearch = document.getElementById('ycs_btn_search');
        const eInputSearch = document.getElementById('ycs-input-search');
        const btnSearchClearText = document.getElementById('ycs_btn_search_clear_text');

        if (eInputSearch) {
            eInputSearch.onkeyup = (e): void => {
                if (e.key === 'Enter' || e.code === 'Enter') {
                    btnSearch?.click();
                }
            };
            // toggle clear-text button visibility
            eInputSearch.addEventListener('input', () => {
                const hasText = (eInputSearch as HTMLInputElement).value.trim().length > 0;
                if (btnSearchClearText) {
                    (btnSearchClearText as HTMLButtonElement).style.display = hasText ? 'inline-block' : 'none';
                }
            });
        }

        // initialize clear-text button visibility
        if (btnSearchClearText) {
            (btnSearchClearText as HTMLButtonElement).style.display =
                (eInputSearch as HTMLInputElement)?.value?.trim()?.length > 0 ? 'inline-block' : 'none';
            btnSearchClearText.addEventListener('click', () => {
                try {
                    if (eInputSearch) {
                        (eInputSearch as HTMLInputElement).value = '';
                    }

                    const activeParam = getActiveFilterParam();
                    const elSearchRes = document.getElementById('ycs-search-result');
                    const elSearchTotalRes = document.getElementById('ycs-search-total-result') as HTMLElement | null;

                    if (activeParam && !isInstantDegradedMode()) {
                        // Reapply current filter while only clearing the text query
                        requestAnimationFrame(() => {
                            btnSearch?.click();
                        });
                    } else if (elSearchRes) {
                        if (activeParam) {
                            // Instant mode: an empty query mismatches the session query, so
                            // re-running the filter would re-degrade it into the upgrade modal —
                            // clear the filter together with the text instead.
                            setActiveFilterByElement(null);
                            state = resetSearchCounts(state);
                        }
                        searchIntentState.resetExecution();
                        clearInstantSessionUi({ clearResultsDom: true });
                        elSearchRes.innerText = '';
                        if (elSearchTotalRes) elSearchTotalRes.innerText = 'Search cleared';
                        syncShortsFooterBySearchState();
                    }

                    // hide clear button after clearing
                    (btnSearchClearText as HTMLButtonElement).style.display = 'none';
                    const btnClear = document.getElementById('ycs_btn_clear') as HTMLButtonElement | null;
                    if (btnClear) {
                        (btnClear as HTMLButtonElement).style.visibility = 'hidden';
                    }
                } catch (err) {
                    console.error(err);
                }
            });
        }

        const setMenuVisibility = (menu: HTMLElement | null, visible: boolean): void => {
            if (!menu) return;
            if (visible) {
                menu.classList.add('show');
            } else {
                menu.classList.remove('show');
            }
            menu.setAttribute('aria-hidden', visible ? 'false' : 'true');
        };

        const closeAllDropdowns = (except?: HTMLElement | null): void => {
            dropdownMenus.forEach((menu) => {
                if (menu !== except) {
                    setMenuVisibility(menu, false);
                }
            });
        };

        // Initialize Transcript Loader with DI (after dropdown helpers are defined)
        const transcriptLoaderDeps: TranscriptLoaderDeps = {
            state: {
                getState: () => state,
                setState: (newState) => {
                    state = newState;
                },
                getCommentsTrVideo,
                setCommentsTrVideo,
                clearCommentsTrVideo,
                getStateTranscriptTracks,
                setTranscriptTracks,
                getSelectedTranscriptLanguage,
                setSelectedTranscriptLanguage,
                getController,
                resetController,
                getCounts,
                setCount,
                getComments,
                getCommentsChat
            },
            elements: {
                elLiveApp: elLiveApp as HTMLElement,
                elLoadTranscriptVideo,
                elTranscriptLangButton,
                elTranscriptLangMenu
            },
            callbacks: {
                updateTitleCount,
                showLoadComments,
                closeAllDropdowns,
                setMenuVisibility
            }
        };

        createTranscriptLoader(transcriptLoaderDeps);

        // Comment Sort Order Selector
        if (!isShorts) {
            const commentSortOrderSelectorDeps: CommentSortOrderSelectorDeps = {
                state: {
                    getState: () => state,
                    setState: (newState) => {
                        state = newState;
                    },
                    getSelectedCommentSortOrder,
                    setSelectedCommentSortOrder,
                    clearComments,
                    getController,
                    resetController
                },
                elements: {
                    elSortOrderButton,
                    elSortOrderMenu,
                    elLoadComments
                },
                callbacks: {
                    closeAllDropdowns,
                    setMenuVisibility
                }
            };

            createCommentSortOrderSelector(commentSortOrderSelectorDeps);

            // Register comment sort order menu in dropdownMenus for click-outside-to-close
            if (elSortOrderMenu instanceof HTMLElement) {
                dropdownMenus.add(elSortOrderMenu);
                setMenuVisibility(elSortOrderMenu, false);
            }
        }

        const setupDropdown = (
            trigger: HTMLElement | null,
            menu: HTMLElement | null,
            onSelect: (format: ExportFormat) => void
        ): void => {
            if (!trigger || !menu) return;

            dropdownMenus.add(menu);
            setMenuVisibility(menu, false);

            trigger.addEventListener('click', (event) => {
                try {
                    const target = event.target as HTMLElement | null;
                    if (target?.closest('.ycs_dropdown_trigger')) {
                        event.stopPropagation();
                    }
                    closeAllDropdowns(menu);
                    const shouldShow = !menu.classList.contains('show');
                    setMenuVisibility(menu, shouldShow);
                } catch (err) {
                    console.error(err);
                }
            });

            menu.addEventListener('click', (event) => {
                try {
                    const target = event.target as HTMLElement | null;
                    if (!target) return;
                    const format = target.dataset.format;
                    if (!isExportFormat(format)) return;

                    onSelect(format);
                } catch (err) {
                    console.error(err);
                } finally {
                    setMenuVisibility(menu, false);
                }
            });
        };

        const btnOpenCommentsNewWindow = document.getElementById('ycs_open_all_comments_window');
        btnOpenCommentsNewWindow?.addEventListener('click', () => {
            const comments = getComments(state);
            if (comments.length === 0) return;

            try {
                openCommentsWindow(comments, getExportMeta());
            } catch (e) {
                console.error(e);
                return;
            }
        });

        // Comments save dropdown
        const btnSaveCommentsToFile = document.getElementById('ycs_save_all_comments');
        const btnSaveCommentsToFileMenu = document.getElementById('ycs_save_all_comments_menu');
        setupDropdown(btnSaveCommentsToFile, btnSaveCommentsToFileMenu, (format) => {
            const comments = getComments(state);
            if (!comments || comments.length === 0) return;

            if (format === EXPORT_FORMAT.TXT) {
                downloadCommentsFile(comments, getExportMeta());
            } else if (format === EXPORT_FORMAT.JSON) {
                downloadCommentsFileJSON(comments, getExportMeta());
            } else if (format === EXPORT_FORMAT.XLSX) {
                downloadCommentsFileXLSX(comments, getExportMeta());
            }
        });

        const btnOpenCommentsChatNewWindow = document.getElementById('ycs_open_all_comments_chat_window');
        btnOpenCommentsChatNewWindow?.addEventListener('click', () => {
            const commentsChat = getCommentsChat(state);
            if (commentsChat.size === 0) return;

            try {
                openChatWindow([...commentsChat.values()], getExportMeta());
            } catch (e) {
                console.error(e);
                return;
            }
        });

        // Chat save dropdown
        const btnSaveCommentsChatToFile = document.getElementById('ycs_save_all_comments_chat');
        const btnSaveCommentsChatToFileMenu = document.getElementById('ycs_save_all_comments_chat_menu');
        setupDropdown(btnSaveCommentsChatToFile, btnSaveCommentsChatToFileMenu, (format) => {
            const commentsChat = getCommentsChat(state);
            if (!commentsChat || commentsChat.size === 0) return;
            const arr = [...commentsChat.values()];

            if (format === EXPORT_FORMAT.TXT) {
                downloadChatFile(arr, getExportMeta());
            } else if (format === EXPORT_FORMAT.JSON) {
                downloadChatFileJSON(arr, getExportMeta());
            } else if (format === EXPORT_FORMAT.XLSX) {
                downloadChatFileXLSX(arr, getExportMeta());
            }
        });

        const btnOpenCommentsTrVideoNewWindow = document.getElementById('ycs_open_all_comments_trvideo_window');
        btnOpenCommentsTrVideoNewWindow?.addEventListener('click', () => {
            try {
                const commentsTrVideo = getCommentsTrVideo(state);
                console.log('commentsTrVideo: ', commentsTrVideo);

                const cueGroups = extractCueGroups(commentsTrVideo);
                if (cueGroups && cueGroups.length > 0) {
                    openTranscriptWindow(cueGroups, getExportMeta());
                }
            } catch (e) {
                console.error(e);
                return;
            }
        });

        // Transcript save dropdown
        const btnSaveCommentsTrVideoToFile = document.getElementById('ycs_save_all_comments_trvideo');
        const btnSaveCommentsTrVideoToFileMenu = document.getElementById('ycs_save_all_comments_trvideo_menu');
        setupDropdown(btnSaveCommentsTrVideoToFile, btnSaveCommentsTrVideoToFileMenu, (format) => {
            const commentsTrVideo = getCommentsTrVideo(state);
            const cueGroups = extractCueGroups(commentsTrVideo);
            if (!cueGroups || cueGroups.length === 0) return;

            if (format === EXPORT_FORMAT.TXT) {
                downloadTranscriptFile(cueGroups, getExportMeta());
            } else if (format === EXPORT_FORMAT.JSON) {
                downloadTranscriptFileJSON(cueGroups, getExportMeta());
            } else if (format === EXPORT_FORMAT.XLSX) {
                downloadTranscriptFileXLSX(cueGroups, getExportMeta());
            } else if (format === EXPORT_FORMAT.SRT) {
                downloadTranscriptFileSRT(cueGroups, getExportMeta());
            }
        });

        // Close dropdowns when clicking outside
        handleDocumentClick = (event) => {
            try {
                const target = event.target as HTMLElement | null;
                // Skip YouTube's native dropdown/popup elements to prevent interference
                if (target?.closest('tp-yt-iron-dropdown') || target?.closest('ytd-popup-container')) return;
                if (target?.closest('.ycs_dropdown_wrap')) return;

                closeAllDropdowns();
            } catch (err) {
                // ignore
            }
        };
        document.addEventListener('click', handleDocumentClick);

        const runCommentsPipeline = (selector: string, query: string, param?: IParamSearch) => {
            const context = buildSearchContext();
            const result = runCommentsSearch(query, param, state, context);

            const stateAccessor = {
                getComments: () => getComments(state)
            };

            renderCommentsResult(selector, result, { stateAccessor });
            finalizeCommentsRender(result, stateAccessor, query);

            return result;
        };

        /**
         * Instant local filter pipeline: runs filters/sort over an already-complete instant
         * session's results without any API call. Passes an empty query to the search core —
         * `session.results` already ARE the query matches; re-running Fuse would double-filter.
         */
        const runInstantLocalPipeline = (
            selector: string,
            query: string,
            param?: IParamSearch
        ): CommentsSearchResult => {
            const context = buildSearchContext();
            const result = runSearchOnComments('', param, getRemoteSearch(state).results, context, {
                preferPublishedAtOrder: true
            });
            // Preserve the user's query on the result so render-side highlighting still works.
            result.query = query;

            const stateAccessor = getInstantResultAccessor();
            renderCommentsResult(selector, result, {
                stateAccessor,
                onLocalBatchExhausted: () => renderInstantShowMore(selector, query)
            });
            finalizeCommentsRender(result, stateAccessor, query);

            return result;
        };

        if (elTranscriptLangMenu instanceof HTMLElement) {
            dropdownMenus.add(elTranscriptLangMenu);
            setMenuVisibility(elTranscriptLangMenu, false);
        }

        const runChatPipeline = (selector: string, query: string, param?: IParamSearch) => {
            const context = buildSearchContext();
            const result = runChatSearch(query, param, state, context);

            renderChatResult(selector, result);

            state = setSearchCount(state, 'commentsChat', result.total);

            const elsGotoChatVideo = document.getElementById('ycs_wrap_comments_chat');

            if (elsGotoChatVideo) {
                elsGotoChatVideo.addEventListener('click', (event) => {
                    try {
                        const target = event.target as HTMLElement | null;
                        if (!target) return;

                        const isChatVideo = target.classList.contains('ycs-gotochat-video');
                        const isCommentTime = target.classList.contains('ycs-goto-comment-time');

                        if (!isChatVideo && !isCommentTime) return;

                        event.preventDefault();

                        const elFrameVideo = document.getElementsByTagName('video')[0];
                        if (elFrameVideo) {
                            navigateVideoToTimestamp(target, elFrameVideo);
                        }
                    } catch (error) {
                        console.error(error);
                    }
                });
            }

            return result;
        };

        const runTranscriptPipeline = (selector: string, query: string, param?: IParamSearch) => {
            const context = buildSearchContext();
            const result = runTranscriptSearch(query, param, state, context);

            renderTranscriptResult(selector, result);

            state = setSearchCount(state, 'commentsTrVideo', result.total);

            const elsGotoVideo = document.getElementById('ycs_wrap_comments_trvideo');

            if (elsGotoVideo) {
                elsGotoVideo.addEventListener('click', (event) => {
                    try {
                        const target = event.target as HTMLElement | null;
                        if (!target?.classList.contains('ycs-goto-video')) return;

                        event.preventDefault();

                        const elFrameVideo = document.getElementsByTagName('video')[0];
                        if (elFrameVideo) {
                            const ms = target.dataset.offsetvideo;
                            if (ms) {
                                elFrameVideo.currentTime = parseInt(ms, 10) / 1000;
                            }
                        }
                    } catch (error) {
                        console.error(error);
                    }
                });
            }

            return result;
        };
        const searchCommentsAll = async (selector: string, param?: IParamSearch): Promise<void> => {
            const elSearchAll = document.querySelector(selector);
            const comments = getComments(state);
            const commentsChat = getCommentsChat(state);
            const commentsTrVideo = getCommentsTrVideo(state);
            const query = getSearchQuery();

            /**
             * Filter support matrix:
             * - Comments: All filters supported (author, donated, members, verified, heart, likes, replied, links, timestamp, random)
             * - Chat: Supports author, donated, members, verified, links, timestamp, sortFirst
             * - Transcript: Only supports links, timestamp, sortFirst
             *
             * This conditional rendering ensures:
             * 1. Chat is hidden when using filters it doesn't support (heart, likes, replied, random)
             * 2. Transcript is hidden when using filters it doesn't support (all except links, timestamp, sortFirst)
             * 3. All sources are shown when no filter is applied or when using sortFirst
             */

            const hasChatUnsupportedFilter = CHAT_UNSUPPORTED_FILTERS.some((filter) => param?.[filter]);
            const shouldRenderChat = !param || param.sortFirst === true || !hasChatUnsupportedFilter;

            const hasTranscriptUnsupportedFilter = TRANSCRIPT_UNSUPPORTED_FILTERS.some((filter) => param?.[filter]);
            const shouldRenderTranscript = !param || param.sortFirst === true || !hasTranscriptUnsupportedFilter;

            if (elSearchAll) elSearchAll.textContent = '';

            const elWrapComments = document.createElement('div');
            elWrapComments.id = 'ycs_allsearch__wrap_comments';

            const elWrapCommentsChat = document.createElement('div');
            elWrapCommentsChat.id = 'ycs_allsearch__wrap_comments_chat';

            const elWrapCommentsTrVideo = document.createElement('div');
            elWrapCommentsTrVideo.id = 'ycs_allsearch__wrap_comments_trvideo';

            state = resetSearchCounts(state);

            let usedInstantComments = false;

            try {
                if (comments.length > 0) {
                    elSearchAll?.appendChild(elWrapComments);
                    runCommentsPipeline('#ycs_allsearch__wrap_comments', query, param);
                } else if (shouldUseInstantSearch(query, state)) {
                    elSearchAll?.appendChild(elWrapComments);
                    usedInstantComments = await runInstantCommentsFlow('#ycs_allsearch__wrap_comments', query, param);
                } else if (!query.trim() && isInstantBrowseMode(state)) {
                    usedInstantComments = await runInstantCommentsFlow('#ycs_allsearch__wrap_comments', query, param);
                }

                if (shouldRenderChat && commentsChat.size > 0) {
                    elSearchAll?.appendChild(elWrapCommentsChat);
                    runChatPipeline('#ycs_allsearch__wrap_comments_chat', query, param);
                }

                if (shouldRenderTranscript && getCueGroupCount(commentsTrVideo) > 0) {
                    elSearchAll?.appendChild(elWrapCommentsTrVideo);
                    runTranscriptPipeline('#ycs_allsearch__wrap_comments_trvideo', query, param);
                }

                const searchCounts = getSearchCounts(state);
                const resTotalSearch = searchCounts.comments + searchCounts.commentsChat + searchCounts.commentsTrVideo;

                let resultText = '';
                if (param?.timestamp) {
                    resultText = `Time stamps, found: ${resTotalSearch}`;
                } else if (param?.author) {
                    resultText = `Author, found: ${resTotalSearch}`;
                } else if (param?.heart) {
                    resultText = `Heart, found: ${resTotalSearch}`;
                } else if (param?.verified) {
                    resultText = `Verified authors, found: ${resTotalSearch}`;
                } else if (param?.links) {
                    resultText = `Links, found: ${resTotalSearch}`;
                } else if (param?.likes) {
                    resultText = `Likes, found: ${resTotalSearch}`;
                } else if (param?.replied) {
                    resultText = `Replied, found: ${resTotalSearch}`;
                } else if (param?.members) {
                    resultText = `Members, found: ${resTotalSearch}`;
                } else if (param?.donated) {
                    resultText = `Donated, found: ${resTotalSearch}`;
                } else if (param?.random) {
                    resultText = `Random, found: ${resTotalSearch}`;
                } else if (param?.sortFirst) {
                    resultText = `All comments, found: ${resTotalSearch}`;
                } else {
                    resultText = `(All) Found: ${resTotalSearch}`;
                }

                const hasOtherSources =
                    (shouldRenderChat && commentsChat.size > 0) ||
                    (shouldRenderTranscript && getCueGroupCount(commentsTrVideo) > 0);

                const remoteSession = getRemoteSearch(state);
                const instantChipVisible =
                    usedInstantComments && remoteSession.active && remoteSession.results.length > 0;

                if (instantChipVisible && hasOtherSources) {
                    // Keep the ⚡ Instant chip visible instead of overwriting it with plain text
                    // once other sources (chat/transcript) are also rendered — the combined count
                    // includes API-fetched comments and must stay marked as instant.
                    updateInstantStatusHtml(buildInstantAllModeStatusHtml(resultText));
                } else if (!usedInstantComments || hasOtherSources) {
                    updateTotalResultDisplay(resultText);
                }
                // instantChipVisible && !hasOtherSources: chip already rendered by runInstantCommentsFlow.
            } catch (err) {
                console.error(err);
            }
        };
        if (btnSearch) {
            btnSearch.addEventListener('click', (): void => {
                // keep current active filter when performing a generic Search

                const elSelectOptSearch = document.getElementById('ycs_search_select') as HTMLSelectElement;

                if (elSelectOptSearch) {
                    const activeParam = getActiveFilterParam();
                    executeSearchBasedOnType(activeParam);
                }

                return;
            });
        }

        window.postMessage({ type: 'GET_OPTIONS' }, window.location.origin);

        handleMessageEvent = (e: MessageEvent<ExtensionMessagePayload>): void => {
            // console.log('EVENT MESSAGE e: ', e);

            if (e.origin !== window.location.origin) return;

            if (e.data?.type === 'YCS_OPTIONS' && e.data?.text) {
                console.log('YCS_OPTIONS', e.data);

                const optMaxComments = (value: number): void => {
                    try {
                        GlobalStore.maxComments = value;
                    } catch (err) {
                        console.error(err);
                    }
                };

                const optAutoload = (value: boolean): void => {
                    if (value === true) {
                        if (shouldSkipAutoload()) return;
                        GlobalStore.autoload = true;
                        elLoadAll?.click();
                    }
                };

                const wrapOptAutoload = (value: boolean, opts: IYCSOptions): void => {
                    if (!opts.cache) {
                        if (value && shouldSkipAutoload(opts)) return;
                        optAutoload(value);
                    }
                };

                const optHighlightText = (value: boolean): void => {
                    try {
                        GlobalStore.highlightText = value;
                    } catch (err) {
                        console.error(err);
                    }
                };

                const optHighlightExact = (value: boolean): void => {
                    try {
                        GlobalStore.highlightExact = value;
                    } catch (err) {
                        console.error(err);
                    }
                };

                const optCached = (value: boolean): void => {
                    try {
                        if (!value) return;

                        loadFromCache(window.location.href);
                    } catch (err) {
                        console.error(err);
                    }
                };

                const optSortTimestamp = (value: boolean): void => {
                    try {
                        GlobalStore.sortTimestamp = value;
                    } catch (err) {
                        console.error(err);
                    }
                };

                const optAutoExpandReplyContext = (value: boolean): void => {
                    try {
                        GlobalStore.autoExpandReplyContext = value;
                    } catch (err) {
                        console.error(err);
                    }
                };

                const optHiddenByDefault = (opts: IYCSOptions): void => {
                    try {
                        const app = document.querySelector('.ycs-app') as HTMLElement;
                        if (!app) return;

                        // Use hiddenByDefaultShorts for Shorts pages, hiddenByDefault for regular video pages
                        const value = isShortsPage()
                            ? Boolean(opts.hiddenByDefaultShorts)
                            : Boolean(opts.hiddenByDefault);

                        // Apply collapsed state instead of fully hiding the app to keep the top toggle visible
                        app.classList.toggle('ycs-collapsed', value);
                        // Recalculate height when app visibility changes on Shorts pages
                        if (isShortsPage()) {
                            setTimeout(() => {
                                adjustSearchResultHeightForShorts();
                                adjustEngagementPanelHeightForShorts();
                            }, 100);
                        }
                    } catch (err) {
                        console.error(err);
                    }
                };

                const optSidebarByDefault = (opts: IYCSOptions): void => {
                    try {
                        if (!opts.sidebarByDefault || isShortsPage() || isPostsPage()) return;

                        const app = document.querySelector('.ycs-app') as HTMLElement;
                        if (app && !app.classList.contains('ycs-in-sidebar')) {
                            moveYcsToSidebar();
                        }
                    } catch (err) {
                        console.error(err);
                    }
                };

                try {
                    const opts = (e.data.text ?? {}) as IYCSOptions;

                    // Check enableShortsSupport for Shorts pages
                    if (isShortsPage() && opts.enableShortsSupport === false) {
                        cleanupShortsUI();
                        return;
                    }

                    // Set following options first before autoload
                    if (typeof opts.maxComments !== 'undefined') {
                        optMaxComments(Number(opts.maxComments));
                    }
                    if (typeof opts.hasYoutubeApiKey !== 'undefined') {
                        GlobalStore.hasYoutubeApiKey = Boolean(opts.hasYoutubeApiKey);
                    }
                    if (typeof opts.youtubeApiEnabled !== 'undefined') {
                        GlobalStore.youtubeApiEnabled = Boolean(opts.youtubeApiEnabled);
                    }
                    if (typeof opts.youtubeApiInstantSearch !== 'undefined') {
                        GlobalStore.youtubeApiInstantSearch = opts.youtubeApiInstantSearch !== false;
                    } else {
                        GlobalStore.youtubeApiInstantSearch = true;
                    }
                    syncInstantSearchPlaceholder();
                    if (typeof opts.transcriptLanguage !== 'undefined') {
                        state = setSelectedTranscriptLanguage(
                            state,
                            typeof opts.transcriptLanguage === 'string' && opts.transcriptLanguage.trim()
                                ? opts.transcriptLanguage.trim()
                                : undefined
                        );
                    }

                    (Object.keys(opts) as Array<keyof IYCSOptions>).forEach((key) => {
                        switch (key) {
                            case 'autoload':
                                wrapOptAutoload(Boolean(opts.autoload), opts);
                                break;

                            case 'highlightText':
                                optHighlightText(Boolean(opts.highlightText));
                                break;
                            case 'highlightExact':
                                optHighlightExact(Boolean(opts.highlightExact));
                                break;

                            case 'cache':
                                optCached(Boolean(opts.cache));
                                break;

                            case 'sortTimestamp':
                                optSortTimestamp(Boolean(opts.sortTimestamp));
                                break;

                            case 'autoExpandReplyContext':
                                optAutoExpandReplyContext(Boolean(opts.autoExpandReplyContext));
                                break;

                            case 'hiddenByDefault':
                                optHiddenByDefault(opts);
                                break;

                            case 'sidebarByDefault':
                                optSidebarByDefault(opts);
                                break;

                            case 'hiddenByDefaultShorts':
                                optHiddenByDefault(opts);
                                break;

                            case 'enableShortsSupport':
                                if (isShortsPage() && opts.enableShortsSupport === false) {
                                    cleanupShortsUI();
                                }
                                break;

                            case 'filterButtons':
                                if (opts.filterButtons) {
                                    // First reload button panel
                                    loadFilterButtons(opts.filterButtons);
                                    // Then re-initialize button configuration (bind events)
                                    initFilterButtons(opts.filterButtons);
                                }
                                break;
                            default:
                                break;
                        }
                    });
                } catch (err) {
                    console.error(err);
                }
            }

            if (e.data?.type === 'YCS_CACHE_STORAGE_GET_RESPONSE') {
                if (e.data?.body) {
                    const body = e.data.body as CacheStorageBody;

                    // Validate cache videoId matches current video to prevent stale data from wrong video
                    const currentVideoId = getVideoId(window.location.href);
                    if (body.videoId && currentVideoId && body.videoId !== currentVideoId) {
                        console.warn(
                            '[YCS] Cache videoId mismatch, ignoring stale cache:',
                            body.videoId,
                            '!==',
                            currentVideoId
                        );
                        return;
                    }

                    const cachedComments = Array.isArray(body.comments) ? (body.comments as CommentItem[]) : [];
                    try {
                        // Rebuild reply-to-origin mapping using a single-pass index to reduce complexity from O(n^2) to O(n)
                        // Support all levels of nesting by including all comment IDs in the lookup map
                        if (cachedComments.length > 0) {
                            const originById: Record<string, CommentItem> = {};
                            for (const c of cachedComments) {
                                const id = c?.commentRenderer?.commentId || (c as any)?.commentId;
                                if (typeof id === 'string' && id.length > 0) {
                                    originById[id] = c;
                                }
                            }

                            for (const cmnt of cachedComments) {
                                if (cmnt?.typeComment === 'R') {
                                    const refId =
                                        cmnt?.originComment?.commentRenderer?.commentId ||
                                        cmnt?.originComment?.commentId;
                                    if (typeof refId === 'string' && refId.length > 0) {
                                        const origin = originById[refId];
                                        if (origin) cmnt.originComment = origin;
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        console.error(err);
                    }
                    state = setComments(state, cachedComments);
                    state = resetRemoteSearch(state);
                    syncInstantDegradedControls(false);
                    syncInstantSearchPlaceholder();

                    const chatEntries = JSON.parse(body.commentsChat || '[]') as Array<[number, ChatItem]>;
                    state = setCommentsChat(state, new Map<number, ChatItem>(chatEntries));
                    state = setChatSource(state, body.chatSource);
                    state = setCommentsTrVideo(state, body.commentsTrVideo);

                    // Restore GlobalStore.getInitYtData with minimal structure for author filter
                    if (body.channelId) {
                        GlobalStore.getInitYtData = {
                            playerResponse: {
                                videoDetails: {
                                    channelId: body.channelId
                                }
                            }
                        };
                    }

                    const crdate = body.date;
                    const comments = getComments(state);
                    const commentsChat = getCommentsChat(state);
                    const commentsTrVideo = getCommentsTrVideo(state);

                    // comments
                    const elStatusCmnts = document.getElementById('ycs_status_cmnt');
                    if (comments.length > 0 && elStatusCmnts) {
                        elStatusCmnts.innerHTML = iconOk();
                    }

                    if (comments.length > 0 && (elLiveApp.parentNode || elLiveApp.parentElement)) {
                        state = setCount(state, 'comments', comments.length);
                    }

                    const elLoadCmnts = document.getElementById('ycs_cmnts');
                    if (elLoadCmnts) {
                        elLoadCmnts.textContent = `${comments.length}`;
                    }

                    // end comments

                    // chat

                    if (commentsChat.size > 0) {
                        const elLoadChat = document.getElementById('ycs_cmnts_chat') as HTMLElement;
                        const elStatusChat = document.getElementById('ycs_status_chat') as HTMLElement;
                        elLoadChat.textContent = commentsChat.size.toString();
                        elStatusChat.innerHTML = iconOk();
                    }

                    if (commentsChat.size > 0 && (elLiveApp.parentNode || elLiveApp.parentElement)) {
                        state = setCount(state, 'commentsChat', commentsChat.size);
                    }

                    // end chat

                    // Tr. video

                    const transcriptGroupCount = getCueGroupCount(commentsTrVideo);
                    if (transcriptGroupCount > 0) {
                        const elStatusTrVideo = document.getElementById('ycs_status_trvideo') as HTMLElement;
                        const elLoadTrVideo = document.getElementById('ycs_cmnts_video') as HTMLElement;

                        showLoadComments(transcriptGroupCount, elLoadTrVideo);
                        elStatusTrVideo.innerHTML = iconOk();
                    }

                    if (transcriptGroupCount > 0 && (elLiveApp.parentNode || elLiveApp.parentElement)) {
                        state = setCount(state, 'commentsTrVideo', transcriptGroupCount);
                    }

                    // end tr. video

                    const counts = getCounts(state);
                    const totalCount = counts.comments + counts.commentsChat + counts.commentsTrVideo;
                    updateBadge('NUMBER_COMMENTS', totalCount);

                    updateTitleCount(totalCount);
                    appendCachedInfoToCounters(crdate);
                } else {
                    if (!shouldSkipAutoload()) {
                        window.postMessage({ type: 'YCS_AUTOLOAD' }, window.location.origin);
                    } else {
                        syncInstantSearchPlaceholder();
                    }
                }
            }

            if (e.data?.type === 'YCS_AUTOLOAD') {
                if (shouldSkipAutoload()) return;
                GlobalStore.autoload = true;
                elLoadAll?.click();
            }
        };

        window.addEventListener('message', handleMessageEvent);

        initShowBarFAQ();
        initShowViewMode();

        // elExtSearch is now declared at the top of app() function for accessibility
        if (elExtSearch) {
            const elExtSearchTitle = document.getElementById('ycs_extended_search_title') as HTMLInputElement;
            const elExtSearchMain = document.getElementById('ycs_extended_search_main') as HTMLInputElement;

            elExtSearch?.addEventListener('click', () => {
                try {
                    if (elExtSearch?.checked) {
                        if (elExtSearchTitle && elExtSearchMain) {
                            elExtSearchTitle.disabled = false;
                            elExtSearchMain.disabled = false;
                        }
                    } else {
                        if (elExtSearchTitle && elExtSearchMain) {
                            elExtSearchTitle.disabled = true;
                            elExtSearchMain.disabled = true;
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
            });
        }
    }

    const runAppAndCheckRender = (): boolean => {
        try {
            app();
            return Boolean(document.querySelector('.ycs-app'));
        } catch (error) {
            console.error('YCS: app() execution failed', error);
            return false;
        }
    };

    // Store app() reference for retry mechanism in polling
    // This allows retrying rendering without re-initializing listeners/intervals
    appFunction = runAppAndCheckRender;

    function startObserve(): void {
        // Clean up old interval if it exists (prevents memory leaks on re-initialization)
        if (observeIntervalId !== null) {
            if (DEBUG) {
                console.log('YCS: Clearing old startObserve interval, ID:', observeIntervalId);
            }
            clearInterval(observeIntervalId);
            observeIntervalId = null;
        }

        let prevUrl = getCleanUrlVideo(window.location.href) ?? window.location.href;
        let pendingUrl: string | null = null;
        // console.log('prevUrl First init: ', prevUrl);

        // Store interval ID for cleanup on next initApp() call
        observeIntervalId = setInterval(() => {
            // Abort pending requests when leaving video page
            // This handles the case: video page -> non-video page (e.g., homepage) -> back to video
            if (!isVideoPage() && prevUrl) {
                getController(state).abort();
                state = resetController(state);
                prevUrl = '';
                console.log('[YCS] Left video page, aborted pending requests');
                return;
            }

            if (
                isVideoPage() &&
                getPageMetaElement() &&
                prevUrl !== (getCleanUrlVideo(window.location.href) ?? window.location.href)
            ) {
                const currentUrl = getCleanUrlVideo(window.location.href) ?? window.location.href;
                if (pendingUrl === currentUrl) {
                    return;
                }
                pendingUrl = currentUrl;

                // Stop live recording if active (video switch detected)
                const liveRecording = getLiveRecording(state);
                if (liveRecording.isRecording) {
                    console.log('[YCS] Video switch detected, stopping live recording...');
                    // Clear timeout/intervals
                    if (liveRecording.pollTimeoutId !== null) {
                        clearTimeout(liveRecording.pollTimeoutId);
                    }
                    if (liveRecording.timerIntervalId !== null) {
                        clearInterval(liveRecording.timerIntervalId);
                    }

                    // Save final chat data to cache before video switch
                    // Use prevUrl (old video) instead of window.location.href (new video)
                    const commentsChat = getCommentsChat(state);
                    const oldVideoId = prevUrl ? getVideoId(prevUrl) : null;
                    if (commentsChat.size > 0 && oldVideoId && prevUrl) {
                        saveToCache(
                            {
                                videoId: oldVideoId,
                                comments: getComments(state),
                                commentsChat: JSON.stringify(Array.from(commentsChat.entries())),
                                commentsTrVideo: getCommentsTrVideo(state),
                                channelId: extractChannelId(),
                                chatSource: getChatSource(state)
                            },
                            { url: prevUrl, title: document.title }
                        );
                        console.log('[YCS] Saved', commentsChat.size, 'chat messages for old video before switch');
                    }

                    // Abort controller BEFORE resetting to stop pending requests
                    getController(state).abort();
                    state = resetLiveRecording(state);
                }

                // Note: If recording was active, controller was already aborted above
                // If not recording, abort here before calling app()
                if (!liveRecording.isRecording) {
                    getController(state).abort();
                }
                const didRender = runAppAndCheckRender();
                pendingUrl = null;

                // Only update prevUrl after confirming .ycs-app was successfully created
                // If DOM insertion failed, next interval tick will retry
                if (didRender) {
                    prevUrl = currentUrl;
                    if (DEBUG) {
                        console.log('YCS: Video switch successful, prevUrl updated to:', prevUrl);
                    }
                } else if (DEBUG) {
                    console.log('YCS: .ycs-app not found after app(), will retry on next interval');
                }
            }
        }, 1000);

        if (DEBUG) {
            console.log('YCS: startObserve interval created, ID:', observeIntervalId);
        }
    }

    startObserve();

    if (isVideoPage()) {
        runAppAndCheckRender();
    }
}
