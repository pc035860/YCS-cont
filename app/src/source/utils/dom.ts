import Mark, { MarkOptions } from 'mark.js';

import { GlobalStore, getCleanUrlVideo, getRandomInt, oIsEmpty, wrapTryCatch } from './common';

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
            commentsNewWindow.document.title = `Comments, ${document.title} (${comments.count})`;
            const elWrapPre = document.createElement('pre');
            elWrapPre.style.cssText = 'word-wrap: break-word; white-space: pre-wrap;';
            elWrapPre.insertAdjacentText(
                'afterbegin',
                `
YCS - YouTube Comment Search

Comments
File created by ${new Date().toString()}
Video URL: ${getCleanUrlVideo(window.location.href)}
Title: ${document.title}
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
            commentsNewWindow.document.title = `Chat, ${document.title} (${comments.count})`;
            const elWrapPre = document.createElement('pre');
            elWrapPre.style.cssText = 'word-wrap: break-word; white-space: pre-wrap;';
            elWrapPre.insertAdjacentText(
                'afterbegin',
                `
YCS - YouTube Comment Search

Chat replay
File created by ${new Date().toString()}
Video URL: ${getCleanUrlVideo(window.location.href)}
Title: ${document.title}
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
            commentsNewWindow.document.title = `Transcript video, ${document.title} (${comments.count})`;
            const elWrapPre = document.createElement('pre');
            elWrapPre.style.cssText = 'word-wrap: break-word; white-space: pre-wrap;';
            elWrapPre.insertAdjacentText(
                'afterbegin',
                `
YCS - YouTube Comment Search

Transcript video
File created by ${new Date().toString()}
Video URL: ${getCleanUrlVideo(window.location.href)}
Title: ${document.title}
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

        const highlightExact: boolean = !!GlobalStore?.highlightExact;

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
                type: 'YCS_CACHE',
                value: JSON.stringify(value),
                url: getCleanUrlVideo(url),
                title
            },
            '*'
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
                type: 'YCS_GET_CACHE',
                value: getCleanUrlVideo(url)
            },
            '*'
        );
    } catch (err) {
        console.error(err);
    }
}

function sendMsgToBadge(typeMsg: string, msg: string | number): void {
    try {
        chrome.runtime.sendMessage({
            action: 'ACTION_BADGE',
            payload: {
                typeMsg,
                msg
            }
        });
    } catch (err) {
        console.error(err);
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
                if (authors.has(wrapTryCatch(() => cmnt.commentRenderer.authorEndpoint.browseEndpoint.canonicalBaseUrl))) {
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

        return [];
    } catch (err) {
        console.error(err);
        return [];
    }
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
    getRandomComment
};
