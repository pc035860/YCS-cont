import type { ChatItem, TranscriptCueGroup, CommentItem } from './interfaces/i_types';
import type { ISheetChatCommentsParam, ISheetCommentsParam, ISheetRepliesParam } from './interfaces/i_assist';
import { msToRoundSec, parseFormattedNumberToInt, formatRelativeTimestamp, formatDurationHMS } from './formatting';
import { getVideoId, wrapTryCatch } from './common';

export type CommentExportItem = ISheetCommentsParam;
export type CommentExportReply = ISheetRepliesParam;

export interface CommentsExportPayload {
    urlVideo: string;
    titleVideo: string;
    videoId: string;
    cachedDate: number;
    totalComments: number;
    totalReplies: number;
    total: number;
    comments: CommentExportItem[];
}

export interface ChatExportItem {
    author: {
        nameAuthor: string;
        channel: string;
        member: string;
    };
    commentMessage: string;
    timestampUsec: number;
    timestampText: string;
    relativeTimestamp?: string; // Format: "+H:MM:SS" (relative to broadcast start)
}

export interface ChatExportPayload {
    urlVideo: string;
    titleVideo: string;
    videoId: string;
    cachedDate: number;
    total: number;
    commentsChat: ChatExportItem[];
}

export interface TranscriptExportItem {
    urlShare: string;
    formattedStartOffset: string;
    startOffsetMs: number;
    durationMs: number;
    message: string;
}

export interface TranscriptExportPayload {
    urlVideo: string;
    titleVideo: string;
    videoId: string;
    cachedDate: number;
    titleTrVideo: string;
    total: number;
    trVideo: TranscriptExportItem[];
}

function parseLikeCount(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value !== 'string') {
        return 0;
    }

    return parseFormattedNumberToInt(value);
}

function createCommentsPayloadSkeleton(input: {
    titleVideo?: string;
    url?: string;
    videoId?: string;
    cachedDate?: number;
    total?: number;
}): CommentsExportPayload {
    const title = input?.titleVideo || '';
    const url = input?.url || '';
    const videoId = input?.videoId || (url ? getVideoId(url) : undefined) || '';
    return {
        urlVideo: url,
        titleVideo: title,
        videoId,
        cachedDate: input?.cachedDate || Date.now(),
        totalComments: 0,
        totalReplies: 0,
        total: input?.total ?? 0,
        comments: []
    };
}

function createChatPayloadSkeleton(input: {
    titleVideo?: string;
    url?: string;
    videoId?: string;
    cachedDate?: number;
    total?: number;
}): ChatExportPayload {
    const title = input?.titleVideo || '';
    const url = input?.url || '';
    const videoId = input?.videoId || (url ? getVideoId(url) : undefined) || '';
    return {
        urlVideo: url,
        titleVideo: title,
        videoId,
        cachedDate: input?.cachedDate || Date.now(),
        total: input?.total ?? 0,
        commentsChat: []
    };
}

function createTranscriptPayloadSkeleton(input: {
    titleVideo?: string;
    url?: string;
    videoId?: string;
    cachedDate?: number;
    titleTrVideo?: string;
    total?: number;
}): TranscriptExportPayload {
    const title = input?.titleVideo || '';
    const url = input?.url || '';
    const videoId = input?.videoId || (url ? getVideoId(url) : undefined) || '';
    return {
        urlVideo: url,
        titleVideo: title,
        videoId,
        cachedDate: input?.cachedDate || Date.now(),
        titleTrVideo: input?.titleTrVideo || '',
        total: input?.total ?? 0,
        trVideo: []
    };
}

function formatYoutubePath(path?: string): string {
    return `youtube.com${path || ''}`;
}

function buildAuthorChannelUrl(renderer: any): string {
    const canonicalBaseUrl = renderer?.authorEndpoint?.browseEndpoint?.canonicalBaseUrl;
    const fallback = wrapTryCatch(() => renderer?.authorEndpoint?.commandMetadata?.webCommandMetadata?.url);
    return formatYoutubePath(canonicalBaseUrl || (fallback as string) || '');
}

function buildCommentUrl(renderer: any, videoId: string, commentId: string): string {
    const publishedUrl = wrapTryCatch(
        () => renderer.publishedTimeText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url
    );
    const fallback = commentId ? `/watch?v=${videoId}&lc=${commentId}` : `/watch?v=${videoId}`;
    return formatYoutubePath((publishedUrl as string) || fallback);
}

function buildCommentMessage(renderer: any): string {
    return renderer?.contentText?.fullText || renderer?.renderFullText || '';
}

function buildMemberTooltip(renderer: any): string {
    return (wrapTryCatch(() => renderer?.sponsorCommentBadge?.sponsorCommentBadgeRenderer?.tooltip) as string) || '';
}

