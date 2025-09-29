/* eslint-disable @typescript-eslint/no-explicit-any */

import { encode } from 'html-entities';
import { msToShareVideo, tmUsecToDateTime, wrapTryCatch, markTextComment, randomString, getPiP } from '../utils/assist';

// Use html-entities for proper HTML encoding
// This ensures special characters and emojis are handled correctly
function esc(input: unknown): string {
    try {
        const s = String(input ?? '');
        return encode(s);
    } catch {
        return '';
    }
}

function safeUrl(raw: unknown): string {
    try {
        let url = String(raw || '');
        if (!url) return '#';
        // normalize YouTube path
        if (url.startsWith('/')) url = `https://www.youtube.com${url}`;
        if (url.startsWith('www.')) url = `https://${url}`;
        const lower = url.toLowerCase();
        if (lower.startsWith('http://') || lower.startsWith('https://')) return url;
        return '#';
    } catch {
        return '#';
    }
}

function sanitizeHtml(html: unknown): string {
    try {
        let s = String(html || '');
        if (!s) return '';
        // strip scripts
        s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        // drop on* event handlers
        s = s
            .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
            .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
            .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
        // sanitize href/src protocols
        s = s.replace(/href\s*=\s*"([^"]*)"/gi, (_m, p1) => `href="${esc(safeUrl(p1))}" rel="noopener noreferrer"`);
        s = s.replace(/href\s*=\s*'([^']*)'/gi, (_m, p1) => `href='${esc(safeUrl(p1))}' rel="noopener noreferrer"`);
        s = s.replace(/src\s*=\s*"([^"]*)"/gi, (_m, p1) => {
            const u = safeUrl(p1);
            return u === '#' ? 'src=""' : `src="${esc(u)}"`;
        });
        s = s.replace(/src\s*=\s*'([^']*)'/gi, (_m, p1) => {
            const u = safeUrl(p1);
            return u === '#' ? "src=''" : `src='${esc(u)}'`;
        });
        return s;
    } catch {
        return '';
    }
}

function iconSortUp(): string {
    return `
        <span class="ycs-icons">
            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">
                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>
            </svg>
        </span>
    `;
}

function iconSortDown(): string {
    return `
        <span class="ycs-icons">
            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">
                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>
            </svg>
        </span>
    `;
}

function iconOk(): string {
    return `
        <span class="ycs-icons">
            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px"
            width="48" height="48"
            viewBox="0 0 48 48"
            style=" fill:#000000;"><linearGradient id="I9GV0SozQFknxHSR6DCx5a_70yRC8npwT3d_gr1" x1="9.858" x2="38.142" y1="9.858" y2="38.142" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#21ad64"></stop><stop offset="1" stop-color="#088242"></stop></linearGradient><path fill="url(#I9GV0SozQFknxHSR6DCx5a_70yRC8npwT3d_gr1)" d="M44,24c0,11.045-8.955,20-20,20S4,35.045,4,24S12.955,4,24,4S44,12.955,44,24z"></path><path d="M32.172,16.172L22,26.344l-5.172-5.172c-0.781-0.781-2.047-0.781-2.828,0l-1.414,1.414	c-0.781,0.781-0.781,2.047,0,2.828l8,8c0.781,0.781,2.047,0.781,2.828,0l13-13c0.781-0.781,0.781-2.047,0-2.828L35,16.172	C34.219,15.391,32.953,15.391,32.172,16.172z" opacity=".05"></path><path d="M20.939,33.061l-8-8c-0.586-0.586-0.586-1.536,0-2.121l1.414-1.414c0.586-0.586,1.536-0.586,2.121,0	L22,27.051l10.525-10.525c0.586-0.586,1.536-0.586,2.121,0l1.414,1.414c0.586,0.586,0.586,1.536,0,2.121l-13,13	C22.475,33.646,21.525,33.646,20.939,33.061z" opacity=".07"></path><path fill="#fff" d="M21.293,32.707l-8-8c-0.391-0.391-0.391-1.024,0-1.414l1.414-1.414c0.391-0.391,1.024-0.391,1.414,0	L22,27.758l10.879-10.879c0.391-0.391,1.024-0.391,1.414,0l1.414,1.414c0.391,0.391,0.391,1.024,0,1.414l-13,13	C22.317,33.098,21.683,33.098,21.293,32.707z"></path></svg>
        </span>
    `;
}

function iconReload(): string {
    return `
        <span class="ycs-icons">
            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="48" height="48" viewBox="0 0 48 48">
                <path fill="#ff6f02" d="M31 7.002l13 1.686L33.296 19 31 7.002zM17 41L4 39.314 14.704 29 17 41z"></path>
                <path fill="#ff6f00"
                    d="M8 24c0-8.837 7.163-16 16-16 1.024 0 2.021.106 2.992.29l.693-3.865C26.525 4.112 25.262 4.005 24 4.005c-11.053 0-20 8.947-20 20 0 4.844 1.686 9.474 4.844 13.051l3.037-2.629C9.468 31.625 8 27.987 8 24zM39.473 11.267l-3.143 2.537C38.622 16.572 40 20.125 40 24c0 8.837-7.163 16-16 16-1.029 0-2.033-.106-3.008-.292l-.676 3.771c1.262.21 2.525.317 3.684.317 11.053 0 20-8.947 20-20C44 19.375 42.421 14.848 39.473 11.267z">
                </path>
            </svg>
        </span>
    `;
}

function iconExpandShowMore(): string {
    return `
        <span class="ycs-icons__coll_exp">
            <svg version="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" enable-background="new 0 0 48 48">
                <polygon fill="#2196F3" points="43,17.1 39.9,14 24,29.9 8.1,14 5,17.1 24,36"/>
            </svg>
        </span>
    `;
}

function iconExpand(): string {
    return '▼';
}

function iconCollapse(): string {
    return '▲';
}

function iconPlay(): string {
    return `
        |▶
    `;
}

