import 'abort-controller/polyfill';

import {
    GlobalStore,
    extractChannelId,
    getCleanUrlVideo,
    getVideoId,
    isVideoPage,
    extractVideoDuration
} from '../utils/common';
import {
    initShowBarFAQ,
    initShowViewMode,
    navigateVideoToTimestamp,
    removeNodeList,
    showLoadComments
} from '../utils/dom';
import { getAllCommentsModeV2, getChatComments, getTranscriptTracks, getTranscriptVideo } from '../utils/innertube';

import { IParamSearch, ISelectedSearch, IYCSOptions } from '../utils/interfaces/i_types';
import type {
    ChatItem,
    CommentItem,
    TranscriptCueGroup,
    TranscriptData,
    TranscriptTrackInfo
} from '../utils/interfaces/i_types';

import { iconOk, iconReload } from '../utils/icons';
import { renderLoadComments, renderSearch, loadFilterButtons } from '../utils/renderView';
import { loadFromCache, saveToCache, updateBadge } from './services/cacheService';
import type { CacheData } from './services/cacheService';
import {
    downloadChatFile,
    downloadCommentsFile,
    downloadTranscriptFile,
    openChatWindow,
    openCommentsWindow,
    openTranscriptWindow,
    ExportMeta,
    downloadCommentsFileJSON,
    downloadCommentsFileXLSX,
    downloadChatFileJSON,
    downloadChatFileXLSX,
    downloadTranscriptFileJSON,
    downloadTranscriptFileXLSX,
    EXPORT_FORMAT
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
    getTranscriptTracks as getStateTranscriptTracks,
    getCounts,
    getSearchCounts,
    resetController,
    resetSearchCounts,
    setComments,
    setCommentsChat,
    setCommentsTrVideo,
    setSelectedTranscriptLanguage,
    setTranscriptTracks,
    setCount,
    setSearchCount,
    WebResourcesState
} from './state';
import {
    FILTER_BUTTONS,
    FilterButtonRegistry,
    FilterParamKey,
    registerFilterButtons,
    getDynamicFilterButtonConfigs
} from './ui/filters';
import { registerCommentInteractions } from './ui/commentInteractions';
import { runSearch as runCommentsSearch, clearCommentsFuseCache } from './search/commentsSearch';
import { runSearch as runChatSearch, clearChatFuseCache } from './search/chatSearch';
import { runSearch as runTranscriptSearch, clearTranscriptFuseCache } from './search/transcriptSearch';
import {
    extractTimestamps,
    createTimeIntervals,
    aggregateTimestamps,
    filterCommentsByInterval,
    formatTime
} from './search/timestampAnalysis';
import { showFloatingButton } from './ui/timestampFloatingButton';
import { renderTimestampChart } from './ui/timestampChart';
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

