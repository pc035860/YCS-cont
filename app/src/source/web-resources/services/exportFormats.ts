import type { ChatItem, TranscriptCueGroup, CommentItem } from '../../utils/interfaces/i_types';
import type { ISheetCommentsParam, ISheetRepliesParam } from '../../utils/interfaces/i_assist';
import { getVideoId, wrapTryCatch } from '../../utils/common';
import { parseFormattedNumberToInt } from '../../utils/formatting';
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

type CommentExportItem = ISheetCommentsParam;
type CommentExportReply = ISheetRepliesParam;

interface CommentsExportPayload {
    urlVideo: string;
    titleVideo: string;
    videoId: string;
    cachedDate: number;
    totalComments: number;
    totalReplies: number;
    total: number;
    comments: CommentExportItem[];
}

interface ChatExportItem {
    author: {
        nameAuthor: string;
        channel: string;
        member: string;
    };
    commentMessage: string;
    timestampUsec: number;
    timestampText: string;
}

interface ChatExportPayload {
    urlVideo: string;
    titleVideo: string;
    videoId: string;
    cachedDate: number;
    total: number;
    commentsChat: ChatExportItem[];
}

interface TranscriptExportItem {
    urlShare: string;
    formattedStartOffset: string;
    startOffsetMs: number;
    durationMs: number;
    message: string;
}

interface TranscriptExportPayload {
    urlVideo: string;
    titleVideo: string;
    videoId: string;
    cachedDate: number;
    titleTrVideo: string;
    total: number;
    trVideo: TranscriptExportItem[];
}

type SheetBuilder<TPayload> = (XLSX: any, workbook: any, payload: TPayload, createdLabel: string) => void;

function createJsonResponse(fileName: string, payload: unknown): { content: string; fileName: string; mime: string } {
    return {
        content: JSON.stringify(payload),
        fileName,
        mime: 'application/json'
    };
}

function createXlsxWriter<TPayload>(
    payload: TPayload,
    fileName: string,
    builders: Array<SheetBuilder<TPayload>>
): { writeFunc: () => void } {
    return {
        writeFunc: () => {
            loadXLSX()
                .then((XLSX) => {
                    const workbook = XLSX.utils.book_new();
                    const created = `Report was created by ${new Date().toUTCString()}`;

                    for (const build of builders) {
                        try {
                            build(XLSX, workbook, payload, created);
                        } catch (err) {
                            console.error(err);
                        }
                    }

                    XLSX.writeFile(workbook, fileName);
                })
                .catch((e) => console.error(e));
        }
    };
}

function parseLikeCount(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value !== 'string') {
        return 0;
    }

    // Reuse shared formatter so suffix/multilingual units stay consistent across exports.
    return parseFormattedNumberToInt(value);
}