function renderComment(el: string | HTMLElement, data: any, isReply = true, querySearch?: string): void {
    if (!el) return;

    const renderLikeCount = (count: string | number): string => {
        try {
            if (typeof count === 'string' || typeof count === 'number') {
                return `
                    <div class="ycs-wrap-like">
                        <span class="ycs-icon-like">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">
                                <g>
                                    <path
                                        d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"></path>
                                </g>
                            </svg>
                        </span>
                        <span class="ycs-like-count">${esc(count)}</span>
                    </div>
                `;
            }
        } catch (err) {
            console.error(err);
        }

        return '';
    };

    const renderSpeechCount = (count: string | number, id: number): string => {
        const numericCount = typeof count === 'string' ? parseInt(count, 10) : count;
        if (typeof numericCount === 'number' && Number.isFinite(numericCount) && numericCount !== 0) {
            return `
                <div class="ycs-wrap-like">
                    <span class="ycs-icons__speech">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="14px" height="14px">
                            <linearGradient x1="12.686" x2="35.58" y1="4.592" y2="41.841"
                                gradientUnits="userSpaceOnUse">
                                <stop offset="0" stop-color="#21ad64" />
                                <stop offset="1" stop-color="#088242" />
                            </linearGradient>
                            <path
                                d="M42,8H6c-1.105,0-2,0.895-2,2v26c0,1.105,0.895,2,2,2h8v7.998	c0,0.891,1.077,1.337,1.707,0.707L24.412,38H42c1.105,0,2-0.895,2-2V10C44,8.895,43.105,8,42,8z" />
                        </svg>
                    </span>
                    <span class="ycs-like-count">${esc(count)}</span>
                    <button class="ycs-open-reply" data-idcom="${id}" title="Open replies to the comment">+</button>
                </div>
            `;
        }

        return '';
    };

    const renderMemberUser = (cmnt: any): string => {
        try {
            if (cmnt.item?.commentRenderer?.sponsorCommentBadge?.sponsorCommentBadgeRenderer?.tooltip) {
                const tooltip = cmnt.item.commentRenderer.sponsorCommentBadge.sponsorCommentBadgeRenderer.tooltip;
                const thumbnail =
                    wrapTryCatch(
                        () =>
                            cmnt.item.commentRenderer.sponsorCommentBadge.sponsorCommentBadgeRenderer.customBadge
                                .thumbnails[0].url
                    ) || '';

                return `
                    <img alt="${esc(tooltip)}" height="14" width="14"
                         title="${esc(tooltip)}"
                         class="ycs-user-member"
                         src="${esc(thumbnail)}" loading="lazy">
                `;
            }

            return '';
        } catch (err) {
            console.error(err);
            return '';
        }
    };

    const renderHeart = (cmnt: any): string => {
        try {
            if (cmnt?.item?.commentRenderer?.creatorHeart) {
                const tooltip = 'Liked by the author: ' + esc(cmnt.item.commentRenderer.creatorHeart.name);

                return `
                    <div class="ycs-heart-wrap" title="${tooltip}">
                        <span class="ycs-heart-icon">❤</span>
                    </div>
                `;
            }
        } catch (err) {
            console.error(err);
        }

        return '';
    };

    const renderVerified = (cmnt: any): string => {
        try {
            if (cmnt?.item?.commentRenderer?.verifiedAuthor) {
                const tooltip = 'Verified user';

                return `
                    <div class="ycs-verified-wrap" title="${tooltip}">
                        <span class="ycs-verified-icon">✔</span>
                    </div>
                `;
            }
        } catch (err) {
            console.error(err);
        }

        return '';
    };

    // const nodeSelect: HTMLElement | null = document.querySelector(selector);
    const wrapper = document.createElement('div');
    wrapper.id = 'ycs_wrap_comments';

    let nodeSelect;
    if (typeof el === 'string') {
        nodeSelect = document.querySelector(el);
    } else {
        nodeSelect = el;
    }

    nodeSelect?.appendChild(wrapper);

    // const elResutlSearch = document.createDocumentFragment();

    // const t0 = performance.now();

    if (nodeSelect) {
        const buildChatMessageHtml = (cmnt: any): string => {
            try {
                const r = wrapTryCatch(
                    () => cmnt.item.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer
                ) as any;
                if (!r) return '';

                const rf = wrapTryCatch(() => r.message.renderFullText);
                if (rf) return sanitizeHtml(rf);

                const ft = wrapTryCatch(() => r.message.fullText);
                if (ft) return esc(ft);

                const runs = (wrapTryCatch(() => r.message.runs) as any[]) || [];
                let html = '';
                for (const run of runs) {
                    try {
                        if (wrapTryCatch(() => (run as any).emoji)) {
                            const emoji: any = wrapTryCatch(() => (run as any).emoji) || {};
                            const thumbnails = wrapTryCatch(() => emoji.image.thumbnails) || [];
                            const url = wrapTryCatch(() => thumbnails[thumbnails.length - 1].url) || '';
                            const shortcut = (wrapTryCatch(() => emoji.shortcuts?.[0]) as string) || '';
                            const label =
                                (wrapTryCatch(() => emoji.image.accessibility.accessibilityData.label) as string) || '';
                            const alt = shortcut || label || 'emoji';
                            const style = `margin-left: 2px; margin-right: 2px;`;
                            if (url) {
                                html += `<img src="${url}" alt="${alt}" title="${alt}" width="24" height="24" style="${style}" class="ycs-attachment">`;
                            } else {
                                html += alt;
                            }
                        } else if (run?.navigationEndpoint) {
                            if (
                                parseInt(
                                    wrapTryCatch(() => run.navigationEndpoint.watchEndpoint.startTimeSeconds) as any
                                ) >= 0
                            ) {
                                const videoId = wrapTryCatch(() => run.navigationEndpoint.watchEndpoint.videoId) || '';
                                const t =
                                    wrapTryCatch(() => run.navigationEndpoint.watchEndpoint.startTimeSeconds) || 0;
                                const text = run?.text || '';
                                html += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${videoId}&t=${t}s" data-offsetvideo="${t}">${text}</a>`;
                            } else {
                                const href =
                                    wrapTryCatch(() => run.navigationEndpoint.browseEndpoint.canonicalBaseUrl) ||
                                    wrapTryCatch(() => run.navigationEndpoint.urlEndpoint.url) ||
                                    wrapTryCatch(() => run.navigationEndpoint.commandMetadata.webCommandMetadata.url) ||
                                    '#';
                                const text = run?.text || '';
                                html += `<a class="ycs-cpointer ycs-comment-link" href="${href}" target="_blank">${text}</a>`;
                            }
                        } else {
                            html += run?.text || '';
                        }
                    } catch (e) {
                        console.error(e);
                        html += run?.text || '';
                    }
                }
                return html ? sanitizeHtml(html) : '';
            } catch (e) {
                console.error(e);
                return '';
            }
        };

        // nodeSelect.style.display = 'none';

        const arrHtml: any[] = [];
        const range = 200;
        let currentPos = 0;
        let countComment = 0;
        // const nodeComment = document.createElement('div');

        for (const comment of data) {
            // nodeComment.id = `ycs-number-comment-${++countComment}`;
            // nodeComment.className = 'ycs-render-comment';

            try {
                arrHtml.push({
                    html: `
                    <div id="ycs-number-comment-${++countComment}" class="ycs-render-comment">
                        <div class="ycs-left">
                            <a href="${safeUrl(wrapTryCatch(() => comment.item.commentRenderer.authorEndpoint.browseEndpoint.canonicalBaseUrl) || comment.item?.commentRenderer?.authorEndpoint?.commandMetadata?.webCommandMetadata?.url || '')}" target="_blank" rel="noopener noreferrer">
                                <div class="ycs-render-img">
                                    <img alt="${esc(comment.item?.commentRenderer?.authorText?.simpleText || '')}" height="40" width="40"
                                    src="${esc(wrapTryCatch(() => comment.item.commentRenderer.authorThumbnail.thumbnails[0].url) || '')}" loading="lazy">
                                </div>
                            </a>
                        </div>
                        <div class="ycs-comment-block">
                            <div class="ycs-head-block__dib ycs-head-block ycs-head__title-main">
                                <a class="ycs-head__title"
                                 href="${safeUrl(wrapTryCatch(() => comment.item.commentRenderer.authorEndpoint.browseEndpoint.canonicalBaseUrl) || comment.item?.commentRenderer?.authorEndpoint?.commandMetadata?.webCommandMetadata?.url || '')}" target="_blank" rel="noopener noreferrer">
                                    <span>
                                         ${esc(comment.item?.commentRenderer?.authorText?.simpleText || '')}
                                    </span>
                                </a>
                                ${renderVerified(comment)}
                                <div class="ycs-head-block__dib ycs-head-block__lh">
                                    ${renderMemberUser(comment)}
                                    <a
                                        class="ycs-datetime-goto"
                                         href="${safeUrl(wrapTryCatch(() => comment.item.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url) || '')}" target="_blank" rel="noopener noreferrer" title="Open a comment, a reply, in a new window, for edit">
                                             ${esc(wrapTryCatch(() => comment.item.commentRenderer.publishedTimeText.runs[0].text) || '')}
                                    </a>
                                    ${renderHeart(comment)}
                                    ${renderLikeCount(comment?.item?.commentRenderer?.likeCount || comment?.item?.commentRenderer?.voteCount?.simpleText)}
                                    ${renderSpeechCount(comment?.item?.commentRenderer?.replyCount, comment.item?.commentRenderer?.commentId)}
                                    ${comment.item?.typeComment === 'R' && isReply ? `<span class="ycs-datetime-goto">(reply)</span><button id=${comment.refIndex} title="Open the comment to the reply here." class="ycs-open-comment">${iconExpand()}</button>` : ''}
                                </div>
                            </div>
                             <div class="ycs-comment__main-text">${comment.item?.commentRenderer?.contentText?.renderFullText ? sanitizeHtml(comment.item?.commentRenderer?.contentText?.renderFullText) : esc(comment.item?.commentRenderer?.contentText?.fullText || '')}</div>
                        </div>
                    </div>
                `
                });
            } catch (e) {
                console.error(e);
                continue;
            }
        }

        try {
            const partSearchRes = arrHtml.slice(currentPos, range);

            if (partSearchRes.length > 0) {
                for (const res of partSearchRes) {
                    wrapper.insertAdjacentHTML('beforeend', res.html);
                    currentPos++;
                }

                if (arrHtml.length > range) {
                    wrapper.insertAdjacentHTML(
                        'beforeend',
                        `
                        <div id="ycs_search_show_more" class="ycs-render-comment ycs-show_more_block">
                            <div id="ycs__show-more-button"
                                class="ycs-title">
                                Show more, found comments (${arrHtml.length - currentPos}) ${iconExpandShowMore()}
                            </div>
                        </div>
                    `
                    );

                    const elShowMoreBtn = document.getElementById('ycs_search_show_more');

                    elShowMoreBtn?.addEventListener('click', () => {
                        const pSearchRes = arrHtml.slice(currentPos, range + currentPos);

                        if (pSearchRes.length > 0) {
                            const randomStr = randomString(15);
                            elShowMoreBtn.insertAdjacentHTML('beforebegin', `<div class="${randomStr}"></div>`);
                            const elShowMore = document.getElementsByClassName(randomStr)[0];

                            for (const res of pSearchRes) {
                                elShowMore.insertAdjacentHTML('beforeend', res.html);
                                currentPos++;
                            }

                            if (querySearch) {
                                console.log('elShowMoreBtn: ', elShowMoreBtn);
                                console.log('querySearch: ', querySearch);
                                markTextComment(`.${randomStr}`, querySearch);
                            }

                            if (arrHtml.length - currentPos <= 0) {
                                const showMore = document.getElementById('ycs_search_show_more');

                                if (showMore) {
                                    showMore.remove();
                                }
                            } else {
                                const showMore = document.querySelector('#ycs_search_show_more #ycs__show-more-button');

                                if (showMore) {
                                    showMore.innerHTML = `Show more, found comments (${arrHtml.length - currentPos}) ${iconExpandShowMore()}`;
                                }
                            }
                        }
                    });
                }
            }
        } catch (e) {
            // if error show all search result
            console.error(e);
            currentPos = 0;
            for (const res of arrHtml) {
                wrapper.insertAdjacentHTML('beforeend', res.html);
            }
        }

        if (querySearch) {
            markTextComment(el, querySearch);
        }
    }
}

