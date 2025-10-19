/* eslint-disable @typescript-eslint/no-explicit-any */

import { encode } from 'html-entities';
import { wrapTryCatch } from './common';
import { msToShareVideo, tmUsecToDateTime } from './formatting';

export interface MemberBadgeViewModel {
    tooltip: string;
    thumbnailUrl: string;
}

export interface CommentViewModel {
    authorName: string;
    authorProfileUrl: string;
    authorAvatarUrl: string;
    isVerified: boolean;
    memberBadge?: MemberBadgeViewModel;
    publishedText: string;
    publishedUrl: string;
    likeCountText?: string;
    replyCount?: number;
    commentId?: string;
    heartTooltip?: string;
    isReply: boolean;
    isReplyType: boolean;
    refIndex?: string;
    contentHtml: string;
}

export interface ChatMessageViewModel {
    authorName: string;
    authorProfileUrl: string;
    authorAvatarUrl: string;
    isVerified: boolean;
    memberBadge?: MemberBadgeViewModel;
    timestampGmtText: string;
    timestampLabel: string;
    gotoVideoUrl?: string;
    gotoVideoOffset?: string;
    messageHtml: string;
}

export interface TranscriptViewModel {
    shareUrl: string;
    gotoOffset?: string;
    formattedOffset: string;
    cueText: string;
}

function escapeHtml(value: unknown): string {
    try {
        return encode(String(value ?? ''));
    } catch {
        return '';
    }
}

function coerceString(value: unknown): string {
    if (value === undefined || value === null) return '';
    try {
        return String(value);
    } catch {
        return '';
    }
}

function normalizeUrl(raw: unknown): string {
    try {
        let url = String(raw ?? '').trim();
        if (!url) return '';

        if (url.startsWith('/')) {
            url = `https://www.youtube.com${url}`;
        } else if (url.startsWith('www.')) {
            url = `https://${url}`;
        }

        const lower = url.toLowerCase();
        if (lower.startsWith('http://') || lower.startsWith('https://')) {
            return url;
        }
    } catch {
        // ignore
    }

    return '';
}

function sanitizeHtml(html: unknown): string {
    try {
        let value = String(html ?? '');
        if (!value) return '';

        value = value.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        value = value
            .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
            .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
            .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');

        value = value.replace(/href\s*=\s*"([^"]*)"/gi, (_match, href) => {
            const safe = normalizeUrl(href);
            return safe ? `href="${escapeHtml(safe)}" rel="noopener noreferrer"` : 'href="#"';
        });

        value = value.replace(/href\s*=\s*'([^']*)'/gi, (_match, href) => {
            const safe = normalizeUrl(href);
            return safe ? `href='${escapeHtml(safe)}' rel="noopener noreferrer"` : "href='#'";
        });

        value = value.replace(/src\s*=\s*"([^"]*)"/gi, (_match, src) => {
            const safe = normalizeUrl(src);
            return safe ? `src="${escapeHtml(safe)}"` : 'src=""';
        });

        value = value.replace(/src\s*=\s*'([^']*)'/gi, (_match, src) => {
            const safe = normalizeUrl(src);
            return safe ? `src='${escapeHtml(safe)}'` : "src=''";
        });

        return value;
    } catch {
        return '';
    }
}

function resolveCommentBadge(renderer: any): MemberBadgeViewModel | undefined {
    const badge = wrapTryCatch(() => renderer?.sponsorCommentBadge?.sponsorCommentBadgeRenderer);
    if (!badge) return undefined;

    const tooltip = coerceString(wrapTryCatch(() => badge.tooltip));
    const thumbnail =
        normalizeUrl(
            wrapTryCatch(() => badge.customBadge?.thumbnails?.[0]?.url) ??
                wrapTryCatch(() => badge.customThumbnail?.thumbnails?.[0]?.url)
        ) || '';

    if (!tooltip || !thumbnail) {
        return undefined;
    }

    return {
        tooltip,
        thumbnailUrl: thumbnail
    };
}

function resolveChatBadge(renderer: any): MemberBadgeViewModel | undefined {
    const badges: any[] = wrapTryCatch(() => renderer?.authorBadges) || [];

    for (const badge of badges) {
        const liveBadge = wrapTryCatch(() => badge?.liveChatAuthorBadgeRenderer);
        if (!liveBadge) continue;

        const tooltip = coerceString(wrapTryCatch(() => liveBadge.tooltip));
        const thumbnail = normalizeUrl(wrapTryCatch(() => liveBadge.customThumbnail?.thumbnails?.[0]?.url));

        if (tooltip && thumbnail) {
            return {
                tooltip,
                thumbnailUrl: thumbnail
            };
        }
    }

    return undefined;
}

