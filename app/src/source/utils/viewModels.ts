/* eslint-disable @typescript-eslint/no-explicit-any */

import { decodeHtml, escapeHtml, wrapTryCatch, convertColorToRgba } from './common';
import { msToShareVideo, tmUsecToDateTime } from './formatting';

export interface MemberBadgeViewModel {
    tooltip: string;
    thumbnailUrl: string;
}

export interface DonatedChipViewModel {
    amount: string;
    backgroundColor?: string;
    foregroundColor?: string;
    iconType?: string;
}

export interface CommentViewModel {
    authorName: string;
    authorProfileUrl: string;
    authorAvatarUrl: string;
    isVerified: boolean;
    memberBadge?: MemberBadgeViewModel;
    donatedChip?: DonatedChipViewModel;
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
    donatedChip?: DonatedChipViewModel;
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

        const allowedTags = new Set(['a', 'br', 'img']);
        value = value.replace(/<(\/)?([a-z0-9-]+)([^>]*)>/gi, (match, closingSlash, tag, attrs) => {
            const lower = tag.toLowerCase();
            if (!allowedTags.has(lower)) {
                return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }

            if (lower === 'br') {
                return '<br />';
            }

            if (lower === 'img') {
                return `<img${attrs}>`;
            }

            const slash = closingSlash ? '/' : '';
            return `<${slash}${lower}${attrs}>`;
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

function resolveDonatedChip(renderer: any): DonatedChipViewModel | undefined {
    const chip = wrapTryCatch(() => renderer?.donatedChip?.pdgCommentChipRenderer);
    if (!chip) return undefined;

    const amount = coerceString(wrapTryCatch(() => chip.chipText?.simpleText));
    if (!amount) return undefined;

    // Extract color palette
    const bgColorInt = wrapTryCatch(() => chip.chipColorPalette?.backgroundColor);
    const fgColorInt = wrapTryCatch(() => chip.chipColorPalette?.foregroundTitleColor);

    let backgroundColor: string | undefined;
    let foregroundColor: string | undefined;

    try {
        if (typeof bgColorInt === 'number') {
            backgroundColor = convertColorToRgba(bgColorInt);
        }
    } catch (err) {
        console.error('Failed to convert backgroundColor:', bgColorInt, err);
    }

    try {
        if (typeof fgColorInt === 'number') {
            foregroundColor = convertColorToRgba(fgColorInt);
        }
    } catch (err) {
        console.error('Failed to convert foregroundColor:', fgColorInt, err);
    }

    // Extract icon type
    const iconType = coerceString(wrapTryCatch(() => chip.chipIcon?.iconType));

    return {
        amount,
        backgroundColor,
        foregroundColor,
        iconType: iconType || undefined
    };
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
                const shortcut = decodeHtml(coerceString(wrapTryCatch(() => emoji.shortcuts?.[0])));
                const label = decodeHtml(
                    coerceString(wrapTryCatch(() => emoji.image?.accessibility?.accessibilityData?.label))
                );
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
                    const text = decodeHtml(coerceString(run.text));
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
                    const text = decodeHtml(coerceString(run.text));
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

            parts.push(escapeHtml(decodeHtml(coerceString(run.text))));
        } catch {
            parts.push(escapeHtml(decodeHtml(coerceString(run?.text))));
        }
    }

    return parts.join('');
}

function buildChatMessageHtml(renderer: any): string {
    const message = wrapTryCatch(() => renderer?.message);
    if (!message) return '';

    const renderFullText = coerceString(wrapTryCatch(() => message.renderFullText));
    if (renderFullText) {
        return sanitizeHtml(decodeHtml(renderFullText));
    }

    const fullText = coerceString(wrapTryCatch(() => message.fullText));
    if (fullText) {
        return escapeHtml(decodeHtml(fullText));
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
        const heartTooltip = coerceString(wrapTryCatch(() => renderer.creatorHeart?.tooltip));
        const renderFullText = coerceString(wrapTryCatch(() => renderer.contentText?.renderFullText));
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
            donatedChip: resolveDonatedChip(renderer),
            publishedText,
            publishedUrl,
            likeCountText: likeCountText || undefined,
            replyCount,
            commentId: commentId || undefined,
            heartTooltip: heartTooltip || undefined,
            isReply,
            isReplyType: coerceString(wrapTryCatch(() => item?.item?.typeComment)).toUpperCase() === 'R',
            refIndex: coerceString(wrapTryCatch(() => item?.refIndex)) || undefined,
            contentHtml: renderFullText
                ? sanitizeHtml(decodeHtml(renderFullText))
                : escapeHtml(decodeHtml(fallbackText))
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
            donatedChip: resolveDonatedChip(renderer),
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
            cueText: decodeHtml(coerceString(wrapTryCatch(() => cue.cue?.simpleText)))
        });
    }

    return models;
}