function renderCommentChat(selector: string, data: any, querySearch?: string): void {
    if (typeof selector !== 'string') return;

    const wrapper = document.createElement('div');
    wrapper.id = 'ycs_wrap_comments_chat';
    const nodeSelect = document.querySelector(selector);
    nodeSelect?.appendChild(wrapper);

    const _gotoVideo = (comment: any): string => {
        try {
            if (comment.item?.replayChatItemAction?.videoOffsetTimeMsec) {
                return `
                    <span class="ycs-cpointer ycs-gotochat-video ycs_goto_chat" data-offsetvideo="${comment.item?.replayChatItemAction?.videoOffsetTimeMsec || 0}"
                        title="Go to the video by time.">
                        ${iconPlay()} Go to: ${wrapTryCatch(() => comment.item.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.timestampText.simpleText) || ''}
                    </span>
                `;
            }

            return '';
        } catch (e) {
            console.error(e);
            return '';
        }
    };

    const renderMemberUser = (cmnt: any): string => {
        try {
            const authorBadge: any = wrapTryCatch(
                () =>
                    cmnt.item.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer
                        .authorBadges
            );
            let member: any;

            console.log('authorBadge: ', authorBadge);

            if (authorBadge?.length > 0) {
                for (const m of authorBadge) {
                    if (m?.liveChatAuthorBadgeRenderer?.customThumbnail) {
                        member = m;
                        break;
                    }
                }
            }

            console.log('member: ', member);

            if (authorBadge && member) {
                const tooltip = member?.liveChatAuthorBadgeRenderer?.tooltip;
                const thumbnail =
                    wrapTryCatch(() => member.liveChatAuthorBadgeRenderer.customThumbnail.thumbnails[0].url) || '';

                return `
                    <img alt="${tooltip}" height="14" width="14"
                         title="${tooltip}"
                         class="ycs-user-member"
                         src="${thumbnail}" loading="lazy">
                `;
            }

            return '';
        } catch (err) {
            console.error(err);
            return '';
        }
    };

    const renderVerified = (cmnt: any): string => {
        try {
            if (
                wrapTryCatch(
                    () =>
                        cmnt.item.replayChatItemAction.actions[0].addChatItemAction.item?.liveChatTextMessageRenderer
                            .verifiedAuthor
                )
            ) {
                const tooltip = 'Verified user';

                return `
                    <div class="ycs-verified-wrap" title="${tooltip}">
                        <span class="ycs-verified-icon">✔</span>
                    </div>
                `;
            }
        } catch (err) {
            console.error(err);
        }

        return '';
    };

    // Build rich chat message HTML with emoji image fallback to shortcut/label
    const buildChatMessageHtml = (cmnt: any): string => {
        try {
            const r = wrapTryCatch(
                () => cmnt.item.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer
            ) as any;
            if (!r) return '';

            const rf = wrapTryCatch(() => r.message.renderFullText);
            if (rf) return sanitizeHtml(rf);

            const ft = wrapTryCatch(() => r.message.fullText);
            if (ft) return esc(ft);

            const runs = (wrapTryCatch(() => r.message.runs) as any[]) || [];
            let html = '';
            for (const run of runs) {
                try {
                    if (wrapTryCatch(() => (run as any).emoji)) {
                        const emoji: any = wrapTryCatch(() => (run as any).emoji) || {};
                        const thumbnails = wrapTryCatch(() => emoji.image.thumbnails) || [];
                        const url = wrapTryCatch(() => thumbnails[thumbnails.length - 1].url) || '';
                        const shortcut = (wrapTryCatch(() => emoji.shortcuts?.[0]) as string) || '';
                        const label =
                            (wrapTryCatch(() => emoji.image.accessibility.accessibilityData.label) as string) || '';
                        const alt = shortcut || label || 'emoji';
                        const style = `margin-left: 2px; margin-right: 2px;`;
                        if (url) {
                            html += `<img src="${url}" alt="${alt}" title="${alt}" width="24" height="24" style="${style}" class="ycs-attachment">`;
                        } else {
                            html += alt;
                        }
                    } else if (run?.navigationEndpoint) {
                        if (
                            parseInt(
                                wrapTryCatch(() => run.navigationEndpoint.watchEndpoint.startTimeSeconds) as any
                            ) >= 0
                        ) {
                            const videoId = wrapTryCatch(() => run.navigationEndpoint.watchEndpoint.videoId) || '';
                            const t = wrapTryCatch(() => run.navigationEndpoint.watchEndpoint.startTimeSeconds) || 0;
                            const text = run?.text || '';
                            html += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${videoId}&t=${t}s" data-offsetvideo="${t}">${text}</a>`;
                        } else {
                            const href =
                                wrapTryCatch(() => run.navigationEndpoint.browseEndpoint.canonicalBaseUrl) ||
                                wrapTryCatch(() => run.navigationEndpoint.urlEndpoint.url) ||
                                wrapTryCatch(() => run.navigationEndpoint.commandMetadata.webCommandMetadata.url) ||
                                '#';
                            const text = run?.text || '';
                            html += `<a class="ycs-cpointer ycs-comment-link" href="${href}" target="_blank">${text}</a>`;
                        }
                    } else {
                        html += run?.text || '';
                    }
                } catch (e) {
                    console.error(e);
                    html += run?.text || '';
                }
            }
            return html ? sanitizeHtml(html) : '';
        } catch (e) {
            console.error(e);
            return '';
        }
    };

    if (nodeSelect) {
        const arrHtml: any[] = [];
        const range = 200;
        let currentPos = 0;
        let countComment = 0;

        // const nodeComment = document.createElement('div');

        for (const comment of data) {
            // nodeComment.id = `ycs-number-comment-${++countComment}`;
            // nodeComment.className = 'ycs-render-comment';

            try {
                arrHtml.push({
                    html: `
                    <div id="ycs-number-comment-${++countComment}" class="ycs-render-comment">
                        <div class="ycs-left">
                            <a href="${safeUrl(`/channel/${wrapTryCatch(() => comment.item.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorExternalChannelId) || ''}`)}" target="_blank" rel="noopener noreferrer">
                                <div class="ycs-render-img">
                                     <img alt="${esc(wrapTryCatch(() => comment.item.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorName.simpleText) || '')}" height="40" width="40"
                                     src="${esc(wrapTryCatch(() => comment.item.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorPhoto.thumbnails[0].url) || '')}" loading="lazy">
                                </div>
                            </a>
                        </div>
                        <div class="ycs-comment-block">
                            <div class="ycs-head-block__dib ycs-head-block ycs-head__title-main">
                                 <a class="ycs-head__title""
                                 href="${safeUrl(`/channel/${wrapTryCatch(() => comment.item.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorExternalChannelId) || ''}`)}" target="_blank" rel="noopener noreferrer">
                                    <span>
                                     ${esc(wrapTryCatch(() => comment.item.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorName.simpleText) || '')}
                                    </span>
                                </a>
                                ${renderVerified(comment)}
                                <div class="ycs-head-block__dib ycs-head-block__lh ycs-time-size">
                                    ${renderMemberUser(comment)}
                                    <a
                                         class="ycs-datetime-goto" title="GMT0"
                                         href="${safeUrl(msToShareVideo(comment.item?.replayChatItemAction?.videoOffsetTimeMsec) || '')}" target="_blank" rel="noopener noreferrer">
                                            ${tmUsecToDateTime(wrapTryCatch(() => comment.item.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.timestampUsec) as any)}
                                    </a>
                                    <span class="ycs_chat_info">(chat)</span>
                                    ${_gotoVideo(comment)}
                                </div>
                            </div>
                             <div class="ycs-comment__main-text">${((): string => {
                                 try {
                                     return buildChatMessageHtml(comment);
                                 } catch (e) {
                                     console.error(e);
                                     return '';
                                 }
                             })()}</div>
                        </div>
                    </div>
                `
                });
            } catch (e) {
                console.error(e);
                continue;
            }

            // elResutlSearch.appendChild(nodeComment);
        }

        try {
            const partSearchRes = arrHtml.slice(currentPos, range);

            if (partSearchRes.length > 0) {
                for (const res of partSearchRes) {
                    wrapper.insertAdjacentHTML('beforeend', res.html);
                    currentPos++;
                }

                if (arrHtml.length > range) {
                    wrapper.insertAdjacentHTML(
                        'beforeend',
                        `
                        <div id="ycs_search_chat_show_more" class="ycs-render-comment ycs-show_more_block">
                            <div id="ycs__show-more-button"
                                class="ycs-title">
                                Show more, found chat replay (${arrHtml.length - currentPos}) ${iconExpandShowMore()}
                            </div>
                        </div>
                    `
                    );

                    const elShowMoreBtn = document.getElementById('ycs_search_chat_show_more');

                    elShowMoreBtn?.addEventListener('click', () => {
                        // const partSearchRes = arrHtml.slice(currentPos, range + currentPos);

                        // for (const res of partSearchRes) {
                        //     elShowMoreBtn.insertAdjacentHTML('beforebegin', res.html);
                        //     currentPos++;
                        // }

                        const pSearchRes = arrHtml.slice(currentPos, range + currentPos);

                        if (pSearchRes.length > 0) {
                            const randomStr = randomString(15);
                            elShowMoreBtn.insertAdjacentHTML('beforebegin', `<div class="${randomStr}"></div>`);
                            const elShowMore = document.getElementsByClassName(randomStr)[0];

                            for (const res of pSearchRes) {
                                elShowMore.insertAdjacentHTML('beforeend', res.html);
                                currentPos++;
                            }

                            if (querySearch) {
                                console.log('elShowMoreBtn: ', elShowMoreBtn);
                                console.log('querySearch: ', querySearch);
                                markTextComment(`.${randomStr}`, querySearch);
                            }

                            if (arrHtml.length - currentPos <= 0) {
                                const showMore = document.getElementById('ycs_search_chat_show_more');

                                if (showMore) {
                                    showMore.remove();
                                }
                            } else {
                                const showMore = document.querySelector(
                                    '#ycs_search_chat_show_more #ycs__show-more-button'
                                );

                                if (showMore) {
                                    showMore.innerHTML = `Show more, found chat replay (${arrHtml.length - currentPos}) ${iconExpandShowMore()}`;
                                }
                            }
                        }
                    });
                }
            }

            if (querySearch) {
                markTextComment(selector, querySearch);
            }
        } catch (e) {
            // if error show all search result
            console.error(e);
            currentPos = 0;
            for (const res of arrHtml) {
                wrapper.insertAdjacentHTML('beforeend', res.html);
            }
        }
    }
}