function createCommentExportItem(renderer: any, videoId: string): CommentExportItem {
    const commentId = renderer?.commentId || '';
    return {
        commentUrl: buildCommentUrl(renderer, videoId, commentId),
        author: {
            nameAuthor: renderer?.authorText?.simpleText || '',
            authorIsChannelOwner: Boolean(renderer?.authorIsChannelOwner),
            channel: buildAuthorChannelUrl(renderer)
        },
        publishedTimeText: wrapTryCatch(() => renderer?.publishedTimeText?.runs?.[0]?.text) || '',
        commentMessage: buildCommentMessage(renderer),
        totalLikes: parseLikeCount(renderer?.voteCount?.simpleText ?? renderer?.likeCount),
        member: buildMemberTooltip(renderer),
        commentReplies: {
            replies: []
        }
    };
}

function findMemberBadge(badges: any): any {
    if (!Array.isArray(badges)) return;
    return badges.find((badge) => badge?.liveChatAuthorBadgeRenderer?.customThumbnail);
}

function buildChatMemberText(renderer: any): string {
    const memberBadge = findMemberBadge(renderer?.authorBadges);
    if (!memberBadge) return '';
    return (
        (wrapTryCatch(() => memberBadge.liveChatAuthorBadgeRenderer?.tooltip) as string) ||
        (wrapTryCatch(
            () => memberBadge.liveChatAuthorBadgeRenderer?.accessibility?.accessibilityData?.label
        ) as string) ||
        ''
    );
}

function buildChatMessage(renderer: any): string {
    return renderer?.message?.simpleText || renderer?.message?.fullText || renderer?.message?.renderFullText || '';
}

function buildChatAuthorChannel(renderer: any): string {
    const authorChannelId = wrapTryCatch(() => renderer?.authorExternalChannelId) as string | undefined;
    return authorChannelId ? `youtube.com/channel/${authorChannelId}` : '';
}

/**
 * Check if a timestamp label is in relative format (e.g., "2:35", "1:02:35")
 * vs absolute format (e.g., "4:30 PM", "16:30")
 */
function isRelativeTimestamp(label: string): boolean {
    if (!label) return false;
    // Relative timestamps are typically in format "M:SS" or "H:MM:SS" without AM/PM
    // and don't contain special characters or excessive digits for hours
    const relativePattern = /^\d{1,2}:\d{2}(:\d{2})?$/;
    return relativePattern.test(label.trim());
}

function createChatExportRow(
    renderer: any,
    broadcastStartTime?: string,
    videoOffsetTimeMsec?: string | number
): ISheetChatCommentsParam {
    const timestampUsec = Number(renderer?.timestampUsec || 0);

    // Read timestampText with fallback (consistent with viewModels logic)
    const rawTimestampText =
        (wrapTryCatch(() => renderer?.timestampText?.simpleText) as string | undefined) ||
        (wrapTryCatch(() => renderer?.timestampText?.runs?.[0]?.text) as string | undefined) ||
        '';

    // Generate timestampText from videoOffsetTimeMsec if rawTimestampText is empty or not relative
    let timestampText = rawTimestampText;
    if (videoOffsetTimeMsec !== undefined && (!timestampText || !isRelativeTimestamp(timestampText))) {
        const offsetMs =
            typeof videoOffsetTimeMsec === 'string' ? parseFloat(videoOffsetTimeMsec) : videoOffsetTimeMsec;
        if (!Number.isNaN(offsetMs) && offsetMs >= 0) {
            timestampText = formatDurationHMS(offsetMs);
        }
    }

    const row: ISheetChatCommentsParam = {
        author: {
            nameAuthor: renderer?.authorName?.simpleText || '',
            channel: buildChatAuthorChannel(renderer),
            member: buildChatMemberText(renderer)
        },
        commentMessage: buildChatMessage(renderer),
        timestampUsec,
        timestampText: timestampText
    };

    // Priority 1: Use pre-calculated videoOffsetTimeMsec (consistent with render logic)
    if (videoOffsetTimeMsec !== undefined) {
        const offsetMs =
            typeof videoOffsetTimeMsec === 'string' ? parseFloat(videoOffsetTimeMsec) : videoOffsetTimeMsec;
        if (!Number.isNaN(offsetMs) && offsetMs >= 0) {
            row.relativeTimestamp = '+' + formatDurationHMS(offsetMs);
            row.videoOffsetMs = offsetMs;
        }
    } else if (broadcastStartTime && timestampUsec > 0) {
        // Fallback: Calculate from broadcastStartTime (backward compatibility)
        row.relativeTimestamp = formatRelativeTimestamp(timestampUsec, broadcastStartTime);
    }

    return row;
}