function buildCommentsExportPayload(input: {
    titleVideo?: string;
    url?: string;
    videoId?: string;
    comments?: CommentItem[];
    cachedDate?: number;
}): CommentsExportPayload {
    const title = input?.titleVideo || '';
    const url = input?.url || '';
    const videoId = input?.videoId || (url ? getVideoId(url) : undefined) || '';
    const comments = (input?.comments || []) as CommentItem[];

    const payload: CommentsExportPayload = {
        urlVideo: url,
        titleVideo: title,
        videoId,
        cachedDate: input?.cachedDate || Date.now(),
        totalComments: 0,
        totalReplies: 0,
        total: comments.length,
        comments: []
    };

    const commentMap = new Map<string, CommentExportItem>();
    const repliesSet: CommentItem[] = [];

    for (const item of comments) {
        const type = (item as any)?.typeComment;
        const cr = (item as any)?.commentRenderer || {};
        if (type === 'C') {
            const commentId = cr?.commentId;
            if (typeof commentId !== 'string' || commentId.length === 0) continue;
            const authorChannelUrl =
                cr?.authorEndpoint?.browseEndpoint?.canonicalBaseUrl ||
                cr?.authorEndpoint?.commandMetadata?.webCommandMetadata?.url;

            const publishedUrl = wrapTryCatch(
                () => cr.publishedTimeText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url
            );

            const comment: CommentExportItem = {
                commentUrl: 'youtube.com' + (publishedUrl || `/watch?v=${videoId}&lc=${commentId}`),
                author: {
                    nameAuthor: cr?.authorText?.simpleText || '',
                    authorIsChannelOwner: Boolean(cr?.authorIsChannelOwner),
                    channel: 'youtube.com' + (authorChannelUrl || '')
                },
                publishedTimeText: wrapTryCatch(() => cr.publishedTimeText.runs[0].text) || '',
                commentMessage: cr?.contentText?.fullText || cr?.renderFullText || '',
                totalLikes: parseLikeCount(cr?.voteCount?.simpleText),
                member: wrapTryCatch(() => cr.sponsorCommentBadge.sponsorCommentBadgeRenderer.tooltip) || '',
                commentReplies: { replies: [] }
            };

            commentMap.set(commentId, comment);
        } else if (type === 'R') {
            repliesSet.push(item);
        }
    }

    for (const reply of repliesSet) {
        const renderer = (reply as any).commentRenderer || {};
        const originId = (reply as any)?.originComment?.commentRenderer?.commentId;
        if (typeof originId !== 'string' || originId.length === 0) continue;
        const origin = commentMap.get(originId);
        if (!origin) continue;

        const publishedUrl = wrapTryCatch(
            () => renderer.publishedTimeText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url
        );

        const replyEntry: CommentExportReply = {
            commentUrl: 'youtube.com' + (publishedUrl || `/watch?v=${videoId}&lc=${renderer?.commentId}`),
            author: {
                nameAuthor: renderer?.authorText?.simpleText || '',
                authorIsChannelOwner: Boolean(renderer?.authorIsChannelOwner),
                channel:
                    'youtube.com' +
                    ((renderer as any)?.authorEndpoint?.browseEndpoint?.canonicalBaseUrl ||
                        (renderer as any)?.authorEndpoint?.commandMetadata?.webCommandMetadata?.url)
            },
            publishedTimeText: wrapTryCatch(() => renderer.publishedTimeText.runs[0].text) || '',
            commentMessage: renderer?.contentText?.fullText || renderer?.renderFullText || '',
            totalLikes: parseLikeCount(renderer?.voteCount?.simpleText),
            member: wrapTryCatch(() => renderer.sponsorCommentBadge.sponsorCommentBadgeRenderer.tooltip) || '',
            commentReplies: { replies: [] }
        };

        origin.commentReplies.replies.push(replyEntry);
    }

    for (const [, value] of commentMap) {
        payload.comments.push(value);
    }

    payload.totalReplies = repliesSet.length;
    payload.totalComments = payload.comments.length;

    return payload;
}

function buildChatExportPayload(
    chatMessages: ChatItem[],
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number }
): ChatExportPayload {
    const title = meta?.titleVideo || '';
    const url = meta?.url || '';
    const videoId = meta?.videoId || (url ? getVideoId(url) : undefined) || '';
    const items = chatMessages || [];

    const payload: ChatExportPayload = {
        urlVideo: url,
        titleVideo: title,
        videoId,
        cachedDate: meta?.cachedDate || Date.now(),
        total: 0,
        commentsChat: []
    };

    for (const item of items) {
        const renderer = wrapTryCatch(() => (item as any).replayChatItemAction.actions[0].addChatItemAction.item)
            ?.liveChatTextMessageRenderer as any;
        if (!renderer) continue;

        const member = (renderer?.authorBadges || [])?.some(
            (badge: any) => badge?.liveChatAuthorBadgeRenderer?.customThumbnail
        )
            ? 'member'
            : '';
        const message =
            renderer?.message?.simpleText || renderer?.message?.fullText || renderer?.message?.renderFullText || '';

        payload.commentsChat.push({
            author: {
                nameAuthor: renderer?.authorName?.simpleText || '',
                channel: '',
                member
            },
            commentMessage: message,
            timestampUsec: Number(renderer?.timestampUsec || 0),
            timestampText: renderer?.timestampText?.simpleText || ''
        });
    }

    payload.total = payload.commentsChat.length;
    return payload;
}