function renderCommentTrVideo(selector: string, data: any, querySearch?: string): void {
    if (typeof selector !== 'string') return;

    const wrapper = document.createElement('div');
    wrapper.id = 'ycs_wrap_comments_trvideo';
    const nodeSelect = document.querySelector(selector);
    nodeSelect?.appendChild(wrapper);

    // const elResutlSearch = document.createDocumentFragment();

    // const _msToTime = (ms: number): string => {
    //     try {
    //         return new Date(parseInt((ms as any))).toISOString().substr(11, 8);
    //     } catch (e) {
    //         console.error(e);
    //         return '';
    //     }
    // }

    if (nodeSelect) {
        const arrHtml: any[] = [];
        const range = 200;
        let currentPos = 0;
        let countComment = 0;
        // const nodeComment = document.createElement('div');

        for (const comment of data) {
            // nodeComment.id = `ycs-number-comment-${++countComment}`;
            // nodeComment.className = 'ycs-render-comment ycs-oc-ml';

            try {
                arrHtml.push({
                    html: `
                    <div id="ycs-number-comment-${++countComment}" class="ycs-render-comment ycs-oc-ml">
                        <div class="ycs-left">
                            <a class="ycs-goto-video ycs-cpointer"
                                href="${safeUrl(msToShareVideo(wrapTryCatch(() => comment.item.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.startOffsetMs) as any) || '')}"
                                target="_blank"
                                data-offsetvideo="${wrapTryCatch(() => comment.item.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.startOffsetMs) || ''}"
                                title="Go to the video by time.">
                                ${iconPlay()} Go to: ${esc(comment.item?.transcriptCueGroupRenderer?.formattedStartOffset?.simpleText || 0)}
                            </a>
                            <div class="ycs-head-block__dib ycs-head-block ycs-head__title-main">
                                <a class="ycs-datetime-goto"
                                    href="${safeUrl(msToShareVideo(wrapTryCatch(() => comment.item.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.startOffsetMs) as any) || '')}"
                                    target="_blank" title="Timestamp link">
                                    Share link
                                </a>
                            </div>
                        </div>
                        <div class="ycs-comment__main-text ycs-clear">${wrapTryCatch(() => comment.item.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.cue.simpleText) || ''}</div>
                    </div>
                `
                });
            } catch (e) {
                console.error(e);
                continue;
            }

            // elResutlSearch.appendChild(nodeComment);
        }

        try {
            const partSearchRes = arrHtml.slice(currentPos, range);

            if (partSearchRes.length > 0) {
                for (const res of partSearchRes) {
                    wrapper.insertAdjacentHTML('beforeend', res.html);
                    currentPos++;
                }

                if (arrHtml.length > range) {
                    wrapper.insertAdjacentHTML(
                        'beforeend',
                        `
                        <div id="ycs_search_trvideo_show_more" class="ycs-render-comment ycs-show_more_block">
                            <div id="ycs__show-more-button"
                                class="ycs-title">
                                Show more, found transcript video (${arrHtml.length - currentPos}) ${iconExpandShowMore()}
                            </div>
                        </div>
                    `
                    );

                    const elShowMoreBtn = document.getElementById('ycs_search_trvideo_show_more');

                    elShowMoreBtn?.addEventListener('click', () => {
                        // const partSearchRes = arrHtml.slice(currentPos, range + currentPos);

                        // for (const res of partSearchRes) {
                        //     elShowMoreBtn.insertAdjacentHTML('beforebegin', res.html);
                        //     currentPos++;
                        // }

                        const pSearchRes = arrHtml.slice(currentPos, range + currentPos);

                        if (pSearchRes.length > 0) {
                            const randomStr = randomString(15);
                            elShowMoreBtn.insertAdjacentHTML('beforebegin', `<div class="${randomStr}"></div>`);
                            const elShowMore = document.getElementsByClassName(randomStr)[0];

                            for (const res of pSearchRes) {
                                elShowMore.insertAdjacentHTML('beforeend', res.html);
                                currentPos++;
                            }

                            if (querySearch) {
                                console.log('elShowMoreBtn: ', elShowMoreBtn);
                                console.log('querySearch: ', querySearch);
                                markTextComment(`.${randomStr}`, querySearch);
                            }

                            if (arrHtml.length - currentPos <= 0) {
                                const showMore = document.getElementById('ycs_search_trvideo_show_more');

                                if (showMore) {
                                    showMore.remove();
                                }
                            } else {
                                const showMore = document.querySelector(
                                    '#ycs_search_trvideo_show_more #ycs__show-more-button'
                                );

                                if (showMore) {
                                    showMore.innerHTML = `Show more, found transcript video (${arrHtml.length - currentPos}) ${iconExpandShowMore()}`;
                                }
                            }
                        }
                    });
                }
            }

            if (querySearch) {
                markTextComment(selector, querySearch);
            }
        } catch (e) {
            // if error show all search result
            console.error(e);
            currentPos = 0;
            for (const res of arrHtml) {
                wrapper.insertAdjacentHTML('beforeend', res.html);
            }
        }
    }
}

