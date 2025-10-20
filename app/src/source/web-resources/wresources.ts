/* eslint-disable @typescript-eslint/no-explicit-any */

import 'abort-controller/polyfill';

import Fuse from '../../../node_modules/fuse.js/dist/fuse';

import { GlobalStore, extractChannelId, wrapTryCatch, getCleanUrlVideo, isVideoPage } from '../utils/common';
import {
    downloadFile,
    getRandomComment,
    initShowBarFAQ,
    initShowViewMode,
    openComments,
    openCommentsChat,
    openCommentsTrVideo,
    removeClass,
    removeNodeList,
    sendGetCacheInIDB,
    sendMsgToBadge,
    setCacheToIDB,
    showLoadComments
} from '../utils/dom';
import {
    filterAuthorComments,
    filterHeartComments,
    filterVerifiedComments,
    filterLikesComments,
    filterLinksTrpVideoComments,
    filterMemberComments,
    filterDonatedComments,
    filterNewestFirst,
    filterRepliedComments,
    filterLinksComments,
    filterAllTrpVideoComments
} from '../utils/filters/comments';
import {
    filterAuthorChat,
    filterMembersChat,
    filterDonatedChat,
    filterVerifiedChatComments,
    filterLinksChatComments,
    filterChatNewestFirst
} from '../utils/filters/chat';
import { getAllCommentsModeV2, getChatComments, getTranscriptVideo } from '../utils/innertube';
import { getCommentsChatHtmlText, getCommentsHtmlText, getCommentsTrVideoHtmlText } from '../utils/formatting';

import { ICommentsFuseResult, IParamSearch, ISelectedSearch } from '../utils/interfaces/i_types';

import { iconCollapse, iconExpand, iconOk, iconReload, iconSortDown, iconSortUp } from '../utils/icons';
import {
    renderComment,
    renderCommentChat,
    renderCommentTrVideo,
    renderLoadComments,
    renderSearch
} from '../utils/renderView';

