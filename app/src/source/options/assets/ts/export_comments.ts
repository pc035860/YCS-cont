import Queue from 'p-queue';
import * as XLSX from 'xlsx';

import {
    delayMs,
    downloadFile,
    formatBytes,
    getCommentsChatHtmlText,
    getCommentsHtmlText,
    getCommentsTrVideoHtmlText,
    getPaginate,
    getSheetChatComments,
    getSheetChatDetails,
    getSheetComments,
    getSheetDetails,
    getSheetReplies,
    getSheetTrVideo,
    getSheetTrVideoDetails,
    isNumeric,
    msToRoundSec,
    removeNodeList,
    wrapTryCatch
} from '../../../utils/assist';
import { IComment, IReplyComment } from '../../../utils/interfaces/i_export_comments';
import { IStorageEstimate } from '../../../utils/interfaces/i_types';
import { idb } from '../../../utils/libs';

const STORE_CACHE_YCS = 'STORE_CACHE_YCS';

window.onload = async (): Promise<void> => {
    try {
        console.log('Export comments');

        const elBtnClearAllCache = document.getElementById('ycs_opts_btn_cache');
        const elBtnShowAllCache = document.getElementById('ycs_opts_btn_show_all_cache');

        const disButtons = (edis: boolean): void => {
            const btns = document.querySelectorAll('[type="button"]') as NodeListOf<HTMLInputElement>;

            for (const btn of btns) {
                btn.disabled = edis;
            }
        };

        const getProcessShowAllHtml = (): HTMLElement | void => {
            removeNodeList('#ycs_process_show_all_wrap');

            const divWrap = document.createElement('div');
            divWrap.id = 'ycs_process_show_all_wrap';
            divWrap.className = 'ycs_formation_cache_table ycs_process_event';

            divWrap.innerHTML = `
                    <p>Please wait! The table is being formed.</p>
                    <p>Caches processed: <span class="ycs_opt_mark" id="ycs_f_current_cache">0</span> of <span class="ycs_opt_mark" id="ycs_f_all_cache"></span></p>
                `;

            return divWrap;
        };

        const getProcessExportCacheHtml = (): HTMLElement | void => {
            removeNodeList('#ycs_process_export_cache_wrap');

            const divWrap = document.createElement('div');
            divWrap.id = 'ycs_process_export_cache_wrap';
            divWrap.className = 'ycs_process_event';

            divWrap.innerHTML = `
                    <p>Please wait. Cached video comments are exported. Do not close this window. Comments are exported to the default browser download folder.</p>
                    <p>Total video: <span id="ycs_process_total_video" class="ycs_opt_mark"></span></p>
                    <p>Preparing a comments of cache from a video: <span id="ycs_process_now" class="ycs_opt_mark">0</span> of <span id="ycs_process_now_total" class="ycs_opt_mark"></span></p>
                    <p>Saving files: <span class="ycs_opt_mark" id="ycs_count_save_files">0</span></p>
                `;

            return divWrap;
        };

        const getProcessExportDoneHtml = (): HTMLElement | void => {
            removeNodeList('#ycs_process_export_done_wrap');

            const divWrap = document.createElement('div');
            divWrap.id = 'ycs_process_export_done_wrap';

            divWrap.innerHTML = `
                    <div class="ycs_export_file_type_title ycs_export_done">
                        <p>Comments have been exported! For <span class="ycs_opt_mark" id="ycs_done_count_video"></span> selected videos.</p>
                        <p>Files saved: <span class="ycs_opt_mark" id="ycs_saved_files_count"></span></p>
                        <p class="ycs_opt_mark" id="ycs_export_done_date"></p>
                    </div>
                `;

            return divWrap;
        };

        const getOptsFileType = (): {
            typeTXT: boolean;
            typeJSON: boolean;
            typeXLSX: boolean;
        } => {
            const typeTXT = document.getElementById('ycs_file_type_txt') as HTMLInputElement;
            const typeJSON = document.getElementById('ycs_file_type_json') as HTMLInputElement;
            const typeXLSX = document.getElementById('ycs_file_type_xlsx') as HTMLInputElement;

            return {
                typeTXT: typeTXT?.checked || false,
                typeJSON: typeJSON?.checked || false,
                typeXLSX: typeXLSX?.checked || false
            };
        };

        const getOptsDataTypeExport = (): {
            typeComments: boolean;
            typeChat: boolean;
            typeTrVideo: boolean;
        } => {
            const typeComments = document.getElementById('ycs_export_data_comments') as HTMLInputElement;
            const typeChat = document.getElementById('ycs_export_data_chat') as HTMLInputElement;
            const typeTrVideo = document.getElementById('ycs_export_data_trvideo') as HTMLInputElement;

            return {
                typeComments: typeComments?.checked || false,
                typeChat: typeChat?.checked || false,
                typeTrVideo: typeTrVideo?.checked || false
            };
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getCommentsText = (
            body: any
        ): {
            text: string;
            length: number;
        } | void => {
            try {
                if (body.comments.length === 0) return;

                const c = getCommentsHtmlText(body.comments);
                const htmlText = `
YCS - YouTube Comment Search

Comments
File created by ${new Date().toString()}
Video URL: ${body.url}
Title: ${body.titleVideo}
Total: ${c.count}\n${c.html}`;

                return {
                    text: htmlText,
                    length: c.count
                };
            } catch (err) {
                console.error(err);
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getCommentsJSON = (
            body: any
        ): {
            json: string;
            length: number;
        } | void => {
            try {
                if (body.comments.length === 0) return;

                const cmnts = {
                    urlVideo: body?.url as string,
                    titleVideo: body?.titleVideo as string,
                    videoId: body?.videoId as string,
                    cachedDate: body?.date as number,
                    totalComments: 0,
                    totalReplies: 0,
                    total: body?.comments.length as number,
                    comments: [] as IComment[]
                };

                const cmntsMap = new Map<string, IComment>();
                const repliesSet = new Set<IReplyComment>();
                for (const cmnt of body.comments) {
                    if (cmnt?.typeComment === 'C') {
                        cmntsMap.set(cmnt?.commentRenderer?.commentId, {
                            commentUrl: ('youtube.com' +
                                (wrapTryCatch(
                                    () =>
                                        cmnt.commentRenderer.publishedTimeText.runs[0].navigationEndpoint
                                            .commandMetadata.webCommandMetadata.url
                                ) || `/watch?v=${cmnts?.videoId}&lc=${cmnt?.commentRenderer?.commentId}`)) as string,
                            author: {
                                nameAuthor: cmnt?.commentRenderer?.authorText?.simpleText as string,
                                authorIsChannelOwner: cmnt?.commentRenderer?.authorIsChannelOwner as boolean,
                                channel:
                                    'youtube.com' +
                                    (cmnt?.commentRenderer?.authorEndpoint?.browseEndpoint?.canonicalBaseUrl ||
                                        cmnt?.commentRenderer?.authorEndpoint?.commandMetadata?.webCommandMetadata?.url)
                            },
                            publishedTimeText: wrapTryCatch(
                                () => cmnt.commentRenderer.publishedTimeText.runs[0].text
                            ) as string,
                            commentMessage: (cmnt?.commentRenderer?.contentText?.fullText ||
                                cmnt?.commentRenderer?.renderFullText) as string,
                            totalLikes: (cmnt?.commentRenderer?.voteCount?.simpleText || '0') as string,
                            member: cmnt?.commentRenderer?.sponsorCommentBadge?.sponsorCommentBadgeRenderer
                                ?.tooltip as string,
                            commentReplies: {
                                replies: []
                            }
                        });
                    } else if (cmnt?.typeComment === 'R') {
                        repliesSet.add(cmnt);
                    }
                }

                console.log('cmnts IS:', cmnts);
                console.log('cmntsMap IS:', cmntsMap);
                console.log('repliesSet IS:', repliesSet);

                for (const reply of repliesSet) {
                    const replyCommentIdOrigComment = reply?.originComment?.commentRenderer?.commentId;

                    const origComment = cmntsMap.get(replyCommentIdOrigComment) as IComment;
                    if (origComment) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const cmnt: any = reply;
                        origComment?.commentReplies?.replies?.push({
                            commentUrl: ('youtube.com' +
                                (wrapTryCatch(
                                    () =>
                                        cmnt.commentRenderer.publishedTimeText.runs[0].navigationEndpoint
                                            .commandMetadata.webCommandMetadata.url
                                ) || `/watch?v=${cmnts?.videoId}&lc=${cmnt?.commentRenderer?.commentId}`)) as string,
                            author: {
                                nameAuthor: cmnt?.commentRenderer?.authorText?.simpleText as string,
                                authorIsChannelOwner: cmnt?.commentRenderer?.authorIsChannelOwner as boolean,
                                channel:
                                    'youtube.com' +
                                    (cmnt?.commentRenderer?.authorEndpoint?.browseEndpoint?.canonicalBaseUrl ||
                                        cmnt?.commentRenderer?.authorEndpoint?.commandMetadata?.webCommandMetadata?.url)
                            },
                            publishedTimeText: wrapTryCatch(
                                () => cmnt.commentRenderer.publishedTimeText.runs[0].text
                            ) as string,
                            commentMessage: (cmnt?.commentRenderer?.contentText?.fullText ||
                                cmnt?.commentRenderer?.renderFullText) as string,
                            totalLikes: (cmnt?.commentRenderer?.voteCount?.simpleText || '0') as string,
                            member: cmnt?.commentRenderer?.sponsorCommentBadge?.sponsorCommentBadgeRenderer
                                ?.tooltip as string
                        });
                    }
                }

                cmnts.totalReplies = repliesSet.size;
                repliesSet.clear();

                for (const [k, v] of cmntsMap) {
                    cmnts.comments.push(v);

                    cmntsMap.delete(k);
                }

                cmnts.totalComments = cmnts.comments.length;

                cmntsMap.clear();

                const json = JSON.stringify(cmnts);

                return {
                    json: json,
                    length: body.comments.length
                };
            } catch (err) {
                console.error(err);
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getCommentsChatText = (
            body: any
        ): {
            text: string;
            length: number;
        } | void => {
            try {
                const commentsChat = new Map(JSON.parse(body?.commentsChat));
                if (commentsChat.size === 0) return;

                const c = getCommentsChatHtmlText([...commentsChat.values()]);
                const htmlText = `
YCS - YouTube Comment Search

Comments chat
File created by ${new Date().toString()}
Video URL: ${body.url}
Title: ${body.titleVideo}
Total: ${c.count}\n${c.html}`;

                return {
                    text: htmlText,
                    length: c.count
                };
            } catch (err) {
                console.error(err);
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getCommentsChatJSON = (
            body: any
        ): {
            json: string;
            length: number;
        } | void => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const commentsChat = new Map<number, any>(JSON.parse(body.commentsChat));
                if (commentsChat.size === 0) return;

                interface Chat {
                    author: {
                        nameAuthor: string;
                        channel: string;
                        member: string;
                    };
                    commentMessage: string;
                    timestampUsec: number;
                    timestampText: string;
                }

                const cmntsChat = {
                    urlVideo: body?.url as string,
                    titleVideo: body?.titleVideo as string,
                    videoId: body?.videoId as string,
                    cachedDate: body?.date as number,
                    total: 0,
                    commentsChat: [] as Chat[]
                };

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const getMember = (aBadges: any): any => {
                    try {
                        if (aBadges && aBadges.length > 0) {
                            let member;
                            for (const m of aBadges) {
                                if (m?.liveChatAuthorBadgeRenderer?.customThumbnail) {
                                    member = m;
                                    break;
                                }
                            }

                            if (member) return member;
                        }
                    } catch (err) {
                        console.error(err);
                    }
                };

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                for (const [k, cmnt] of commentsChat) {
                    try {
                        const member = getMember(
                            wrapTryCatch(
                                () =>
                                    cmnt.replayChatItemAction.actions[0].addChatItemAction.item
                                        .liveChatTextMessageRenderer.authorBadges
                            )
                        );

                        cmntsChat.commentsChat.push({
                            author: {
                                nameAuthor: wrapTryCatch(
                                    () =>
                                        cmnt.replayChatItemAction.actions[0].addChatItemAction.item
                                            .liveChatTextMessageRenderer.authorName.simpleText
                                ) as string,
                                channel:
                                    `youtube.com/channel/${wrapTryCatch(() => cmnt.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorExternalChannelId)}` as string,
                                member:
                                    wrapTryCatch(() => member.liveChatAuthorBadgeRenderer.tooltip) ||
                                    (wrapTryCatch(
                                        () => member.liveChatAuthorBadgeRenderer.accessibility.accessibilityData.label
                                    ) as string)
                            },
                            commentMessage: wrapTryCatch(
                                () =>
                                    cmnt.replayChatItemAction.actions[0].addChatItemAction.item
                                        .liveChatTextMessageRenderer.message.fullText ||
                                    cmnt.replayChatItemAction.actions[0].addChatItemAction.item
                                        .liveChatTextMessageRenderer.message.renderFullText
                            ) as string,
                            timestampUsec: wrapTryCatch(
                                () =>
                                    cmnt.replayChatItemAction.actions[0].addChatItemAction.item
                                        .liveChatTextMessageRenderer.timestampUsec
                            ) as number,
                            timestampText: wrapTryCatch(
                                () =>
                                    cmnt.replayChatItemAction.actions[0].addChatItemAction.item
                                        .liveChatTextMessageRenderer.timestampText.simpleText
                            ) as string
                        });
                    } catch (err) {
                        console.error(err);
                        continue;
                    }
                }

                cmntsChat.total = cmntsChat.commentsChat.length;

                const json = JSON.stringify(cmntsChat);

                return {
                    json: json,
                    length: cmntsChat.total
                };
            } catch (err) {
                console.error(err);
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getTrVideoText = (
            body: any
        ): {
            text: string;
            length: number;
        } | void => {
            try {
                const c = getCommentsTrVideoHtmlText(
                    wrapTryCatch(
                        () =>
                            body.commentsTrVideo.actions[0].updateEngagementPanelAction.content.transcriptRenderer.body
                                .transcriptBodyRenderer.cueGroups
                    )
                );

                const htmlText = `
YCS - YouTube Comment Search

Transcript video
File created by ${new Date().toString()}
Video URL: ${body.url}
Title: ${body.titleVideo}
Total: ${c.count}\n${c.html}`;

                return {
                    text: htmlText,
                    length: c.count
                };
            } catch (err) {
                console.error(err);
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getTrVideoJSON = (
            body: any
        ): {
            json: string;
            length: number;
        } | void => {
            try {
                if (body?.commentsTrVideo?.actions?.length === 0) return;

                interface TrVideo {
                    formattedStartOffset: string;
                    message: string;
                    startOffsetMs: number;
                    durationMs: number;
                    urlShare: string;
                }

                const transcriptVideo = {
                    titleTrVideo: wrapTryCatch(
                        () =>
                            body.commentsTrVideo.actions[0].updateEngagementPanelAction.content.transcriptRenderer
                                .footer.transcriptFooterRenderer.languageMenu.sortFilterSubMenuRenderer.subMenuItems[0]
                                .title
                    ) as string,
                    urlVideo: body?.url as string,
                    titleVideo: body?.titleVideo as string,
                    videoId: body?.videoId as string,
                    cachedDate: body?.date as number,
                    total: 0,
                    trVideo: [] as TrVideo[]
                };

                const arrTrVideo = wrapTryCatch(
                    () =>
                        body.commentsTrVideo.actions[0].updateEngagementPanelAction.content.transcriptRenderer.body
                            .transcriptBodyRenderer.cueGroups
                );

                for (const trVideo of arrTrVideo) {
                    transcriptVideo.trVideo.push({
                        message: wrapTryCatch(
                            () => trVideo.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.cue.simpleText
                        ) as string,
                        formattedStartOffset: wrapTryCatch(
                            () => trVideo.transcriptCueGroupRenderer.formattedStartOffset.simpleText
                        ) as string,
                        startOffsetMs: wrapTryCatch(
                            () => trVideo.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.startOffsetMs
                        ) as number,
                        durationMs: wrapTryCatch(
                            () => trVideo.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.durationMs
                        ) as number,
                        urlShare: `youtu.be/${body?.videoId}?t=${msToRoundSec(wrapTryCatch(() => trVideo.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.startOffsetMs) as number) || 0}`
                    });
                }

                transcriptVideo.total = transcriptVideo.trVideo.length;

                const json = JSON.stringify(transcriptVideo);

                return {
                    json: json,
                    length: transcriptVideo.total
                };
            } catch (err) {
                console.error(err);
            }
        };

        const asyncDownloadFiles = async (content: string, fileName: string, type: string): Promise<void> => {
            try {
                downloadFile(content, fileName, type);

                await delayMs(300);
            } catch (err) {
                console.error(err);
            }
        };

        const removeCacheByKey = async (videoId: string): Promise<boolean | void> => {
            try {
                if (typeof videoId != 'string') return;

                const db = await idb;

                await db.delete(STORE_CACHE_YCS, videoId);

                return true;
            } catch (err) {
                console.error(err);
            }
        };

        const getInfoAllCache = async (): Promise<Map<string, object> | void> => {
            try {
                const db = await idb;
                const cache = new Map();

                const totalCache = await db.count(STORE_CACHE_YCS);

                let cursor = await db.transaction(STORE_CACHE_YCS).store.openCursor();

                const elMAin = document.getElementById('ycs_export_cache_main') as HTMLElement;
                elMAin.style.display = 'none';

                const htmlFormationCacheTable = getProcessShowAllHtml() as HTMLElement;
                elMAin.insertAdjacentElement('afterend', htmlFormationCacheTable);

                const elTotalCache = document.getElementById('ycs_f_all_cache') as HTMLElement;
                const elCurrentCache = document.getElementById('ycs_f_current_cache') as HTMLElement;

                elTotalCache.textContent = totalCache as unknown as string;

                let currentCache = 1;
                while (cursor) {
                    cache.set(cursor.key, {
                        title: cursor.value.body.titleVideo,
                        url: cursor.value.body.url,
                        date: cursor.value.body.date,
                        videoId: cursor.value.body.videoId
                    });

                    elCurrentCache.textContent = currentCache as unknown as string;
                    currentCache += 1;

                    cursor = await cursor.continue();
                }

                htmlFormationCacheTable.remove();
                elMAin.style.display = 'block';

                return cache;
            } catch (err) {
                console.error(err);
            }
        };

        const showUsageMemory = async (): Promise<void> => {
            try {
                const db = await idb;

                const memory = (await navigator.storage.estimate()) as IStorageEstimate;

                const elTotalCache = document.getElementById('ycs_total_cache') as HTMLElement;
                const elUsedCache = document.getElementById('ycs_used_cache') as HTMLElement;
                const elBrowserAvStorage = document.getElementById('ycs_browser_av_storage') as HTMLElement;
                const elQuotaAvStorage = document.getElementById('ycs_quota_av_storage') as HTMLElement;

                elTotalCache.textContent = (await db.count(STORE_CACHE_YCS)) + '';

                elUsedCache.textContent = formatBytes(
                    (memory?.usageDetails?.indexedDB || memory.usage) as number
                ) as string;

                elBrowserAvStorage.textContent =
                    (((memory.usage as number) / (memory.quota as number)) * 100).toFixed(2) + '%';

                elQuotaAvStorage.textContent = formatBytes(memory.quota as number) as string;
            } catch (err) {
                console.error(err);
            }
        };

        const btnClearAllCache = async (): Promise<void> => {
            try {
                const db = await idb;

                await db.clear(STORE_CACHE_YCS);

                await showUsageMemory();
            } catch (err) {
                console.error(err);
            }
        };

        elBtnClearAllCache?.addEventListener('click', async () => {
            try {
                // (e.target as HTMLButtonElement).disabled = true;

                disButtons(true);

                await btnClearAllCache();
                await showUsageMemory();

                const elShowTable = document.getElementById('ycs_all_cache_table') as HTMLElement;
                elShowTable.style.display = 'none';

                disButtons(false);

                // (e.target as HTMLButtonElement).disabled = false;
            } catch (err) {
                console.error(err);
                disButtons(false);
            }
        });

        elBtnShowAllCache?.addEventListener('click', async () => {
            try {
                // (e.target as HTMLButtonElement).disabled = true;
                disButtons(true);

                removeNodeList('#ycs_process_export_done_wrap');

                const pageSize = 10;

                showUsageMemory();

                const elCountSelCache = document.getElementsByClassName('ycs_selection_cache');
                for (const el of elCountSelCache) {
                    el.textContent = '';
                }

                const tableCacheAll = document.getElementById('ycs_all_cache_table') as HTMLDivElement;

                const cacheMap = (await getInfoAllCache()) as Map<string, object>;
                if (cacheMap.size === 0) {
                    disButtons(false);
                    return;
                }

                let cache = Array.from(cacheMap.values()) as { videoId: string }[];
                console.log(cache);

                const listCheckbox = new Map();

                for (const el of cache) {
                    listCheckbox.set(el.videoId, false);
                }

                console.log('listCheckbox:', listCheckbox);

                const renderCheckBox = (): void => {
                    const elmsCheckBox = document.getElementsByName(
                        'ycs_all_cache_checkbox'
                    ) as NodeListOf<HTMLInputElement>;

                    for (const cbox of elmsCheckBox) {
                        const checked = listCheckbox.get(cbox.id);

                        cbox.checked = checked;
                    }
                };

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const renderColumns = (c: any, el: HTMLElement, startNumber = 1): void => {
                    const truncateString = (str: string, num: number): string | void => {
                        if (str.length <= num) {
                            return str;
                        }
                        return str.slice(0, num) + ' ...';
                    };

                    el.textContent = '';

                    let i = startNumber;

                    // eslint-disable-next-line
                    for (const v of c) {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const value: any = v;

                            el.insertAdjacentHTML(
                                'beforeend',
                                `
                                    <tr class="ycs_${value.videoId}">
                                        <td><div>${i++}</div></td>
                                        <td><div title="${value.title}">${wrapTryCatch(() => truncateString(value.title, 118))}</div></td>
                                        <td><div><a href="${wrapTryCatch(() => value.url)}" target="_blank" rel="noopener noreferrer" title="${wrapTryCatch(() => value.url)}">${wrapTryCatch(() => truncateString(value.url, 100))}</a></div></td>
                                        <td><div>${wrapTryCatch(() => new Date(value.date).toUTCString())}</div></td>
                                        <td><div><input type="checkbox" name="ycs_all_cache_checkbox" id="${value.videoId}"></div></td>
                                    </tr>
                                `
                            );
                        } catch (err) {
                            console.error(err);
                        }
                    }
                };

                const elSelAllCheckBox = document.getElementById('ycs_select_all_checkbox') as HTMLInputElement;
                elSelAllCheckBox.checked = false;

                const elBodyTableCacheAll = document.getElementById('ycs_all_cache_body_table') as HTMLTableElement;
                elBodyTableCacheAll.innerHTML = '';

                const elWrapPagNav = document.getElementsByClassName('ycs_wrap_nav_pag');
                for (const el of elWrapPagNav) {
                    el.remove();
                }

                if (cache.length > pageSize) {
                    const pag = getPaginate(cache.length, 1, pageSize);

                    const elCurrentPage = document.getElementById('ycs_pag_nav_current') as HTMLElement;
                    elCurrentPage.textContent = `(Pages: ${pag.totalPages} - [${pag.currentPage}])`;

                    const divPag = document.createElement('div');
                    divPag.className = 'ycs_wrap_nav_pag';
                    divPag.innerHTML = `
                            <span class="ycs_btn_nav_pag" id="ycs_btn_pag_nav_prev">➖</span>
                            <input type="text" name="Pagination" id="ycs_all_cache_table_pag" class="ycs_all_cache_tab_pag" value="${pag.currentPage}">
                            <span class="ycs_btn_nav_pag" id="ycs_btn_pag_nav_next">➕</span>
                        `;

                    tableCacheAll.appendChild(divPag);

                    const prev = document.getElementById('ycs_btn_pag_nav_prev') as HTMLElement;
                    const next = document.getElementById('ycs_btn_pag_nav_next') as HTMLElement;

                    const navPag = document.getElementById('ycs_all_cache_table_pag') as HTMLInputElement;

                    prev.onclick = (): void => {
                        const number = Number.parseInt(navPag.value) - 1;
                        if (number > 0) {
                            navPag.value = number as unknown as string;
                            navPag.dispatchEvent(new Event('input'));
                        }
                    };

                    next.onclick = (): void => {
                        const number = Number.parseInt(navPag.value) + 1;
                        if (number <= pag.totalPages) {
                            navPag.value = number as unknown as string;
                            navPag.dispatchEvent(new Event('input'));
                        }
                    };

                    navPag.oninput = (ev: Event): void => {
                        const target = ev.target as HTMLInputElement;

                        if (isNumeric(target.value) && Number.parseInt(target.value) > 0) {
                            const pagin = getPaginate(cache.length, Number.parseInt(target.value), pageSize);
                            renderColumns(
                                cache.slice(pagin.startIndex, pagin.endIndex + 1),
                                elBodyTableCacheAll,
                                pagin.startIndex + 1
                            );
                            elCurrentPage.textContent = `(Pages: ${pagin.totalPages} - [${pagin.currentPage}])`;
                            renderCheckBox();
                        }
                    };

                    renderColumns(
                        cache.slice(pag.startIndex, pag.endIndex + 1),
                        elBodyTableCacheAll,
                        pag.startIndex + 1
                    );
                } else {
                    renderColumns(cache, elBodyTableCacheAll);
                }

                tableCacheAll.style.display = 'block';

                const getSelectionCache = (checkBox: Map<string, boolean>): object[] | void => {
                    try {
                        if (checkBox.size >= 0) {
                            const arrCheckedBox = [] as object[];
                            checkBox.forEach((v, k) => {
                                if (v === true) {
                                    arrCheckedBox.push({
                                        videoId: k,
                                        checked: v
                                    });
                                }
                            });

                            return arrCheckedBox;
                        }
                    } catch (err) {
                        console.error(err);
                    }
                };

                const renderCountSelCache = (): void => {
                    const el = document.getElementsByClassName('ycs_selection_cache');

                    if (el.length > 0) {
                        const countChecked = getSelectionCache(listCheckbox);
                        console.log('countChecked:', countChecked);

                        if (countChecked && countChecked.length >= 0) {
                            for (const elm of el) {
                                elm.textContent = `(${countChecked.length})`;
                            }
                        }
                    }
                };

                elSelAllCheckBox.onclick = (ev: Event): void => {
                    const target = ev.target as HTMLInputElement;

                    if (target.checked === true) {
                        listCheckbox.forEach((v, k) => {
                            listCheckbox.set(k, true);
                        });
                        console.log('listCheckbox:', listCheckbox);
                        renderCheckBox();
                        console.log('getSelectionCache: ', getSelectionCache(listCheckbox));
                        renderCountSelCache();
                    } else if (target.checked === false) {
                        listCheckbox.forEach((v, k) => {
                            listCheckbox.set(k, false);
                        });
                        console.log('listCheckbox:', listCheckbox);
                        renderCheckBox();
                        console.log('getSelectionCache: ', getSelectionCache(listCheckbox));
                        renderCountSelCache();
                    }
                };

                elBodyTableCacheAll.onclick = (ev: Event): void => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const target: any = ev.target;
                    if (target.name === 'ycs_all_cache_checkbox') {
                        console.log('id: ', target.id);
                        listCheckbox.set(target.id, target.checked);
                        console.log('getSelectionCache: ', getSelectionCache(listCheckbox));
                        renderCountSelCache();
                    }
                };

                const removeCacheFromVariables = (videoId: string): void => {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const arrCache = cache.filter((el: any) => {
                            return el.videoId != videoId;
                        });
                        cache = arrCache;

                        listCheckbox.delete(videoId);

                        console.log('NOW cache and listCheckbox is: ', cache, listCheckbox);
                    } catch (err) {
                        console.error(err);
                    }
                };

                const removeCacheFromTable = (videoId: string): void => {
                    try {
                        const elSelCache = document.getElementsByClassName('ycs_' + videoId);
                        console.log('removeCacheFromTable:', elSelCache);
                        for (const el of elSelCache) {
                            el.remove();
                        }

                        renderCountSelCache();
                    } catch (err) {
                        console.error(err);
                    }
                };

                const elExportSelCache = document.getElementById('ycs_btn_export_sel_cache') as HTMLButtonElement;
                elExportSelCache.onclick = async (): Promise<void> => {
                    try {
                        const selCache = getSelectionCache(listCheckbox) as {
                            videoId: string;
                            checked: boolean;
                        }[];

                        if (!selCache) return;

                        if (selCache.length === 0) return;

                        const fileTypes = getOptsFileType();
                        if (fileTypes.typeJSON === false && fileTypes.typeTXT === false && fileTypes.typeXLSX === false)
                            return;

                        const exportTypes = getOptsDataTypeExport();
                        if (
                            exportTypes.typeComments === false &&
                            exportTypes.typeChat === false &&
                            exportTypes.typeTrVideo === false
                        )
                            return;

                        disButtons(true);

                        const db = await idb;

                        removeNodeList('#ycs_process_export_done_wrap');

                        const totalCache = await db.count(STORE_CACHE_YCS);

                        const elExportAllCacheMain = document.getElementById('ycs_export_cache_main') as HTMLElement;
                        const elProcessExportCache = getProcessExportCacheHtml() as HTMLElement;

                        elExportAllCacheMain.style.display = 'none';
                        elExportAllCacheMain.insertAdjacentElement('afterend', elProcessExportCache);

                        const elProcessNowCache = document.getElementById('ycs_process_now') as HTMLElement;
                        const elProcessNowCacheTotal = document.getElementById('ycs_process_now_total') as HTMLElement;
                        const elProcessTotal = document.getElementById('ycs_process_total_video') as HTMLElement;
                        const elProcessSaveFiles = document.getElementById('ycs_count_save_files') as HTMLElement;

                        elProcessNowCacheTotal.textContent = totalCache as unknown as string;

                        elProcessTotal.textContent = totalCache as unknown as string;

                        // const files = [];

                        const filesQueue = new Queue({ concurrency: 1 });

                        let countSaveFiles = 0;

                        filesQueue.on('next', () => {
                            countSaveFiles += 1;

                            elProcessSaveFiles.textContent = countSaveFiles as unknown as string;
                        });

                        for (const [indexCache, scache] of selCache.entries()) {
                            if (scache.checked) {
                                const cacheSel = await db.get(STORE_CACHE_YCS, scache.videoId);

                                try {
                                    if (fileTypes.typeTXT) {
                                        if (exportTypes?.typeComments) {
                                            try {
                                                const txt = getCommentsText(cacheSel.body);
                                                if (txt) {
                                                    // downloadFile(txt.text, `Comments, ${cacheSel.body.titleVideo} (${txt.length}).txt`, 'text/plain');

                                                    const body = cacheSel.body;
                                                    filesQueue.add(async () => {
                                                        await asyncDownloadFiles(
                                                            txt.text,
                                                            `Comments, ${body.titleVideo} (${txt.length}).txt`,
                                                            'text/plain'
                                                        );
                                                    });

                                                    // files.push({
                                                    //     // content: txt.text,
                                                    //     fileName: `Comments, ${cacheSel.body.titleVideo} (${txt.length}).txt`,
                                                    //     type: 'text/plain'
                                                    // });
                                                }
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }

                                        if (exportTypes?.typeChat) {
                                            try {
                                                const commentsChatText = getCommentsChatText(cacheSel.body);
                                                if (commentsChatText) {
                                                    // downloadFile(commentsChatText.text, `Comments chat, ${cacheSel.body.titleVideo} (${commentsChatText.length}).txt`, 'text/plain');

                                                    const body = cacheSel.body;
                                                    filesQueue.add(async () => {
                                                        await asyncDownloadFiles(
                                                            commentsChatText.text,
                                                            `Comments chat, ${body.titleVideo} (${commentsChatText.length}).txt`,
                                                            'text/plain'
                                                        );
                                                    });

                                                    // files.push({
                                                    //     // content: commentsChatText.text,
                                                    //     fileName: `Comments chat, ${cacheSel.body.titleVideo} (${commentsChatText.length}).txt`,
                                                    //     type: 'text/plain'
                                                    // });
                                                }
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }

                                        if (exportTypes?.typeTrVideo) {
                                            try {
                                                const trVideoText = getTrVideoText(cacheSel.body);
                                                if (trVideoText) {
                                                    // downloadFile(trVideoText.text, `Transcript video, ${cacheSel.body.titleVideo} (${trVideoText.length}).txt`, 'text/plain');

                                                    const body = cacheSel.body;
                                                    filesQueue.add(async () => {
                                                        await asyncDownloadFiles(
                                                            trVideoText.text,
                                                            `Transcript video, ${body.titleVideo} (${trVideoText.length}).txt`,
                                                            'text/plain'
                                                        );
                                                    });

                                                    // files.push({
                                                    //     // content: trVideoText.text,
                                                    //     fileName: `Transcript video, ${cacheSel.body.titleVideo} (${trVideoText.length}).txt`,
                                                    //     type: 'text/plain'
                                                    // });
                                                }
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }
                                    }
                                } catch (err) {
                                    console.error(err);
                                    continue;
                                }

                                try {
                                    if (fileTypes.typeJSON) {
                                        if (exportTypes?.typeComments) {
                                            try {
                                                const json = getCommentsJSON(cacheSel.body);

                                                if (json) {
                                                    // downloadFile(json.json, `Comments, ${cacheSel.body.titleVideo} (${json.length}).json`, 'text/plain');

                                                    const body = cacheSel.body;
                                                    filesQueue.add(async () => {
                                                        await asyncDownloadFiles(
                                                            json.json,
                                                            `Comments, ${body.titleVideo} (${json.length}).json`,
                                                            'text/plain'
                                                        );
                                                    });

                                                    // files.push({
                                                    //     // content: json.json,
                                                    //     fileName: `Comments, ${cacheSel.body.titleVideo} (${json.length}).json`,
                                                    //     type: 'text/plain'
                                                    // });
                                                }
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }

                                        if (exportTypes?.typeChat) {
                                            try {
                                                const commentsChatJSON = getCommentsChatJSON(cacheSel.body);

                                                if (commentsChatJSON) {
                                                    // downloadFile(commentsChatJSON.json, `Comments chat, ${cacheSel.body.titleVideo} (${commentsChatJSON.length}).json`, 'text/plain');

                                                    const body = cacheSel.body;
                                                    filesQueue.add(async () => {
                                                        await asyncDownloadFiles(
                                                            commentsChatJSON.json,
                                                            `Comments chat, ${body.titleVideo} (${commentsChatJSON.length}).json`,
                                                            'text/plain'
                                                        );
                                                    });

                                                    // files.push({
                                                    //     // content: commentsChatJSON.json,
                                                    //     fileName: `Comments chat, ${cacheSel.body.titleVideo} (${commentsChatJSON.length}).json`,
                                                    //     type: 'text/plain'
                                                    // });
                                                }
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }

                                        if (exportTypes?.typeTrVideo) {
                                            try {
                                                const trVideoJSON = getTrVideoJSON(cacheSel.body);

                                                if (trVideoJSON) {
                                                    // downloadFile(trVideoText.text, `Transcript video, ${cacheSel.body.titleVideo} (${trVideoText.length}).txt`, 'text/plain');

                                                    const body = cacheSel.body;
                                                    filesQueue.add(async () => {
                                                        await asyncDownloadFiles(
                                                            trVideoJSON.json,
                                                            `Transcript video, ${body.titleVideo} (${trVideoJSON.length}).json`,
                                                            'text/plain'
                                                        );
                                                    });

                                                    // files.push({
                                                    //     // content: trVideoJSON.json,
                                                    //     fileName: `Transcript video, ${cacheSel.body.titleVideo} (${trVideoJSON.length}).json`,
                                                    //     type: 'text/plain'
                                                    // });
                                                }
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }
                                    }
                                } catch (err) {
                                    console.error(err);
                                    continue;
                                }

                                try {
                                    if (fileTypes.typeXLSX) {
                                        if (exportTypes?.typeComments) {
                                            try {
                                                const json = getCommentsJSON(cacheSel.body);

                                                if (json) {
                                                    const body = cacheSel.body;
                                                    filesQueue.add(() => {
                                                        const cmnt = JSON.parse(json.json);

                                                        const wb = XLSX.utils.book_new();

                                                        const created = `Report was created by ${new Date().toUTCString()}`;

                                                        let ws;

                                                        try {
                                                            ws = XLSX.utils.json_to_sheet([getSheetDetails(cmnt)]);
                                                            XLSX.utils.sheet_add_aoa(ws, [[created]], { origin: 'A5' });
                                                            XLSX.utils.book_append_sheet(wb, ws, 'Details');
                                                        } catch (err) {
                                                            console.error(err);
                                                        }

                                                        try {
                                                            ws = XLSX.utils.json_to_sheet(
                                                                getSheetComments(cmnt.comments)
                                                            );
                                                            XLSX.utils.book_append_sheet(wb, ws, 'Comments');
                                                        } catch (err) {
                                                            console.error(err);
                                                        }

                                                        try {
                                                            ws = XLSX.utils.json_to_sheet(
                                                                getSheetReplies(cmnt.comments)
                                                            );
                                                            XLSX.utils.book_append_sheet(wb, ws, 'Replies');
                                                        } catch (err) {
                                                            console.error(err);
                                                        }

                                                        XLSX.writeFile(
                                                            wb,
                                                            `Comments, ${body.titleVideo} (${json.length}).xlsx`
                                                        );
                                                    });
                                                }
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }

                                        if (exportTypes?.typeChat) {
                                            try {
                                                const commentsChatJSON = getCommentsChatJSON(cacheSel.body);
                                                console.log('commentsChatJSON: ', commentsChatJSON);

                                                if (commentsChatJSON) {
                                                    // downloadFile(commentsChatJSON.json, `Comments chat, ${cacheSel.body.titleVideo} (${commentsChatJSON.length}).json`, 'text/plain');

                                                    const body = cacheSel.body;
                                                    filesQueue.add(() => {
                                                        const cmnt = JSON.parse(commentsChatJSON.json);

                                                        const wb = XLSX.utils.book_new();

                                                        const created = `Report was created by ${new Date().toUTCString()}`;

                                                        let ws;

                                                        try {
                                                            ws = XLSX.utils.json_to_sheet([getSheetChatDetails(cmnt)]);
                                                            XLSX.utils.sheet_add_aoa(ws, [[created]], { origin: 'A5' });
                                                            XLSX.utils.book_append_sheet(wb, ws, 'Details');
                                                        } catch (err) {
                                                            console.error(err);
                                                        }

                                                        try {
                                                            ws = XLSX.utils.json_to_sheet(getSheetChatComments(cmnt));
                                                            XLSX.utils.book_append_sheet(wb, ws, 'Chat comments');
                                                        } catch (err) {
                                                            console.error(err);
                                                        }

                                                        XLSX.writeFile(
                                                            wb,
                                                            `Comments chat, ${body.titleVideo} (${commentsChatJSON.length}).xlsx`
                                                        );

                                                        // await asyncDownloadFiles(commentsChatJSON.json, `Comments chat, ${body.titleVideo} (${commentsChatJSON.length}).json`, 'text/plain');
                                                    });
                                                }
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }

                                        if (exportTypes?.typeTrVideo) {
                                            try {
                                                const trVideoJSON = getTrVideoJSON(cacheSel.body);

                                                if (trVideoJSON) {
                                                    // downloadFile(trVideoText.text, `Transcript video, ${cacheSel.body.titleVideo} (${trVideoText.length}).txt`, 'text/plain');

                                                    const body = cacheSel.body;
                                                    filesQueue.add(() => {
                                                        const trVideo = JSON.parse(trVideoJSON.json);

                                                        const wb = XLSX.utils.book_new();

                                                        const created = `Report was created by ${new Date().toUTCString()}`;

                                                        let ws;

                                                        try {
                                                            ws = XLSX.utils.json_to_sheet([
                                                                getSheetTrVideoDetails(trVideo)
                                                            ]);
                                                            XLSX.utils.sheet_add_aoa(ws, [[created]], { origin: 'A5' });
                                                            XLSX.utils.book_append_sheet(wb, ws, 'Details');
                                                        } catch (err) {
                                                            console.error(err);
                                                        }

                                                        try {
                                                            ws = XLSX.utils.json_to_sheet(getSheetTrVideo(trVideo));
                                                            XLSX.utils.book_append_sheet(wb, ws, 'Transcript video');
                                                        } catch (err) {
                                                            console.error(err);
                                                        }

                                                        XLSX.writeFile(
                                                            wb,
                                                            `Transcript video, ${body.titleVideo} (${trVideoJSON.length}).xlsx`
                                                        );

                                                        // await asyncDownloadFiles(trVideoJSON.json, `Transcript video, ${body.titleVideo} (${trVideoJSON.length}).json`, 'text/plain');
                                                    });
                                                }
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }
                                    }
                                } catch (err) {
                                    console.error(err);
                                    continue;
                                }

                                elProcessNowCache.textContent = indexCache + 1 + '';
                            }
                        }

                        await filesQueue.onIdle();

                        // console.log('FILES: ', files);
                        // console.log('filesQueue', filesQueue);

                        elProcessExportCache.remove();
                        elExportAllCacheMain.style.display = 'block';

                        const elDoneExport = getProcessExportDoneHtml() as HTMLElement;
                        elExportAllCacheMain.insertAdjacentElement('afterend', elDoneExport);

                        const elExportDoneDate = document.getElementById('ycs_export_done_date') as HTMLElement;
                        const elExportFilesCount = document.getElementById('ycs_saved_files_count') as HTMLElement;
                        const elExportCountVideo = document.getElementById('ycs_done_count_video') as HTMLElement;

                        elExportDoneDate.textContent = new Date().toUTCString();

                        elExportFilesCount.textContent = countSaveFiles as unknown as string;

                        elExportCountVideo.textContent = elProcessNowCache.textContent;

                        disButtons(false);
                    } catch (err) {
                        console.error(err);
                        disButtons(false);
                    }
                };

                const elRemoveSelCache = document.getElementById('ycs_btn_remove_sel_cache') as HTMLButtonElement;
                elRemoveSelCache.onclick = async (): Promise<void> => {
                    try {
                        disButtons(true);

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const selCache = getSelectionCache(listCheckbox) as any;

                        for (const sel of selCache) {
                            if (sel.checked) {
                                await removeCacheByKey(sel.videoId);
                                await showUsageMemory();
                                removeCacheFromVariables(sel.videoId);
                                removeCacheFromTable(sel.videoId);
                            }
                        }

                        if (selCache.length > 0) {
                            const navPag = document.getElementById('ycs_all_cache_table_pag') as HTMLInputElement;

                            if (navPag) {
                                navPag.value = 1 as unknown as string;
                                navPag.dispatchEvent(new Event('input'));
                            }
                        }

                        disButtons(false);
                    } catch (err) {
                        console.error(err);
                        disButtons(false);
                    }
                };

                disButtons(false);
                // (e.target as HTMLButtonElement).disabled = false;
            } catch (err) {
                console.error(err);
                disButtons(false);
            }
        });

        const saveExportedCacheToFiles = async (): Promise<void> => {
            try {
                removeNodeList('#ycs_process_export_done_wrap');

                const db = await idb;

                const totalCache = await db.count(STORE_CACHE_YCS);
                if (totalCache === 0) return;

                const fileTypes = getOptsFileType();
                if (fileTypes.typeJSON === false && fileTypes.typeTXT === false && fileTypes.typeXLSX === false) return;

                const exportTypes = getOptsDataTypeExport();
                if (
                    exportTypes.typeComments === false &&
                    exportTypes.typeChat === false &&
                    exportTypes.typeTrVideo === false
                )
                    return;

                let cursor = await db.transaction(STORE_CACHE_YCS).store.openCursor();

                const elExportAllCacheMain = document.getElementById('ycs_export_cache_main') as HTMLElement;
                const elProcessExportCache = getProcessExportCacheHtml() as HTMLElement;

                elExportAllCacheMain.style.display = 'none';
                elExportAllCacheMain.insertAdjacentElement('afterend', elProcessExportCache);

                const elProcessNowCache = document.getElementById('ycs_process_now') as HTMLElement;
                const elProcessNowCacheTotal = document.getElementById('ycs_process_now_total') as HTMLElement;
                const elProcessTotal = document.getElementById('ycs_process_total_video') as HTMLElement;
                const elProcessSaveFiles = document.getElementById('ycs_count_save_files') as HTMLElement;

                elProcessNowCacheTotal.textContent = totalCache as unknown as string;

                elProcessTotal.textContent = totalCache as unknown as string;

                // const files = [];

                const filesQueue = new Queue({ concurrency: 1 });

                let countSaveFiles = 0;

                filesQueue.on('next', () => {
                    countSaveFiles += 1;

                    elProcessSaveFiles.textContent = countSaveFiles as unknown as string;
                });

                let indexCache = 1;
                while (cursor) {
                    try {
                        if (fileTypes.typeTXT) {
                            if (exportTypes?.typeComments) {
                                try {
                                    const txt = getCommentsText(cursor.value.body);
                                    if (txt) {
                                        // downloadFile(txt.text, `Comments, ${cursor.value.body.titleVideo} (${txt.length}).txt`, 'text/plain');

                                        const body = cursor.value.body;
                                        filesQueue.add(async () => {
                                            await asyncDownloadFiles(
                                                txt.text,
                                                `Comments, ${body.titleVideo} (${txt.length}).txt`,
                                                'text/plain'
                                            );
                                        });

                                        // files.push({
                                        //     // content: txt.text,
                                        //     fileName: `Comments, ${cursor.value.body.titleVideo} (${txt.length}).txt`,
                                        //     type: 'text/plain'
                                        // });
                                    }
                                } catch (err) {
                                    console.error(err);
                                }
                            }

                            if (exportTypes?.typeChat) {
                                try {
                                    const commentsChatText = getCommentsChatText(cursor.value.body);
                                    if (commentsChatText) {
                                        // downloadFile(commentsChatText.text, `Comments chat, ${cursor.value.body.titleVideo} (${commentsChatText.length}).txt`, 'text/plain');

                                        const body = cursor.value.body;
                                        filesQueue.add(async () => {
                                            await asyncDownloadFiles(
                                                commentsChatText.text,
                                                `Comments chat, ${body.titleVideo} (${commentsChatText.length}).txt`,
                                                'text/plain'
                                            );
                                        });

                                        // files.push({
                                        //     // content: commentsChatText.text,
                                        //     fileName: `Comments chat, ${cursor.value.body.titleVideo} (${commentsChatText.length}).txt`,
                                        //     type: 'text/plain'
                                        // });
                                    }
                                } catch (err) {
                                    console.error(err);
                                }
                            }

                            if (exportTypes?.typeTrVideo) {
                                try {
                                    const trVideoText = getTrVideoText(cursor.value.body);
                                    if (trVideoText) {
                                        // downloadFile(trVideoText.text, `Transcript video, ${cursor.value.body.titleVideo} (${trVideoText.length}).txt`, 'text/plain');

                                        const body = cursor.value.body;
                                        filesQueue.add(async () => {
                                            await asyncDownloadFiles(
                                                trVideoText.text,
                                                `Transcript video, ${body.titleVideo} (${trVideoText.length}).txt`,
                                                'text/plain'
                                            );
                                        });

                                        // files.push({
                                        //     // content: trVideoText.text,
                                        //     fileName: `Transcript video, ${cursor.value.body.titleVideo} (${trVideoText.length}).txt`,
                                        //     type: 'text/plain'
                                        // });
                                    }
                                } catch (err) {
                                    console.error(err);
                                }
                            }
                        }
                    } catch (err) {
                        console.error(err);
                        continue;
                    }

                    try {
                        if (fileTypes.typeJSON) {
                            if (exportTypes?.typeComments) {
                                try {
                                    const json = getCommentsJSON(cursor.value.body);

                                    if (json) {
                                        // downloadFile(json.json, `Comments, ${cursor.value.body.titleVideo} (${json.length}).json`, 'text/plain');

                                        const body = cursor.value.body;
                                        filesQueue.add(async () => {
                                            await asyncDownloadFiles(
                                                json.json,
                                                `Comments, ${body.titleVideo} (${json.length}).json`,
                                                'text/plain'
                                            );
                                        });

                                        // files.push({
                                        //     // content: json.json,
                                        //     fileName: `Comments, ${cursor.value.body.titleVideo} (${json.length}).json`,
                                        //     type: 'text/plain'
                                        // });
                                    }
                                } catch (err) {
                                    console.error(err);
                                }
                            }

                            if (exportTypes?.typeChat) {
                                try {
                                    const commentsChatJSON = getCommentsChatJSON(cursor.value.body);

                                    if (commentsChatJSON) {
                                        // downloadFile(commentsChatJSON.json, `Comments chat, ${cursor.value.body.titleVideo} (${commentsChatJSON.length}).json`, 'text/plain');

                                        const body = cursor.value.body;
                                        filesQueue.add(async () => {
                                            await asyncDownloadFiles(
                                                commentsChatJSON.json,
                                                `Comments chat, ${body.titleVideo} (${commentsChatJSON.length}).json`,
                                                'text/plain'
                                            );
                                        });

                                        // files.push({
                                        //     // content: commentsChatJSON.json,
                                        //     fileName: `Comments chat, ${cursor.value.body.titleVideo} (${commentsChatJSON.length}).json`,
                                        //     type: 'text/plain'
                                        // });
                                    }
                                } catch (err) {
                                    console.error(err);
                                }
                            }

                            if (exportTypes?.typeTrVideo) {
                                try {
                                    const trVideoJSON = getTrVideoJSON(cursor.value.body);

                                    if (trVideoJSON) {
                                        // downloadFile(trVideoText.text, `Transcript video, ${cursor.value.body.titleVideo} (${trVideoText.length}).txt`, 'text/plain');

                                        const body = cursor.value.body;
                                        filesQueue.add(async () => {
                                            await asyncDownloadFiles(
                                                trVideoJSON.json,
                                                `Transcript video, ${body.titleVideo} (${trVideoJSON.length}).json`,
                                                'text/plain'
                                            );
                                        });

                                        // files.push({
                                        //     // content: trVideoJSON.json,
                                        //     fileName: `Transcript video, ${cursor.value.body.titleVideo} (${trVideoJSON.length}).json`,
                                        //     type: 'text/plain'
                                        // });
                                    }
                                } catch (err) {
                                    console.error(err);
                                }
                            }
                        }
                    } catch (err) {
                        console.error(err);
                        continue;
                    }

                    try {
                        if (fileTypes.typeXLSX) {
                            if (exportTypes?.typeComments) {
                                try {
                                    const json = getCommentsJSON(cursor.value.body);

                                    if (json) {
                                        const body = cursor.value.body;
                                        filesQueue.add(() => {
                                            const cmnt = JSON.parse(json.json);

                                            const wb = XLSX.utils.book_new();

                                            const created = `Report was created by ${new Date().toUTCString()}`;

                                            let ws;

                                            try {
                                                ws = XLSX.utils.json_to_sheet([getSheetDetails(cmnt)]);
                                                XLSX.utils.sheet_add_aoa(ws, [[created]], { origin: 'A5' });
                                                XLSX.utils.book_append_sheet(wb, ws, 'Details');
                                            } catch (err) {
                                                console.error(err);
                                            }

                                            try {
                                                ws = XLSX.utils.json_to_sheet(getSheetComments(cmnt.comments));
                                                XLSX.utils.book_append_sheet(wb, ws, 'Comments');
                                            } catch (err) {
                                                console.error(err);
                                            }

                                            try {
                                                ws = XLSX.utils.json_to_sheet(getSheetReplies(cmnt.comments));
                                                XLSX.utils.book_append_sheet(wb, ws, 'Replies');
                                            } catch (err) {
                                                console.error(err);
                                            }

                                            XLSX.writeFile(wb, `Comments, ${body.titleVideo} (${json.length}).xlsx`);
                                        });
                                    }
                                } catch (err) {
                                    console.error(err);
                                }
                            }

                            if (exportTypes?.typeChat) {
                                try {
                                    const commentsChatJSON = getCommentsChatJSON(cursor.value.body);
                                    console.log('commentsChatJSON: ', commentsChatJSON);

                                    if (commentsChatJSON) {
                                        // downloadFile(commentsChatJSON.json, `Comments chat, ${cacheSel.body.titleVideo} (${commentsChatJSON.length}).json`, 'text/plain');

                                        const body = cursor.value.body;
                                        filesQueue.add(() => {
                                            const cmnt = JSON.parse(commentsChatJSON.json);

                                            const wb = XLSX.utils.book_new();

                                            const created = `Report was created by ${new Date().toUTCString()}`;

                                            let ws;

                                            try {
                                                ws = XLSX.utils.json_to_sheet([getSheetChatDetails(cmnt)]);
                                                XLSX.utils.sheet_add_aoa(ws, [[created]], { origin: 'A5' });
                                                XLSX.utils.book_append_sheet(wb, ws, 'Details');
                                            } catch (err) {
                                                console.error(err);
                                            }

                                            try {
                                                ws = XLSX.utils.json_to_sheet(getSheetChatComments(cmnt));
                                                XLSX.utils.book_append_sheet(wb, ws, 'Chat comments');
                                            } catch (err) {
                                                console.error(err);
                                            }

                                            XLSX.writeFile(
                                                wb,
                                                `Comments chat, ${body.titleVideo} (${commentsChatJSON.length}).xlsx`
                                            );

                                            // await asyncDownloadFiles(commentsChatJSON.json, `Comments chat, ${body.titleVideo} (${commentsChatJSON.length}).json`, 'text/plain');
                                        });
                                    }
                                } catch (err) {
                                    console.error(err);
                                }
                            }

                            if (exportTypes?.typeTrVideo) {
                                try {
                                    const trVideoJSON = getTrVideoJSON(cursor.value.body);

                                    if (trVideoJSON) {
                                        // downloadFile(trVideoText.text, `Transcript video, ${cacheSel.body.titleVideo} (${trVideoText.length}).txt`, 'text/plain');

                                        const body = cursor.value.body;
                                        filesQueue.add(() => {
                                            const trVideo = JSON.parse(trVideoJSON.json);

                                            const wb = XLSX.utils.book_new();

                                            const created = `Report was created by ${new Date().toUTCString()}`;

                                            let ws;

                                            try {
                                                ws = XLSX.utils.json_to_sheet([getSheetTrVideoDetails(trVideo)]);
                                                XLSX.utils.sheet_add_aoa(ws, [[created]], { origin: 'A5' });
                                                XLSX.utils.book_append_sheet(wb, ws, 'Details');
                                            } catch (err) {
                                                console.error(err);
                                            }

                                            try {
                                                ws = XLSX.utils.json_to_sheet(getSheetTrVideo(trVideo));
                                                XLSX.utils.book_append_sheet(wb, ws, 'Transcript video');
                                            } catch (err) {
                                                console.error(err);
                                            }

                                            XLSX.writeFile(
                                                wb,
                                                `Transcript video, ${body.titleVideo} (${trVideoJSON.length}).xlsx`
                                            );

                                            // await asyncDownloadFiles(trVideoJSON.json, `Transcript video, ${body.titleVideo} (${trVideoJSON.length}).json`, 'text/plain');
                                        });
                                    }
                                } catch (err) {
                                    console.error(err);
                                }
                            }
                        }
                    } catch (err) {
                        console.error(err);
                        continue;
                    }

                    elProcessNowCache.textContent = indexCache as unknown as string;
                    indexCache += 1;

                    cursor = await cursor.continue();
                }

                await filesQueue.onIdle();

                // console.log('FILES: ', files);
                // console.log('filesQueue', filesQueue);

                elProcessExportCache.remove();
                elExportAllCacheMain.style.display = 'block';

                const elDoneExport = getProcessExportDoneHtml() as HTMLElement;
                elExportAllCacheMain.insertAdjacentElement('afterend', elDoneExport);

                const elExportDoneDate = document.getElementById('ycs_export_done_date') as HTMLElement;
                const elExportFilesCount = document.getElementById('ycs_saved_files_count') as HTMLElement;
                const elExportCountVideo = document.getElementById('ycs_done_count_video') as HTMLElement;

                elExportDoneDate.textContent = new Date().toUTCString();

                elExportFilesCount.textContent = countSaveFiles as unknown as string;

                elExportCountVideo.textContent = elProcessNowCache.textContent;
            } catch (err) {
                console.error(err);
            }
        };

        const elExportAllCache = document.getElementById('ycs_opts_btn_export_all_cache') as HTMLButtonElement;
        elExportAllCache.onclick = async (): Promise<void> => {
            try {
                const db = await idb;

                const totalCache = await db.count(STORE_CACHE_YCS);
                if (totalCache === 0) return;

                const fileTypes = getOptsFileType();
                if (fileTypes.typeJSON === false && fileTypes.typeTXT === false && fileTypes.typeXLSX === false) return;

                const exportTypes = getOptsDataTypeExport();
                if (
                    exportTypes.typeComments === false &&
                    exportTypes.typeChat === false &&
                    exportTypes.typeTrVideo === false
                )
                    return;

                disButtons(true);

                await saveExportedCacheToFiles();

                disButtons(false);
            } catch (err) {
                console.error(err);
                disButtons(false);
            }
        };

        await showUsageMemory();
    } catch (err) {
        console.error(err);
    }
};