const isExportFormat = (value: string | undefined): value is ExportFormat => {
    return value === EXPORT_FORMAT.TXT || value === EXPORT_FORMAT.JSON || value === EXPORT_FORMAT.XLSX;
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

const extractCueGroups = (transcript?: TranscriptData | null): TranscriptCueGroup[] | undefined => {
    return transcript?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.body
        ?.transcriptBodyRenderer?.cueGroups as TranscriptCueGroup[] | undefined;
};

const getCueGroupCount = (transcript?: TranscriptData | null): number => {
    return extractCueGroups(transcript)?.length ?? 0;
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

let appFunction: (() => void) | null = null;
let observeIntervalId: ReturnType<typeof setInterval> | null = null;

export function retryApp(): boolean {
    if (!appFunction) {
        return false;
    }

    try {
        appFunction();
        return true;
    } catch (error) {
        console.error('YCS: app() retry failed', error);
        return false;
    }
}

export function initApp(): void {
    let handleMessageEvent: ((ev: MessageEvent<ExtensionMessagePayload>) => void) | null = null;

    let state = createState();

    function app(): void {
        if (!isVideoPage()) return;

        // Clear GlobalStore to prevent data leakage across videos
        delete GlobalStore.getInitYtData;

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

        state = createState();

        updateBadge('NUMBER_COMMENTS', '');

        removeNodeList('.ycs-app');
        dropdownMenus.clear();
        if (handleDocumentClick) {
            document.removeEventListener('click', handleDocumentClick);
            handleDocumentClick = null;
        }

        // Try new insertion points first (between expandable-metadata and ticket-shelf)
        if (document.querySelector('#expandable-metadata.ytd-watch-flexy')) {
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

        const elSearch = document.getElementById('ycs-search');
        if (elSearch) {
            renderSearch(elSearch);
            // Initial button loading (using default settings)
            loadFilterButtons();
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

        // Helper function to manage #ycs-search-total-result element visibility and content
        // This ensures consistent behavior across all search functions
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
        };

        const getSearchQuery = (): string => {
            const inputSearch = document.getElementById('ycs-input-search') as HTMLInputElement | null;
            return inputSearch?.value ?? '';
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

                // toggle clear-filter button visibility
                const btnClear = document.getElementById('ycs_btn_clear') as HTMLButtonElement | null;
                if (btnClear) {
                    const hasActive = !!param;
                    btnClear.style.visibility = hasActive ? 'visible' : 'hidden';
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

        const executeSearchBasedOnType = (param?: IParamSearch, forceType?: ISelectedSearch): void => {
            const elSelectOptSearch = document.getElementById('ycs_search_select') as HTMLSelectElement | null;
            const query = getSearchQuery();

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
                    const result = runCommentsPipeline('#ycs-search-result', query, param);
                    updateTotalResultDisplay(result.summary);
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
                    searchCommentsAll('#ycs-search-result', param);
                    break;
                }
            }
        };

        const handleTimestampViz = (): void => {
            try {
                const comments = getComments(state);
                if (!comments || comments.length === 0) {
                    const container = document.getElementById('ycs-search-result');
                    if (container) {
                        container.innerHTML =
                            '<div class="ycs-timestamp-chart"><div class="ycs-chart-title">No comments loaded</div></div>';
                    }
                    updateTotalResultDisplay('No comments available for timestamp analysis');
                    return;
                }

                // Get search query and filter comments if needed
                const query = getSearchQuery();
                let filteredComments = comments;

                if (query.trim()) {
                    // Use existing search logic to filter comments by search query
                    const context: SearchContext = {
                        extendedSearch: { enabled: false, title: false, main: false },
                        sortOrders: { comments: {}, chat: {}, transcript: {} }
                    };
                    const searchResult = runCommentsSearch(query.trim(), {}, state, context);
                    filteredComments = searchResult.results.map((result) => result.item as CommentItem);
                }

                // Extract timestamps from filtered comments
                const timestamps = extractTimestamps(filteredComments);
                if (timestamps.length === 0) {
                    const container = document.getElementById('ycs-search-result');
                    if (container) {
                        container.innerHTML = `<div class="ycs-timestamp-chart"><div class="ycs-chart-title">No timestamps found in comments</div></div>`;
                    }
                    updateTotalResultDisplay(`No timestamps found in comments`);
                    return;
                }

                // Get video duration
                const videoDurationMs = extractVideoDuration();
                if (!videoDurationMs) {
                    const container = document.getElementById('ycs-search-result');
                    if (container) {
                        container.innerHTML =
                            '<div class="ycs-timestamp-chart"><div class="ycs-chart-title">Unable to get video duration</div></div>';
                    }
                    updateTotalResultDisplay('Unable to get video duration');
                    return;
                }

                // Create time intervals
                const intervals = createTimeIntervals(timestamps, videoDurationMs);
                const intervalData = aggregateTimestamps(timestamps, intervals);

                // Create result container for interval results
                const container = document.getElementById('ycs-search-result');
                if (container) {
                    // Clear previous results
                    container.innerHTML = '';

                    // Create chart container
                    const chartContainer = document.createElement('div');
                    chartContainer.id = 'ycs-timestamp-chart-container';

                    // Create results container
                    const resultsContainer = document.createElement('div');
                    resultsContainer.id = 'ycs-timestamp-interval-results';

                    container.appendChild(chartContainer);
                    container.appendChild(resultsContainer);

                    // Update statistics after DOM is updated
                    const totalTimestamps = timestamps.length;
                    const totalIntervals = intervals.length;
                    updateTotalResultDisplay(`Found ${totalTimestamps} timestamps across ${totalIntervals} intervals`);

                    // Render chart with click handler
                    renderTimestampChart(
                        chartContainer,
                        intervalData,
                        videoDurationMs,
                        filteredComments,
                        (startMs: number, endMs: number) => {
                            // Filter comments by interval
                            const intervalComments = filterCommentsByInterval(filteredComments, startMs, endMs);

                            // Convert to ICommentsFuseResult format
                            const fuseResults = intervalComments.map((comment, index) => {
                                const originalIndex = Number((comment as any)?._index);
                                return {
                                    item: comment,
                                    refIndex: Number.isFinite(originalIndex) ? originalIndex : index,
                                    score: 0
                                };
                            });

                            // Create search result object
                            const searchResult = {
                                results: fuseResults,
                                total: intervalComments.length,
                                summary: `${intervalComments.length} items in ${formatTime(startMs)} - ${formatTime(endMs)}`,
                                query: query.trim(),
                                buttonStates: {}
                            };

                            // Render results
                            renderCommentsResult('#ycs-timestamp-interval-results', searchResult);

                            // Update statistics display with the interval summary
                            updateTotalResultDisplay(searchResult.summary);

                            // Register comment interactions for the new results
                            const resultsContainer = document.getElementById('ycs-timestamp-interval-results');
                            if (resultsContainer) {
                                registerCommentInteractions(
                                    resultsContainer,
                                    {
                                        getComments: () => getComments(state)
                                    },
                                    () => query.trim()
                                );
                            }

                            // Scroll to results and show floating button
                            const searchResultContainer = document.getElementById('ycs-search-result');
                            if (searchResultContainer) {
                                // Find the results container and scroll to it
                                const resultsContainer = document.getElementById('ycs-timestamp-interval-results');
                                if (resultsContainer) {
                                    // Calculate the position of the results container relative to the scrollable container
                                    const containerRect = searchResultContainer.getBoundingClientRect();
                                    const resultsRect = resultsContainer.getBoundingClientRect();
                                    const scrollTop =
                                        searchResultContainer.scrollTop + (resultsRect.top - containerRect.top);

                                    // Scroll to the results container
                                    searchResultContainer.scrollTop = scrollTop;
                                }
                                showFloatingButton(searchResultContainer, startMs, endMs, intervalComments.length);
                            }
                        }
                    );
                }
            } catch (error) {
                console.error('Error in handleTimestampViz:', error);
                const container = document.getElementById('ycs-search-result');
                if (container) {
                    container.innerHTML =
                        '<div class="ycs-timestamp-chart"><div class="ycs-chart-title">Error generating timestamp chart</div></div>';
                }
                updateTotalResultDisplay('Error generating timestamp chart');
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

                        const eInputSearch = document.getElementById('ycs-input-search') as HTMLInputElement;

                        if (eInputSearch?.value && eInputSearch.value.trim()) {
                            requestAnimationFrame(() => {
                                const searchBtn = document.getElementById('ycs_btn_search');
                                searchBtn?.click();
                            });
                        } else {
                            const elSearchRes = document.getElementById('ycs-search-result');
                            const elSearchTotalRes = document.getElementById(
                                'ycs-search-total-result'
                            ) as HTMLElement | null;

                            if (elSearchRes && elSearchTotalRes) {
                                elSearchRes.innerText = '';
                                elSearchTotalRes.innerText = 'Search cleared';
                            }
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
        };

        initFilterButtons();
        // No restore from storage; ensure clear button hidden initially
        try {
            const btnClearInit = document.getElementById('ycs_btn_clear') as HTMLButtonElement | null;
            if (btnClearInit) btnClearInit.style.visibility = 'hidden';
        } catch {
            // Silently ignore DOM initialization errors
        }

        const elLiveApp = document.getElementsByClassName('ycs-app')[0];

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

        const buildCacheMeta = () => ({
            url: window.location.href,
            title: document.title
        });

        const buildExportMeta = (): ExportMeta => {
            const videoUrl = getCleanUrlVideo(window.location.href);

            return {
                url: videoUrl ?? window.location.href,
                title: document.title,
                generatedAt: new Date()
            };
        };

        const appendCachedInfo = (timestamp: number | string | null | undefined): void => {
            const cacheTitle = new Date(timestamp as number | string);
            const targets: (HTMLElement | null)[] = [elCountComments, elCountCommentsCollapsed];

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

        const clearButtonLabelDataset = (button: HTMLButtonElement): void => {
            if (!button) return;
            if (button.dataset.labelHtml !== undefined) {
                delete button.dataset.labelHtml;
                button.removeAttribute('data-label-html');
            }
        };

        const elLoadComments = document.getElementById('ycs-load-cmnts');
        if (elLoadComments) {
            elLoadComments.addEventListener('click', async function (e: MouseEvent): Promise<void> {
                if (!elLiveApp.parentNode || !elLiveApp.parentElement) return;

                // Capture URL and videoId at the start of async operation
                const startUrl = window.location.href;
                const startVideoId = getVideoId(startUrl);

                state = clearComments(state);
                const comments = getComments(state);

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

                        await getAllCommentsModeV2(elLoadCmnts, controller.signal, comments);

                        // Verify video hasn't changed before saving cache
                        const currentVideoId = getVideoId(window.location.href);
                        if (startVideoId && currentVideoId && startVideoId !== currentVideoId) {
                            console.warn(
                                '[YCS] Video changed during comment loading, skipping cache save:',
                                startVideoId,
                                '→',
                                currentVideoId
                            );
                            return;
                        }

                        if (comments.length > 0) {
                            elStatusCmnts.innerHTML = iconOk();
                            saveToCache(
                                {
                                    videoId: startVideoId,
                                    comments,
                                    commentsChat: JSON.stringify(Array.from(getCommentsChat(state).entries())),
                                    commentsTrVideo: getCommentsTrVideo(state),
                                    channelId: extractChannelId()
                                },
                                buildCacheMeta()
                            );
                        }
                    }

                    if (comments.length > 0) {
                        state = setCount(state, 'comments', comments.length);
                    }

                    const counts = getCounts(state);
                    const totalCount = counts.comments + counts.commentsChat + counts.commentsTrVideo;
                    updateBadge('NUMBER_COMMENTS', totalCount);

                    if (elLoadCmnts) {
                        elLoadCmnts.textContent = `${comments.length}`;
                    }

                    updateTitleCount(totalCount);
                } finally {
                    currentTarget.disabled = false;
                    currentTarget.innerText = defaultLabel;
                }
            });
        }

        const elLoadCommentsChat = document.getElementById('ycs-load-chat');
        if (elLoadCommentsChat) {
            elLoadCommentsChat.addEventListener('click', async function (e: MouseEvent): Promise<void> {
                if (!elLiveApp.parentNode || !elLiveApp.parentElement) return;

                // Capture URL and videoId at the start of async operation
                const startUrl = window.location.href;
                const startVideoId = getVideoId(startUrl);

                state = clearCommentsChat(state);
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
                            saveToCache(
                                {
                                    videoId: startVideoId,
                                    comments: getComments(state),
                                    commentsChat: JSON.stringify(Array.from(commentsChat.entries())),
                                    commentsTrVideo: getCommentsTrVideo(state),
                                    channelId: extractChannelId()
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

        const elLoadTranscriptVideo = document.getElementById('ycs-load-transcript-video');
        const elTranscriptLangButton = document.getElementById('ycs_transcript_language');
        const elTranscriptLangMenu = document.getElementById('ycs_transcript_language_menu');

        const loadTranscript = async (trigger: HTMLElement, languageCode?: string): Promise<void> => {
            if (!elLiveApp.parentNode || !elLiveApp.parentElement) return;

            const startUrl = window.location.href;
            const startVideoId = getVideoId(startUrl);

            const currentTarget = trigger as HTMLButtonElement;
            const defaultLabel = currentTarget.innerText;

            clearButtonLabelDataset(currentTarget);

            currentTarget.disabled = true;
            currentTarget.innerText = 'reload';

            try {
                const elStatusTrVideo = document.getElementById('ycs_status_trvideo');
                const elLoadTrVideo = document.getElementById('ycs_cmnts_video');

                if (elLoadTrVideo && elStatusTrVideo) {
                    elLoadTrVideo.textContent = '0';

                    elStatusTrVideo.innerHTML = iconReload();

                    const controller = getController(state);
                    const normalizedLanguage = languageCode?.trim();
                    const preferredLanguage = normalizedLanguage || getSelectedTranscriptLanguage(state);
                    const tr = (await getTranscriptVideo(controller.signal, { languageCode: preferredLanguage })) as
                        | TranscriptData
                        | undefined;
                    state = clearCommentsTrVideo(state);
                    if (getCueGroupCount(tr) > 0) {
                        state = setCommentsTrVideo(state, tr);
                    }

                    const currentVideoId = getVideoId(window.location.href);
                    if (startVideoId && currentVideoId && startVideoId !== currentVideoId) {
                        console.warn(
                            '[YCS] Video changed during transcript loading, skipping cache save:',
                            startVideoId,
                            '→',
                            currentVideoId
                        );
                        return;
                    }

                    try {
                        const transcript = getCommentsTrVideo(state);
                        const cueGroups = extractCueGroups(transcript);
                        if (transcript && elLoadTrVideo && cueGroups && cueGroups.length > 0) {
                            showLoadComments(cueGroups.length, elLoadTrVideo);
                            saveToCache(
                                {
                                    videoId: startVideoId,
                                    comments: getComments(state),
                                    commentsChat: JSON.stringify(Array.from(getCommentsChat(state).entries())),
                                    commentsTrVideo: transcript,
                                    channelId: extractChannelId()
                                },
                                buildCacheMeta()
                            );
                        } else {
                            state = clearCommentsTrVideo(state);
                        }
                    } catch (err) {
                        console.error(err);
                        state = clearCommentsTrVideo(state);
                    }

                    const transcript = getCommentsTrVideo(state);
                    if (getCueGroupCount(transcript) > 0) {
                        elStatusTrVideo.innerHTML = iconOk();
                    }
                }

                if (
                    getCueGroupCount(getCommentsTrVideo(state)) > 0 &&
                    (elLiveApp.parentNode || elLiveApp.parentElement)
                ) {
                    const transcript = getCommentsTrVideo(state);
                    state = setCount(state, 'commentsTrVideo', getCueGroupCount(transcript));
                }

                const counts = getCounts(state);
                const totalCount = counts.comments + counts.commentsChat + counts.commentsTrVideo;
                updateBadge('NUMBER_COMMENTS', totalCount);

                updateTitleCount(totalCount);
            } finally {
                currentTarget.disabled = false;
                currentTarget.innerText = defaultLabel;
            }
        };

        if (elLoadTranscriptVideo) {
            elLoadTranscriptVideo.addEventListener('click', async function (e: MouseEvent): Promise<void> {
                const currentTarget = e.currentTarget as HTMLButtonElement;
                await loadTranscript(currentTarget, getSelectedTranscriptLanguage(state));
            });
        }

        const renderTranscriptLanguageMenu = (tracks: TranscriptTrackInfo[], selected?: string): void => {
            if (!elTranscriptLangMenu) return;

            elTranscriptLangMenu.innerHTML = '';

            if (!tracks.length) {
                const emptyItem = document.createElement('div');
                emptyItem.className = 'ycs_dropdown_item ycs_disabled';
                emptyItem.textContent = 'No languages available';
                elTranscriptLangMenu.appendChild(emptyItem);
                return;
            }

            const createItem = (track: TranscriptTrackInfo | undefined, label: string, value?: string) => {
                const item = document.createElement('div');
                item.className = 'ycs_dropdown_item';
                item.dataset.value = value ?? '';
                item.textContent = label;
                if ((value ?? '') === (selected ?? '')) {
                    item.classList.add('ycs_dropdown_item--active');
                }
                item.addEventListener('click', () => {
                    const normalizedValue = value?.trim();
                    const nextLanguage = normalizedValue ? normalizedValue : undefined;
                    state = setSelectedTranscriptLanguage(state, nextLanguage);
                    closeAllDropdowns();
                    setMenuVisibility(elTranscriptLangMenu, false);
                    if (elLoadTranscriptVideo instanceof HTMLElement) {
                        loadTranscript(elLoadTranscriptVideo, nextLanguage).catch((err) => console.error(err));
                    }
                });
                return item;
            };

            const preferredOption = createItem(undefined, 'Default (YouTube / options)', '');
            elTranscriptLangMenu.appendChild(preferredOption);

            tracks.forEach((track) => {
                const code = track.languageCode ?? '';
                const labelParts = [track.displayName || code];
                if (track.isAutoGenerated) {
                    labelParts.push('(auto)');
                }
                if (code && !labelParts.includes(code)) {
                    labelParts.push(`[${code}]`);
                }
                const label = labelParts.join(' ');
                const item = createItem(track, label, code);
                elTranscriptLangMenu.appendChild(item);
            });
        };

        const handleTranscriptLanguageDropdown = (button: HTMLElement): void => {
            const controller = getController(state);
            let tracks = getStateTranscriptTracks(state) ?? [];
            const selectedLanguage = getSelectedTranscriptLanguage(state);

            const toggleMenu = () => {
                if (!elTranscriptLangMenu) return;
                const shouldShow = !elTranscriptLangMenu.classList.contains('show');
                closeAllDropdowns(elTranscriptLangMenu);
                setMenuVisibility(elTranscriptLangMenu, shouldShow);
            };

            const ensureTracks = async () => {
                if (!tracks.length) {
                    const fetched = await getTranscriptTracks(controller.signal);
                    tracks = fetched ?? [];
                    state = setTranscriptTracks(state, tracks);
                }
                renderTranscriptLanguageMenu(tracks, selectedLanguage);
            };

            button.addEventListener('click', () => {
                const buttonElement = button as HTMLButtonElement;
                const originalText = buttonElement.innerText;
                const originalDisabled = buttonElement.disabled;

                // Set loading state
                buttonElement.disabled = true;
                buttonElement.innerText = 'loading...';

                ensureTracks()
                    .then(() => {
                        // Restore button state
                        buttonElement.disabled = originalDisabled;
                        buttonElement.innerText = originalText;
                        toggleMenu();
                    })
                    .catch((err) => {
                        console.error('Failed to load transcript tracks', err);
                        // Restore button state
                        buttonElement.disabled = originalDisabled;
                        buttonElement.innerText = originalText;
                        renderTranscriptLanguageMenu([], selectedLanguage);
                        toggleMenu();
                    });
            });
        };

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
                    (btnSearchClearText as HTMLButtonElement).style.visibility = hasText ? 'visible' : 'hidden';
                }
            });
        }

        // initialize clear-text button visibility
        if (btnSearchClearText) {
            (btnSearchClearText as HTMLButtonElement).style.visibility =
                (eInputSearch as HTMLInputElement)?.value?.trim()?.length > 0 ? 'visible' : 'hidden';
            btnSearchClearText.addEventListener('click', () => {
                try {
                    if (eInputSearch) {
                        (eInputSearch as HTMLInputElement).value = '';
                    }

                    const activeParam = getActiveFilterParam();
                    const elSearchRes = document.getElementById('ycs-search-result');
                    const elSearchTotalRes = document.getElementById('ycs-search-total-result') as HTMLElement | null;

                    if (activeParam) {
                        // Reapply current filter while only clearing the text query
                        requestAnimationFrame(() => {
                            btnSearch?.click();
                        });
                    } else if (elSearchRes) {
                        elSearchRes.innerText = '';
                        if (elSearchTotalRes) elSearchTotalRes.innerText = 'Search cleared';
                    }

                    // hide clear button after clearing
                    (btnSearchClearText as HTMLButtonElement).style.visibility = 'hidden';
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
                    event.stopPropagation();
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
                openCommentsWindow(comments, buildExportMeta());
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
                downloadCommentsFile(comments, buildExportMeta());
            } else if (format === EXPORT_FORMAT.JSON) {
                downloadCommentsFileJSON(comments, buildExportMeta());
            } else if (format === EXPORT_FORMAT.XLSX) {
                downloadCommentsFileXLSX(comments, buildExportMeta());
            }
        });

        const btnOpenCommentsChatNewWindow = document.getElementById('ycs_open_all_comments_chat_window');
        btnOpenCommentsChatNewWindow?.addEventListener('click', () => {
            const commentsChat = getCommentsChat(state);
            if (commentsChat.size === 0) return;

            try {
                openChatWindow([...commentsChat.values()], buildExportMeta());
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
                downloadChatFile(arr, buildExportMeta());
            } else if (format === EXPORT_FORMAT.JSON) {
                downloadChatFileJSON(arr, buildExportMeta());
            } else if (format === EXPORT_FORMAT.XLSX) {
                downloadChatFileXLSX(arr, buildExportMeta());
            }
        });

        const btnOpenCommentsTrVideoNewWindow = document.getElementById('ycs_open_all_comments_trvideo_window');
        btnOpenCommentsTrVideoNewWindow?.addEventListener('click', () => {
            try {
                const commentsTrVideo = getCommentsTrVideo(state);
                console.log('commentsTrVideo: ', commentsTrVideo);

                const cueGroups = extractCueGroups(commentsTrVideo);
                if (cueGroups && cueGroups.length > 0) {
                    openTranscriptWindow(cueGroups, buildExportMeta());
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
                downloadTranscriptFile(cueGroups, buildExportMeta());
            } else if (format === EXPORT_FORMAT.JSON) {
                downloadTranscriptFileJSON(cueGroups, buildExportMeta());
            } else if (format === EXPORT_FORMAT.XLSX) {
                downloadTranscriptFileXLSX(cueGroups, buildExportMeta());
            }
        });

        // Close dropdowns when clicking outside
        handleDocumentClick = (event) => {
            try {
                const target = event.target as HTMLElement | null;
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

            renderCommentsResult(selector, result);

            state = setSearchCount(state, 'comments', result.total);

            const commentsContainer = document.getElementById('ycs_wrap_comments');

            if (commentsContainer instanceof HTMLElement) {
                registerCommentInteractions(
                    commentsContainer,
                    {
                        getComments: () => getComments(state)
                    },
                    () => query
                );
            }

            return result;
        };

        if (elTranscriptLangButton instanceof HTMLElement && elTranscriptLangMenu instanceof HTMLElement) {
            dropdownMenus.add(elTranscriptLangMenu);
            setMenuVisibility(elTranscriptLangMenu, false);
            handleTranscriptLanguageDropdown(elTranscriptLangButton);
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
        const searchCommentsAll = (selector: string, param?: IParamSearch): void => {
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

            try {
                if (comments.length > 0) {
                    elSearchAll?.appendChild(elWrapComments);
                    runCommentsPipeline('#ycs_allsearch__wrap_comments', query, param);
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
                updateTotalResultDisplay(resultText);
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

                const optAutoload = (value: boolean): void => {
                    if (value === true) {
                        elLoadAll?.click();
                    }
                };

                const wrapOptAutoload = (value: boolean, opts: IYCSOptions): void => {
                    if (!opts.cache) {
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

                const optHiddenByDefault = (value: boolean): void => {
                    try {
                        const app = document.querySelector('.ycs-app') as HTMLElement;
                        if (!app) return;
                        // Apply collapsed state instead of fully hiding the app to keep the top toggle visible
                        app.classList.toggle('ycs-collapsed', value);
                    } catch (err) {
                        console.error(err);
                    }
                };

                try {
                    const opts = (e.data.text ?? {}) as IYCSOptions;

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

                            case 'hiddenByDefault':
                                optHiddenByDefault(Boolean(opts.hiddenByDefault));
                                break;

                            case 'filterButtons':
                                if (opts.filterButtons) {
                                    // First reload button panel
                                    loadFilterButtons(opts.filterButtons);
                                    // Then re-initialize button configuration (bind events)
                                    initFilterButtons(opts.filterButtons);
                                }
                                break;

                            case 'transcriptLanguage':
                                state = setSelectedTranscriptLanguage(
                                    state,
                                    typeof opts.transcriptLanguage === 'string' && opts.transcriptLanguage.trim()
                                        ? opts.transcriptLanguage.trim()
                                        : undefined
                                );
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
                        if (cachedComments.length > 0) {
                            const originById: Record<string, CommentItem> = {};
                            for (const c of cachedComments) {
                                if (c?.typeComment === 'C') {
                                    const id = c?.commentRenderer?.commentId;
                                    if (typeof id === 'string' && id.length > 0) {
                                        originById[id] = c;
                                    }
                                }
                            }

                            for (const cmnt of cachedComments) {
                                if (cmnt?.typeComment === 'R') {
                                    const refId = cmnt?.originComment?.commentRenderer?.commentId;
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

                    const chatEntries = JSON.parse(body.commentsChat || '[]') as Array<[number, ChatItem]>;
                    state = setCommentsChat(state, new Map<number, ChatItem>(chatEntries));
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
                    appendCachedInfo(crdate);
                } else {
                    window.postMessage({ type: 'YCS_AUTOLOAD' }, window.location.origin);
                }
            }

            if (e.data?.type === 'YCS_AUTOLOAD') {
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

    // Store app() reference for retry mechanism in polling
    // This allows retrying rendering without re-initializing listeners/intervals
    appFunction = app;

    function startObserve(): void {
        // Clean up old interval if it exists (prevents memory leaks on re-initialization)
        if (observeIntervalId !== null) {
            if (DEBUG) {
                console.log('YCS: Clearing old startObserve interval, ID:', observeIntervalId);
            }
            clearInterval(observeIntervalId);
            observeIntervalId = null;
        }

        let prevUrl = getCleanUrlVideo(window.location.href);
        // console.log('prevUrl First init: ', prevUrl);

        // Store interval ID for cleanup on next initApp() call
        observeIntervalId = setInterval(() => {
            if (
                isVideoPage() &&
                document.querySelector('#meta.style-scope.ytd-watch-flexy') &&
                prevUrl !== getCleanUrlVideo(window.location.href)
            ) {
                const currentUrl = getCleanUrlVideo(window.location.href);

                getController(state).abort();
                app();

                // Only update prevUrl after confirming .ycs-app was successfully created
                // If DOM insertion failed, next interval tick will retry
                if (document.querySelector('.ycs-app')) {
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

    try {
        if (isVideoPage()) {
            app();
        }
    } catch (e) {
        console.error(e);
        if (isVideoPage()) {
            app();
        }
    }
}
