import Mark from 'mark.js';
import type { MarkOptions } from 'mark.js';

import { GlobalStore, getCleanUrlVideo, getRandomInt, getVideoId, oIsEmpty, wrapTryCatch } from './common';
import { resolveMeta } from './formatting';

function removeClass(elms: object, s: string): void {
    try {
        if (oIsEmpty(elms) || typeof s !== 'string') return;

        const els: Array<HTMLElement> = (Object as any).values(elms);

        for (const e of els) {
            e.classList.remove(s);
        }
    } catch (err) {
        console.error(err);
    }
}

function showLoadComments(number: number, showNode: HTMLElement): void {
    if (!showNode) return;

    showNode.textContent = number.toString();
}

function removeNodeList(selector: string): void {
    if (typeof selector !== 'string') return;

    const nodeList = document.querySelectorAll(selector);
    for (const node of nodeList) {
        node.remove();
    }
}

function openComments(comments: any): WindowProxy | undefined {
    if (!comments.count && !comments.html) return;

    try {
        const commentsNewWindow = window.open(
            '',
            'CommentsNewWindow',
            'width=640,height=700,menubar=0,toolbar=0,location=0,status=0,resizable=1,scrollbars=1,directories=0,channelmode=0,titlebar=0,top=75,left=75'
        );

        if (commentsNewWindow) {
            const meta = resolveMeta(comments?.meta);

            commentsNewWindow.document.title = `Comments, ${meta.title} (${comments.count})`;
            const elWrapPre = document.createElement('pre');
            elWrapPre.style.cssText = 'word-wrap: break-word; white-space: pre-wrap;';
            elWrapPre.insertAdjacentText(
                'afterbegin',
                `
YCS - YouTube Comment Search

Comments
File created by ${meta.generatedAt}
Video URL: ${meta.url}
Title: ${meta.title}
Total comments: ${comments.count}\n${comments.html}`
            );
            commentsNewWindow.document.body.textContent = '';
            commentsNewWindow.document.body.appendChild(elWrapPre);
            return commentsNewWindow;
        }

        return;
    } catch (e) {
        console.error(e);
        return;
    }
}

function openCommentsChat(comments: any): WindowProxy | undefined {
    if (!comments.count && !comments.html) return;

    try {
        const commentsNewWindow = window.open(
            '',
            'CommentsChatNewWindow',
            'width=640,height=700,menubar=0,toolbar=0,location=0,status=0,resizable=1,scrollbars=1,directories=0,channelmode=0,titlebar=0,top=75,left=75'
        );

        if (commentsNewWindow) {
            const meta = resolveMeta(comments?.meta);

            commentsNewWindow.document.title = `Chat, ${meta.title} (${comments.count})`;
            const elWrapPre = document.createElement('pre');
            elWrapPre.style.cssText = 'word-wrap: break-word; white-space: pre-wrap;';
            elWrapPre.insertAdjacentText(
                'afterbegin',
                `
YCS - YouTube Comment Search

Chat replay
File created by ${meta.generatedAt}
Video URL: ${meta.url}
Title: ${meta.title}
Total: ${comments.count}\n${comments.html}`
            );
            commentsNewWindow.document.body.textContent = '';
            commentsNewWindow.document.body.appendChild(elWrapPre);
            return commentsNewWindow;
        }

        return;
    } catch (e) {
        console.error(e);
        return;
    }
}

function openCommentsTrVideo(comments: any): WindowProxy | undefined {
    if (!comments.count && !comments.html) return;

    try {
        const commentsNewWindow = window.open(
            '',
            'CommentsTrVideoNewWindow',
            'width=640,height=700,menubar=0,toolbar=0,location=0,status=0,resizable=1,scrollbars=1,directories=0,channelmode=0,titlebar=0,top=75,left=75'
        );

        if (commentsNewWindow) {
            const meta = resolveMeta(comments?.meta);

            commentsNewWindow.document.title = `Transcript video, ${meta.title} (${comments.count})`;
            const elWrapPre = document.createElement('pre');
            elWrapPre.style.cssText = 'word-wrap: break-word; white-space: pre-wrap;';
            elWrapPre.insertAdjacentText(
                'afterbegin',
                `
YCS - YouTube Comment Search

Transcript video
File created by ${meta.generatedAt}
Video URL: ${meta.url}
Title: ${meta.title}
Total: ${comments.count}\n${comments.html}`
            );
            commentsNewWindow.document.body.textContent = '';
            commentsNewWindow.document.body.appendChild(elWrapPre);
            return commentsNewWindow;
        }

        return;
    } catch (e) {
        console.error(e);
        return;
    }
}