function buildChatRunsHtml(runs: any[]): string {
    const parts: string[] = [];

    for (const run of runs) {
        if (!run) continue;

        try {
            const emoji = wrapTryCatch(() => run.emoji);
            if (emoji) {
                const thumbnails: any[] = wrapTryCatch(() => emoji.image?.thumbnails) || [];
                const url = normalizeUrl(wrapTryCatch(() => thumbnails[thumbnails.length - 1]?.url));
                const shortcut = coerceString(wrapTryCatch(() => emoji.shortcuts?.[0]));
                const label = coerceString(wrapTryCatch(() => emoji.image?.accessibility?.accessibilityData?.label));
                const alt = shortcut || label || 'emoji';
                if (url) {
                    parts.push(
                        `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" title="${escapeHtml(alt)}" width="24" height="24" style="margin-left: 2px; margin-right: 2px;" class="ycs-attachment">`
                    );
                } else {
                    parts.push(escapeHtml(alt));
                }
                continue;
            }

            const navigation = wrapTryCatch(() => run.navigationEndpoint);
            if (navigation) {
                const startSecondsRaw = wrapTryCatch(() => navigation.watchEndpoint?.startTimeSeconds);
                const startSeconds = startSecondsRaw !== undefined ? parseInt(coerceString(startSecondsRaw), 10) : NaN;
                if (!Number.isNaN(startSeconds) && startSeconds >= 0) {
                    const videoId = coerceString(wrapTryCatch(() => navigation.watchEndpoint?.videoId));
                    const href =
                        videoId && Number.isFinite(startSeconds)
                            ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${encodeURIComponent(String(startSeconds))}s`
                            : '';
                    const text = coerceString(run.text);
                    const offsetAttr = Number.isFinite(startSeconds)
                        ? ` data-offsetvideo="${escapeHtml(String(startSeconds))}"`
                        : '';
                    const safeHref = href ? ` href="${escapeHtml(href)}"` : '';
                    parts.push(
                        `<a class="ycs-cpointer ycs-gotochat-video"${safeHref}${offsetAttr}>${escapeHtml(text)}</a>`
                    );
                } else {
                    const href =
                        normalizeUrl(
                            wrapTryCatch(() => navigation.browseEndpoint?.canonicalBaseUrl) ??
                                wrapTryCatch(() => navigation.urlEndpoint?.url) ??
                                wrapTryCatch(() => navigation.commandMetadata?.webCommandMetadata?.url)
                        ) || '';
                    const text = coerceString(run.text);
                    if (href) {
                        parts.push(
                            `<a class="ycs-cpointer ycs-comment-link" href="${escapeHtml(
                                href
                            )}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
                        );
                    } else {
                        parts.push(escapeHtml(text));
                    }
                }
                continue;
            }

            parts.push(escapeHtml(run.text));
        } catch {
            parts.push(escapeHtml(run?.text));
        }
    }

    return parts.join('');
}

function buildChatMessageHtml(renderer: any): string {
    const message = wrapTryCatch(() => renderer?.message);
    if (!message) return '';

    const renderFullText = wrapTryCatch(() => message.renderFullText);
    if (renderFullText) {
        return sanitizeHtml(renderFullText);
    }

    const fullText = wrapTryCatch(() => message.fullText);
    if (fullText) {
        return escapeHtml(fullText);
    }

    const runs: any[] = wrapTryCatch(() => message.runs) || [];
    if (!runs.length) return '';

    return buildChatRunsHtml(runs);
}