function buildTranscriptExportPayload(
    cueGroups: TranscriptCueGroup[] | any,
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number; titleTrVideo?: string }
): TranscriptExportPayload {
    const title = meta?.titleVideo || '';
    const url = meta?.url || '';
    const videoId = meta?.videoId || (url ? getVideoId(url) : undefined) || '';
    const groups = cueGroups || [];

    const payload: TranscriptExportPayload = {
        urlVideo: url,
        titleVideo: title,
        videoId,
        cachedDate: meta?.cachedDate || Date.now(),
        titleTrVideo: meta?.titleTrVideo || '',
        total: 0,
        trVideo: []
    };

    for (const group of groups) {
        const renderer = (group as any)?.transcriptCueGroupRenderer?.cues?.[0]?.transcriptCueRenderer || {};
        const message = renderer?.cue?.simpleText || renderer?.cue?.runs?.[0]?.text || '';
        const startOffsetMs = Number(renderer?.startOffsetMs || 0);
        const durationMs = Number(renderer?.durationMs || 0);
        const startSeconds = wrapTryCatch(() => renderer.navigationEndpoint.watchEndpoint.startTimeSeconds) || 0;
        const formattedStartOffset = wrapTryCatch(() => renderer.formattedStartOffset.simpleText) || '';
        const urlShare = `https://youtu.be/${videoId}?t=${startSeconds || 0}`;

        payload.trVideo.push({
            urlShare,
            formattedStartOffset,
            startOffsetMs,
            durationMs,
            message
        });
    }

    payload.total = payload.trVideo.length;
    return payload;
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
        const payload = buildCommentsExportPayload(input);
        return createJsonResponse(`Comments, ${payload.titleVideo} (${payload.total}).json`, payload);
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
        const payload = buildCommentsExportPayload(input);
        return createXlsxWriter(payload, `Comments, ${payload.titleVideo} (${payload.total}).xlsx`, [
            (XLSX, workbook, data, created) => {
                const details = getSheetDetails(data);
                if (!details) return;
                const sheet = XLSX.utils.json_to_sheet([details as any]);
                XLSX.utils.sheet_add_aoa(sheet, [[created]], { origin: 'A5' });
                XLSX.utils.book_append_sheet(workbook, sheet, 'Details');
            },
            (XLSX, workbook, data) => {
                const commentsSheet = XLSX.utils.json_to_sheet(getSheetComments(data.comments) as any);
                XLSX.utils.book_append_sheet(workbook, commentsSheet, 'Comments');
            },
            (XLSX, workbook, data) => {
                const repliesSheet = XLSX.utils.json_to_sheet(getSheetReplies(data.comments) as any);
                XLSX.utils.book_append_sheet(workbook, repliesSheet, 'Replies');
            }
        ]);
    } catch (e) {
        console.error(e);
        return;
    }
}

// Chat and Transcript exporters: simple JSON wrappers (XLSX can be added similarly)
export function exportChatAsJSON(
    chatMessages: ChatItem[],
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number }
): { content: string; fileName: string; mime: string } | void {
    try {
        const payload = buildChatExportPayload(chatMessages, meta);
        return createJsonResponse(`Comments chat, ${payload.titleVideo} (${payload.total}).json`, payload);
    } catch (e) {
        console.error(e);
        return;
    }
}

export function exportChatAsXLSX(
    chatMessages: ChatItem[],
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number }
): { writeFunc: () => void } | void {
    try {
        const payload = buildChatExportPayload(chatMessages, meta);
        return createXlsxWriter(payload, `Comments chat, ${payload.titleVideo} (${payload.total}).xlsx`, [
            (XLSX, workbook, data, created) => {
                const details = getSheetChatDetails(data);
                if (!details) return;
                const sheet = XLSX.utils.json_to_sheet([details as any]);
                XLSX.utils.sheet_add_aoa(sheet, [[created]], { origin: 'A5' });
                XLSX.utils.book_append_sheet(workbook, sheet, 'Details');
            },
            (XLSX, workbook, data) => {
                const commentsSheet = XLSX.utils.json_to_sheet(getSheetChatComments(data) as any);
                XLSX.utils.book_append_sheet(workbook, commentsSheet, 'Chat comments');
            }
        ]);
    } catch (e) {
        console.error(e);
        return;
    }
}

export function exportTranscriptAsJSON(
    cueGroups: TranscriptCueGroup[],
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number; titleTrVideo?: string }
): { content: string; fileName: string; mime: string } | void {
    try {
        const payload = buildTranscriptExportPayload(cueGroups, meta);
        return createJsonResponse(`Transcript video, ${payload.titleVideo} (${payload.total}).json`, payload);
    } catch (e) {
        console.error(e);
        return;
    }
}

export function exportTranscriptAsXLSX(
    cueGroups: TranscriptCueGroup[],
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number; titleTrVideo?: string }
): { writeFunc: () => void } | void {
    try {
        const payload = buildTranscriptExportPayload(cueGroups, meta);
        return createXlsxWriter(payload, `Transcript video, ${payload.titleVideo} (${payload.total}).xlsx`, [
            (XLSX, workbook, data, created) => {
                const details = getSheetTrVideoDetails(data);
                if (!details) return;
                const sheet = XLSX.utils.json_to_sheet([details as any]);
                XLSX.utils.sheet_add_aoa(sheet, [[created]], { origin: 'A5' });
                XLSX.utils.book_append_sheet(workbook, sheet, 'Details');
            },
            (XLSX, workbook, data) => {
                const transcriptSheet = XLSX.utils.json_to_sheet(getSheetTrVideo(data) as any);
                XLSX.utils.book_append_sheet(workbook, transcriptSheet, 'Transcript video');
            }
        ]);
    } catch (e) {
        console.error(e);
        return;
    }
}

export default {};