(function (): void {
    try {
        const tt: any = (window as any).trustedTypes;
        if (tt && tt.createPolicy && !tt.defaultPolicy) {
            tt.createPolicy('default', {
                createHTML: (s: string) => s,
                createScriptURL: (s: string) => s,
                createScript: (s: string) => s
            });
        }
    } catch (e) {
        // noop: Trusted Types not available or policy creation failed
    }

    // Debug mode configuration
    // Set to true for detailed diagnostic logs during development
    // Set to false for production to reduce console noise
    const DEBUG = false;

    // Filter support matrix for different content types
    // Chat doesn't support: heart, likes, replied, random
    // Transcript doesn't support: all filters except links, sortFirst, timestamp
    // Note: Timestamp filter has different semantics for each content type:
    //   - Comments: filters comments containing video timestamp LINKS
    //   - Chat: filters chat messages containing video timestamp LINKS
    //   - Transcript: parses mm:ss search input to find cues at specific time
    const CHAT_UNSUPPORTED_FILTERS = ['heart', 'likes', 'replied', 'random'] as const;
    const TRANSCRIPT_UNSUPPORTED_FILTERS = [
        'heart',
        'likes',
        'replied',
        'random',
        'author',
        'donated',
        'members',
        'verified'
    ] as const;

    // Track if initApp() has been called to prevent duplicate initialization
    // Store app() function reference to allow retry without re-initializing
    let isInitAppCalled = false;
    let appFunction: (() => void) | null = null;

    // Store startObserve() interval ID to allow cleanup on re-initialization
    // This prevents memory leaks when initApp() is called multiple times
    let observeIntervalId: ReturnType<typeof setInterval> | null = null;

    // Listen for YouTube's native SPA navigation events
    // This provides instant response (< 50ms) when navigating from homepage to video page
    window.addEventListener('yt-navigate-finish', function handleYtNavigate() {
        if (DEBUG) {
            console.log('YCS: yt-navigate-finish detected');
            console.log('isInitAppCalled: ', isInitAppCalled);
            console.log('isVideoPage: ', isVideoPage());
            console.log(
                'document.querySelector(#meta.style-scope.ytd-watch-flexy): ',
                document.querySelector('#meta.style-scope.ytd-watch-flexy')
            );
        }

        // Only trigger initial call to initApp()
        // Once called, startObserve() inside initApp() handles all subsequent navigations
        if (!isInitAppCalled && isVideoPage() && document.querySelector('#meta.style-scope.ytd-watch-flexy')) {
            console.log('YCS: Initializing app via yt-navigate-finish');
            isInitAppCalled = true;
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            initApp();
        }
    });

    // Handle browser back/forward navigation
    window.addEventListener('popstate', function handlePopState() {
        if (DEBUG) {
            console.log('YCS: popstate detected');
            console.log('isInitAppCalled: ', isInitAppCalled);
            console.log('isVideoPage: ', isVideoPage());
            console.log(
                'document.querySelector(#meta.style-scope.ytd-watch-flexy): ',
                document.querySelector('#meta.style-scope.ytd-watch-flexy')
            );
        }

        // Small delay to let YouTube update DOM after history navigation
        setTimeout(() => {
            if (!isInitAppCalled && isVideoPage() && document.querySelector('#meta.style-scope.ytd-watch-flexy')) {
                console.log('YCS: Initializing app via popstate');
                isInitAppCalled = true;
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                initApp();
            }
        }, 100);
    });

    // Fallback polling mechanism with retry capability
    // 1. If initApp() not called: call it (fallback)
    // 2. If initApp() called but UI not created: retry app() (DOM might not be ready yet)
    // 3. If UI created: stop polling (success)
    const intervalCheckLoadDOM = setInterval(() => {
        if (isVideoPage() && document.querySelector('#meta.style-scope.ytd-watch-flexy')) {
            if (!document.querySelector('.ycs-app')) {
                if (!isInitAppCalled) {
                    // First call: initialize the app
                    console.log('YCS: Initializing app via polling fallback');
                    isInitAppCalled = true;
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                    initApp();
                } else if (appFunction) {
                    // initApp() was called but UI not created yet - retry rendering
                    if (DEBUG) {
                        console.log('YCS: Retrying app() - DOM might not be ready yet');
                    }
                    try {
                        appFunction();
                    } catch (e) {
                        console.error('YCS: app() retry failed', e);
                    }
                }
            } else {
                // Check if UI was successfully created - if yes, stop polling
                console.log('YCS: UI successfully created, stopping polling');
                clearInterval(intervalCheckLoadDOM);
            }
        }
    }, 1000);

    function initApp(): void {
        let controller: AbortController;

        let handleMessageEvent: (ev: MessageEvent<any>) => unknown;

        function app(): void {
            if (!isVideoPage()) return;

            if (handleMessageEvent) {
                window.removeEventListener('message', handleMessageEvent);
            }

            const countComments = {
                comments: 0,
                commentsChat: 0,
                commentsTrVideo: 0
            };

            const countSearchComments = {
                comments: 0,
                commentsChat: 0,
                commentsTrVideo: 0
            };

            let comments: object[] = [];
            let commentsChat = new Map<number, object>();
            let commentsTrVideo: object | undefined;

            controller = new AbortController();

            const fuseOptions = {
                isCaseSensitive: false,
                findAllMatches: false,
                includeMatches: false,
                includeScore: true,
                ignoreLocation: true,
                useExtendedSearch: false,
                minMatchCharLength: 1,
                shouldSort: true,
                threshold: 0.15,
                distance: 100000
            };

            sendMsgToBadge('NUMBER_COMMENTS', '');

            removeNodeList('.ycs-app');

            if (document.querySelector('#meta.style-scope.ytd-watch-flexy')) {
                renderLoadComments('#meta.style-scope.ytd-watch-flexy');
            } else if (document.querySelector('#meta.style-scope')) {
                renderLoadComments('#meta.style-scope');
            } else {
                return;
            }

            const elSearch = document.getElementById('ycs-search');
            if (elSearch) {
                renderSearch(elSearch);
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

            const getElmsBtnPanel = (): object => {
                return {
                    elPTimeStamps: document.getElementById('ycs_btn_timestamps'),
                    elPAuthor: document.getElementById('ycs_btn_author'),
                    elPHeart: document.getElementById('ycs_btn_heart'),
                    elPVerified: document.getElementById('ycs_btn_verified'),
                    elPLinks: document.getElementById('ycs_btn_links'),
                    elPLikes: document.getElementById('ycs_btn_likes'),
                    elPReplied: document.getElementById('ycs_btn_replied_comments'),
                    elPMembers: document.getElementById('ycs_btn_members'),
                    elPDonated: document.getElementById('ycs_btn_donated'),
                    elPClear: document.getElementById('ycs_btn_clear'),
                    elPRandom: document.getElementById('ycs_btn_random'),
                    elFirstComments: document.getElementById('ycs_btn_sort_first')
                };
            };

            const elsBtnPanel = getElmsBtnPanel();
            console.log('elsBtnPanel: ', elsBtnPanel);

            // Active-state management helpers for filter buttons
            const codeToId: Record<string, string> = {
                timestamp: 'ycs_btn_timestamps',
                author: 'ycs_btn_author',
                heart: 'ycs_btn_heart',
                verified: 'ycs_btn_verified',
                links: 'ycs_btn_links',
                likes: 'ycs_btn_likes',
                replied: 'ycs_btn_replied_comments',
                members: 'ycs_btn_members',
                donated: 'ycs_btn_donated',
                random: 'ycs_btn_random',
                sortFirst: 'ycs_btn_sort_first'
            };
            const idToCode: Record<string, ISelectedSearch | string> = (function () {
                const res: Record<string, ISelectedSearch | string> = {};
                for (const key in codeToId) {
                    if (Object.prototype.hasOwnProperty.call(codeToId, key)) {
                        const val = (codeToId as any)[key] as string;
                        res[val] = key as ISelectedSearch | string;
                    }
                }
                return res;
            })();

            // Removed persistent storage for active filter; rely on DOM state only

            const setActiveFilterByElement = (code: string | null, el?: HTMLElement): void => {
                try {
                    removeClass(elsBtnPanel, 'ycs_btn_active');
                    if (code && el) el.classList.add('ycs_btn_active');
                    // toggle clear-filter button visibility
                    const btnClear = document.getElementById('ycs_btn_clear') as HTMLButtonElement | null;
                    if (btnClear) {
                        const hasActive = !!code;
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
                    const code = active?.id ? (idToCode[active.id] as string) : '';
                    if (!code) return undefined;

                    const param: IParamSearch = {} as IParamSearch;
                    switch (code) {
                        case 'timestamp':
                            param.timestamp = true;
                            break;
                        case 'author':
                            param.author = true;
                            break;
                        case 'heart':
                            param.heart = true;
                            break;
                        case 'verified':
                            param.verified = true;
                            break;
                        case 'links':
                            param.links = true;
                            break;
                        case 'likes':
                            param.likes = true;
                            break;
                        case 'replied':
                            param.replied = true;
                            break;
                        case 'members':
                            param.members = true;
                            break;
                        case 'donated':
                            param.donated = true;
                            break;
                        case 'random':
                            param.random = true;
                            break;
                        case 'sortFirst':
                            param.sortFirst = true;
                            break;
                        default:
                            return undefined;
                    }

                    // Get sort order from the active button's dataset
                    if (active) {
                        const sortOrder = active.dataset.sort as 'newest' | 'oldest' | undefined;
                        if (sortOrder) param.sortOrder = sortOrder;
                        const sortChatOrder = active.dataset.sortChat as 'newest' | 'oldest' | undefined;
                        if (sortChatOrder) param.sortOrder = sortChatOrder;
                    }

                    return param;
                } catch {
                    return undefined;
                }
            };

            const handlersBtnPanel = (hElms: any): void => {
                if (hElms) {
                    const clearCountComments = (): void => {
                        countSearchComments.comments = 0;
                        countSearchComments.commentsChat = 0;
                        countSearchComments.commentsTrVideo = 0;
                    };

                    // Helper function to execute search based on selected type
                    const executeSearchBasedOnType = (param?: IParamSearch): void => {
                        const elSelectOptSearch = document.getElementById('ycs_search_select') as HTMLSelectElement;

                        if (elSelectOptSearch) {
                            const selected: ISelectedSearch = elSelectOptSearch?.options[
                                elSelectOptSearch?.options?.selectedIndex
                            ].value as unknown as ISelectedSearch;

                            switch (selected) {
                                case 'comments':
                                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                                    searchComments('#ycs-search-result', param);
                                    break;
                                case 'chat':
                                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                                    searchCommentsChat('#ycs-search-result', param);
                                    break;
                                case 'video':
                                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                                    searchCommentsTrVideo('#ycs-search-result', param);
                                    break;
                                case 'all':
                                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                                    searchCommentsAll('#ycs-search-result', param);
                                    break;
                                default:
                                    // Default to searchCommentsAll if no valid selection
                                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                                    searchCommentsAll('#ycs-search-result', param);
                                    break;
                            }
                        } else {
                            // Fallback to searchCommentsAll if select element not found
                            // eslint-disable-next-line @typescript-eslint/no-use-before-define
                            searchCommentsAll('#ycs-search-result', param);
                        }
                    };

                    hElms?.elPTimeStamps?.addEventListener('click', (e: Event) => {
                        try {
                            const currentTarget = e.currentTarget as HTMLElement;
                            const wasActive = currentTarget.classList.contains('ycs_btn_active');

                            // Toggle sort only if button was already active
                            if (wasActive) {
                                const currentSort = currentTarget.dataset.sort;
                                currentTarget.dataset.sort = currentSort === 'newest' ? 'oldest' : 'newest';
                                const currentSortChat = currentTarget.dataset.sortChat;
                                currentTarget.dataset.sortChat = currentSortChat === 'newest' ? 'oldest' : 'newest';
                            }

                            setActiveFilterByElement('timestamp', currentTarget);
                            clearCountComments();

                            // eslint-disable-next-line @typescript-eslint/no-use-before-define
                            executeSearchBasedOnType({
                                timestamp: true
                            });
                        } catch (err) {
                            console.error(err);
                        }
                    });

                    hElms?.elPAuthor?.addEventListener('click', (e: Event) => {
                        try {
                            const currentTarget = e.currentTarget as HTMLElement;
                            const wasActive = currentTarget.classList.contains('ycs_btn_active');

                            // Toggle sort only if button was already active
                            if (wasActive) {
                                const currentSort = currentTarget.dataset.sort;
                                currentTarget.dataset.sort = currentSort === 'newest' ? 'oldest' : 'newest';
                                const currentSortChat = currentTarget.dataset.sortChat;
                                currentTarget.dataset.sortChat = currentSortChat === 'newest' ? 'oldest' : 'newest';
                            }

                            setActiveFilterByElement('author', currentTarget);
                            clearCountComments();

                            // eslint-disable-next-line @typescript-eslint/no-use-before-define
                            executeSearchBasedOnType({
                                author: true
                            });
                        } catch (err) {
                            console.error(err);
                        }
                    });

                    hElms?.elPHeart?.addEventListener('click', (e: Event) => {
                        try {
                            const currentTarget = e.currentTarget as HTMLElement;
                            const wasActive = currentTarget.classList.contains('ycs_btn_active');

                            // Toggle sort only if button was already active
                            if (wasActive) {
                                const currentSort = currentTarget.dataset.sort;
                                currentTarget.dataset.sort = currentSort === 'newest' ? 'oldest' : 'newest';
                            }

                            setActiveFilterByElement('heart', currentTarget);
                            clearCountComments();

                            // eslint-disable-next-line @typescript-eslint/no-use-before-define
                            executeSearchBasedOnType({
                                heart: true
                            });
                        } catch (err) {
                            console.error(err);
                        }
                    });

                    hElms?.elPVerified?.addEventListener('click', (e: Event) => {
                        try {
                            const currentTarget = e.currentTarget as HTMLElement;
                            const wasActive = currentTarget.classList.contains('ycs_btn_active');

                            // Toggle sort only if button was already active
                            if (wasActive) {
                                const currentSort = currentTarget.dataset.sort;
                                currentTarget.dataset.sort = currentSort === 'newest' ? 'oldest' : 'newest';
                                const currentSortChat = currentTarget.dataset.sortChat;
                                currentTarget.dataset.sortChat = currentSortChat === 'newest' ? 'oldest' : 'newest';
                            }

                            setActiveFilterByElement('verified', currentTarget);
                            clearCountComments();

                            // eslint-disable-next-line @typescript-eslint/no-use-before-define
                            executeSearchBasedOnType({
                                verified: true
                            });
                        } catch (err) {
                            console.error(err);
                        }
                    });

                    hElms?.elPLinks?.addEventListener('click', (e: Event) => {
                        try {
                            const currentTarget = e.currentTarget as HTMLElement;
                            const wasActive = currentTarget.classList.contains('ycs_btn_active');

                            // Toggle sort only if button was already active
                            if (wasActive) {
                                const currentSort = currentTarget.dataset.sort;
                                currentTarget.dataset.sort = currentSort === 'newest' ? 'oldest' : 'newest';
                                const currentSortChat = currentTarget.dataset.sortChat;
                                currentTarget.dataset.sortChat = currentSortChat === 'newest' ? 'oldest' : 'newest';
                                const currentSortTrp = currentTarget.dataset.sortTrp;
                                currentTarget.dataset.sortTrp = currentSortTrp === 'newest' ? 'oldest' : 'newest';
                            }

                            setActiveFilterByElement('links', currentTarget);
                            clearCountComments();

                            // eslint-disable-next-line @typescript-eslint/no-use-before-define
                            executeSearchBasedOnType({
                                links: true
                            });
                        } catch (err) {
                            console.error(err);
                        }
                    });

                    hElms?.elPLikes?.addEventListener('click', (e: Event) => {
                        try {
                            const currentTarget = e.currentTarget;

                            setActiveFilterByElement('likes', currentTarget as HTMLElement);
                            clearCountComments();

                            executeSearchBasedOnType({
                                likes: true
                            });
                        } catch (err) {
                            console.error(err);
                        }
                    });

                    hElms?.elPReplied?.addEventListener('click', (e: Event) => {
                        try {
                            const currentTarget = e.currentTarget;

                            setActiveFilterByElement('replied', currentTarget as HTMLElement);
                            clearCountComments();

                            executeSearchBasedOnType({
                                replied: true
                            });
                        } catch (err) {
                            console.error(err);
                        }
                    });

                    hElms?.elPMembers?.addEventListener('click', (e: Event) => {
                        try {
                            const currentTarget = e.currentTarget as HTMLElement;
                            const wasActive = currentTarget.classList.contains('ycs_btn_active');

                            // Toggle sort only if button was already active
                            if (wasActive) {
                                const currentSort = currentTarget.dataset.sort;
                                currentTarget.dataset.sort = currentSort === 'newest' ? 'oldest' : 'newest';
                                const currentSortChat = currentTarget.dataset.sortChat;
                                currentTarget.dataset.sortChat = currentSortChat === 'newest' ? 'oldest' : 'newest';
                            }

                            setActiveFilterByElement('members', currentTarget);
                            clearCountComments();

                            executeSearchBasedOnType({
                                members: true
                            });
                        } catch (err) {
                            console.error(err);
                        }
                    });

                    hElms?.elPDonated?.addEventListener('click', (e: Event) => {
                        try {
                            const currentTarget = e.currentTarget as HTMLElement;
                            const wasActive = currentTarget.classList.contains('ycs_btn_active');

                            // Toggle sort only if button was already active
                            if (wasActive) {
                                const currentSort = currentTarget.dataset.sort;
                                currentTarget.dataset.sort = currentSort === 'newest' ? 'oldest' : 'newest';
                                const currentSortChat = currentTarget.dataset.sortChat;
                                currentTarget.dataset.sortChat = currentSortChat === 'newest' ? 'oldest' : 'newest';
                            }

                            setActiveFilterByElement('donated', currentTarget);
                            clearCountComments();

                            executeSearchBasedOnType({
                                donated: true
                            });
                        } catch (err) {
                            console.error(err);
                        }
                    });

                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    hElms?.elPClear?.addEventListener('click', (e: Event) => {
                        try {
                            // const currentTarget = e.currentTarget;

                            setActiveFilterByElement(null);

                            clearCountComments();

                            // (currentTarget as HTMLElement)?.classList.add('ycs_btn_active');

                            // Check if search input has content
                            const eInputSearch = document.getElementById('ycs-input-search') as HTMLInputElement;

                            // If search input is not empty, trigger search again for results without button filter
                            if (eInputSearch?.value && eInputSearch.value.trim()) {
                                // Use requestAnimationFrame to ensure DOM updates are completed before triggering search
                                requestAnimationFrame(() => {
                                    const searchBtn = document.getElementById('ycs_btn_search');
                                    searchBtn?.click();
                                });
                            } else {
                                // Only clear results if search input is empty
                                const elSearchRes = document.getElementById('ycs-search-result');
                                const elSearchTotalRes: any = document.getElementById('ycs-search-total-result');

                                if (elSearchRes) {
                                    elSearchRes.innerText = '';
                                    elSearchTotalRes.innerText = 'Search cleared';
                                }
                            }

                            // Hide clear-filter button after clearing
                            const btnClear = document.getElementById('ycs_btn_clear') as HTMLButtonElement | null;
                            if (btnClear) btnClear.style.visibility = 'hidden';
                        } catch (err) {
                            console.error(err);
                        }
                    });

                    hElms?.elPRandom?.addEventListener('click', (e: Event) => {
                        try {
                            const currentTarget = e.currentTarget;

                            setActiveFilterByElement('random', currentTarget as HTMLElement);
                            clearCountComments();

                            executeSearchBasedOnType({
                                random: true
                            });
                        } catch (err) {
                            console.error(err);
                        }
                    });

                    hElms?.elFirstComments?.addEventListener('click', (e: Event) => {
                        try {
                            const currentTarget = e.currentTarget as HTMLElement;
                            const wasActive = currentTarget.classList.contains('ycs_btn_active');

                            // Toggle sort only if button was already active
                            if (wasActive) {
                                const currentSort = currentTarget.dataset.sort;
                                currentTarget.dataset.sort = currentSort === 'newest' ? 'oldest' : 'newest';
                                const currentSortChat = currentTarget.dataset.sortChat;
                                currentTarget.dataset.sortChat = currentSortChat === 'newest' ? 'oldest' : 'newest';
                                const currentSortTrp = currentTarget.dataset.sortTrp;
                                currentTarget.dataset.sortTrp = currentSortTrp === 'newest' ? 'oldest' : 'newest';
                            }

                            setActiveFilterByElement('sortFirst', currentTarget);
                            clearCountComments();

                            executeSearchBasedOnType({
                                sortFirst: true
                            });
                        } catch (err) {
                            console.error(err);
                        }
                    });
                }
            };

            handlersBtnPanel(elsBtnPanel);
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

            const elLoadComments = document.getElementById('ycs-load-cmnts');
            if (elLoadComments) {
                elLoadComments.addEventListener('click', async function (e: MouseEvent): Promise<void> {
                    if (!elLiveApp.parentNode || !elLiveApp.parentElement) return;
                    console.log('CLICK');

                    comments.length = 0;

                    const currentTarget = e.currentTarget as HTMLButtonElement;

                    currentTarget.disabled = true;
                    currentTarget.innerText = 'reload';

                    const elStatusCmnts = document.getElementById('ycs_status_cmnt');
                    const elLoadCmnts = document.getElementById('ycs_cmnts');

                    if (elLoadCmnts && elStatusCmnts) {
                        elLoadCmnts.textContent = '0';

                        elStatusCmnts.innerHTML = iconReload();

                        await getAllCommentsModeV2(elLoadCmnts, controller.signal, comments);

                        console.log('ORIGIN COMMENTS: ', comments);

                        if (comments.length > 0) {
                            elStatusCmnts.innerHTML = iconOk();
                            setCacheToIDB(
                                {
                                    comments,
                                    commentsChat: JSON.stringify(Array.from(commentsChat.entries())),
                                    commentsTrVideo,
                                    channelId: extractChannelId()
                                },
                                window.location.href,
                                document.title
                            );
                        }
                    }

                    if (comments.length > 0) {
                        countComments.comments = comments.length;
                    }

                    const totalCount =
                        countComments.comments + countComments.commentsChat + countComments.commentsTrVideo;
                    sendMsgToBadge('NUMBER_COMMENTS', totalCount);

                    if (elLoadCmnts) {
                        elLoadCmnts.textContent = `${comments.length}`;
                    }

                    updateTitleCount(totalCount);

                    currentTarget.disabled = false;
                });
            }

            const elLoadCommentsChat = document.getElementById('ycs-load-chat');
            if (elLoadCommentsChat) {
                elLoadCommentsChat.addEventListener('click', async function (e: MouseEvent): Promise<void> {
                    if (!elLiveApp.parentNode || !elLiveApp.parentElement) return;

                    commentsChat.clear();

                    const currentTarget = e.currentTarget as HTMLButtonElement;

                    currentTarget.disabled = true;
                    currentTarget.innerText = 'reload';

                    const elStatusChat = document.getElementById('ycs_status_chat');
                    const elLoadChat = document.getElementById('ycs_cmnts_chat');

                    if (elLoadChat && elStatusChat) {
                        elLoadChat.textContent = '0';

                        elStatusChat.innerHTML = iconReload();

                        await getChatComments(controller.signal, elLoadChat, commentsChat);

                        console.log('CHAT COMMENTS: ', commentsChat);

                        if (commentsChat && commentsChat.size > 0) {
                            elLoadChat.textContent = commentsChat.size.toString();
                            elStatusChat.innerHTML = iconOk();
                            setCacheToIDB(
                                {
                                    comments,
                                    commentsChat: JSON.stringify(Array.from(commentsChat.entries())),
                                    commentsTrVideo,
                                    channelId: extractChannelId()
                                },
                                window.location.href,
                                document.title
                            );
                        }
                    }

                    if (commentsChat && commentsChat.size > 0 && (elLiveApp.parentNode || elLiveApp.parentElement)) {
                        countComments.commentsChat = commentsChat.size;
                    }

                    const totalCount =
                        countComments.comments + countComments.commentsChat + countComments.commentsTrVideo;
                    sendMsgToBadge('NUMBER_COMMENTS', totalCount);

                    updateTitleCount(totalCount);

                    currentTarget.disabled = false;
                });
            }

            const elLoadTranscriptVideo = document.getElementById('ycs-load-transcript-video');
            if (elLoadTranscriptVideo) {
                elLoadTranscriptVideo.addEventListener('click', async function (e: MouseEvent): Promise<void> {
                    if (!elLiveApp.parentNode || !elLiveApp.parentElement) return;

                    const currentTarget = e.currentTarget as HTMLButtonElement;

                    currentTarget.disabled = true;
                    currentTarget.innerText = 'reload';

                    const elStatusTrVideo = document.getElementById('ycs_status_trvideo');
                    const elLoadTrVideo = document.getElementById('ycs_cmnts_video');

                    if (elLoadTrVideo && elStatusTrVideo) {
                        elLoadTrVideo.textContent = '0';

                        elStatusTrVideo.innerHTML = iconReload();

                        // Load transcript with robust fallback,
                        // ensure old buffer won't leak when current load fails
                        const tr = await getTranscriptVideo(controller.signal);
                        commentsTrVideo = undefined;
                        if (
                            wrapTryCatch(
                                () =>
                                    (tr as any)?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer
                                        ?.body?.transcriptBodyRenderer?.cueGroups?.length > 0
                            )
                        ) {
                            commentsTrVideo = tr;
                        }

                        try {
                            if (
                                commentsTrVideo &&
                                elLoadTrVideo &&
                                (commentsTrVideo as any)?.actions?.length > 0 &&
                                (commentsTrVideo as any)?.actions[0]?.updateEngagementPanelAction?.content
                                    ?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups?.length > 0
                            ) {
                                showLoadComments(
                                    (commentsTrVideo as any).actions[0].updateEngagementPanelAction.content
                                        .transcriptRenderer.body.transcriptBodyRenderer.cueGroups.length,
                                    elLoadTrVideo
                                );
                                setCacheToIDB(
                                    {
                                        comments,
                                        commentsChat: JSON.stringify(Array.from(commentsChat.entries())),
                                        commentsTrVideo,
                                        channelId: extractChannelId()
                                    },
                                    window.location.href,
                                    document.title
                                );
                            } else {
                                commentsTrVideo = undefined;
                            }
                        } catch (err) {
                            console.error(err);
                            commentsTrVideo = undefined;
                        }

                        console.log('Transcript: ', commentsTrVideo);

                        if (
                            wrapTryCatch(
                                () =>
                                    (commentsTrVideo as any)?.actions[0]?.updateEngagementPanelAction?.content
                                        ?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups?.length > 0
                            )
                        ) {
                            elStatusTrVideo.innerHTML = iconOk();
                        }
                    }

                    if (
                        wrapTryCatch(
                            () =>
                                (commentsTrVideo as any)?.actions[0]?.updateEngagementPanelAction?.content
                                    ?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups?.length > 0
                        ) &&
                        (elLiveApp.parentNode || elLiveApp.parentElement)
                    ) {
                        countComments.commentsTrVideo = (
                            commentsTrVideo as any
                        ).actions[0].updateEngagementPanelAction.content.transcriptRenderer.body.transcriptBodyRenderer.cueGroups.length;
                    }

                    const totalCount =
                        countComments.comments + countComments.commentsChat + countComments.commentsTrVideo;
                    sendMsgToBadge('NUMBER_COMMENTS', totalCount);

                    updateTitleCount(totalCount);

                    currentTarget.disabled = false;
                });
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
                        controller.abort();
                        controller = new AbortController();
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
                        const elSearchTotalRes: any = document.getElementById('ycs-search-total-result');

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

            const btnOpenCommentsNewWindow = document.getElementById('ycs_open_all_comments_window');
            btnOpenCommentsNewWindow?.addEventListener('click', () => {
                if (comments.length === 0) return;

                try {
                    openComments(getCommentsHtmlText(comments));
                } catch (e) {
                    console.error(e);
                    return;
                }
            });

            const btnSaveCommentsToFile = document.getElementById('ycs_save_all_comments');
            btnSaveCommentsToFile?.addEventListener('click', () => {
                if (comments.length === 0) return;

                try {
                    const c = getCommentsHtmlText(comments);
                    const htmlText = `
YCS - YouTube Comment Search

Comments
File created by ${new Date().toString()}
Video URL: ${getCleanUrlVideo(window.location.href)}
Title: ${document.title}
Total: ${c.count}\n${c.html}`;

                    downloadFile(htmlText, `Comments, ${document.title} (${c.count}).txt`, 'text/plain');
                } catch (e) {
                    console.error(e);
                    return;
                }
            });

            const btnOpenCommentsChatNewWindow = document.getElementById('ycs_open_all_comments_chat_window');
            btnOpenCommentsChatNewWindow?.addEventListener('click', () => {
                if (commentsChat.size === 0) return;

                try {
                    openCommentsChat(getCommentsChatHtmlText([...commentsChat.values()]));
                } catch (e) {
                    console.error(e);
                    return;
                }
            });

            const btnSaveCommentsChatToFile = document.getElementById('ycs_save_all_comments_chat');
            btnSaveCommentsChatToFile?.addEventListener('click', () => {
                if (commentsChat.size === 0) return;

                try {
                    const c = getCommentsChatHtmlText([...commentsChat.values()]);
                    const htmlText = `
YCS - YouTube Comment Search

Comments chat
File created by ${new Date().toString()}
Video URL: ${getCleanUrlVideo(window.location.href)}
Title: ${document.title}
Total: ${c.count}\n${c.html}`;

                    downloadFile(htmlText, `Comments chat, ${document.title} (${c.count}).txt`, 'text/plain');
                } catch (e) {
                    console.error(e);
                    return;
                }
            });

            const btnOpenCommentsTrVideoNewWindow = document.getElementById('ycs_open_all_comments_trvideo_window');
            btnOpenCommentsTrVideoNewWindow?.addEventListener('click', () => {
                try {
                    console.log('commentsTrVideo: ', commentsTrVideo);

                    if (
                        commentsTrVideo &&
                        (commentsTrVideo as any)?.actions?.length > 0 &&
                        (commentsTrVideo as any)?.actions[0]?.updateEngagementPanelAction?.content?.transcriptRenderer
                            ?.body?.transcriptBodyRenderer?.cueGroups?.length > 0
                    ) {
                        openCommentsTrVideo(
                            getCommentsTrVideoHtmlText(
                                (commentsTrVideo as any).actions[0].updateEngagementPanelAction.content
                                    .transcriptRenderer.body.transcriptBodyRenderer.cueGroups
                            )
                        );
                    }
                } catch (e) {
                    console.error(e);
                    return;
                }
            });

            const btnSaveCommentsTrVideoToFile = document.getElementById('ycs_save_all_comments_trvideo');
            btnSaveCommentsTrVideoToFile?.addEventListener('click', () => {
                try {
                    if (
                        commentsTrVideo &&
                        (commentsTrVideo as any)?.actions?.length > 0 &&
                        (commentsTrVideo as any).actions[0]?.updateEngagementPanelAction?.content?.transcriptRenderer
                            ?.body?.transcriptBodyRenderer?.cueGroups?.length > 0
                    ) {
                        const c = getCommentsTrVideoHtmlText(
                            (commentsTrVideo as any).actions[0].updateEngagementPanelAction.content.transcriptRenderer
                                .body.transcriptBodyRenderer.cueGroups
                        );

                        const htmlText = `
YCS - YouTube Comment Search

Transcript video
File created by ${new Date().toString()}
Video URL: ${getCleanUrlVideo(window.location.href)}
Title: ${document.title}
Total: ${c.count}\n${c.html}`;

                        downloadFile(htmlText, `Transcript video, ${document.title} (${c.count}).txt`, 'text/plain');
                    }
                } catch (e) {
                    console.error(e);
                    return;
                }
            });

            const searchComments = (selector: string, param?: IParamSearch): void => {
                try {
                    if (comments.length === 0) {
                        const elSearchRes = document.querySelector(selector);
                        if (elSearchRes) elSearchRes.textContent = '';
                        updateTotalResultDisplay('(Comments) Found: 0');
                        countSearchComments.comments = 0;
                        return;
                    }

                    const inputSearch = document.getElementById('ycs-input-search') as HTMLInputElement;
                    const querySearch: string = inputSearch?.value;

                    const elSearchRes = document.querySelector(selector);

                    if (elSearchRes) elSearchRes.textContent = '';

                    const elExtSearchTitle = document.getElementById('ycs_extended_search_title') as HTMLInputElement;
                    const elExtSearchMain = document.getElementById('ycs_extended_search_main') as HTMLInputElement;

                    let fuseOpt = fuseOptions;
                    let keysOpt = ['commentRenderer.authorText.simpleText', 'commentRenderer.contentText.fullText'];

                    if (elExtSearch?.checked) {
                        fuseOpt = JSON.parse(JSON.stringify(fuseOptions));
                        fuseOpt.useExtendedSearch = true;

                        if (elExtSearchTitle.checked) {
                            keysOpt = ['commentRenderer.authorText.simpleText'];
                        }

                        if (elExtSearchMain.checked) {
                            keysOpt = ['commentRenderer.contentText.fullText'];
                        }
                    }

                    const options: object = {
                        ...fuseOpt,
                        keys: keysOpt
                    };

                    let resultSearch: ICommentsFuseResult[] = [];
                    // Compute global text search once (if query present)
                    let textMatchedSet: Set<any> | null = null;
                    if (querySearch && querySearch.trim()) {
                        const fuseBase = new Fuse(comments, options);
                        const baseMatches = fuseBase.search(querySearch.trim()) as any[];
                        textMatchedSet = new Set(baseMatches.map((r: any) => r.item));
                    }

                    if (param?.likes) {
                        const cmntsLikes = filterLikesComments(comments);

                        // Unified pipeline: filter-only; apply text subset; then sort by likeCount desc
                        resultSearch = cmntsLikes;
                        if (textMatchedSet) resultSearch = resultSearch.filter((r: any) => textMatchedSet?.has(r.item));
                        resultSearch?.sort((first: any, second: any) => {
                            const a = first.item?.commentRenderer?.likesForSort || 0;
                            const b = second.item?.commentRenderer?.likesForSort || 0;
                            if (b !== a) return b - a;
                            return (first.refIndex || 0) - (second.refIndex || 0);
                        });

                        renderComment(selector, resultSearch, true, querySearch);

                        console.log('cmntsLikes: ', cmntsLikes);
                    } else if (param?.links) {
                        const cmntsLinked = filterLinksComments(comments);
                        resultSearch = cmntsLinked;
                        if (textMatchedSet) resultSearch = resultSearch.filter((r: any) => textMatchedSet?.has(r.item));

                        if (resultSearch.length > 0) {
                            console.log('Links before: ', resultSearch);

                            resultSearch?.sort((firstItem, secondItem) => {
                                return firstItem.refIndex - secondItem.refIndex;
                            });

                            console.log('Links after: ', resultSearch);

                            const elSortLinks = document.getElementById('ycs_btn_links') as HTMLElement;
                            // Use sortOrder from param if provided (from text search), otherwise use button's dataset
                            const sortType = param?.sortOrder || (elSortLinks.dataset.sort as 'newest' | 'oldest');

                            if (sortType === 'newest') {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortLinks.innerHTML = `Links ${iconSortDown()}`;
                                elSortLinks.title = 'Shows links in comments, replies, chat, video transcript (Newest)';
                            } else if (sortType === 'oldest') {
                                renderComment(selector, resultSearch?.reverse(), true, querySearch);
                                elSortLinks.innerHTML = `Links ${iconSortUp()}`;
                                elSortLinks.title = 'Shows links in comments, replies, chat, video transcript (Oldest)';
                            } else {
                                if (querySearch && querySearch.trim()) {
                                    const base = resultSearch.map((r: any) => r.item);
                                    const fuse = new Fuse(base, options);
                                    const filtered = fuse.search(querySearch.trim()) as ICommentsFuseResult[];
                                    renderComment(selector, filtered, true, querySearch);
                                    resultSearch = filtered;
                                } else {
                                    renderComment(selector, resultSearch, true, querySearch);
                                }
                                elSortLinks.innerHTML = `Links ${iconSortDown()}`;
                            }
                        }
                    } else if (param?.members) {
                        const cmntsMembers = filterMemberComments(comments);
                        resultSearch = cmntsMembers;
                        if (textMatchedSet) resultSearch = resultSearch.filter((r: any) => textMatchedSet?.has(r.item));

                        if (resultSearch.length > 0) {
                            console.log('members before: ', resultSearch);

                            resultSearch?.sort((firstItem, secondItem) => {
                                return firstItem.refIndex - secondItem.refIndex;
                            });

                            console.log('members after: ', resultSearch);

                            const elSortMembers = document.getElementById('ycs_btn_members') as HTMLElement;
                            // Use sortOrder from param if provided (from text search), otherwise use button's dataset
                            const sortType = param?.sortOrder || (elSortMembers.dataset.sort as 'newest' | 'oldest');

                            if (sortType === 'newest') {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortMembers.innerHTML = `Members ${iconSortDown()}`;
                                elSortMembers.title = 'Show comments, replies, chat from channel members (Newest)';
                            } else if (sortType === 'oldest') {
                                renderComment(selector, resultSearch?.reverse(), true, querySearch);
                                elSortMembers.innerHTML = `Members ${iconSortUp()}`;
                                elSortMembers.title = 'Show comments, replies, chat from channel members (Oldest)';
                            } else {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortMembers.innerHTML = `Members ${iconSortDown()}`;
                            }

                            console.log('cmntsMembers: ', cmntsMembers);
                        }
                    } else if (param?.donated) {
                        const cmntsDonated = filterDonatedComments(comments);
                        resultSearch = cmntsDonated;
                        if (textMatchedSet) resultSearch = resultSearch.filter((r: any) => textMatchedSet?.has(r.item));

                        if (resultSearch.length > 0) {
                            console.log('donated before: ', resultSearch);

                            resultSearch?.sort((firstItem, secondItem) => {
                                return firstItem.refIndex - secondItem.refIndex;
                            });

                            console.log('donated after: ', resultSearch);

                            const elSortDonated = document.getElementById('ycs_btn_donated') as HTMLElement;
                            // Use sortOrder from param if provided (from text search), otherwise use button's dataset
                            const sortType = param?.sortOrder || (elSortDonated.dataset.sort as 'newest' | 'oldest');

                            if (sortType === 'newest') {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortDonated.innerHTML = `Donated ${iconSortDown()}`;
                                elSortDonated.title = 'Show comments from users who have donated (Newest)';
                            } else if (sortType === 'oldest') {
                                renderComment(selector, resultSearch?.reverse(), true, querySearch);
                                elSortDonated.innerHTML = `Donated ${iconSortUp()}`;
                                elSortDonated.title = 'Show comments from users who have donated (Oldest)';
                            } else {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortDonated.innerHTML = `Donated ${iconSortDown()}`;
                            }

                            console.log('cmntsDonated: ', cmntsDonated);
                        }
                    } else if (param?.replied) {
                        const cmntsReplied = filterRepliedComments(comments);
                        resultSearch = cmntsReplied;
                        if (textMatchedSet) resultSearch = resultSearch.filter((r: any) => textMatchedSet?.has(r.item));
                        resultSearch?.sort((first: any, second: any) => {
                            const a = first.item?.commentRenderer?.repliedForSort || 0;
                            const b = second.item?.commentRenderer?.repliedForSort || 0;
                            if (b !== a) return b - a;
                            return (first.refIndex || 0) - (second.refIndex || 0);
                        });
                        renderComment(selector, resultSearch, true, querySearch);

                        console.log('cmntsReplied: ', cmntsReplied);
                    } else if (param?.author) {
                        const cmntsAuthor = filterAuthorComments(comments);
                        resultSearch = cmntsAuthor;
                        if (textMatchedSet) resultSearch = resultSearch.filter((r: any) => textMatchedSet?.has(r.item));

                        if (resultSearch.length > 0) {
                            console.log('author before: ', resultSearch);

                            resultSearch?.sort((firstItem, secondItem) => {
                                return firstItem.refIndex - secondItem.refIndex;
                            });

                            console.log('author after: ', resultSearch);

                            const elSortAuthor = document.getElementById('ycs_btn_author') as HTMLElement;
                            // Use sortOrder from param if provided (from text search), otherwise use button's dataset
                            const sortType = param?.sortOrder || (elSortAuthor.dataset.sort as 'newest' | 'oldest');

                            if (sortType === 'newest') {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortAuthor.innerHTML = `Author ${iconSortDown()}`;
                                elSortAuthor.title = 'Show comments, replies, chat from the author (Newest)';
                            } else if (sortType === 'oldest') {
                                renderComment(selector, resultSearch?.reverse(), true, querySearch);
                                elSortAuthor.innerHTML = `Author ${iconSortUp()}`;
                                elSortAuthor.title = 'Show comments, replies, chat from the author (Oldest)';
                            } else {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortAuthor.innerHTML = `Author ${iconSortDown()}`;
                            }
                        }
                    } else if (param?.heart) {
                        const cmntsHeart = filterHeartComments(comments);
                        resultSearch = cmntsHeart;
                        if (textMatchedSet) resultSearch = resultSearch.filter((r: any) => textMatchedSet?.has(r.item));

                        if (resultSearch.length > 0) {
                            console.log('heart before: ', resultSearch);

                            resultSearch?.sort((firstItem, secondItem) => {
                                return firstItem.refIndex - secondItem.refIndex;
                            });

                            console.log('heart after: ', resultSearch);

                            const elSortHeart = document.getElementById('ycs_btn_heart') as HTMLElement;
                            // Use sortOrder from param if provided (from text search), otherwise use button's dataset
                            const sortType = param?.sortOrder || (elSortHeart.dataset.sort as 'newest' | 'oldest');

                            if (sortType === 'newest') {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortHeart.innerHTML = `<span class="ycs-creator-heart_icon">❤</span> ${iconSortDown()}`;
                                elSortHeart.title = 'Show comments and replies that the author likes (Newest)';
                            } else if (sortType === 'oldest') {
                                renderComment(selector, resultSearch?.reverse(), true, querySearch);
                                elSortHeart.innerHTML = `<span class="ycs-creator-heart_icon">❤</span> ${iconSortUp()}`;
                                elSortHeart.title = 'Show comments and replies that the author likes (Oldest)';
                            } else {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortHeart.innerHTML = `<span class="ycs-creator-heart_icon">❤</span> ${iconSortDown()}`;
                            }
                        }
                    } else if (param?.verified) {
                        const cmntsVerified = filterVerifiedComments(comments);
                        resultSearch = cmntsVerified;
                        if (textMatchedSet) resultSearch = resultSearch.filter((r: any) => textMatchedSet?.has(r.item));

                        if (resultSearch.length > 0) {
                            console.log('verified before: ', resultSearch);

                            resultSearch?.sort((firstItem, secondItem) => {
                                return firstItem.refIndex - secondItem.refIndex;
                            });

                            console.log('verified after: ', resultSearch);

                            const elSortVerified = document.getElementById('ycs_btn_verified') as HTMLElement;
                            // Use sortOrder from param if provided (from text search), otherwise use button's dataset
                            const sortType = param?.sortOrder || (elSortVerified.dataset.sort as 'newest' | 'oldest');

                            if (sortType === 'newest') {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortVerified.innerHTML = `<span class="ycs-creator-verified_icon">✔</span> ${iconSortDown()}`;
                                elSortVerified.title =
                                    'Show comments,  replies and chat from a verified authors (Newest)';
                            } else if (sortType === 'oldest') {
                                renderComment(selector, resultSearch?.reverse(), true, querySearch);
                                elSortVerified.innerHTML = `<span class="ycs-creator-verified_icon">✔</span> ${iconSortUp()}`;
                                elSortVerified.title =
                                    'Show comments,  replies and chat from a verified authors (Oldest)';
                            } else {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortVerified.innerHTML = `<span class="ycs-creator-verified_icon">✔</span> ${iconSortDown()}`;
                            }
                        }
                    } else if (param?.random) {
                        // If there is a query, pick a random comment from the text-matched pool.
                        if (querySearch && querySearch.trim()) {
                            const fuseBase = new Fuse(comments, options);
                            const baseMatches = fuseBase.search(querySearch.trim()) as any[];
                            const pool = baseMatches.map((r: any) => ({
                                item: r.item,
                                refIndex: (r.item as any)?._index
                            }));

                            if (pool.length > 0) {
                                const pick = pool[Math.floor(Math.random() * pool.length)];
                                resultSearch = [pick] as any;
                            } else {
                                resultSearch = [] as any;
                            }
                        } else {
                            const randomComment = getRandomComment(comments);
                            resultSearch = randomComment;
                        }

                        renderComment(selector, resultSearch, true, querySearch);

                        console.log('Get Random COMMENT: ', resultSearch);
                    } else if (param?.timestamp) {
                        // No second fuse; simply filter those marked as timeline
                        let timeline = comments
                            .filter((c: any) => c?.commentRenderer?.isTimeLine === 'timeline')
                            .map((c: any) => ({ item: c, refIndex: (c as any)?._index }));
                        if (textMatchedSet) timeline = timeline.filter((r: any) => textMatchedSet?.has(r.item));
                        resultSearch = timeline as any;

                        if (resultSearch.length > 0) {
                            resultSearch?.sort((a, b) => a.refIndex - b.refIndex);

                            const elSortTimeStamp = document.getElementById('ycs_btn_timestamps') as HTMLElement;
                            const sortType = param?.sortOrder || (elSortTimeStamp.dataset.sort as 'newest' | 'oldest');

                            if (sortType === 'newest') {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortTimeStamp.innerHTML = `Time stamps ${iconSortDown()}`;
                                elSortTimeStamp.title = 'Show comments, replies, chat with time stamps (Newest)';
                            } else if (sortType === 'oldest') {
                                renderComment(selector, resultSearch?.reverse(), true, querySearch);
                                elSortTimeStamp.innerHTML = `Time stamps ${iconSortUp()}`;
                                elSortTimeStamp.title = 'Show comments, replies, chat with time stamps (Oldest)';
                            } else {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortTimeStamp.innerHTML = `Time stamps ${iconSortDown()}`;
                            }
                        }
                    } else if (param?.sortFirst) {
                        const firstComments = filterNewestFirst(comments) as ICommentsFuseResult[];
                        resultSearch = firstComments;

                        // If there is a text query, restrict to matched items first
                        if (textMatchedSet) {
                            resultSearch = resultSearch.filter((r: any) => textMatchedSet?.has(r.item));
                        }

                        if (resultSearch.length > 0) {
                            const elSortAll = document.getElementById('ycs_btn_sort_first') as HTMLElement;
                            // Use sortOrder from param if provided (from text search), otherwise use button's dataset
                            const sortType = param?.sortOrder || (elSortAll.dataset.sort as 'newest' | 'oldest');

                            if (sortType === 'newest') {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortAll.innerHTML = `All ${iconSortDown()}`;
                                elSortAll.title = 'Show all comments, chat, video transcript sorted by date (Newest)';

                                // markTextComment(selector, querySearch);
                            } else if (sortType === 'oldest') {
                                renderComment(selector, resultSearch?.reverse(), true, querySearch);
                                elSortAll.innerHTML = `All ${iconSortUp()}`;
                                elSortAll.title = 'Show all comments, chat, video transcript sorted by date (Oldest)';
                            } else {
                                renderComment(selector, resultSearch, true, querySearch);
                                elSortAll.innerHTML = `All ${iconSortDown()}`;
                            }

                            console.log('Get First COMMENT: ', firstComments);
                        }
                    } else {
                        const fuse = new Fuse(comments, options);
                        // Map to original index to make downstream sort stable
                        resultSearch = (fuse.search(querySearch.trim()) as any[]).map((r: any) => ({
                            item: r.item,
                            refIndex: (r.item as any)?._index,
                            score: r.score
                        }));
                        renderComment(selector, resultSearch, true, querySearch);
                    }

                    console.log('SEARCH COMMENTS QUERY: ', querySearch);
                    // const resultSearch = fuse.search(querySearch.trim()) as Comments[];
                    console.log('AFTER FUSE SEARCH RESULT: ', resultSearch);

                    console.log('Fuse search: ', resultSearch);

                    // Use unified helper function to update total result display
                    updateTotalResultDisplay(`(Comments) Found: ${resultSearch.length}`);

                    countSearchComments.comments = resultSearch.length;

                    console.log('RESULT SEARCH: ', resultSearch);

                    const elsCommentOpenReply = document.getElementById('ycs_wrap_comments');

                    if (elsCommentOpenReply) {
                        elsCommentOpenReply.addEventListener('click', (e) => {
                            try {
                                console.log('EVENT CLICK FOR REPLY: ', e);
                                if ((e.target as HTMLElement)?.classList?.contains('ycs-open-comment')) {
                                    const refID = parseInt((e.target as HTMLElement).getAttribute('id') as string, 10);
                                    console.log('refID: ', refID);

                                    const reply = (e.target as HTMLElement).closest('.ycs-render-comment');

                                    console.log('reply: ', reply);

                                    if (reply && refID && !document.getElementById('ycs-com-' + refID)) {
                                        try {
                                            // Find the origin comment by matching _index
                                            const origin = comments.find((x: any) => (x as any)?._index === refID);
                                            const com = origin
                                                ? { item: (origin as any).originComment, refIndex: refID }
                                                : (undefined as any);

                                            const wrap = document.createElement('div');
                                            wrap.id = 'ycs-com-' + refID.toString();
                                            wrap.className = wrap.id;

                                            reply.insertAdjacentElement('beforebegin', wrap);

                                            if (com) renderComment('#' + wrap.id, [com], true, querySearch);

                                            reply.classList.add('ycs-oc-ml');

                                            let toReplyAuthor;
                                            if ((origin as any)?.commentRenderer?.contentText?.runs?.length > 0) {
                                                for (const msg of (origin as any).commentRenderer.contentText.runs) {
                                                    try {
                                                        if (msg.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl) {
                                                            toReplyAuthor =
                                                                msg.navigationEndpoint?.browseEndpoint
                                                                    ?.canonicalBaseUrl;
                                                            break;
                                                        }
                                                    } catch (err) {
                                                        console.error(err);
                                                        continue;
                                                    }
                                                }
                                            }

                                            const replyAuthor = [];
                                            if (toReplyAuthor) {
                                                for (const auth of comments) {
                                                    try {
                                                        if (
                                                            (auth as any).typeComment === 'R' &&
                                                            (auth as any).originComment ===
                                                                (origin as any).originComment &&
                                                            (auth as any).commentRenderer?.authorEndpoint
                                                                ?.browseEndpoint?.canonicalBaseUrl === toReplyAuthor
                                                        ) {
                                                            replyAuthor.push({
                                                                item: auth,
                                                                refIndex: refID
                                                            });
                                                        }
                                                    } catch (err) {
                                                        console.error(err);
                                                        continue;
                                                    }
                                                }
                                            }

                                            if (replyAuthor.length > 0) {
                                                console.log('replyAuthor: ', replyAuthor);
                                                const wrapToReply = document.createElement('div');
                                                wrapToReply.id = 'ycs-com-rauth-' + refID.toString();
                                                wrapToReply.className = `ycs-com-${refID} ycs-oc-ml`;
                                                reply.insertAdjacentElement('beforebegin', wrapToReply);

                                                renderComment('#' + wrapToReply.id, replyAuthor, false, querySearch);
                                            }

                                            (e.target as HTMLElement).innerHTML = `${iconCollapse()}`;
                                            (e.target as HTMLElement).title = 'Close the comment to the reply here.';
                                        } catch (err) {
                                            console.error(err);
                                        }
                                    } else if (reply && refID && document.getElementById('ycs-com-' + refID)) {
                                        removeNodeList('.ycs-com-' + refID);

                                        reply.classList.remove('ycs-oc-ml');
                                        (e.target as HTMLElement).innerHTML = `${iconExpand()}`;
                                        (e.target as HTMLElement).title = 'Open the comment to the reply here.';
                                    }
                                } else if ((e.target as HTMLElement)?.classList?.contains('ycs-gotochat-video')) {
                                    e.preventDefault();

                                    const elFrameVideo: HTMLVideoElement = document.getElementsByTagName('video')[0];

                                    if (elFrameVideo) {
                                        const ms = (e.target as HTMLElement).dataset.offsetvideo;

                                        console.log('MS: ', ms);

                                        if (ms) {
                                            elFrameVideo.currentTime = parseInt(ms);
                                        }
                                    }
                                } else if ((e.target as HTMLElement)?.classList?.contains('ycs-open-reply')) {
                                    const id = (e.target as HTMLElement).dataset.idcom;

                                    const wrap = (e.target as HTMLElement).closest('.ycs-render-comment');
                                    console.log('WRAP ELEMENT: ', wrap);

                                    if (wrap?.querySelector(`.ycs-com-replies-${id}`)) {
                                        const replies = wrap.querySelector(`.ycs-com-replies-${id}`);
                                        replies?.remove();

                                        (e.target as HTMLElement).innerHTML = '+';
                                        (e.target as HTMLElement).title = 'Open replies to the comment';

                                        return;
                                    }

                                    const repls = [];
                                    if (id) {
                                        let index: number | undefined;

                                        for (const [i, o] of comments.entries()) {
                                            try {
                                                // console.log(i, o);
                                                if ((o as any).commentRenderer?.commentId === id) {
                                                    index = i;
                                                    break;
                                                }
                                            } catch (err) {
                                                console.error(err);
                                                continue;
                                            }
                                        }

                                        console.log('INDEX: ', index);

                                        if (Number.isInteger(index) && (index as number) >= 0) {
                                            for (const c of comments) {
                                                try {
                                                    if (comments[index as number] === (c as any).originComment) {
                                                        repls.push({
                                                            item: c,
                                                            refIndex: id
                                                        });
                                                    }
                                                } catch (err) {
                                                    console.error(err);
                                                    continue;
                                                }
                                            }
                                        }
                                    }

                                    if (repls.length > 0) {
                                        const reply = (e.target as HTMLElement).closest('.ycs-render-comment');

                                        console.log('reply: ', reply);

                                        const wrapToReply = document.createElement('div');
                                        wrapToReply.id = 'ycs-com-replies-' + id;
                                        wrapToReply.className = `ycs-com-replies-${id} ycs-oc-ml ycs-com-replies ycs-com-rp`;
                                        reply?.insertAdjacentElement('beforeend', wrapToReply);

                                        renderComment(wrapToReply, repls, false, querySearch);

                                        (e.target as HTMLElement).innerHTML = String.fromCharCode(8722);
                                        (e.target as HTMLElement).title = 'Close replies to the comment';
                                    }

                                    console.log('ID: ', id);
                                    console.log('e.target: ', e.target);
                                }
                            } catch (err) {
                                console.error(err);
                            }
                        });
                    }
                } catch (err) {
                    console.error(err);
                }
            };

            const searchCommentsChat = (selector: string, param?: IParamSearch): void => {
                try {
                    if (CHAT_UNSUPPORTED_FILTERS.some((filter) => param?.[filter])) {
                        const elSearchRes = document.querySelector(selector);
                        if (elSearchRes) elSearchRes.textContent = '';
                        updateTotalResultDisplay('(Chat replay) Found: 0');
                        countSearchComments.commentsChat = 0;
                        return;
                    }

                    if (commentsChat && commentsChat.size > 0) {
                        const elSearchRes = document.querySelector(selector);
                        const inputSearch = document.getElementById('ycs-input-search');

                        const cmntsChat = [...commentsChat.values()];
                        console.log('cmntsChat: ', cmntsChat);
                        let querySearch = '';

                        if (inputSearch) {
                            querySearch = (inputSearch as HTMLInputElement).value;
                        }

                        console.log('query Search for CHAT: ', querySearch);

                        if (elSearchRes) elSearchRes.textContent = '';

                        const elExtSearchTitle = document.getElementById(
                            'ycs_extended_search_title'
                        ) as HTMLInputElement;
                        const elExtSearchMain = document.getElementById('ycs_extended_search_main') as HTMLInputElement;

                        let fuseOpt = fuseOptions;
                        let keysOpt = [
                            'replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.authorName.simpleText',
                            'replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.message.fullText'
                        ];

                        if (elExtSearch?.checked) {
                            fuseOpt = JSON.parse(JSON.stringify(fuseOptions));
                            fuseOpt.useExtendedSearch = true;

                            if (elExtSearchTitle.checked) {
                                keysOpt = [
                                    'replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.authorName.simpleText'
                                ];
                            }

                            if (elExtSearchMain.checked) {
                                keysOpt = [
                                    'replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.message.fullText'
                                ];
                            }
                        }

                        const options: object = {
                            ...fuseOpt,
                            keys: keysOpt
                        };

                        let resultSearch: ICommentsFuseResult[] = [];

                        if (param?.author) {
                            const cmntsAuthor = filterAuthorChat(cmntsChat);
                            resultSearch = cmntsAuthor;
                            console.log('resultSearch chat author: ', resultSearch);

                            if (resultSearch?.length > 0) {
                                console.log('author Chat before: ', resultSearch);

                                resultSearch?.sort((firstItem, secondItem) => {
                                    return firstItem.refIndex - secondItem.refIndex;
                                });

                                console.log('author Chat after: ', resultSearch);

                                const elSortAuthor = document.getElementById('ycs_btn_author') as HTMLElement;
                                // Use sortOrder from param if provided (from text search), otherwise use button's dataset
                                const sortType =
                                    param?.sortOrder || (elSortAuthor.dataset.sortChat as 'newest' | 'oldest');

                                if (sortType === 'newest') {
                                    renderCommentChat(selector, resultSearch, querySearch);

                                    elSortAuthor.innerHTML = `Author ${iconSortDown()}`;
                                    elSortAuthor.title = 'Show comments, replies, chat from the author (Newest)';
                                } else if (sortType === 'oldest') {
                                    renderCommentChat(selector, resultSearch?.reverse(), querySearch);

                                    elSortAuthor.innerHTML = `Author ${iconSortUp()}`;
                                    elSortAuthor.title = 'Show comments, replies, chat from the author (Oldest)';
                                } else {
                                    renderCommentChat(selector, resultSearch, querySearch);
                                }
                            }

                            console.log('COMMENT CHAT authorIsChannelOwner SEARCH: ', cmntsAuthor);
                        } else if (param?.donated) {
                            const cmntsDonated = filterDonatedChat(cmntsChat);
                            resultSearch = cmntsDonated;

                            if (resultSearch?.length > 0) {
                                console.log('donated Chat before: ', resultSearch);

                                resultSearch?.sort((firstItem, secondItem) => {
                                    return firstItem.refIndex - secondItem.refIndex;
                                });

                                console.log('donated Chat after: ', resultSearch);

                                const elSortDonated = document.getElementById('ycs_btn_donated') as HTMLElement;
                                // Use sortOrder from param if provided (from text search), otherwise use button's dataset
                                const sortType =
                                    param?.sortOrder || (elSortDonated.dataset.sortChat as 'newest' | 'oldest');

                                if (sortType === 'newest') {
                                    // Apply search text filter if present
                                    if (querySearch && querySearch.trim()) {
                                        const base = resultSearch.map((r: any) => r.item);
                                        const fuse = new Fuse(base, options);
                                        const filtered = fuse.search(querySearch.trim()) as ICommentsFuseResult[];
                                        renderCommentChat(selector, filtered, querySearch);
                                        resultSearch = filtered;
                                    } else {
                                        renderCommentChat(selector, resultSearch, querySearch);
                                    }

                                    elSortDonated.innerHTML = `Donated ${iconSortDown()}`;
                                    elSortDonated.title = 'Show chat comments from users who have donated (Newest)';
                                } else if (sortType === 'oldest') {
                                    // Apply search text filter if present
                                    if (querySearch && querySearch.trim()) {
                                        const base = resultSearch.map((r: any) => r.item).reverse();
                                        const fuse = new Fuse(base, options);
                                        const filtered = fuse.search(querySearch.trim()) as ICommentsFuseResult[];
                                        renderCommentChat(selector, filtered, querySearch);
                                        resultSearch = filtered;
                                    } else {
                                        renderCommentChat(selector, resultSearch?.reverse(), querySearch);
                                    }

                                    elSortDonated.innerHTML = `Donated ${iconSortUp()}`;
                                    elSortDonated.title = 'Show chat comments from users who have donated (Oldest)';
                                } else {
                                    renderCommentChat(selector, resultSearch, querySearch);
                                    elSortDonated.innerHTML = `Donated ${iconSortDown()}`;
                                }
                            }

                            console.log('cmntsDonated: ', cmntsDonated);
                        } else if (param?.members) {
                            const cmntsMembers = filterMembersChat(cmntsChat);
                            resultSearch = cmntsMembers;

                            if (resultSearch?.length > 0) {
                                console.log('member Chat before: ', resultSearch);

                                resultSearch?.sort((firstItem, secondItem) => {
                                    return firstItem.refIndex - secondItem.refIndex;
                                });

                                console.log('member Chat after: ', resultSearch);

                                const elSortMember = document.getElementById('ycs_btn_members') as HTMLElement;
                                // Use sortOrder from param if provided (from text search), otherwise use button's dataset
                                const sortType =
                                    param?.sortOrder || (elSortMember.dataset.sortChat as 'newest' | 'oldest');

                                if (sortType === 'newest') {
                                    // Apply search text filter if present
                                    if (querySearch && querySearch.trim()) {
                                        const base = resultSearch.map((r: any) => r.item);
                                        const fuse = new Fuse(base, options);
                                        const filtered = fuse.search(querySearch.trim()) as ICommentsFuseResult[];
                                        renderCommentChat(selector, filtered, querySearch);
                                        resultSearch = filtered;
                                    } else {
                                        renderCommentChat(selector, resultSearch, querySearch);
                                    }

                                    elSortMember.innerHTML = `Members ${iconSortDown()}`;
                                    elSortMember.title = 'Show comments, replies, chat from channel members (Newest)';
                                } else if (sortType === 'oldest') {
                                    // Apply search text filter if present
                                    if (querySearch && querySearch.trim()) {
                                        const base = resultSearch.map((r: any) => r.item).reverse();
                                        const fuse = new Fuse(base, options);
                                        const filtered = fuse.search(querySearch.trim()) as ICommentsFuseResult[];
                                        renderCommentChat(selector, filtered, querySearch);
                                        resultSearch = filtered;
                                    } else {
                                        renderCommentChat(selector, resultSearch?.reverse(), querySearch);
                                    }

                                    elSortMember.innerHTML = `Members ${iconSortUp()}`;
                                    elSortMember.title = 'Show comments, replies, chat from channel members (Oldest)';
                                } else {
                                    renderCommentChat(selector, resultSearch, querySearch);
                                }

                                console.log('COMMENT CHAT cmntsMembers: ', cmntsMembers);
                            }
                        } else if (param?.timestamp) {
                            (options as any).keys = [
                                'replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.isTimeLine'
                            ];

                            console.log('CHAT TIMELINE SEARCH');

                            const fuse = new Fuse(cmntsChat, options);
                            resultSearch = fuse.search('timeline') as ICommentsFuseResult[];

                            if (resultSearch?.length > 0) {
                                console.log('timestamp CHAT before: ', resultSearch);

                                resultSearch?.sort((firstItem, secondItem) => {
                                    return firstItem.refIndex - secondItem.refIndex;
                                });

                                console.log('timestamp CHAT after: ', resultSearch);

                                const elSortTimeStamp = document.getElementById('ycs_btn_timestamps') as HTMLElement;
                                // Use sortOrder from param if provided (from text search), otherwise use button's dataset
                                const sortType =
                                    param?.sortOrder || (elSortTimeStamp.dataset.sortChat as 'newest' | 'oldest');

                                if (sortType === 'newest') {
                                    renderCommentChat(selector, resultSearch, querySearch);

                                    elSortTimeStamp.innerHTML = `Time stamps ${iconSortDown()}`;
                                    elSortTimeStamp.title = 'Show comments, replies, chat with time stamps (Newest)';
                                } else if (sortType === 'oldest') {
                                    renderCommentChat(selector, resultSearch?.reverse(), querySearch);

                                    elSortTimeStamp.innerHTML = `Time stamps ${iconSortUp()}`;
                                    elSortTimeStamp.title = 'Show comments, replies, chat with time stamps (Oldest)';
                                } else {
                                    renderCommentChat(selector, resultSearch, querySearch);
                                }
                            }
                        } else if (param?.sortFirst) {
                            const cmntsChatAll = filterChatNewestFirst(commentsChat) as ICommentsFuseResult[];
                            resultSearch = cmntsChatAll;

                            // If there is a query, restrict to matched chat items
                            if (querySearch && querySearch.trim()) {
                                try {
                                    const fuseBase = new Fuse(cmntsChat, options);
                                    const baseMatches = fuseBase.search(querySearch.trim()) as any[];
                                    const matched = new Set(baseMatches.map((r: any) => r.item));
                                    resultSearch = resultSearch.filter((r: any) => matched.has(r.item));
                                } catch (err) {
                                    console.error(err);
                                }
                            }

                            if (resultSearch?.length > 0) {
                                console.log('All Chat before: ', resultSearch);

                                resultSearch?.sort((firstItem, secondItem) => {
                                    return firstItem.refIndex - secondItem.refIndex;
                                });

                                console.log('All Chat after: ', resultSearch);

                                const elSortChatAll = document.getElementById('ycs_btn_sort_first') as HTMLElement;
                                // Use sortOrder from param if provided (from text search), otherwise use button's dataset
                                const sortType =
                                    param?.sortOrder || (elSortChatAll.dataset.sortChat as 'newest' | 'oldest');

                                if (sortType === 'newest') {
                                    renderCommentChat(selector, resultSearch, querySearch);

                                    elSortChatAll.innerHTML = `All ${iconSortDown()}`;
                                    elSortChatAll.title =
                                        'Show all comments, chat, video transcript sorted by date (Newest)';
                                } else if (sortType === 'oldest') {
                                    renderCommentChat(selector, resultSearch?.reverse(), querySearch);

                                    elSortChatAll.innerHTML = `All ${iconSortUp()}`;
                                    elSortChatAll.title =
                                        'Show all comments, chat, video transcript sorted by date (Oldest)';
                                } else {
                                    renderCommentChat(selector, resultSearch, querySearch);
                                }
                            }
                        } else if (param?.verified) {
                            const cmntsChatAll = filterVerifiedChatComments(commentsChat) as ICommentsFuseResult[];
                            resultSearch = cmntsChatAll;

                            console.log('cmntsChatAll, filterVerifiedChatComments: ', resultSearch);

                            if (resultSearch?.length > 0) {
                                console.log('All filterVerifiedChatComments before: ', resultSearch);

                                resultSearch?.sort((firstItem, secondItem) => {
                                    return firstItem.refIndex - secondItem.refIndex;
                                });

                                console.log('All filterVerifiedChatComments after: ', resultSearch);

                                const elSortVerified = document.getElementById('ycs_btn_verified') as HTMLElement;
                                // Use sortOrder from param if provided (from text search), otherwise use button's dataset
                                const sortType =
                                    param?.sortOrder || (elSortVerified.dataset.sortChat as 'newest' | 'oldest');

                                if (sortType === 'newest') {
                                    renderCommentChat(selector, resultSearch, querySearch);

                                    elSortVerified.innerHTML = `<span class="ycs-creator-verified_icon">✔</span> ${iconSortDown()}`;
                                    elSortVerified.title =
                                        'Show comments,  replies and chat from a verified authors (Newest)';
                                } else if (sortType === 'oldest') {
                                    renderCommentChat(selector, resultSearch?.reverse(), querySearch);

                                    elSortVerified.innerHTML = `<span class="ycs-creator-verified_icon">✔</span> ${iconSortUp()}`;
                                    elSortVerified.title =
                                        'Show comments,  replies and chat from a verified authors (Oldest)';
                                } else {
                                    renderCommentChat(selector, resultSearch, querySearch);
                                }
                            }
                        } else if (param?.links) {
                            const cmntsChatAll = filterLinksChatComments(commentsChat) as ICommentsFuseResult[];
                            resultSearch = cmntsChatAll;

                            console.log('cmntsChatAll, filterLinksChatComments: ', resultSearch);

                            if (resultSearch?.length > 0) {
                                console.log('All filterLinksChatComments before: ', resultSearch);

                                resultSearch?.sort((firstItem, secondItem) => {
                                    return firstItem.refIndex - secondItem.refIndex;
                                });

                                console.log('All filterLinksChatComments after: ', resultSearch);

                                const elSortVerified = document.getElementById('ycs_btn_links') as HTMLElement;
                                // Use sortOrder from param if provided (from text search), otherwise use button's dataset
                                const sortType =
                                    param?.sortOrder || (elSortVerified.dataset.sortChat as 'newest' | 'oldest');

                                if (sortType === 'newest') {
                                    // Apply search text filter if present
                                    if (querySearch && querySearch.trim()) {
                                        const base = resultSearch.map((r: any) => r.item);
                                        const fuse = new Fuse(base, options);
                                        const filtered = fuse.search(querySearch.trim()) as ICommentsFuseResult[];
                                        renderCommentChat(selector, filtered, querySearch);
                                        resultSearch = filtered;
                                    } else {
                                        renderCommentChat(selector, resultSearch, querySearch);
                                    }

                                    elSortVerified.innerHTML = `Links ${iconSortDown()}`;
                                    elSortVerified.title =
                                        'Shows links in comments, replies, chat, video transcript (Newest)';
                                } else if (sortType === 'oldest') {
                                    // Apply search text filter if present
                                    if (querySearch && querySearch.trim()) {
                                        const base = resultSearch.map((r: any) => r.item).reverse();
                                        const fuse = new Fuse(base, options);
                                        const filtered = fuse.search(querySearch.trim()) as ICommentsFuseResult[];
                                        renderCommentChat(selector, filtered, querySearch);
                                        resultSearch = filtered;
                                    } else {
                                        renderCommentChat(selector, resultSearch?.reverse(), querySearch);
                                    }

                                    elSortVerified.innerHTML = `Links ${iconSortUp()}`;
                                    elSortVerified.title =
                                        'Shows links in comments, replies, chat, video transcript (Oldest)';
                                } else {
                                    renderCommentChat(selector, resultSearch, querySearch);
                                }
                            }
                        } else {
                            const fuse = new Fuse(cmntsChat, options);
                            resultSearch = (fuse.search(querySearch.trim()) as any[]).map((r: any) => ({
                                item: r.item,
                                refIndex:
                                    parseInt(
                                        wrapTryCatch(
                                            () =>
                                                r.item.replayChatItemAction.actions[0].addChatItemAction.item
                                                    .liveChatTextMessageRenderer.timestampUsec
                                        ) as any,
                                        10
                                    ) || 0,
                                score: r.score
                            }));

                            renderCommentChat(selector, resultSearch, querySearch);
                        }

                        console.log('BEFORE SEARCH CHAT: ', cmntsChat);

                        console.log('FUSE SEARCH CHAT: ', resultSearch);

                        // Use unified helper function to update total result display
                        updateTotalResultDisplay(`(Chat replay) Found: ${resultSearch.length}`);
                        countSearchComments.commentsChat = resultSearch.length;

                        const elsGotoChatVideo = document.getElementById('ycs_wrap_comments_chat');

                        elsGotoChatVideo?.addEventListener('click', (e) => {
                            try {
                                if ((e.target as HTMLElement)?.classList?.contains('ycs-gotochat-video')) {
                                    const elFrameVideo: HTMLVideoElement = document.getElementsByTagName('video')[0];

                                    e.preventDefault();

                                    if (elFrameVideo) {
                                        const ms = (e.target as HTMLElement).dataset.offsetvideo;

                                        console.log('MS: ', ms);

                                        if (ms) {
                                            elFrameVideo.currentTime = parseInt(ms) / 1000;
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error(err);
                                return;
                            }
                        });
                    }
                } catch (err) {
                    console.error(err);
                }
            };

            const searchCommentsTrVideo = (selector: string, param?: IParamSearch): void => {
                try {
                    if (TRANSCRIPT_UNSUPPORTED_FILTERS.some((filter) => param?.[filter])) {
                        // Clear UI elements before returning to avoid showing stale data
                        const elSearchRes = document.querySelector(selector);
                        if (elSearchRes) elSearchRes.textContent = '';
                        // Display zero count instead of hiding (consistent with user expectation)
                        updateTotalResultDisplay('(Tr. video) Found: 0');
                        countSearchComments.commentsTrVideo = 0;
                        return;
                    }

                    if (
                        commentsTrVideo &&
                        wrapTryCatch(
                            () =>
                                (commentsTrVideo as any).actions[0].updateEngagementPanelAction.content
                                    .transcriptRenderer.body.transcriptBodyRenderer.cueGroups.length > 0
                        )
                    ) {
                        const elSearchRes = document.querySelector(selector);
                        const inputSearch = document.getElementById('ycs-input-search');

                        const cmntsTrVideo = (commentsTrVideo as any).actions[0].updateEngagementPanelAction.content
                            .transcriptRenderer.body.transcriptBodyRenderer.cueGroups;

                        let querySearch = '';
                        if (inputSearch) {
                            querySearch = (inputSearch as HTMLInputElement).value;
                        }

                        console.log('query Search for TRVIDEO: ', querySearch);

                        if (elSearchRes) elSearchRes.textContent = '';

                        const elExtSearchTitle = document.getElementById(
                            'ycs_extended_search_title'
                        ) as HTMLInputElement;
                        const elExtSearchMain = document.getElementById('ycs_extended_search_main') as HTMLInputElement;

                        let fuseOpt = fuseOptions;
                        let keysOpt = [
                            'transcriptCueGroupRenderer.cues.transcriptCueRenderer.cue.simpleText',
                            'transcriptCueGroupRenderer.formattedStartOffset.simpleText'
                        ];

                        if (elExtSearch?.checked) {
                            fuseOpt = JSON.parse(JSON.stringify(fuseOptions));
                            fuseOpt.useExtendedSearch = true;

                            if (elExtSearchTitle.checked) {
                                keysOpt = ['transcriptCueGroupRenderer.formattedStartOffset.simpleText'];
                            }

                            if (elExtSearchMain.checked) {
                                keysOpt = ['transcriptCueGroupRenderer.cues.transcriptCueRenderer.cue.simpleText'];
                            }
                        }

                        const options: object = {
                            ...fuseOpt,
                            keys: keysOpt
                        };

                        console.log('BEFORE SEARCH TRVIDEO: ', cmntsTrVideo);

                        let resultSearch: any[] = [];

                        let textMatchedSet: Set<any> | null = null;

                        if (querySearch && querySearch.trim()) {
                            const fuseBase = new Fuse(cmntsTrVideo, options);
                            const baseMatches = fuseBase.search(querySearch.trim()) as any[];
                            textMatchedSet = new Set(baseMatches.map((r: any) => r.item));
                        }

                        if (param) {
                            if (param?.links) {
                                const trpVideo = filterLinksTrpVideoComments(cmntsTrVideo) as ICommentsFuseResult[];
                                resultSearch = trpVideo;

                                console.log('filterLinksTrpVideoComments resultSearch: ', resultSearch);

                                if (resultSearch?.length > 0) {
                                    console.log('All filterLinksTrpVideoComments before: ', resultSearch);

                                    resultSearch?.sort((firstItem, secondItem) => {
                                        return firstItem.refIndex - secondItem.refIndex;
                                    });

                                    console.log('All filterLinksTrpVideoComments after: ', resultSearch);

                                    const elSortLinksTrpVideo = document.getElementById('ycs_btn_links') as HTMLElement;
                                    const sortType = elSortLinksTrpVideo.dataset.sortTrp as 'newest' | 'oldest';

                                    if (sortType === 'newest') {
                                        // Apply search text filter if present
                                        if (querySearch && querySearch.trim()) {
                                            const base = resultSearch.map((r: any) => r.item);
                                            const fuse = new Fuse(base, options);
                                            const filtered = fuse.search(querySearch.trim()) as ICommentsFuseResult[];
                                            renderCommentTrVideo(selector, filtered, querySearch);
                                            resultSearch = filtered;
                                        } else {
                                            renderCommentTrVideo(selector, resultSearch, querySearch);
                                        }

                                        elSortLinksTrpVideo.innerHTML = `Links ${iconSortDown()}`;
                                        elSortLinksTrpVideo.title =
                                            'Shows links in comments, replies, chat, video transcript (Newest)';
                                    } else if (sortType === 'oldest') {
                                        // Apply search text filter if present
                                        if (querySearch && querySearch.trim()) {
                                            const base = resultSearch.map((r: any) => r.item).reverse();
                                            const fuse = new Fuse(base, options);
                                            const filtered = fuse.search(querySearch.trim()) as ICommentsFuseResult[];
                                            renderCommentTrVideo(selector, filtered, querySearch);
                                            resultSearch = filtered;
                                        } else {
                                            renderCommentTrVideo(selector, resultSearch?.reverse(), querySearch);
                                        }

                                        elSortLinksTrpVideo.innerHTML = `Links ${iconSortUp()}`;
                                        elSortLinksTrpVideo.title =
                                            'Shows links in comments, replies, chat, video transcript (Oldest)';
                                    } else {
                                        renderCommentTrVideo(selector, resultSearch, querySearch);
                                    }
                                }
                            } else if (param?.sortFirst) {
                                const trpVideo = filterAllTrpVideoComments(cmntsTrVideo) as ICommentsFuseResult[];
                                resultSearch = trpVideo;

                                if (textMatchedSet) {
                                    resultSearch = resultSearch.filter((r: any) => textMatchedSet?.has(r.item));
                                }

                                console.log('filterAllTrpVideoComments resultSearch: ', resultSearch);

                                if (resultSearch?.length > 0) {
                                    console.log('All filterAllTrpVideoComments before: ', resultSearch);

                                    resultSearch?.sort((firstItem, secondItem) => {
                                        return firstItem.refIndex - secondItem.refIndex;
                                    });

                                    console.log('All filterAllTrpVideoComments after: ', resultSearch);

                                    const elSortAllTrpVideo = document.getElementById(
                                        'ycs_btn_sort_first'
                                    ) as HTMLElement;
                                    const sortType =
                                        param?.sortOrder || (elSortAllTrpVideo.dataset.sortTrp as 'newest' | 'oldest');

                                    if (sortType === 'newest') {
                                        renderCommentTrVideo(selector, resultSearch, querySearch);
                                        elSortAllTrpVideo.innerHTML = `All ${iconSortDown()}`;
                                        elSortAllTrpVideo.title =
                                            'Show all comments, chat, video transcript sorted by date (Newest)';
                                    } else if (sortType === 'oldest') {
                                        renderCommentTrVideo(selector, resultSearch?.reverse(), querySearch);
                                        elSortAllTrpVideo.innerHTML = `All ${iconSortUp()}`;
                                        elSortAllTrpVideo.title =
                                            'Show all comments, chat, video transcript sorted by date (Oldest)';
                                    } else {
                                        renderCommentTrVideo(selector, resultSearch, querySearch);
                                        elSortAllTrpVideo.innerHTML = `All ${iconSortDown()}`;
                                        elSortAllTrpVideo.title =
                                            'Show all comments, chat, video transcript sorted by date (Newest)';
                                    }
                                }
                            } else if (param?.timestamp) {
                                // mm:ss query: 將 querySearch 解析為分鐘/秒，篩選起始時間在該分鐘（或精確到秒）的句段
                                const mm = (querySearch || '').trim();
                                const mmRe = /^(\d{1,3})(?::(\d{1,2}))?$/;
                                const m = mmRe.exec(mm);
                                if (m) {
                                    const minutes = parseInt(m[1] || '0', 10);
                                    const seconds = m[2] ? parseInt(m[2], 10) : undefined;
                                    const fromMs = minutes * 60 * 1000 + (seconds ? seconds * 1000 : 0);
                                    const toMs = seconds === undefined ? (minutes + 1) * 60 * 1000 : fromMs + 1000;
                                    const filtered = (cmntsTrVideo as any[])
                                        .filter((g: any) => {
                                            const start = wrapTryCatch(
                                                () =>
                                                    g.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer
                                                        .startOffsetMs
                                            ) as number;
                                            return typeof start === 'number' && start >= fromMs && start < toMs;
                                        })
                                        .map((g: any) => ({
                                            item: g,
                                            refIndex: wrapTryCatch(
                                                () =>
                                                    g.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer
                                                        .startOffsetMs
                                            )
                                        }));
                                    resultSearch = filtered as any[];

                                    const elSortTimeStamp = document.getElementById(
                                        'ycs_btn_timestamps'
                                    ) as HTMLElement;
                                    const sortType = elSortTimeStamp?.dataset?.sortTrp as 'newest' | 'oldest';
                                    if (sortType === 'oldest') {
                                        renderCommentTrVideo(selector, resultSearch?.reverse(), querySearch);
                                        if (elSortTimeStamp) {
                                            elSortTimeStamp.dataset.sortTrp = 'newest';
                                            elSortTimeStamp.innerHTML = `Time stamps ${iconSortUp()}`;
                                            elSortTimeStamp.title =
                                                'Show comments, replies, chat with time stamps (Oldest)';
                                        }
                                    } else {
                                        renderCommentTrVideo(selector, resultSearch, querySearch);
                                        if (elSortTimeStamp) {
                                            elSortTimeStamp.dataset.sortTrp = 'oldest';
                                            elSortTimeStamp.innerHTML = `Time stamps ${iconSortDown()}`;
                                            elSortTimeStamp.title =
                                                'Show comments, replies, chat with time stamps (Newest)';
                                        }
                                    }
                                } else {
                                    // 無效時間格式則退回全文搜尋，並補上 refIndex
                                    const fuse = new Fuse(cmntsTrVideo, options);
                                    resultSearch = (fuse.search(querySearch.trim()) as any[]).map((r: any) => ({
                                        item: r.item,
                                        refIndex: wrapTryCatch(
                                            () =>
                                                r.item.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer
                                                    .startOffsetMs
                                        ),
                                        score: r.score
                                    }));
                                    renderCommentTrVideo(selector, resultSearch, querySearch);
                                }
                            } else {
                                // 無特定參數：全文搜尋，並補上 refIndex
                                const fuse = new Fuse(cmntsTrVideo, options);
                                resultSearch = (fuse.search(querySearch.trim()) as any[]).map((r: any) => ({
                                    item: r.item,
                                    refIndex: wrapTryCatch(
                                        () =>
                                            r.item.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer
                                                .startOffsetMs
                                    ),
                                    score: r.score
                                }));
                                renderCommentTrVideo(selector, resultSearch, querySearch);
                            }
                        } else {
                            const fuse = new Fuse(cmntsTrVideo, options);
                            resultSearch = (fuse.search(querySearch.trim()) as any[]).map((r: any) => ({
                                item: r.item,
                                refIndex: wrapTryCatch(
                                    () => r.item.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.startOffsetMs
                                ),
                                score: r.score
                            }));

                            renderCommentTrVideo(selector, resultSearch, querySearch);
                        }

                        console.log('FUSE SEARCH TR VIDEO: ', resultSearch);

                        // Use unified helper function to update total result display
                        updateTotalResultDisplay(`(Tr. video) Found: ${resultSearch.length}`);
                        countSearchComments.commentsTrVideo = resultSearch.length;

                        const elsGotoVideo = document.getElementById('ycs_wrap_comments_trvideo');

                        elsGotoVideo?.addEventListener('click', (e) => {
                            try {
                                console.log('TR EVENT CLICK: ', e);
                                console.log('TR EVENT CLICK currentTarget: ', e.currentTarget);
                                if ((e.target as HTMLElement)?.classList?.contains('ycs-goto-video')) {
                                    e.preventDefault();

                                    console.log('EVENT CLICK: ', e);

                                    const elFrameVideo: HTMLVideoElement = document.getElementsByTagName('video')[0];

                                    console.log('elFrameVideo: ', elFrameVideo);

                                    if (elFrameVideo) {
                                        const ms = (e.target as HTMLElement).dataset.offsetvideo;

                                        console.log('MS: ', ms);

                                        if (ms) {
                                            elFrameVideo.currentTime = parseInt(ms) / 1000;
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error(err);
                                return;
                            }
                        });
                    }
                } catch (err) {
                    console.error(err);
                }
            };

            const searchCommentsAll = (selector: string, param?: IParamSearch): void => {
                const elSearchAll = document.querySelector(selector);

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

                // Chat doesn't support: heart, likes, replied, random
                const hasChatUnsupportedFilter = CHAT_UNSUPPORTED_FILTERS.some((filter) => param?.[filter]);
                const shouldRenderChat = !param || param.sortFirst === true || !hasChatUnsupportedFilter;

                // Transcript doesn't support: author, donated, members, verified, heart, likes, replied, random
                const hasTranscriptUnsupportedFilter = TRANSCRIPT_UNSUPPORTED_FILTERS.some((filter) => param?.[filter]);
                const shouldRenderTranscript = !param || param.sortFirst === true || !hasTranscriptUnsupportedFilter;

                // Don't hide the element prematurely - let updateTotalResultDisplay() handle visibility
                if (elSearchAll) elSearchAll.textContent = '';

                const elWrapComments = document.createElement('div');
                elWrapComments.id = 'ycs_allsearch__wrap_comments';

                const elWrapCommentsChat = document.createElement('div');
                elWrapCommentsChat.id = 'ycs_allsearch__wrap_comments_chat';

                const elWrapCommentsTrVideo = document.createElement('div');
                elWrapCommentsTrVideo.id = 'ycs_allsearch__wrap_comments_trvideo';

                console.log('searchCommentsAll selector, param: ', selector, param);

                // Reset counters before re-rendering grouped results
                countSearchComments.comments = 0;
                countSearchComments.commentsChat = 0;
                countSearchComments.commentsTrVideo = 0;

                try {
                    if (comments.length > 0) {
                        console.log('comments!!!!!!', comments);
                        elSearchAll?.appendChild(elWrapComments);
                        searchComments('#ycs_allsearch__wrap_comments', param);
                    }

                    if (shouldRenderChat && commentsChat && commentsChat.size > 0) {
                        elSearchAll?.appendChild(elWrapCommentsChat);
                        searchCommentsChat('#ycs_allsearch__wrap_comments_chat', param);
                    }

                    if (
                        shouldRenderTranscript &&
                        commentsTrVideo &&
                        (wrapTryCatch(
                            () =>
                                (commentsTrVideo as any).actions[0].updateEngagementPanelAction.content
                                    .transcriptRenderer.body.transcriptBodyRenderer.cueGroups.length
                        ) as any) > 0
                    ) {
                        console.log('PARAM TR VIDEO!!!!!: ', param);
                        elSearchAll?.appendChild(elWrapCommentsTrVideo);
                        searchCommentsTrVideo('#ycs_allsearch__wrap_comments_trvideo', param);
                    }

                    // Use unified helper function to update total result display with proper text
                    const resTotalSearch =
                        countSearchComments.comments +
                        countSearchComments.commentsChat +
                        countSearchComments.commentsTrVideo;

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

                    console.log('click');

                    if (elSelectOptSearch) {
                        const selected: ISelectedSearch = elSelectOptSearch?.options[
                            elSelectOptSearch?.options?.selectedIndex
                        ].value as unknown as ISelectedSearch;

                        const activeParam = getActiveFilterParam();
                        switch (selected) {
                            case 'comments':
                                console.log('Switch 0');
                                searchComments('#ycs-search-result', activeParam);
                                break;
                            case 'chat':
                                console.log('Switch 1');
                                searchCommentsChat('#ycs-search-result', activeParam);
                                break;
                            case 'video':
                                console.log('Switch 2');
                                searchCommentsTrVideo('#ycs-search-result', activeParam);
                                break;
                            case 'all':
                                console.log('Switch 3');
                                searchCommentsAll('#ycs-search-result', activeParam);
                                break;
                            default:
                                console.log('Switch default');
                                break;
                        }
                    }

                    return;
                });
            }

            window.postMessage({ type: 'GET_OPTIONS' }, window.location.origin);

            handleMessageEvent = (e): void => {
                // console.log('EVENT MESSAGE e: ', e);

                if (e.origin !== window.location.origin) return;

                if (e.data?.type === 'YCS_OPTIONS' && e.data?.text) {
                    console.log('YCS_OPTIONS', e.data);

                    const optAutoload = (value: boolean): void => {
                        if (value === true) {
                            elLoadAll?.click();
                        }
                    };

                    const wrapOptAutoload = (value: boolean, opts: any): void => {
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
                            (GlobalStore as any).highlightExact = value;
                        } catch (err) {
                            console.error(err);
                        }
                    };

                    const optCached = (value: boolean): void => {
                        try {
                            if (!value) return;

                            sendGetCacheInIDB(window.location.href);
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
                        const opts = e.data.text;

                        for (const key of Object.keys(opts)) {
                            switch (key) {
                                case 'autoload':
                                    wrapOptAutoload(opts[key], opts);
                                    break;

                                case 'highlightText':
                                    optHighlightText(opts[key]);
                                    break;
                                case 'highlightExact':
                                    optHighlightExact(opts[key]);
                                    break;

                                case 'cache':
                                    optCached(opts[key]);
                                    break;

                                case 'hiddenByDefault':
                                    optHiddenByDefault(opts[key]);
                                    break;

                                default:
                                    break;
                            }
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }

                if (e.data?.type === 'YCS_CACHE_STORAGE_GET_RESPONSE') {
                    console.log('YCS_CACHE_STORAGE_GET_RESPONSE:', e.data);

                    if (e.data?.body) {
                        try {
                            // Rebuild reply-to-origin mapping using a single-pass index to reduce complexity from O(n^2) to O(n)
                            if (e.data.body.comments.length > 0) {
                                const originById: Record<string, any> = {};
                                for (const c of e.data.body.comments) {
                                    if (c?.typeComment === 'C') {
                                        const id = c?.commentRenderer?.commentId;
                                        if (typeof id === 'string' && id.length > 0) {
                                            originById[id] = c;
                                        }
                                    }
                                }

                                for (const cmnt of e.data.body.comments) {
                                    if (cmnt?.typeComment === 'R') {
                                        const refId = cmnt?.originComment?.commentRenderer?.commentId;
                                        if (typeof refId === 'string' && refId.length > 0) {
                                            const origin = originById[refId];
                                            if (origin) cmnt.originComment = origin;
                                        }
                                    }
                                }

                                comments = e.data.body.comments;
                            }
                        } catch (err) {
                            console.error(err);
                        }

                        commentsChat = new Map(JSON.parse(e.data.body.commentsChat));
                        commentsTrVideo = e.data.body.commentsTrVideo;

                        // Restore GlobalStore.getInitYtData with minimal structure for author filter
                        if (e.data.body.channelId) {
                            (GlobalStore as any).getInitYtData = {
                                playerResponse: {
                                    videoDetails: {
                                        channelId: e.data.body.channelId
                                    }
                                }
                            };
                        }

                        const crdate = e.data.body.date;

                        // comments
                        const elStatusCmnts = document.getElementById('ycs_status_cmnt');
                        if (comments.length > 0 && elStatusCmnts) {
                            elStatusCmnts.innerHTML = iconOk();
                        }

                        if (comments.length > 0 && (elLiveApp.parentNode || elLiveApp.parentElement)) {
                            countComments.comments = comments.length;
                        }

                        const elLoadCmnts = document.getElementById('ycs_cmnts');
                        if (elLoadCmnts) {
                            elLoadCmnts.textContent = `${comments.length}`;
                        }

                        // end comments

                        // chat

                        if (commentsChat && commentsChat.size > 0) {
                            const elLoadChat = document.getElementById('ycs_cmnts_chat') as HTMLElement;
                            const elStatusChat = document.getElementById('ycs_status_chat') as HTMLElement;
                            elLoadChat.textContent = commentsChat.size.toString();
                            elStatusChat.innerHTML = iconOk();
                        }

                        if (
                            commentsChat &&
                            commentsChat.size > 0 &&
                            (elLiveApp.parentNode || elLiveApp.parentElement)
                        ) {
                            countComments.commentsChat = commentsChat.size;
                        }

                        // end chat

                        // Tr. video

                        if (
                            wrapTryCatch(
                                () =>
                                    (commentsTrVideo as any)?.actions[0]?.updateEngagementPanelAction?.content
                                        ?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups?.length > 0
                            )
                        ) {
                            const elStatusTrVideo = document.getElementById('ycs_status_trvideo') as HTMLElement;
                            const elLoadTrVideo = document.getElementById('ycs_cmnts_video') as HTMLElement;

                            showLoadComments(
                                (commentsTrVideo as any).actions[0].updateEngagementPanelAction.content
                                    .transcriptRenderer.body.transcriptBodyRenderer.cueGroups.length,
                                elLoadTrVideo
                            );
                            elStatusTrVideo.innerHTML = iconOk();
                        }

                        if (
                            wrapTryCatch(
                                () =>
                                    (commentsTrVideo as any)?.actions[0]?.updateEngagementPanelAction?.content
                                        ?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups?.length > 0
                            ) &&
                            (elLiveApp.parentNode || elLiveApp.parentElement)
                        ) {
                            countComments.commentsTrVideo = (
                                commentsTrVideo as any
                            ).actions[0].updateEngagementPanelAction.content.transcriptRenderer.body.transcriptBodyRenderer.cueGroups.length;
                        }

                        // end tr. video

                        const totalCount =
                            countComments.comments + countComments.commentsChat + countComments.commentsTrVideo;
                        sendMsgToBadge('NUMBER_COMMENTS', totalCount);

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
                            // fuseOptions.useExtendedSearch = true;

                            if (elExtSearchTitle && elExtSearchMain) {
                                elExtSearchTitle.disabled = false;
                                elExtSearchMain.disabled = false;
                            }

                            // console.log('Ext. search CHECKED: ', fuseOptions.useExtendedSearch);
                        } else {
                            // fuseOptions.useExtendedSearch = false;

                            if (elExtSearchTitle && elExtSearchMain) {
                                elExtSearchTitle.disabled = true;
                                elExtSearchMain.disabled = true;
                            }

                            // console.log('Ext. search UN CHECKED: ', fuseOptions.useExtendedSearch);
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
                    prevUrl = getCleanUrlVideo(window.location.href);
                    // console.log('prevUrl After: ', prevUrl);

                    controller.abort();
                    app();
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
})();