function downloadFile(content: string, fileName: string, type: string): void {
    try {
        const file = new Blob([content], { type });

        const link = document.createElement('a');

        link.href = URL.createObjectURL(file);
        link.download = fileName;

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (err) {
        console.error(err);
    }
}

function markTextComment(sel: string | HTMLElement, text: string): void {
    try {
        if (!text || !sel || !GlobalStore?.highlightText) return;

        const elExtSearch = document.getElementById('ycs_extended_search') as HTMLInputElement;
        if (elExtSearch?.checked) return;

        const sliceStringForMark = (str: string): string | void => {
            try {
                if (typeof str != 'string') return;

                let query = '';

                if (str.length <= 2) {
                    query = str;
                } else if (str.length >= 3 && str.length <= 5) {
                    query = str.slice(0, -1);
                } else if (str.length >= 6 && str.length <= 8) {
                    query = str.slice(0, -3);
                } else if (str.length >= 9) {
                    query = str.slice(0, -4);
                }

                return query;
            } catch (err) {
                console.error(err);
                return str;
            }
        };

        const highlightExact = !!GlobalStore?.highlightExact;

        if (!highlightExact) {
            if (text.split(' ').length === 1) {
                text = sliceStringForMark(text) || text;
            } else if (text.split(' ').length > 1) {
                let query = '';
                for (const str of text.split(' ')) {
                    query += (sliceStringForMark(str) || str) + ' ';
                }
                text = query?.trim();
            }
        }

        const opts: MarkOptions = {
            element: 'span',
            className: 'ycs-mark-words',
            separateWordSearch: !highlightExact
        };

        if (typeof sel !== 'string') {
            const markTextTitle = new Mark((sel as HTMLElement)?.querySelectorAll('.ycs-head__title'));
            const markTextMain = new Mark((sel as HTMLElement)?.querySelectorAll('.ycs-comment__main-text'));
            markTextTitle.mark(text, opts);
            markTextMain.mark(text, opts);
        } else {
            const markTextTitle = new Mark(`${sel} .ycs-head__title`);
            const markTextMain = new Mark(`${sel} .ycs-comment__main-text`);
            markTextTitle.mark(text, opts);
            markTextMain.mark(text, opts);
        }
    } catch (err) {
        console.error(err);
    }
}

function setCacheToIDB(value: any, url: string, title: string): void {
    try {
        console.log('setCacheToIDB()', value, url);

        window.postMessage(
            {
                type: 'YCS_CACHE_STORAGE_SET',
                body: {
                    url,
                    videoId: getVideoId(getCleanUrlVideo(url) as string),
                    date: new Date().getTime(),
                    titleVideo: title,
                    comments: value.comments,
                    commentsChat: value.commentsChat,
                    commentsTrVideo: value.commentsTrVideo,
                    channelId: value.channelId,
                    chatSource: value.chatSource
                }
            },
            window.location.origin
        );
    } catch (err) {
        console.error(err);
    }
}

function sendGetCacheInIDB(url: string): void {
    try {
        console.log('sendGetCacheInIDB:', url);

        window.postMessage(
            {
                type: 'YCS_CACHE_STORAGE_GET',
                body: {
                    videoId: getVideoId(getCleanUrlVideo(url) as string)
                }
            },
            window.location.origin
        );
    } catch (err) {
        console.error(err);
    }
}

function sendMsgToBadge(typeMsg: string, msg: string | number): void {
    try {
        if ((typeof msg === 'string' || typeof msg === 'number') && typeof typeMsg === 'string') {
            window.postMessage({ type: typeMsg.toString(), text: msg.toString() }, window.location.origin);
        }
    } catch (e) {
        console.error(e);
    }
}

function getPiP(): {
    supported: boolean;
    request: (v: HTMLVideoElement) => Promise<PictureInPictureWindow>;
    exit: (v?: any) => Promise<void>;
    isActive: (v: HTMLVideoElement) => boolean;
} {
    try {
        if (typeof document === 'undefined') return { supported: false } as any;

        const video = document.createElement('video') as any;

        if (document.pictureInPictureEnabled && !video.disablePictureInPicture) {
            return {
                supported: true,
                request: (v: HTMLVideoElement): Promise<PictureInPictureWindow> => {
                    return v.requestPictureInPicture();
                },
                exit: (): Promise<void> => {
                    return document.exitPictureInPicture();
                },
                isActive: (v: HTMLVideoElement): boolean => {
                    return v === document.pictureInPictureElement;
                }
            };
        }

        if (typeof video.webkitSetPresentationMode === 'function') {
            if (/ipad|iphone/i.test(window.navigator.userAgent)) {
                return { supported: false } as any;
            }
            return {
                supported: true,
                request: (v: any): any => {
                    return v.webkitSetPresentationMode('picture-in-picture');
                },
                exit: (v: any): any => {
                    return v.webkitSetPresentationMode('inline');
                },
                isActive: (v: any): boolean => {
                    return v.webkitPresentationMode === 'picture-in-picture';
                }
            };
        }

        return { supported: false } as any;
    } catch (err) {
        console.error(err);
        return { supported: false } as any;
    }
}

function initShowBarFAQ(): void {
    try {
        // Keep existing .ycs__faq-title and .ycs__faq-answers handling logic
        const elWrap = document.querySelector('.ycs__faq-title');
        const elTBody = document.querySelector('.ycs__faq-answers');

        if (elWrap && elTBody) {
            elWrap.addEventListener('click', function () {
                const elChild = elWrap.childNodes as NodeList;
                const elChildLen = elChild.length;

                elWrap.classList.toggle('toggle');

                for (let i = 0; i < elChildLen; i++) {
                    const child = elChild[i];

                    if (child.nodeType === 3) {
                        child.parentElement?.classList.toggle('toggle');
                    }
                }

                elTBody.classList.toggle('toggle');
            });
        }

        // Add modal open/close functionality
        const hCloseModalOut = (e: Event): void => {
            try {
                const elModalWindow = document.getElementById('ycs_modal_window') as HTMLElement;

                if (e.target === elModalWindow) {
                    elModalWindow.style.display = 'none';

                    const elYCSApp = document.getElementsByClassName('ycs-app')[0] as HTMLElement;
                    elYCSApp?.removeEventListener('click', hCloseModalOut);
                }
            } catch (err) {
                console.error(err);
            }
        };

        const hOpenModal = (): void => {
            try {
                const elModalWindow = document.getElementById('ycs_modal_window') as HTMLElement;
                elModalWindow.style.display = 'block';

                const elYCSApp = document.getElementsByClassName('ycs-app')[0] as HTMLElement;
                elYCSApp?.addEventListener('click', hCloseModalOut);
            } catch (err) {
                console.error(err);
            }
        };

        const hCloseModal = (): void => {
            try {
                const elModalWindow = document.getElementById('ycs_modal_window') as HTMLElement;
                elModalWindow.style.display = 'none';

                const elYCSApp = document.getElementsByClassName('ycs-app')[0] as HTMLElement;
                elYCSApp?.removeEventListener('click', hCloseModalOut);
            } catch (err) {
                console.error(err);
            }
        };

        const btnCloseModal = document.getElementById('ycs_btn_close_modal');
        const btnOpenModal = document.getElementById('ycs_btn_open_modal');

        btnCloseModal?.addEventListener('click', hCloseModal);
        btnOpenModal?.addEventListener('click', hOpenModal);
    } catch (err) {
        console.error(err);
    }
}

function initShowViewMode(): void {
    try {
        const hViewMode = async (): Promise<void> => {
            try {
                const anchorJump = (id: string): void => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    const anchorTop = (el as HTMLInputElement).offsetTop as number;
                    window.scrollTo(0, anchorTop);
                };

                const elVideo = document.getElementsByTagName('video')[0] as HTMLVideoElement;

                const videoPip = getPiP();

                if (elVideo && videoPip.supported) {
                    if (videoPip.isActive(elVideo)) {
                        await videoPip.exit();
                        window.scrollTo(0, 0);
                        document.getElementById('ycs-input-search')?.blur();
                        document.getElementById('search')?.focus();
                    } else {
                        await videoPip.request(elVideo);
                        document.getElementById('ycs-input-search')?.focus();
                        anchorJump('ycs_anchor_vmode');
                    }
                }
            } catch (err) {
                console.error(err);
            }
        };

        const _initHotKey = (): void => {
            try {
                const elHotkey = document.getElementById('ycs_hotkey') as HTMLInputElement;
                if (!elHotkey) return;

                const hHotKey = async (e: KeyboardEvent): Promise<void> => {
                    try {
                        if (!GlobalStore()?.keyHotkey) return;

                        const isCtrlMeta = e.ctrlKey || e.metaKey;
                        if (e.shiftKey && (e.code === 'KeyP' || e.code === 'KeyL')) {
                            e.preventDefault();
                            await hViewMode();
                        }

                        if (isCtrlMeta && e.code === 'KeyF') {
                            e.preventDefault();
                            const elInputSearch = document.getElementById('ycs-input-search') as HTMLInputElement;
                            elInputSearch?.focus();
                            elInputSearch?.select();
                        }
                    } catch (err) {
                        console.error(err);
                    }
                };

                const hSwitchHotKey = (): void => {
                    try {
                        GlobalStore().keyHotkey = elHotkey.checked;

                        if (elHotkey.checked) {
                            window.addEventListener('keydown', hHotKey);
                        } else {
                            window.removeEventListener('keydown', hHotKey);
                        }
                    } catch (err) {
                        console.error(err);
                    }
                };

                elHotkey.addEventListener('change', hSwitchHotKey);
                GlobalStore().keyHotkey = elHotkey.checked;

                if (elHotkey.checked) {
                    window.addEventListener('keydown', hHotKey);
                }
            } catch (err) {
                console.error(err);
            }
        };

        const elBtnViewMode = document.getElementById('ycs_view_mode');
        elBtnViewMode?.addEventListener('click', hViewMode);

        _initHotKey();
    } catch (err) {
        console.error(err);
    }
}