function createTranscriptExportItem(group: TranscriptCueGroup, videoId: string): TranscriptExportItem {
    const groupRenderer = group?.transcriptCueGroupRenderer || {};
    const renderer = groupRenderer?.cues?.[0]?.transcriptCueRenderer || {};
    const message = renderer?.cue?.simpleText || renderer?.cue?.runs?.[0]?.text || '';
    const startOffsetMs = Number(renderer?.startOffsetMs || 0);
    const durationMs = Number(renderer?.durationMs || 0);
    const startSeconds = wrapTryCatch(() => renderer?.navigationEndpoint?.watchEndpoint?.startTimeSeconds) || 0;
    const formattedStartOffset = wrapTryCatch(() => groupRenderer?.formattedStartOffset?.simpleText) || '';
    const urlShare = `https://youtu.be/${videoId}?t=${startSeconds || 0}`;

    return {
        urlShare,
        formattedStartOffset,
        startOffsetMs,
        durationMs,
        message
    };
}

function resolveTranscriptUrlShareFromCache(body: any, startOffsetMs: number): string {
    const videoId = body?.videoId || '';
    const seconds = msToRoundSec(startOffsetMs);
    return `youtu.be/${videoId}?t=${seconds || 0}`;
}

export function buildCommentsExportPayload(input: {
    titleVideo?: string;
    url?: string;
    videoId?: string;
    comments?: CommentItem[];
    cachedDate?: number;
}): CommentsExportPayload {
    const comments = (input?.comments || []) as CommentItem[];
    const payload = createCommentsPayloadSkeleton({
        titleVideo: input?.titleVideo,
        url: input?.url,
        videoId: input?.videoId,
        cachedDate: input?.cachedDate,
        total: comments.length
    });

    const commentMap = new Map<string, CommentExportItem>();
    const repliesSet: CommentItem[] = [];

    for (const item of comments) {
        const type = item?.typeComment;
        const renderer = item?.commentRenderer || {};
        if (type === 'C') {
            const commentId = renderer?.commentId;
            if (typeof commentId !== 'string' || commentId.length === 0) continue;
            const entry = createCommentExportItem(renderer, payload.videoId);
            commentMap.set(commentId, entry);
        } else if (type === 'R') {
            repliesSet.push(item);
        }
    }

    for (const reply of repliesSet) {
        const renderer = reply?.commentRenderer || {};
        const originId = reply?.originComment?.commentRenderer?.commentId;
        if (typeof originId !== 'string' || originId.length === 0) continue;
        const origin = commentMap.get(originId);
        if (!origin) continue;
        const replyEntry = createCommentExportItem(renderer, payload.videoId);
        origin.commentReplies.replies.push(replyEntry);
    }

    payload.totalReplies = repliesSet.length;
    payload.totalComments = commentMap.size;
    payload.comments.push(...commentMap.values());

    return payload;
}

export function buildChatExportPayload(
    chatMessages: ChatItem[],
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number; broadcastStartTime?: string }
): ChatExportPayload {
    const payload = createChatPayloadSkeleton({
        titleVideo: meta?.titleVideo,
        url: meta?.url,
        videoId: meta?.videoId,
        cachedDate: meta?.cachedDate
    });

    for (const item of chatMessages) {
        const itemData = wrapTryCatch(() => (item as any).replayChatItemAction.actions[0].addChatItemAction.item);
        if (!itemData) continue;

        const renderer =
            (itemData as any)?.liveChatTextMessageRenderer ||
            (itemData as any)?.liveChatPaidMessageRenderer ||
            (itemData as any)?.liveChatMembershipItemRenderer;
        if (!renderer) continue;

        const videoOffsetTimeMsec = wrapTryCatch(() => (item as any).replayChatItemAction?.videoOffsetTimeMsec) as
            | string
            | number
            | undefined;

        payload.commentsChat.push(createChatExportRow(renderer, meta?.broadcastStartTime, videoOffsetTimeMsec));
    }

    payload.total = payload.commentsChat.length;
    return payload;
}

export function buildTranscriptExportPayload(
    cueGroups: TranscriptCueGroup[] | any,
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number; titleTrVideo?: string }
): TranscriptExportPayload {
    const groups = cueGroups || [];
    const payload = createTranscriptPayloadSkeleton({
        titleVideo: meta?.titleVideo,
        url: meta?.url,
        videoId: meta?.videoId,
        cachedDate: meta?.cachedDate,
        titleTrVideo: meta?.titleTrVideo,
        total: groups.length
    });

    for (const group of groups) {
        payload.trVideo.push(createTranscriptExportItem(group, payload.videoId));
    }

    payload.total = payload.trVideo.length;
    return payload;
}

