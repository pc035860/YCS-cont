/* eslint-disable @typescript-eslint/no-explicit-any */

import 'abort-controller/polyfill';

import { GlobalStore, extractChannelId, wrapTryCatch, getCleanUrlVideo, isVideoPage } from '../utils/common';
import {
    downloadFile,
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
import { getAllCommentsModeV2, getChatComments, getTranscriptVideo } from '../utils/innertube';
import { getCommentsChatHtmlText, getCommentsHtmlText, getCommentsTrVideoHtmlText } from '../utils/formatting';

import { ICommentsFuseResult, IParamSearch, ISelectedSearch } from '../utils/interfaces/i_types';

import { iconCollapse, iconExpand, iconOk, iconReload } from '../utils/icons';
import { renderComment, renderLoadComments, renderSearch } from '../utils/renderView';
import {
    clearComments,
    clearCommentsChat,
    clearCommentsTrVideo,
    createState,
    getComments,
    getCommentsChat,
    getCommentsTrVideo,
    getController,
    getCounts,
    getSearchCounts,
    resetController,
    resetSearchCounts,
    setComments,
    setCommentsChat,
    setCommentsTrVideo,
    setCount,
    setSearchCount,
    WebResourcesState
} from './state';
import { FilterButtonConfig, registerFilterButtons } from './ui/filters';
import { runSearch as runCommentsSearch } from './search/commentsSearch';
import { runSearch as runChatSearch } from './search/chatSearch';
import { runSearch as runTranscriptSearch } from './search/transcriptSearch';
import { renderCommentsResult, renderChatResult, renderTranscriptResult } from './ui/render';

const DEBUG = false;

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
    let handleMessageEvent: (ev: MessageEvent<any>) => unknown;

    let state = createState();

    function app(): void {
        if (!isVideoPage()) return;

        if (handleMessageEvent) {
            window.removeEventListener('message', handleMessageEvent);
        }

        state = createState();

        sendMsgToBadge('NUMBER_COMMENTS', '');

        removeNodeList('.ycs-app');

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

        const executeSearchBasedOnType = (param?: IParamSearch): void => {
            const elSelectOptSearch = document.getElementById('ycs_search_select') as HTMLSelectElement | null;
            const query = getSearchQuery();

            const selected = elSelectOptSearch
                ? (elSelectOptSearch.options[elSelectOptSearch.options.selectedIndex].value as ISelectedSearch)
                : 'all';

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
        const handlersBtnPanel = (hElms: any): void => {
            if (!hElms) {
                return;
            }

            const filterButtonConfigs: FilterButtonConfig[] = [
                { id: 'ycs_btn_timestamps', param: 'timestamp', supportsSort: true },
                { id: 'ycs_btn_author', param: 'author', supportsSort: true },
                { id: 'ycs_btn_heart', param: 'heart', supportsSort: true },
                { id: 'ycs_btn_verified', param: 'verified', supportsSort: true },
                { id: 'ycs_btn_links', param: 'links', supportsSort: true },
                { id: 'ycs_btn_likes', param: 'likes' },
                { id: 'ycs_btn_replied_comments', param: 'replied' },
                { id: 'ycs_btn_members', param: 'members', supportsSort: true },
                { id: 'ycs_btn_donated', param: 'donated', supportsSort: true },
                { id: 'ycs_btn_random', param: 'random' },
                { id: 'ycs_btn_sort_first', param: 'sortFirst', supportsSort: true }
            ];

            registerFilterButtons({
                state: {
                    get: () => state,
                    set: (nextState: WebResourcesState) => {
                        state = nextState;
                    }
                },
                executeSearch: executeSearchBasedOnType,
                setActiveFilter: setActiveFilterByElement,
                buttonConfigs: filterButtonConfigs
            });

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            hElms?.elPClear?.addEventListener('click', (e: Event) => {
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
                        const elSearchTotalRes: any = document.getElementById('ycs-search-total-result');

                        if (elSearchRes) {
                            elSearchRes.innerText = '';
                            elSearchTotalRes.innerText = 'Search cleared';
                        }
                    }

                    const btnClear = document.getElementById('ycs_btn_clear') as HTMLButtonElement | null;
                    if (btnClear) btnClear.style.visibility = 'hidden';
                } catch (err) {
                    console.error(err);
                }
            });
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

                state = clearComments(state);
                const comments = getComments(state);

                const currentTarget = e.currentTarget as HTMLButtonElement;

                currentTarget.disabled = true;
                currentTarget.innerText = 'reload';

                const elStatusCmnts = document.getElementById('ycs_status_cmnt');
                const elLoadCmnts = document.getElementById('ycs_cmnts');

                if (elLoadCmnts && elStatusCmnts) {
                    elLoadCmnts.textContent = '0';

                    elStatusCmnts.innerHTML = iconReload();

                    const controller = getController(state);

                    await getAllCommentsModeV2(elLoadCmnts, controller.signal, comments);

                    console.log('ORIGIN COMMENTS: ', comments);

                    if (comments.length > 0) {
                        elStatusCmnts.innerHTML = iconOk();
                        setCacheToIDB(
                            {
                                comments,
                                commentsChat: JSON.stringify(Array.from(getCommentsChat(state).entries())),
                                commentsTrVideo: getCommentsTrVideo(state),
                                channelId: extractChannelId()
                            },
                            window.location.href,
                            document.title
                        );
                    }
                }

                if (comments.length > 0) {
                    state = setCount(state, 'comments', comments.length);
                }

                const counts = getCounts(state);
                const totalCount = counts.comments + counts.commentsChat + counts.commentsTrVideo;
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

                state = clearCommentsChat(state);
                const commentsChat = getCommentsChat(state);

                const currentTarget = e.currentTarget as HTMLButtonElement;

                currentTarget.disabled = true;
                currentTarget.innerText = 'reload';

                const elStatusChat = document.getElementById('ycs_status_chat');
                const elLoadChat = document.getElementById('ycs_cmnts_chat');

                if (elLoadChat && elStatusChat) {
                    elLoadChat.textContent = '0';

                    elStatusChat.innerHTML = iconReload();

                    const controller = getController(state);

                    await getChatComments(controller.signal, elLoadChat, commentsChat);

                    console.log('CHAT COMMENTS: ', commentsChat);

                    if (commentsChat.size > 0) {
                        elLoadChat.textContent = commentsChat.size.toString();
                        elStatusChat.innerHTML = iconOk();
                        setCacheToIDB(
                            {
                                comments: getComments(state),
                                commentsChat: JSON.stringify(Array.from(commentsChat.entries())),
                                commentsTrVideo: getCommentsTrVideo(state),
                                channelId: extractChannelId()
                            },
                            window.location.href,
                            document.title
                        );
                    }
                }

                if (commentsChat.size > 0 && (elLiveApp.parentNode || elLiveApp.parentElement)) {
                    state = setCount(state, 'commentsChat', commentsChat.size);
                }

                const counts = getCounts(state);
                const totalCount = counts.comments + counts.commentsChat + counts.commentsTrVideo;
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
                    const controller = getController(state);
                    const tr = await getTranscriptVideo(controller.signal);
                    state = clearCommentsTrVideo(state);
                    if (
                        wrapTryCatch(
                            () =>
                                (tr as any)?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer
                                    ?.body?.transcriptBodyRenderer?.cueGroups?.length > 0
                        )
                    ) {
                        state = setCommentsTrVideo(state, tr);
                    }

                    try {
                        const transcript = getCommentsTrVideo(state);
                        if (
                            transcript &&
                            elLoadTrVideo &&
                            (transcript as any)?.actions?.length > 0 &&
                            (transcript as any)?.actions[0]?.updateEngagementPanelAction?.content?.transcriptRenderer
                                ?.body?.transcriptBodyRenderer?.cueGroups?.length > 0
                        ) {
                            showLoadComments(
                                (transcript as any).actions[0].updateEngagementPanelAction.content.transcriptRenderer
                                    .body.transcriptBodyRenderer.cueGroups.length,
                                elLoadTrVideo
                            );
                            setCacheToIDB(
                                {
                                    comments: getComments(state),
                                    commentsChat: JSON.stringify(Array.from(getCommentsChat(state).entries())),
                                    commentsTrVideo: transcript,
                                    channelId: extractChannelId()
                                },
                                window.location.href,
                                document.title
                            );
                        } else {
                            state = clearCommentsTrVideo(state);
                        }
                    } catch (err) {
                        console.error(err);
                        state = clearCommentsTrVideo(state);
                    }

                    const transcript = getCommentsTrVideo(state);
                    console.log('Transcript: ', transcript);

                    if (
                        wrapTryCatch(
                            () =>
                                (transcript as any)?.actions[0]?.updateEngagementPanelAction?.content
                                    ?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups?.length > 0
                        )
                    ) {
                        elStatusTrVideo.innerHTML = iconOk();
                    }
                }

                if (
                    wrapTryCatch(
                        () =>
                            (getCommentsTrVideo(state) as any)?.actions[0]?.updateEngagementPanelAction?.content
                                ?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups?.length > 0
                    ) &&
                    (elLiveApp.parentNode || elLiveApp.parentElement)
                ) {
                    const transcript = getCommentsTrVideo(state) as any;
                    state = setCount(
                        state,
                        'commentsTrVideo',
                        transcript.actions[0].updateEngagementPanelAction.content.transcriptRenderer.body
                            .transcriptBodyRenderer.cueGroups.length
                    );
                }

                const counts = getCounts(state);
                const totalCount = counts.comments + counts.commentsChat + counts.commentsTrVideo;
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
            const comments = getComments(state);
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
            const comments = getComments(state);
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
            const commentsChat = getCommentsChat(state);
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
            const commentsChat = getCommentsChat(state);
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
                const commentsTrVideo = getCommentsTrVideo(state);
                console.log('commentsTrVideo: ', commentsTrVideo);

                if (
                    commentsTrVideo &&
                    (commentsTrVideo as any)?.actions?.length > 0 &&
                    (commentsTrVideo as any)?.actions[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.body
                        ?.transcriptBodyRenderer?.cueGroups?.length > 0
                ) {
                    openCommentsTrVideo(
                        getCommentsTrVideoHtmlText(
                            (commentsTrVideo as any).actions[0].updateEngagementPanelAction.content.transcriptRenderer
                                .body.transcriptBodyRenderer.cueGroups
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
                const commentsTrVideo = getCommentsTrVideo(state);
                if (
                    commentsTrVideo &&
                    (commentsTrVideo as any)?.actions?.length > 0 &&
                    (commentsTrVideo as any).actions[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.body
                        ?.transcriptBodyRenderer?.cueGroups?.length > 0
                ) {
                    const c = getCommentsTrVideoHtmlText(
                        (commentsTrVideo as any).actions[0].updateEngagementPanelAction.content.transcriptRenderer.body
                            .transcriptBodyRenderer.cueGroups
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

        const runCommentsPipeline = (selector: string, query: string, param?: IParamSearch) => {
            const result = runCommentsSearch(query, param, state);

            renderCommentsResult(selector, result);

            state = setSearchCount(state, 'comments', result.total);

            const elsCommentOpenReply = document.getElementById('ycs_wrap_comments');

            if (elsCommentOpenReply) {
                elsCommentOpenReply.addEventListener('click', (event) => {
                    try {
                        const target = event.target as HTMLElement | null;
                        if (!target) return;

                        const comments = getComments(state);

                        if (target.classList.contains('ycs-open-comment')) {
                            const refID = parseInt(target.getAttribute('id') || '', 10);
                            const reply = target.closest('.ycs-render-comment');

                            if (reply && refID && !document.getElementById(`ycs-com-${refID}`)) {
                                const origin = comments.find((item: any) => (item as any)?._index === refID);
                                const com = origin
                                    ? { item: (origin as any).originComment, refIndex: refID }
                                    : undefined;

                                const wrap = document.createElement('div');
                                wrap.id = `ycs-com-${refID}`;
                                wrap.className = wrap.id;

                                reply.insertAdjacentElement('beforebegin', wrap);

                                if (com) renderComment(`#${wrap.id}`, [com], true, query);

                                reply.classList.add('ycs-oc-ml');

                                let toReplyAuthor: string | undefined;

                                if ((origin as any)?.commentRenderer?.contentText?.runs?.length > 0) {
                                    for (const msg of (origin as any).commentRenderer.contentText.runs) {
                                        if (msg.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl) {
                                            toReplyAuthor = msg.navigationEndpoint.browseEndpoint.canonicalBaseUrl;
                                            break;
                                        }
                                    }
                                }

                                const replyAuthor: ICommentsFuseResult[] = [];

                                if (toReplyAuthor) {
                                    for (const auth of comments) {
                                        if (
                                            (auth as any).typeComment === 'R' &&
                                            (auth as any).originComment === (origin as any).originComment &&
                                            (auth as any).commentRenderer?.authorEndpoint?.browseEndpoint
                                                ?.canonicalBaseUrl === toReplyAuthor
                                        ) {
                                            replyAuthor.push({ item: auth, refIndex: refID });
                                        }
                                    }
                                }

                                if (replyAuthor.length > 0) {
                                    const wrapToReply = document.createElement('div');
                                    wrapToReply.id = `ycs-com-rauth-${refID}`;
                                    wrapToReply.className = `ycs-com-${refID} ycs-oc-ml`;
                                    reply.insertAdjacentElement('beforebegin', wrapToReply);

                                    renderComment(`#${wrapToReply.id}`, replyAuthor, false, query);
                                }

                                target.innerHTML = `${iconCollapse()}`;
                                target.title = 'Close the comment to the reply here.';
                            } else if (reply && refID && document.getElementById(`ycs-com-${refID}`)) {
                                removeNodeList(`.ycs-com-${refID}`);

                                reply.classList.remove('ycs-oc-ml');
                                target.innerHTML = `${iconExpand()}`;
                                target.title = 'Open the comment to the reply here.';
                            }
                        } else if (target.classList.contains('ycs-gotochat-video')) {
                            event.preventDefault();

                            const elFrameVideo: HTMLVideoElement | undefined =
                                document.getElementsByTagName('video')[0];
                            if (elFrameVideo) {
                                const ms = target.dataset.offsetvideo;
                                if (ms) {
                                    elFrameVideo.currentTime = parseInt(ms, 10);
                                }
                            }
                        } else if (target.classList.contains('ycs-open-reply')) {
                            const id = target.dataset.idcom;
                            const wrap = target.closest('.ycs-render-comment');

                            if (wrap?.querySelector(`.ycs-com-replies-${id}`)) {
                                const replies = wrap.querySelector(`.ycs-com-replies-${id}`);
                                replies?.remove();

                                target.innerHTML = '+';
                                target.title = 'Open replies to the comment';
                                return;
                            }

                            const repls: ICommentsFuseResult[] = [];
                            if (id) {
                                let index: number | undefined;

                                for (const [i, comment] of comments.entries()) {
                                    if ((comment as any).commentRenderer?.commentId === id) {
                                        index = i;
                                        break;
                                    }
                                }

                                if (Number.isInteger(index) && (index as number) >= 0) {
                                    for (const comment of comments) {
                                        if (comments[index as number] === (comment as any).originComment) {
                                            const refIndex = Number((comment as any)?._index ?? 0);
                                            repls.push({ item: comment, refIndex });
                                        }
                                    }
                                }
                            }

                            if (repls.length > 0) {
                                const replyContainer = target.closest('.ycs-render-comment');
                                const wrapToReply = document.createElement('div');
                                wrapToReply.id = `ycs-com-replies-${id}`;
                                wrapToReply.className = `ycs-com-replies-${id} ycs-oc-ml ycs-com-replies ycs-com-rp`;
                                replyContainer?.insertAdjacentElement('beforeend', wrapToReply);

                                renderComment(wrapToReply, repls, false, query);

                                target.innerHTML = String.fromCharCode(8722);
                                target.title = 'Close replies to the comment';
                            }
                        }
                    } catch (error) {
                        console.error(error);
                    }
                });
            }

            return result;
        };

        const runChatPipeline = (selector: string, query: string, param?: IParamSearch) => {
            const result = runChatSearch(query, param, state);

            renderChatResult(selector, result);

            state = setSearchCount(state, 'commentsChat', result.total);

            const elsGotoChatVideo = document.getElementById('ycs_wrap_comments_chat');

            if (elsGotoChatVideo) {
                elsGotoChatVideo.addEventListener('click', (event) => {
                    try {
                        const target = event.target as HTMLElement | null;
                        if (!target?.classList.contains('ycs-gotochat-video')) return;

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

        const runTranscriptPipeline = (selector: string, query: string, param?: IParamSearch) => {
            const result = runTranscriptSearch(query, param, state);

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

                if (
                    shouldRenderTranscript &&
                    commentsTrVideo &&
                    (wrapTryCatch(
                        () =>
                            (commentsTrVideo as any).actions[0].updateEngagementPanelAction.content.transcriptRenderer
                                .body.transcriptBodyRenderer.cueGroups.length
                    ) as any) > 0
                ) {
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

                console.log('click');

                if (elSelectOptSearch) {
                    const activeParam = getActiveFilterParam();
                    executeSearchBasedOnType(activeParam);
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
                    const cachedComments: any[] = e.data.body.comments || [];
                    try {
                        // Rebuild reply-to-origin mapping using a single-pass index to reduce complexity from O(n^2) to O(n)
                        if (cachedComments.length > 0) {
                            const originById: Record<string, any> = {};
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

                    state = setCommentsChat(state, new Map<number, object>(JSON.parse(e.data.body.commentsChat)));
                    state = setCommentsTrVideo(state, e.data.body.commentsTrVideo);

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
                            (commentsTrVideo as any).actions[0].updateEngagementPanelAction.content.transcriptRenderer
                                .body.transcriptBodyRenderer.cueGroups.length,
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
                        state = setCount(
                            state,
                            'commentsTrVideo',
                            (commentsTrVideo as any).actions[0].updateEngagementPanelAction.content.transcriptRenderer
                                .body.transcriptBodyRenderer.cueGroups.length
                        );
                    }

                    // end tr. video

                    const counts = getCounts(state);
                    const totalCount = counts.comments + counts.commentsChat + counts.commentsTrVideo;
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
                prevUrl = getCleanUrlVideo(window.location.href);
                // console.log('prevUrl After: ', prevUrl);

                getController(state).abort();
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