function getRandomComment(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const authors = new Map();

        for (const [i, cmnt] of comments.entries()) {
            if (cmnt?.typeComment === 'C') {
                if (
                    authors.has(wrapTryCatch(() => cmnt.commentRenderer.authorEndpoint.browseEndpoint.canonicalBaseUrl))
                ) {
                    const cmntsPos = authors.get(cmnt.commentRenderer.authorEndpoint.browseEndpoint.canonicalBaseUrl);
                    cmntsPos.add(i);
                } else if (wrapTryCatch(() => cmnt.commentRenderer.authorEndpoint.browseEndpoint.canonicalBaseUrl)) {
                    authors.set(cmnt.commentRenderer.authorEndpoint.browseEndpoint.canonicalBaseUrl, new Set().add(i));
                }
            }
        }

        if (authors.size > 0) {
            const authorPos = getRandomInt(0, authors.size - 1);

            let i = 0;
            for (const [, posIndex] of authors.entries()) {
                if (i === authorPos) {
                    const authorCommentPos = getRandomInt(0, posIndex.size - 1);

                    let index = 0;
                    for (const [, authorCommentPosIndex] of posIndex.entries()) {
                        if (index === authorCommentPos) {
                            return [
                                {
                                    item: comments[authorCommentPosIndex],
                                    refIndex: (comments[authorCommentPosIndex] as any)?._index
                                }
                            ] as any;
                        }

                        index++;
                    }
                    break;
                }

                i++;
            }
        }

        // Fallback: if author groups cannot be sampled, pick a random comment from the entire list.
        if (comments.length > 0) {
            const fallbackIndex = getRandomInt(0, comments.length - 1);
            const fallback = comments[fallbackIndex];
            if (fallback) {
                return [
                    {
                        item: fallback,
                        refIndex: (fallback as any)?._index ?? fallbackIndex
                    }
                ] as any;
            }
        }

        return [];
    } catch (err) {
        console.error(err);
        return [];
    }
}

/**
 * Navigate video to timestamp with backward compatibility
 * @param target - Click target element containing timestamp data
 * @param video - Video element to navigate
 * @returns true if navigation succeeded, false otherwise
 */
function navigateVideoToTimestamp(target: HTMLElement, video: HTMLVideoElement): boolean {
    const timeValue = target.dataset.offsetvideo;
    if (!timeValue) return false;

    const parsed = Number.parseInt(timeValue, 10);
    if (!Number.isFinite(parsed)) return false;

    // Backward compatibility logic:
    // - ycs_goto_chat: Chat "Go to" button (milliseconds)
    // - Others: Old cached timestamp links or new timestamp links (seconds)
    if (target.classList.contains('ycs_goto_chat')) {
        video.currentTime = parsed / 1000;
    } else {
        video.currentTime = parsed;
    }

    return true;
}

export {
    removeClass,
    showLoadComments,
    removeNodeList,
    openComments,
    openCommentsChat,
    openCommentsTrVideo,
    downloadFile,
    markTextComment,
    setCacheToIDB,
    sendGetCacheInIDB,
    sendMsgToBadge,
    getPiP,
    initShowBarFAQ,
    initShowViewMode,
    getRandomComment,
    navigateVideoToTimestamp
};