function renderLoadComments(selector: string): void {
    if (typeof selector !== 'string') return;

    const renderViewMode = (): string => {
        try {
            if (getPiP().supported) {
                return '<button id="ycs_view_mode" class="ycs-btn-search ycs-title ycs_noselect" name="View Mode" type="button" title="⌨ HOTKEY: [ Alt + ~ ] Viewer mode for more easier searches and video watching">V. Mode</button>';
            } else {
                return '';
            }
        } catch (err) {
            console.error(err);
            return '';
        }
    };

    const node = document.querySelector(selector);

    const nodeTag = document.createElement('div');
    nodeTag.className = 'ycs-app';
    nodeTag.innerHTML = `
        <div class="ycs-app-toggle"><p class="ycs-title ycs-left">YouTube Comment Search</p><div class="ycs-right"><button class="ycs-btn-toggle-app ycs-btn-search ycs_noselect" type="button">Show YCS</button></div></div>
        <div class="ycs-app-main">
            <div class="ycs-head-search">
                <p class="ycs-title ycs-left" id="ycs_title_information">
                    YouTube Comment Search <span id="ycs-count-load"></span>
                </p>
                <div class="ycs_load_all ycs-right">
                    <button class="ycs-btn-toggle-app ycs-btn-search ycs_noselect" type="button">hide YCS</button>
                    <button id="ycs-load-all" class="ycs-btn-search ycs-title ycs_noselect" name="Load all comments" type="button"
                        title="Load all available comments">
                        Load all
                    </button>
                    <button id="ycs_load_stop" class="ycs_btn_load-stop ycs-title ycs_noselect" name="Stop load all comments" type="button"
                        title="Stop load all available comments">
                        stop
                    </button>
                </div>
            </div>
            <div class="ycs-title ycs-clear ycs-infobar">
                <div id="ycs-desc__search">

                    <div>
                        <p class="ycs-infobar-field"><span id="ycs_status_cmnt">${iconReload()}</span> Comments: </p>
                        <div class="ycs-infobar__search">
                            <span id="ycs_cmnts">0</span>

                            <div class="ycs_infobar_btns ycs_noselect">
                                <div class="ycs_load_wrap">
                                    <button id="ycs-load-cmnts" class="ycs-btn-search ycs-title" name="Load comments" type="button"
                                        title="Load comments">
                                        load
                                    </button>
                                </div>
                                <div class="ycs_open_wrap">
                                    <button id="ycs_open_all_comments_window" class="ycs-btn-search ycs-title"
                                        name="Open comments in the new popup window" title="Open comments in the new popup window">
                                        open
                                    </button>
                                </div>
                                <div class="ycs_save_wrap">
                                    <button id="ycs_save_all_comments" class="ycs-btn-search ycs-title" name="Save comments to file"
                                        title="Save comments to file">
                                        save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <span id="ycs_anchor_vmode" class="ycs-hidden"></span>
                    <div>
                        <p class="ycs-infobar-field"><span id="ycs_status_chat">${iconReload()}</span> Chat replay: </p>
                        <div class="ycs-infobar__search">
                            <span id="ycs_cmnts_chat">0</span>

                            <div class="ycs_infobar_btns ycs_noselect">
                                <div class="ycs_load_wrap">
                                    <button id="ycs-load-chat" class="ycs-btn-search ycs-title" name="Load chat replay" type="button"
                                        title="Load chat replay">
                                        load
                                    </button>
                                </div>
                                <div class="ycs_open_wrap">
                                    <button id="ycs_open_all_comments_chat_window" class="ycs-btn-search ycs-title"
                                        name="Open chat comments in the new popup window"
                                        title="Open chat comments in the new popup window">
                                        open
                                    </button>
                                </div>
                                <div class="ycs_save_wrap">
                                    <button id="ycs_save_all_comments_chat" class="ycs-btn-search ycs-title"
                                        name="Save chat comments to file" title="Save chat comments to file">
                                        save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <p class="ycs-infobar-field"><span id="ycs_status_trvideo">${iconReload()}</span> Transcript video: </p>
                        <div class="ycs-infobar__search">
                            <span id="ycs_cmnts_video">0</span>

                            <div class="ycs_infobar_btns ycs_noselect">
                                <div class="ycs_load_wrap">
                                    <button id="ycs-load-transcript-video" class="ycs-btn-search ycs-title" name="Load transcript video"
                                        type="button" title="Load transcript video">
                                        load
                                    </button>
                                </div>
                                <div class="ycs_open_wrap">
                                    <button id="ycs_open_all_comments_trvideo_window" class="ycs-btn-search ycs-title"
                                        name="Open transcript video in the new popup window"
                                        title="Open transcript video in the new popup window">
                                        open
                                    </button>
                                </div>
                                <div class="ycs_save_wrap">
                                    <button id="ycs_save_all_comments_trvideo" class="ycs-btn-search ycs-title"
                                        name="Save transcript video to file" title="Save transcript video to file">
                                        save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <div id="ycs-search"></div>
            <div><p class="ycs-title ycs_notify_box"><i></i></p></div>

            <div class="ycs_extra_panel ycs-right">
                <div>
                    ${renderViewMode()}
                </div>
            </div>

            <div id="ycs-search-result" class="ycs-clear"></div>

            <div id="ycs_modal_window" class="ycs_modal">
                <div class="ycs_modal-content">
                    <button id="ycs_btn_close_modal" class="ycs_btn_close ycs_noselect">✖</button>
                    <div class="ycs_modal_body">
                        <h2>Instructions</h2>
                        <ol>
                            <li>Open video on YouTube</li>
                            <li>Find the YCS extension under the current video and click the button "Load all" or choose to load the categories
                            </li>
                            <li>Write the search query, press Enter or click the button Search</li>
                        </ol>
                        <hr />
                        <h2>FAQ</h2>
                        <ol>
                            <li>
                                <p><strong>How to like, reply to a comment?</strong><br />In the search results, click on the date (like, "2
                                    months ago") of the comment and will open a new window with an active comment or reply under the video,
                                    where you can do any action.</p>
                            </li>
                            <li>
                                <p><strong>How do I find all timestamped comments and replies on a video?</strong><br />Click on the "Timestamps" button under the search bar.</p>
                            </li>
                            <li>
                                <p><strong>How can I find addressed to user's comments, replies?</strong><br />Write&nbsp;<code>@</code>&nbsp;in
                                    the input field.</p>
                            </li>
                            <li>
                                <p><strong>How can I view the contents of the video transcript at a specific minute?</strong><br />You can write
                                    a search query for Trp. Video, in the&nbsp;<code>mm:ss</code>&nbsp;format. For
                                    example:<br /><code>:</code>&nbsp;- all the text of the video transcript.<br /><code>15:</code>&nbsp;- all
                                    the text in the 15th minute.</p>
                            </li>
                            <li>
                                <p><strong>How can I view the comment for a found reply?</strong><br />Click on
                                    the&nbsp;<strong>▼</strong>&nbsp;button.</p>
                            </li>
                            <li>
                                <p><strong>How can I see the all replies to the found comment?</strong><br />In the header of the found comment,
                                    you can find the reply icon and the count, to see the replies click on
                                    the&nbsp;<strong>+</strong>&nbsp;button.</p>
                            </li>
                            <li>
                                <p><strong>How to use search in YouTube shorts?</strong><br />
                                    Open a YouTube video short. Click badge <strong>YCS</strong> (right of the address bar) and click on the button <strong>Open YT short</strong>.</p>
                            </li>
                        </ol>

                        <div>
                            <p>You can use the search engine (YCS), while loading comments, chat, transcript video.</p>
                            &nbsp;&nbsp;
                        </div>

                    </div>
                </div>
            </div>

        </div>
    `;

    node?.appendChild(nodeTag);
}