export function buildCommentsExportPayloadFromCache(body: any): CommentsExportPayload | undefined {
    const comments = body?.comments;
    if (!Array.isArray(comments) || comments.length === 0) return;

    const payload = createCommentsPayloadSkeleton({
        titleVideo: body?.titleVideo,
        url: body?.url,
        videoId: body?.videoId,
        cachedDate: body?.date,
        total: comments.length
    });

    const commentMap = new Map<string, CommentExportItem>();
    const repliesSet: CommentItem[] = [];

    for (const cmnt of comments) {
        if (cmnt?.typeComment === 'C') {
            const renderer = cmnt?.commentRenderer || {};
            const commentId = renderer?.commentId;
            if (typeof commentId !== 'string' || commentId.length === 0) continue;
            commentMap.set(commentId, createCommentExportItem(renderer, payload.videoId));
        } else if (cmnt?.typeComment === 'R') {
            repliesSet.push(cmnt);
        }
    }

    for (const reply of repliesSet) {
        const renderer = reply?.commentRenderer || {};
        const originId = reply?.originComment?.commentRenderer?.commentId;
        if (typeof originId !== 'string' || originId.length === 0) continue;
        const origin = commentMap.get(originId);
        if (!origin) continue;
        origin.commentReplies.replies.push(createCommentExportItem(renderer, payload.videoId));
    }

    payload.totalReplies = repliesSet.length;
    payload.comments.push(...commentMap.values());
    payload.totalComments = payload.comments.length;

    return payload;
}

export function buildChatExportPayloadFromCache(body: any): ChatExportPayload | undefined {
    const serialized = body?.commentsChat;
    if (!serialized) return;

    const commentsChat = new Map<number, any>(JSON.parse(serialized));
    if (commentsChat.size === 0) return;

    const payload = createChatPayloadSkeleton({
        titleVideo: body?.titleVideo,
        url: body?.url,
        videoId: body?.videoId,
        cachedDate: body?.date
    });

    for (const [, entry] of commentsChat) {
        const itemData = wrapTryCatch(() => entry.replayChatItemAction.actions[0].addChatItemAction.item);
        if (!itemData) continue;

        const renderer =
            (itemData as any)?.liveChatTextMessageRenderer ||
            (itemData as any)?.liveChatPaidMessageRenderer ||
            (itemData as any)?.liveChatMembershipItemRenderer;
        if (!renderer) continue;

        const videoOffsetTimeMsec = wrapTryCatch(() => entry.replayChatItemAction?.videoOffsetTimeMsec) as
            | string
            | number
            | undefined;

        payload.commentsChat.push(createChatExportRow(renderer, body?.broadcastStartTime, videoOffsetTimeMsec));
    }

    payload.total = payload.commentsChat.length;
    return payload;
}

export function buildTranscriptExportPayloadFromCache(body: any): TranscriptExportPayload | undefined {
    if (!body?.commentsTrVideo?.actions?.length) return;

    const payload = createTranscriptPayloadSkeleton({
        titleVideo: body?.titleVideo,
        url: body?.url,
        videoId: body?.videoId,
        cachedDate: body?.date,
        titleTrVideo: wrapTryCatch(
            () =>
                body.commentsTrVideo.actions[0].updateEngagementPanelAction.content.transcriptRenderer.footer
                    .transcriptFooterRenderer.languageMenu.sortFilterSubMenuRenderer.subMenuItems[0].title
        ) as string
    });

    const arrTrVideo = wrapTryCatch(
        () =>
            body.commentsTrVideo.actions[0].updateEngagementPanelAction.content.transcriptRenderer.body
                .transcriptBodyRenderer.cueGroups
    );
    if (!Array.isArray(arrTrVideo)) return payload;

    for (const trVideo of arrTrVideo) {
        const renderer = trVideo.transcriptCueGroupRenderer || {};
        const cues = renderer.cues || [];
        const startOffsetMs = wrapTryCatch(() => cues[0]?.transcriptCueRenderer?.startOffsetMs) as number;
        const durationMs = wrapTryCatch(() => cues[0]?.transcriptCueRenderer?.durationMs) as number;
        const message = wrapTryCatch(() => cues[0]?.transcriptCueRenderer?.cue?.simpleText) as string;

        payload.trVideo.push({
            message: message || wrapTryCatch(() => cues[0]?.transcriptCueRenderer?.cue?.runs?.[0]?.text) || '',
            formattedStartOffset: wrapTryCatch(() => renderer.formattedStartOffset?.simpleText) || '',
            startOffsetMs: startOffsetMs || 0,
            durationMs: durationMs || 0,
            urlShare: resolveTranscriptUrlShareFromCache(body, startOffsetMs || 0)
        });
    }

    payload.total = payload.trVideo.length;
    return payload;
}