export function buildCommentViewModels(items: any[], options: { isReply?: boolean } = {}): CommentViewModel[] {
    const models: CommentViewModel[] = [];
    const isReply = Boolean(options.isReply);

    for (const item of items) {
        const renderer = wrapTryCatch(() => item?.item?.commentRenderer) as any;
        if (!renderer) continue;

        const authorEndpoint = wrapTryCatch(() => renderer.authorEndpoint) as any;
        const authorProfileUrl =
            normalizeUrl(
                wrapTryCatch(() => authorEndpoint?.browseEndpoint?.canonicalBaseUrl) ??
                    wrapTryCatch(() => authorEndpoint?.commandMetadata?.webCommandMetadata?.url)
            ) || '';
        const authorAvatarUrl = normalizeUrl(wrapTryCatch(() => renderer.authorThumbnail?.thumbnails?.[0]?.url));
        const authorName = coerceString(wrapTryCatch(() => renderer.authorText?.simpleText));

        const publishedRun = wrapTryCatch(() => renderer.publishedTimeText?.runs?.[0]) as any;
        const publishedText = coerceString(
            wrapTryCatch(() => renderer.publishedTimeText?.simpleText) ?? wrapTryCatch(() => publishedRun?.text)
        );
        const publishedUrl =
            normalizeUrl(
                wrapTryCatch(() => publishedRun?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url)
            ) || '';

        const likeCountRaw =
            wrapTryCatch(() => renderer.voteCount?.simpleText) ?? wrapTryCatch(() => renderer.likeCount);
        const likeCountText = coerceString(likeCountRaw).trim();

        const replyCountRaw = wrapTryCatch(() => renderer.replyCount);
        const replyCountValue =
            typeof replyCountRaw === 'number' ? replyCountRaw : parseInt(coerceString(replyCountRaw), 10);
        const replyCount = Number.isFinite(replyCountValue) && replyCountValue > 0 ? replyCountValue : undefined;

        const commentId = coerceString(wrapTryCatch(() => renderer.commentId));
        const heartName = coerceString(wrapTryCatch(() => renderer.creatorHeart?.name));
        const renderFullText = wrapTryCatch(() => renderer.contentText?.renderFullText);
        const fallbackText =
            coerceString(wrapTryCatch(() => renderer.contentText?.simpleText)) ||
            coerceString(wrapTryCatch(() => renderer.contentText?.text)) ||
            coerceString(
                wrapTryCatch(() =>
                    (renderer.contentText?.runs || []).map((run: any) => coerceString(run?.text)).join('')
                )
            ) ||
            coerceString(wrapTryCatch(() => renderer.contentText?.fullText));

        models.push({
            authorName,
            authorProfileUrl,
            authorAvatarUrl,
            isVerified: Boolean(wrapTryCatch(() => renderer.verifiedAuthor)),
            memberBadge: resolveCommentBadge(renderer),
            publishedText,
            publishedUrl,
            likeCountText: likeCountText || undefined,
            replyCount,
            commentId: commentId || undefined,
            heartTooltip: heartName ? `Liked by the author: ${heartName}` : undefined,
            isReply,
            isReplyType: coerceString(wrapTryCatch(() => item?.item?.typeComment)).toUpperCase() === 'R',
            refIndex: coerceString(wrapTryCatch(() => item?.refIndex)) || undefined,
            contentHtml: renderFullText ? sanitizeHtml(renderFullText) : escapeHtml(fallbackText)
        });
    }

    return models;
}

export function buildChatMessageViewModels(items: any[]): ChatMessageViewModel[] {
    const models: ChatMessageViewModel[] = [];

    for (const item of items) {
        const renderer = wrapTryCatch(
            () => item?.item?.replayChatItemAction?.actions?.[0]?.addChatItemAction?.item?.liveChatTextMessageRenderer
        ) as any;
        if (!renderer) continue;

        const authorChannelId = coerceString(wrapTryCatch(() => renderer.authorExternalChannelId));
        const authorProfileUrl = normalizeUrl(authorChannelId ? `/channel/${authorChannelId}` : '');
        const authorAvatarUrl = normalizeUrl(wrapTryCatch(() => renderer.authorPhoto?.thumbnails?.[0]?.url));
        const authorName = coerceString(wrapTryCatch(() => renderer.authorName?.simpleText));

        const timestampLabel = coerceString(
            wrapTryCatch(() => renderer.timestampText?.simpleText) ??
                wrapTryCatch(() => renderer.timestampText?.runs?.[0]?.text)
        );
        const timestampUsec = wrapTryCatch(() => renderer.timestampUsec) as string | number | undefined;
        const timestampGmtText = timestampUsec ? tmUsecToDateTime(timestampUsec) : '';

        const videoOffset = wrapTryCatch(() => item?.item?.replayChatItemAction?.videoOffsetTimeMsec);
        const gotoVideoUrlRaw = videoOffset !== undefined ? msToShareVideo(videoOffset) : undefined;
        const gotoVideoUrl = gotoVideoUrlRaw ? normalizeUrl(gotoVideoUrlRaw) : '';

        models.push({
            authorName,
            authorProfileUrl,
            authorAvatarUrl,
            isVerified: Boolean(wrapTryCatch(() => renderer.verifiedAuthor)),
            memberBadge: resolveChatBadge(renderer),
            timestampGmtText,
            timestampLabel,
            gotoVideoUrl: gotoVideoUrl || undefined,
            gotoVideoOffset: videoOffset !== undefined ? coerceString(videoOffset) : undefined,
            messageHtml: buildChatMessageHtml(renderer)
        });
    }

    return models;
}

export function buildTranscriptViewModels(items: any[]): TranscriptViewModel[] {
    const models: TranscriptViewModel[] = [];

    for (const item of items) {
        const cue = wrapTryCatch(() => item?.item?.transcriptCueGroupRenderer?.cues?.[0]?.transcriptCueRenderer) as any;
        if (!cue) continue;

        const startOffset = wrapTryCatch(() => cue.startOffsetMs);
        const formattedOffset = coerceString(
            wrapTryCatch(() => item?.item?.transcriptCueGroupRenderer?.formattedStartOffset?.simpleText)
        );
        const shareUrlRaw = startOffset !== undefined ? msToShareVideo(startOffset) : undefined;
        const shareUrl = shareUrlRaw ? normalizeUrl(shareUrlRaw) : '';

        models.push({
            shareUrl,
            gotoOffset: startOffset !== undefined ? coerceString(startOffset) : undefined,
            formattedOffset,
            cueText: coerceString(wrapTryCatch(() => cue.cue?.simpleText))
        });
    }

    return models;
}