function renderSearch(node: HTMLElement): void {
    if (!node) return;

    node.innerHTML = `
        <div>
            <div>
                <div class="ycs-searchbox">
                    <input title="Write the search query, press Enter or click the button Search."
                        class="ycs-search__input ycs_noselect" type="text" id="ycs-input-search" placeholder="Search">
                </div>
                <select title="Select a search category." name="ycs_search_select"
                    id="ycs_search_select" class="ycs-btn-search ycs-title ycs-search-select ycs_noselect">
                    <option value="comments">Comments</option>
                    <option value="chat">Chat replay</option>
                    <option value="video">Trpt. video</option>
                    <option selected value="all">All</option>
                </select>
                <button id="ycs_btn_search" class="ycs-btn-search ycs-title ycs_noselect" type="button">
                    Search
                </button><button id="ycs_btn_search_clear_text" class="ycs-btn-search ycs-title ycs-search-clear" type="button" title="Clear text" style="margin-left:1px;">✕</button>

                <div class="ycs-ext-search_block">
                    <p id="ycs-search-total-result" class="ycs-title"></p>
                    <div class="ycs-ext-search_option">
                        <label for="ycs_extended_search" class="ycs_noselect ycs-title" title="Enables the use of unix-like search commands">
                            <input type="checkbox" name="ycs_extended_search" id="ycs_extended_search">
                            <span class="ycs-ext-search_title">Extended search</span>
                        </label>
                        <div class="ycs-ext-search-opts">
                            <fieldset>

                                <label for="ycs_extended_search_title" class="ycs_noselect ycs-title" title="Extended search by title">
                                    <input type="radio" id="ycs_extended_search_title" name="ycs_ext_search_opts" value="title" disabled>
                                    <span class="ycs-ext-search_title">Title</span>
                                </label>

                                <label for="ycs_extended_search_main" class="ycs_noselect ycs-title" title="Extended search by main text">
                                    <input type="radio" id="ycs_extended_search_main" name="ycs_ext_search_opts" value="main" disabled checked>
                                    <span class="ycs-ext-search_title">Main</span>
                                </label>

                            </fieldset>
                        </div>
                        <a href="https://github.com/sonigy/YCS#extended-search" class="ycs-title ycs-ext-search_link" target="_blank" rel="noopener noreferrer" title="How to use">?</a>
                    </div>
                </div>

                <button id="ycs_btn_open_modal" class="ycs_noselect" title="FAQ">?</button>
            </div>
            <div class="ycs-search-result-infobar">

                <div class="ycs-btn-panel ycs_noselect">
                    <button id="ycs_btn_timestamps"
                        data-sort="newest"
                        data-sort-chat="newest"
                        class="ycs-btn-search ycs-title"
                        name="timestamps" type="button"
                        title="Show comments, replies, chat with time stamps (Newest)">
                        Time stamps
                        ${iconSortDown()}
                    </button>
                    <button id="ycs_btn_author"
                        data-sort="newest"
                        data-sort-chat="newest"
                        class="ycs-btn-search ycs-title"
                        name="author" type="button"
                        title="Show comments, replies, chat from the author (Newest)">
                        Author
                        ${iconSortDown()}
                    </button>
                    <button id="ycs_btn_heart"
                        data-sort="newest"
                        class="ycs-btn-search ycs-title"
                        name="heart" type="button"
                        title="Show comments and replies that the author likes (Newest)">
                        <span class="ycs-creator-heart_icon">❤</span>
                        ${iconSortDown()}
                    </button>
                    <button id="ycs_btn_verified"
                        data-sort="newest"
                        data-sort-chat="newest"
                        class="ycs-btn-search ycs-title"
                        name="verified" type="button"
                        title="Show comments, replies and chat from a verified authors (Newest)">
                        <span class="ycs-creator-verified_icon">✔</span>
                        ${iconSortDown()}
                    </button>
                    <button id="ycs_btn_links"
                        data-sort="newest"
                        data-sort-chat="newest"
                        data-sort-trp="newest"
                        class="ycs-btn-search ycs-title"
                        name="links" type="button"
                        title="Shows links in comments, replies, chat, video transcript (Newest)">
                        Links
                        ${iconSortDown()}
                    </button>
                    <button id="ycs_btn_likes"
                        class="ycs-btn-search ycs-title"
                        name="likes" type="button"
                        title="Show comments, replies by number of likes (sort largest to smallest)">
                        Likes
                    </button>
                    <button id="ycs_btn_replied_comments"
                        class="ycs-btn-search ycs-title"
                        name="replied" type="button"
                        title="Show comments by number of replies (sort largest to smallest)">
                        Replied
                    </button>
                    <button id="ycs_btn_members"
                        data-sort="newest"
                        data-sort-chat="newest"
                        class="ycs-btn-search ycs-title"
                        name="members" type="button"
                        title="Show comments, replies, chat from channel members (Newest)">
                        Members
                        ${iconSortDown()}
                    </button>
                    <button id="ycs_btn_donated"
                        data-sort-chat="newest"
                        class="ycs-btn-search ycs-title"
                        name="donated" type="button"
                        title="Show chat comments from users who have donated (Newest)">
                        Donated
                        ${iconSortDown()}
                    </button>
                    <button id="ycs_btn_sort_first"
                        data-sort="newest"
                        data-sort-chat="newest"
                        data-sort-trp="newest"
                        class="ycs-btn-search ycs-title"
                        name="sortFirst" type="button"
                        title="Show all comments, chat, video transcript sorted by date (Newest)">
                        All
                        ${iconSortDown()}
                    </button>
                    <button id="ycs_btn_random"
                        class="ycs-btn-search ycs-title"
                        name="random" type="button"
                        title="Show a random comment">
                        Random
                    </button>
                    <button id="ycs_btn_clear"
                        class="ycs-btn-search ycs-title ycs-search-clear"
                        style="visibility:hidden;"
                        name="clear" type="button"
                        title="Clear search">
                        X
                    </button>
                </div>
            </div>
        </div>
    `;
}

export {
    renderComment,
    renderLoadComments,
    renderSearch,
    renderCommentTrVideo,
    renderCommentChat,
    iconOk,
    iconReload,
    iconExpand,
    iconCollapse,
    iconSortDown,
    iconSortUp
};
