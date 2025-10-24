import type { ChatItem, TranscriptCueGroup, CommentItem } from '../../utils/interfaces/i_types';
import {
    getSheetDetails,
    getSheetComments,
    getSheetReplies,
    getSheetChatDetails,
    getSheetChatComments,
    getSheetTrVideoDetails,
    getSheetTrVideo
} from '../../utils/sheets';

// Lazy-load xlsx only when user chooses .xlsx export
let xlsxModulePromise: Promise<any> | null = null;
function loadXLSX(): Promise<any> {
    if (!xlsxModulePromise) xlsxModulePromise = import('xlsx');
    return xlsxModulePromise;
}

// Wrapper functions to convert data into downloadable payloads
export function exportCommentsAsJSON(input: {
    titleVideo?: string;
    url?: string;
    videoId?: string;
    comments?: CommentItem[];
    cachedDate?: number;
}): { content: string; fileName: string; mime: string } | void {
    try {
        const title = input?.titleVideo || '';
        const url = input?.url || '';
        const videoId = input?.videoId || getVideoIdFromUrl(url) || '';
        const comments = (input?.comments || []) as CommentItem[];

        // Build export JSON identical to export page getCommentsJSON
        const cmnts: any = {
            urlVideo: url,
            titleVideo: title,
            videoId: videoId,
            cachedDate: input?.cachedDate || Date.now(),
            totalComments: 0,
            totalReplies: 0,
            total: comments.length,
            comments: []
        };

        const commentMap = new Map<string, any>();
        const repliesSet: any[] = [];

        for (const item of comments) {
            const type = (item as any)?.typeComment;
            const cr = (item as any)?.commentRenderer || {};
            if (type === 'C') {
                const commentId = cr?.commentId;
                const authorChannelUrl =
                    cr?.authorEndpoint?.browseEndpoint?.canonicalBaseUrl ||
                    cr?.authorEndpoint?.commandMetadata?.webCommandMetadata?.url;

                const publishedUrl = safe(
                    () => cr.publishedTimeText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url
                );

                commentMap.set(commentId, {
                    commentUrl: 'youtube.com' + (publishedUrl || `/watch?v=${videoId}&lc=${commentId}`),
                    author: {
                        nameAuthor: cr?.authorText?.simpleText,
                        authorIsChannelOwner: cr?.authorIsChannelOwner,
                        channel: 'youtube.com' + (authorChannelUrl || '')
                    },
                    publishedTimeText: safe(() => cr.publishedTimeText.runs[0].text),
                    commentMessage: cr?.contentText?.fullText || cr?.renderFullText,
                    totalLikes: cr?.voteCount?.simpleText || '0',
                    member: safe(() => cr.sponsorCommentBadge.sponsorCommentBadgeRenderer.tooltip),
                    commentReplies: { replies: [] }
                });
            } else if (type === 'R') {
                repliesSet.push(item);
            }
        }

        for (const reply of repliesSet) {
            const r = (reply as any).commentRenderer || {};
            const origId = (reply as any)?.originComment?.commentRenderer?.commentId;
            const orig = commentMap.get(origId);
            if (orig) {
                const publishedUrl = safe(
                    () => r.publishedTimeText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url
                );
                orig.commentReplies.replies.push({
                    commentUrl: 'youtube.com' + (publishedUrl || `/watch?v=${videoId}&lc=${r?.commentId}`),
                    author: {
                        nameAuthor: r?.authorText?.simpleText,
                        authorIsChannelOwner: r?.authorIsChannelOwner,
                        channel:
                            'youtube.com' +
                            ((r as any)?.authorEndpoint?.browseEndpoint?.canonicalBaseUrl ||
                                (r as any)?.authorEndpoint?.commandMetadata?.webCommandMetadata?.url)
                    },
                    publishedTimeText: safe(() => r.publishedTimeText.runs[0].text),
                    commentMessage: r?.contentText?.fullText || r?.renderFullText,
                    totalLikes: r?.voteCount?.simpleText || '0',
                    member: safe(() => r.sponsorCommentBadge.sponsorCommentBadgeRenderer.tooltip)
                });
            }
        }

        cmnts.totalReplies = repliesSet.length;
        for (const [, v] of commentMap) {
            cmnts.comments.push(v);
        }
        cmnts.totalComments = cmnts.comments.length;

        const json = JSON.stringify(cmnts);
        return {
            content: json,
            fileName: `Comments, ${title} (${comments.length}).json`,
            mime: 'text/plain'
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

export function exportCommentsAsXLSX(input: {
    titleVideo?: string;
    url?: string;
    videoId?: string;
    comments?: CommentItem[];
    cachedDate?: number;
}): { writeFunc: () => void } | void {
    try {
        const title = input?.titleVideo || '';
        const url = input?.url || '';
        const videoId = input?.videoId || getVideoIdFromUrl(url) || '';
        const comments = (input?.comments || []) as CommentItem[];

        // Build same JSON and then same sheets as export page
        const jsonPayload = exportCommentsAsJSON({ ...input, titleVideo: title, url, videoId, comments });
        if (!jsonPayload) return;
        const cmnt = JSON.parse(jsonPayload.content);

        return {
            writeFunc: () => {
                loadXLSX()
                    .then((XLSX) => {
                        const wb = XLSX.utils.book_new();
                        const created = `Report was created by ${new Date().toUTCString()}`;
                        let ws;

                        try {
                            ws = XLSX.utils.json_to_sheet([getSheetDetails(cmnt) as any]);
                            XLSX.utils.sheet_add_aoa(ws, [[created]], { origin: 'A5' });
                            XLSX.utils.book_append_sheet(wb, ws, 'Details');
                        } catch (err) {
                            console.error(err);
                        }

                        try {
                            ws = XLSX.utils.json_to_sheet(getSheetComments(cmnt.comments) as any);
                            XLSX.utils.book_append_sheet(wb, ws, 'Comments');
                        } catch (err) {
                            console.error(err);
                        }

                        try {
                            ws = XLSX.utils.json_to_sheet(getSheetReplies(cmnt.comments) as any);
                            XLSX.utils.book_append_sheet(wb, ws, 'Replies');
                        } catch (err) {
                            console.error(err);
                        }

                        XLSX.writeFile(wb, `Comments, ${title} (${comments.length}).xlsx`);
                    })
                    .catch((e) => console.error(e));
            }
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

// Placeholder helpers reused from export_comments.ts - small copies to build sheets
// helpers (kept for future reuse)
/* istanbul ignore next */
function _getSheetDetails(cmnt: any): Record<string, unknown> {
    return {
        title: cmnt.title || '',
        totalComments: cmnt.totalComments || 0,
        totalReplies: cmnt.totalReplies || 0
    };
}

/* istanbul ignore next */
function _getSheetComments(comments: any[]): any[] {
    return (comments || []).map((c) => ({
        author: c.author || '',
        message: c.commentMessage || '',
        likes: c.totalLikes || 0,
        member: c.member || ''
    }));
}

/* istanbul ignore next */
function _getSheetReplies(comments: any[]): any[] {
    const replies: any[] = [];
    for (const c of comments || []) {
        if (Array.isArray(c.replies) && c.replies.length > 0) {
            for (const r of c.replies) {
                replies.push({ parentId: c.commentId || '', author: r.author || '', message: r.commentMessage || '' });
            }
        }
    }
    return replies;
}

// Chat and Transcript exporters: simple JSON wrappers (XLSX can be added similarly)
export function exportChatAsJSON(
    chatMessages: ChatItem[] | any,
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number }
): { content: string; fileName: string; mime: string } | void {
    try {
        const title = meta?.titleVideo || '';
        const url = meta?.url || '';
        const videoId = meta?.videoId || getVideoIdFromUrl(url) || '';
        const arr = chatMessages || [];

        interface ChatNorm {
            author: { nameAuthor: string; channel: string; member: string };
            commentMessage: string;
            timestampUsec: number;
            timestampText: string;
        }

        const cmntsChat: any = {
            urlVideo: url,
            titleVideo: title,
            videoId,
            cachedDate: meta?.cachedDate || Date.now(),
            total: 0,
            commentsChat: [] as ChatNorm[]
        };

        for (const it of arr) {
            const renderer = safe(() => it.replayChatItemAction.actions[0].addChatItemAction.item)
                ?.liveChatTextMessageRenderer as any;
            if (!renderer) continue;
            const name = renderer?.authorName?.simpleText || '';
            const channel = '';
            const member = (renderer?.authorBadges || [])?.some(
                (b: any) => b?.liveChatAuthorBadgeRenderer?.customThumbnail
            )
                ? 'member'
                : '';
            const message =
                renderer?.message?.simpleText || renderer?.message?.fullText || renderer?.message?.renderFullText || '';
            const timestampUsec = Number(renderer?.timestampUsec || 0);
            const timestampText = renderer?.timestampText?.simpleText || '';

            cmntsChat.commentsChat.push({
                author: { nameAuthor: name, channel, member },
                commentMessage: message,
                timestampUsec,
                timestampText
            });
        }

        cmntsChat.total = cmntsChat.commentsChat.length;
        const json = JSON.stringify(cmntsChat);
        return { content: json, fileName: `Comments chat, ${title} (${cmntsChat.total}).json`, mime: 'text/plain' };
    } catch (e) {
        console.error(e);
        return;
    }
}

export function exportChatAsXLSX(
    chatMessages: ChatItem[] | any,
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number }
): { writeFunc: () => void } | void {
    try {
        const payload = exportChatAsJSON(chatMessages, meta);
        if (!payload) return;
        const cmnt = JSON.parse(payload.content);

        return {
            writeFunc: () => {
                loadXLSX()
                    .then((XLSX) => {
                        const wb = XLSX.utils.book_new();
                        const created = `Report was created by ${new Date().toUTCString()}`;
                        let ws;

                        try {
                            ws = XLSX.utils.json_to_sheet([getSheetChatDetails(cmnt) as any]);
                            XLSX.utils.sheet_add_aoa(ws, [[created]], { origin: 'A5' });
                            XLSX.utils.book_append_sheet(wb, ws, 'Details');
                        } catch (err) {
                            console.error(err);
                        }

                        try {
                            ws = XLSX.utils.json_to_sheet(getSheetChatComments(cmnt) as any);
                            XLSX.utils.book_append_sheet(wb, ws, 'Chat comments');
                        } catch (err) {
                            console.error(err);
                        }

                        XLSX.writeFile(wb, `Comments chat, ${meta?.titleVideo || ''} (${cmnt.total}).xlsx`);
                    })
                    .catch((e) => console.error(e));
            }
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

export function exportTranscriptAsJSON(
    cueGroups: TranscriptCueGroup[] | any,
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number; titleTrVideo?: string }
): { content: string; fileName: string; mime: string } | void {
    try {
        const title = meta?.titleVideo || '';
        const url = meta?.url || '';
        const videoId = meta?.videoId || getVideoIdFromUrl(url) || '';
        const groups = cueGroups || [];

        const trVideo: any = {
            urlVideo: url,
            titleVideo: title,
            videoId,
            cachedDate: meta?.cachedDate || Date.now(),
            titleTrVideo: meta?.titleTrVideo || '',
            total: 0,
            trVideo: [] as any[]
        };

        for (const g of groups) {
            const r = (g as any)?.transcriptCueGroupRenderer?.cues?.[0]?.transcriptCueRenderer || {};
            const message = r?.cue?.simpleText || r?.cue?.runs?.[0]?.text || '';
            const startOffsetMs = Number(r?.startOffsetMs || 0);
            const durationMs = Number(r?.durationMs || 0);
            const startSeconds = safe(() => r.navigationEndpoint.watchEndpoint.startTimeSeconds) || 0;
            const formattedStartOffset = safe(() => r.formattedStartOffset.simpleText) || '';
            const urlShare = `https://youtu.be/${videoId}?t=${startSeconds || 0}`;
            trVideo.trVideo.push({
                urlShare,
                formattedStartOffset,
                startOffsetMs,
                durationMs,
                message
            });
        }

        trVideo.total = trVideo.trVideo.length;
        const json = JSON.stringify(trVideo);
        return { content: json, fileName: `Transcript video, ${title} (${trVideo.total}).json`, mime: 'text/plain' };
    } catch (e) {
        console.error(e);
        return;
    }
}

export function exportTranscriptAsXLSX(
    cueGroups: TranscriptCueGroup[] | any,
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number; titleTrVideo?: string }
): { writeFunc: () => void } | void {
    try {
        const payload = exportTranscriptAsJSON(cueGroups, meta);
        if (!payload) return;
        const trVideo = JSON.parse(payload.content);

        return {
            writeFunc: () => {
                loadXLSX()
                    .then((XLSX) => {
                        const wb = XLSX.utils.book_new();
                        const created = `Report was created by ${new Date().toUTCString()}`;
                        let ws;

                        try {
                            ws = XLSX.utils.json_to_sheet([getSheetTrVideoDetails(trVideo) as any]);
                            XLSX.utils.sheet_add_aoa(ws, [[created]], { origin: 'A5' });
                            XLSX.utils.book_append_sheet(wb, ws, 'Details');
                        } catch (err) {
                            console.error(err);
                        }

                        try {
                            ws = XLSX.utils.json_to_sheet(getSheetTrVideo(trVideo) as any);
                            XLSX.utils.book_append_sheet(wb, ws, 'Transcript video');
                        } catch (err) {
                            console.error(err);
                        }

                        XLSX.writeFile(wb, `Transcript video, ${meta?.titleVideo || ''} (${trVideo.total}).xlsx`);
                    })
                    .catch((e) => console.error(e));
            }
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

export default {};

function getVideoIdFromUrl(url: string | undefined): string | undefined {
    try {
        if (!url) return undefined;
        const u = new URL(url);
        const vid = u.searchParams.get('v');
        if (vid) return vid;
        // youtu.be short link
        if (u.hostname.includes('youtu.be')) {
            return u.pathname.replace('/', '') || undefined;
        }
        return undefined;
    } catch (e) {
        return undefined;
    }
}

function safe<T>(fn: () => T): T | undefined {
    try {
        return fn();
    } catch (e) {
        return undefined;
    }
}
