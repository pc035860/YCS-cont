import objectScan from 'object-scan';
import Queue from 'p-queue';

import { fetchR } from '../../libs';
import { GlobalStore, getCleanUrlVideo, getVideoId, wrapTryCatch, extractVideoId } from '../../common';
import { parseFormattedNumber, safeUrl } from '../../formatting';
import { normalizeCommentViewModel } from './normalize';
import { buildInnertubeBody, buildInnertubeHeaders } from '../request';
import { getInnertubeApiKey, getInitYtData, getInitYtDataFromHtml, getPageCfgData } from '../core';
import {
    clearCurrentVideoMemberOnly,
    clearCurrentVideoAgeRestricted,
    updateAccessRestrictionStatus,
    shouldDisableAuth,
    isPostMemberOnlyFromYtInitialData,
    setCurrentVideoMemberOnly
} from '../memberOnly';
import { encode } from 'html-entities';
import { CommentSortOrder } from '../../interfaces/i_types';

export interface CommentContinuation {
    token: string;
    clickTrackingParams?: string;
}

export interface ReplyContinuation extends CommentContinuation {
    originComment?: any;
}

export interface SubThreadContinuation extends ReplyContinuation {
    replyLevel: number;
    parentCommentId?: string;
}

export interface ExtractSubThreadsResult {
    comments: any[];
    continuations: SubThreadContinuation[];
}

/** Maximum depth for recursive subThread scanning to prevent infinite loops */
const MAX_SUBTHREAD_DEPTH = 5;

export interface CommentBatchResult {
    comments: any[];
    continuations: CommentContinuation[];
    frameworkUpdates: Record<string, any>;
}

export interface ProcessParentCommentParams {
    item: any;
    frameworkUpdates: Record<string, any>;
    currentVideoId: string;
}

export interface ProcessParentCommentResult {
    comments: any[];
    replyContinuations: ReplyContinuation[];
}

export interface ScheduleReplyFetchParams {
    continuations: ReplyContinuation[];
    queue: Queue;
    currentVideoId: string;
    fetchContinuation: (continuation: ReplyContinuation) => Promise<CommentBatchResult | undefined>;
    onReply: (reply: any) => void;
    frameworkUpdatesResolver?: (response: any) => Record<string, any>;
    stats?: ReplyContinuationStats;
}

export interface ReplyContinuationStats {
    total: number;
    unique: number;
    skipped: number;
    tokenless: number;
}

export interface FormattedCommentContent {
    fullText: string;
    renderFullText: string;
    isTimeline: boolean;
}

export function formatCommentRuns(runs: any[] | undefined, currentVideoId: string): FormattedCommentContent {
    let fullTextComment = '';
    let renderFullTextComment = '';
    let isTimeline = false;

    const safeRuns = Array.isArray(runs) ? runs : [];

    for (const partTextComment of safeRuns) {
        let text = '';
        let navigationEndpoint: any;
        try {
            text =
                (partTextComment as any)?.text ??
                (partTextComment as any)?.simpleText ??
                (wrapTryCatch(() => (partTextComment as any)?.textRun?.content) as string) ??
                (wrapTryCatch(() => (partTextComment as any)?.textRun?.text) as string) ??
                (wrapTryCatch(() => (partTextComment as any)?.content) as string) ??
                '';
            navigationEndpoint =
                (partTextComment as any)?.navigationEndpoint ??
                wrapTryCatch(() => (partTextComment as any)?.textRun?.navigationEndpoint);

            fullTextComment += text || '';

            const rawTimeValue = wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.startTimeSeconds);
            const parsedTime =
                typeof rawTimeValue === 'string' ? parseInt(rawTimeValue, 10) : (rawTimeValue as number | undefined);
            if (Number.isFinite(parsedTime) && (parsedTime as number) >= 0) {
                const linkVideoId = (wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.videoId) || '') as string;
                const isSameVideo = String(linkVideoId || '') === String(currentVideoId || '');
                const timeValue = rawTimeValue ?? parsedTime ?? '';
                renderFullTextComment += `<a class="ycs-cpointer ycs-goto-comment-time" href="https://www.youtube.com/watch?v=${linkVideoId}&t=${timeValue}s" data-offsetvideo="${timeValue}" data-video-id="${linkVideoId}">${encode(text || '')}</a>`;
                if (isSameVideo) {
                    isTimeline = true;
                }
            } else if (navigationEndpoint) {
                const rawHref = (wrapTryCatch(() => navigationEndpoint?.browseEndpoint?.canonicalBaseUrl) ||
                    wrapTryCatch(() => navigationEndpoint?.urlEndpoint?.url) ||
                    wrapTryCatch(() => navigationEndpoint?.commandMetadata?.webCommandMetadata?.url) ||
                    '') as string;
                const href = safeUrl(rawHref);
                renderFullTextComment += `<a class="ycs-cpointer ycs-comment-link" href="${href}" target="_blank">${encode(text || '')}</a>`;
            } else if (wrapTryCatch(() => (partTextComment as any).emoji)) {
                const url =
                    wrapTryCatch(() => {
                        const thumbnails = (partTextComment as any).emoji.image.thumbnails;
                        return thumbnails[thumbnails.length - 1].url;
                    }) || '';
                const alt = (wrapTryCatch(() => (partTextComment as any).emoji.shortcuts?.[0]) as string) || '';
                const style = `margin-left: 2px; margin-right: 2px;`;
                renderFullTextComment += `<img src="${safeUrl(url)}" alt="${encode(alt)}" title="${encode(alt)}" width="24" height="24" style="${style}" class="ycs-attachment">`;
            } else if (wrapTryCatch(() => (partTextComment as any).attachment?.image)) {
                const image: any = wrapTryCatch(() => (partTextComment as any).attachment.image);
                const url = image?.url || '';
                const width = image?.width || 24;
                const height = image?.height || 24;
                const margin = image?.margin || { left: 0, right: 0 };
                const style = `margin-left: ${margin.left || 0}px; margin-right: ${margin.right || 0}px;`;
                const alt = text || '';
                renderFullTextComment += `<img src="${safeUrl(url)}" alt="${encode(alt)}" title="${encode(alt)}" width="${width}" height="${height}" style="${style}" class="ycs-attachment">`;
            } else {
                renderFullTextComment += encode(text) || '';
            }
        } catch (e) {
            console.error(e);
            const fallbackText: string = ((): string => {
                try {
                    const t =
                        (partTextComment as any)?.text ??
                        (partTextComment as any)?.simpleText ??
                        (wrapTryCatch(() => (partTextComment as any)?.textRun?.content) as string) ??
                        (wrapTryCatch(() => (partTextComment as any)?.textRun?.text) as string) ??
                        (wrapTryCatch(() => (partTextComment as any)?.content) as string) ??
                        '';
                    return typeof t === 'string' ? t : '';
                } catch {
                    return '';
                }
            })();
            renderFullTextComment += encode(fallbackText);
            fullTextComment += encode(fallbackText);
        }
    }

    return { fullText: fullTextComment, renderFullText: renderFullTextComment, isTimeline };
}

export interface FetchInitialCommentBatchParams {
    windowRef: Window & typeof globalThis;
    signal?: AbortSignal;
    sortOrder: CommentSortOrder;
}

export interface FetchContinuationParams extends FetchInitialCommentBatchParams {
    continuation: CommentContinuation;
}

export interface FetchRepliesParams extends FetchContinuationParams {
    clickTrackingParams?: string;
}

function buildSponsorBadge(options: {
    sponsorBadgeUrl: string | undefined;
    sponsorBadgeA11y: string | undefined;
    existingTooltip?: string | undefined;
}): any | undefined {
    if (!options.sponsorBadgeUrl) return undefined;

    const badge: any = {
        sponsorCommentBadgeRenderer: {
            customBadge: { thumbnails: [{ url: options.sponsorBadgeUrl }] }
        }
    };

    const tooltip = options.sponsorBadgeA11y || options.existingTooltip;
    if (tooltip) {
        badge.sponsorCommentBadgeRenderer.tooltip = tooltip;
    }

    return badge;
}

export function getFrameworkUpdatesById(response: any): Record<string, any> {
    try {
        const mutations: any[] = wrapTryCatch(() => response.frameworkUpdates.entityBatchUpdate.mutations) || [];
        if (!Array.isArray(mutations) || mutations.length === 0) return {};
        const map: Record<string, any> = {};
        for (const m of mutations) {
            try {
                const payload = wrapTryCatch(() => m.payload) || {};
                const cmt = wrapTryCatch(() => payload.commentEntityPayload);
                if (cmt) {
                    const commentId = wrapTryCatch(() => cmt.properties?.commentId);
                    if (commentId) map[commentId] = cmt;
                    const cKey = wrapTryCatch(() => cmt.key);
                    if (cKey) map[cKey] = cmt;
                }
                const surface = wrapTryCatch(() => payload.commentSurfaceEntityPayload);
                if (surface && surface.key) {
                    map[surface.key] = surface;
                }
                const toolbar = wrapTryCatch(() => payload.engagementToolbarStateEntityPayload);
                if (toolbar && toolbar.key) {
                    map[toolbar.key] = toolbar;
                }
            } catch (e) {
                console.error(e);
                continue;
            }
        }
        return map;
    } catch (e) {
        console.error(e);
        return {};
    }
}

export function applyFrameworkUpdatesToComment(commentObj: any, vmSource: any, fwById: Record<string, any>): void {
    try {
        if (!commentObj || !fwById) return;
        const vm =
            wrapTryCatch(() => vmSource?.commentThreadRenderer?.commentViewModel?.commentViewModel) ||
            wrapTryCatch(() => vmSource?.commentViewModel) ||
            vmSource;

        const commentId =
            wrapTryCatch(() => vm.commentId) || wrapTryCatch(() => commentObj?.commentRenderer?.commentId);
        const update = commentId ? fwById[commentId] : undefined;
        if (update) {
            const isVerified = wrapTryCatch(() => update.author?.isVerified);
            const isCreator = wrapTryCatch(() => update.author?.isCreator);
            if (isVerified) {
                commentObj.commentRenderer = commentObj.commentRenderer || {};
                commentObj.commentRenderer.verifiedAuthor = true;
            }
            if (isCreator) {
                commentObj.commentRenderer = commentObj.commentRenderer || {};
                commentObj.commentRenderer.authorIsChannelOwner = true;
            }
            const sponsorBadge = buildSponsorBadge({
                sponsorBadgeUrl: wrapTryCatch(() => update.author?.sponsorBadgeUrl),
                sponsorBadgeA11y: wrapTryCatch(() => update.author?.sponsorBadgeA11y),
                existingTooltip: wrapTryCatch(
                    () => commentObj.commentRenderer?.sponsorCommentBadge?.sponsorCommentBadgeRenderer?.tooltip
                )
            });
            if (sponsorBadge) {
                commentObj.commentRenderer = commentObj.commentRenderer || {};
                commentObj.commentRenderer.sponsorCommentBadge = sponsorBadge;
            }
        }

        const toolbarKey = wrapTryCatch(() => vm.toolbarStateKey);
        const toolbarUpdate = toolbarKey ? fwById[toolbarKey] : undefined;
        if (toolbarUpdate && wrapTryCatch(() => toolbarUpdate.heartState) === 'TOOLBAR_HEART_STATE_HEARTED') {
            commentObj.commentRenderer = commentObj.commentRenderer || {};

            const existingHeartTooltip = wrapTryCatch(() => commentObj.commentRenderer?.creatorHeart?.tooltip);
            const heartTooltip =
                wrapTryCatch(() => toolbarUpdate.toolbar?.heartActiveTooltip) ||
                wrapTryCatch(() => update?.toolbar?.heartActiveTooltip);
            const finalTooltip = heartTooltip || existingHeartTooltip || 'hearted';

            commentObj.commentRenderer.creatorHeart = { tooltip: finalTooltip } as any;
        }

        const surfaceKey = wrapTryCatch(() => vm.commentSurfaceKey);
        const surfaceUpdate = surfaceKey ? fwById[surfaceKey] : undefined;
        const donatedChip = wrapTryCatch(() => surfaceUpdate?.pdgCommentChip);
        if (donatedChip) {
            commentObj.commentRenderer = commentObj.commentRenderer || {};
            commentObj.commentRenderer.donatedChip = donatedChip;
        }
    } catch (e) {
        console.error(e);
    }
}

function migrateRuns(baseText: string, rawRuns: any[]): any[] {
    try {
        let currentIndex = 0;
        const result: any[] = [];
        for (const r of rawRuns || []) {
            const startIndex = wrapTryCatch(() => r.startIndex) as any;
            const length = wrapTryCatch(() => r.length) as any;
            if (typeof startIndex === 'number' && startIndex > currentIndex) {
                result.push({ text: baseText.slice(currentIndex, startIndex) });
            }
            result.push(r);
            if (typeof startIndex === 'number' && typeof length === 'number') {
                currentIndex = startIndex + length;
            }
        }
        if (typeof currentIndex === 'number' && currentIndex < (baseText?.length || 0)) {
            result.push({ text: baseText.slice(currentIndex) });
        }
        return result;
    } catch (e) {
        console.error(e);
        return [{ text: baseText || '' }];
    }
}

export function generateCommentObjectFromFW(params: {
    commentId: string;
    update: any;
    surfaceUpdate?: any;
    toolbarStateUpdate?: any;
}): any {
    try {
        const { commentId, update, surfaceUpdate, toolbarStateUpdate } = params;
        if (!update) return undefined;

        const propContent = wrapTryCatch(() => update.properties.content) || {};
        const baseText: string = wrapTryCatch(() => propContent.content) || '';

        const rawRuns: any[] = [];
        try {
            const commandRuns = wrapTryCatch(() => propContent.commandRuns) || [];
            for (const commandRun of commandRuns) {
                try {
                    const watchEndpoint = wrapTryCatch(() => commandRun.onTap.innertubeCommand.watchEndpoint);
                    const browseEndpoint = wrapTryCatch(() => commandRun.onTap.innertubeCommand.browseEndpoint);
                    const webUrl = wrapTryCatch(
                        () => commandRun.onTap.innertubeCommand.commandMetadata.webCommandMetadata.url
                    );
                    const startIndex = wrapTryCatch(() => commandRun.startIndex);
                    const length = wrapTryCatch(() => commandRun.length);
                    let text: string | undefined;
                    if (typeof startIndex === 'number' && typeof length === 'number') {
                        text = baseText.slice(startIndex, startIndex + length);
                    }
                    if (watchEndpoint) {
                        rawRuns.push({
                            text,
                            startIndex,
                            length,
                            navigationEndpoint: {
                                watchEndpoint: {
                                    videoId: wrapTryCatch(() => watchEndpoint.videoId),
                                    startTimeSeconds: wrapTryCatch(() => watchEndpoint.startTimeSeconds) || 0
                                }
                            }
                        });
                    } else if (browseEndpoint || webUrl) {
                        const canonicalBaseUrl = webUrl ? `${webUrl}` : undefined;
                        rawRuns.push({
                            text,
                            startIndex,
                            length,
                            navigationEndpoint: {
                                watchEndpoint: { startTimeSeconds: -1 },
                                browseEndpoint: {
                                    browseId: wrapTryCatch(() => browseEndpoint?.browseId),
                                    canonicalBaseUrl:
                                        wrapTryCatch(() => browseEndpoint?.canonicalBaseUrl) || canonicalBaseUrl
                                }
                            }
                        });
                    }
                } catch (e) {
                    console.error(e);
                    continue;
                }
            }
        } catch (e) {
            console.error(e);
        }

        try {
            const attachmentRuns = wrapTryCatch(() => propContent.attachmentRuns) || [];
            for (const attachmentRun of attachmentRuns) {
                try {
                    const image = wrapTryCatch(() => attachmentRun.element.type.imageType.image);
                    if (!image) continue;
                    const startIndex = wrapTryCatch(() => attachmentRun.startIndex);
                    const length = wrapTryCatch(() => attachmentRun.length);
                    let text: string | undefined;
                    if (typeof startIndex === 'number' && typeof length === 'number') {
                        text = baseText.slice(startIndex, startIndex + length);
                    }
                    const imageSource = wrapTryCatch(() => image.sources[0]) || {};
                    const imageMargin =
                        wrapTryCatch(() => attachmentRun.element.properties.layoutProperties.margin) || {};
                    rawRuns.push({
                        text,
                        startIndex,
                        length,
                        attachment: {
                            image: {
                                width: wrapTryCatch(() => imageSource.width),
                                height: wrapTryCatch(() => imageSource.height),
                                url: wrapTryCatch(() => imageSource.url),
                                margin: {
                                    left: wrapTryCatch(() => imageMargin.left.value) || 0,
                                    right: wrapTryCatch(() => imageMargin.right.value) || 0
                                }
                            }
                        }
                    });
                } catch (e) {
                    console.error(e);
                    continue;
                }
            }
        } catch (e) {
            console.error(e);
        }

        rawRuns.sort((a: any, b: any) => (a?.startIndex || 0) - (b?.startIndex || 0));
        const runs = migrateRuns(baseText, rawRuns);

        const author = wrapTryCatch(() => update.author) || {};
        const likeCountLiked = wrapTryCatch(() => update.toolbar?.likeCountLiked);
        let likeCount = 0;
        try {
            const parsed = parseFormattedNumber(likeCountLiked);
            if (parsed.multiply === 1) {
                likeCount = Math.max(0, parsed.number - 1);
            } else {
                likeCount = parsed.number;
            }
        } catch {
            // ignore parse errors and keep default likeCount
        }
        const replyCountRaw = wrapTryCatch(() => update.toolbar?.replyCount);
        let replyCount = parseFormattedNumber(replyCountRaw || '0').number;

        // Fallback: Try to extract reply count from A11y label if raw count is empty/zero
        // e.g. "4 則回覆" or "4 replies"
        if (replyCount === 0 && !replyCountRaw) {
            const replyCountA11y = wrapTryCatch(() => update.toolbar?.replyCountA11y);
            if (replyCountA11y) {
                const a11yParsed = parseFormattedNumber(replyCountA11y);
                if (a11yParsed.number > 0) {
                    replyCount = a11yParsed.number;
                }
            }
        }

        const comment: any = {
            commentRenderer: {
                commentId,
                likeCount,
                replyCount,
                authorText: { simpleText: wrapTryCatch(() => author.displayName) },
                authorThumbnail: { thumbnails: [{ url: wrapTryCatch(() => author.avatarThumbnailUrl) }] },
                authorEndpoint:
                    wrapTryCatch(() => author.channelPageEndpoint?.innertubeCommand) ||
                    wrapTryCatch(() => author.channelCommand?.innertubeCommand),
                contentText: { runs, fullText: baseText }
            }
        };

        let currentVideoId = '';
        if (typeof window !== 'undefined') {
            try {
                currentVideoId = String(getVideoId(window.location.href) || '');
            } catch {
                currentVideoId = '';
            }
        }
        const formattedContent = formatCommentRuns(runs, currentVideoId);
        comment.commentRenderer.contentText.fullText = formattedContent.fullText || baseText;
        comment.commentRenderer.contentText.renderFullText =
            formattedContent.renderFullText || formattedContent.fullText || baseText;
        if (formattedContent.isTimeline) {
            comment.commentRenderer.isTimeLine = 'timeline';
        }

        const publishedTime = wrapTryCatch(() => update.properties?.publishedTime) || '';
        if (publishedTime) {
            comment.commentRenderer.publishedTimeText = {
                runs: [
                    {
                        text: publishedTime
                    }
                ]
            };
        }

        if (surfaceUpdate) {
            const publishedText = wrapTryCatch(() => update.properties?.publishedTime) || undefined;
            if (publishedText) {
                comment.commentRenderer.publishedTimeText = {
                    runs: [
                        {
                            text: publishedText,
                            navigationEndpoint: wrapTryCatch(
                                () => surfaceUpdate?.publishedTimeCommand?.innertubeCommand
                            )
                        }
                    ]
                };
            }

            const donatedChip = wrapTryCatch(() => surfaceUpdate.pdgCommentChip);
            if (donatedChip) {
                comment.commentRenderer.donatedChip = donatedChip;
            }

            const engagementToolbar = wrapTryCatch(() => surfaceUpdate.engagementToolbar);
            if (engagementToolbar) {
                comment.commentRenderer.engagementToolbar = engagementToolbar;
            }
        }

        if (toolbarStateUpdate && wrapTryCatch(() => toolbarStateUpdate.heartState) === 'TOOLBAR_HEART_STATE_HEARTED') {
            comment.commentRenderer.creatorHeart = {
                tooltip:
                    wrapTryCatch(() => toolbarStateUpdate.toolbar?.heartActiveTooltip) ||
                    wrapTryCatch(() => update.toolbar?.heartActiveTooltip) ||
                    'hearted'
            } as any;
        }

        const sponsorBadge = buildSponsorBadge({
            sponsorBadgeUrl: wrapTryCatch(() => author.sponsorBadgeUrl),
            sponsorBadgeA11y: wrapTryCatch(() => author.sponsorBadgeA11y)
        });
        if (sponsorBadge) {
            comment.commentRenderer.sponsorCommentBadge = sponsorBadge;
        }

        if (wrapTryCatch(() => author.isVerified)) {
            comment.commentRenderer.verifiedAuthor = true;
        }
        if (wrapTryCatch(() => author.isCreator)) {
            comment.commentRenderer.authorIsChannelOwner = true;
        }

        // Extract replyLevel from FW properties (0 = parent, 1+ = nested reply)
        const replyLevel = wrapTryCatch(() => update?.properties?.replyLevel);
        if (typeof replyLevel === 'number') {
            comment.replyLevel = replyLevel;
        }

        return comment;
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

export function migrateContinuationItemsWithFW(
    continuationItems: any[],
    frameworkUpdatesById: Record<string, any>
): any[] {
    try {
        return (continuationItems || [])
            .map((item: any) => {
                try {
                    if (wrapTryCatch(() => item.commentThreadRenderer?.commentViewModel?.commentViewModel)) {
                        const vm = item.commentThreadRenderer.commentViewModel.commentViewModel;
                        const commentId = wrapTryCatch(() => vm.commentId);
                        const update = frameworkUpdatesById[commentId];
                        const surfaceUpdate = frameworkUpdatesById[wrapTryCatch(() => vm.commentSurfaceKey)];
                        const toolbarStateUpdate = frameworkUpdatesById[wrapTryCatch(() => vm.toolbarStateKey)];
                        const comment = generateCommentObjectFromFW({
                            commentId,
                            update,
                            surfaceUpdate,
                            toolbarStateUpdate
                        });
                        if (comment) {
                            const newItem = { ...item };
                            newItem.commentThreadRenderer = { ...newItem.commentThreadRenderer, comment };
                            const cont = wrapTryCatch(
                                () =>
                                    item.commentThreadRenderer.replies.commentRepliesRenderer.contents[0]
                                        .continuationItemRenderer.continuationEndpoint
                            );
                            if (cont) {
                                newItem.commentThreadRenderer.replies = {
                                    ...newItem.commentThreadRenderer.replies,
                                    commentRepliesRenderer: {
                                        continuations: [
                                            {
                                                nextContinuationData: {
                                                    continuation: cont.continuationCommand?.token,
                                                    clickTrackingParams: cont.clickTrackingParams
                                                }
                                            }
                                        ]
                                    }
                                };
                            }
                            return newItem;
                        }
                    }
                    if (wrapTryCatch(() => item.commentViewModel)) {
                        const vm = item.commentViewModel;
                        const commentId = wrapTryCatch(() => vm.commentId);
                        const update = frameworkUpdatesById[commentId];
                        const surfaceUpdate = frameworkUpdatesById[wrapTryCatch(() => vm.commentSurfaceKey)];
                        const comment = generateCommentObjectFromFW({ commentId, update, surfaceUpdate });
                        if (comment) {
                            const newItem = { ...item };
                            newItem.commentRenderer = comment.commentRenderer;
                            return newItem;
                        }
                    }
                    return item;
                } catch (e) {
                    console.error(e);
                    return item;
                }
            })
            .filter(Boolean);
    } catch (e) {
        console.error(e);
        return continuationItems || [];
    }
}

export function extractReplyContinuationFromItem(threadItem: any): { token?: string; cTrParams?: string } {
    try {
        const legacyToken =
            wrapTryCatch(
                () =>
                    threadItem.commentThreadRenderer.replies.commentRepliesRenderer.continuations[0]
                        .nextContinuationData.continuation
            ) ||
            wrapTryCatch(
                () =>
                    threadItem.commentThreadRenderer.replies.commentRepliesRenderer.contents[0].continuationItemRenderer
                        .continuationEndpoint.continuationCommand.token
            );
        const legacyClick =
            wrapTryCatch(
                () =>
                    threadItem.commentThreadRenderer.replies.commentRepliesRenderer.continuations[0]
                        .nextContinuationData.clickTrackingParams
            ) ||
            wrapTryCatch(
                () =>
                    threadItem.commentThreadRenderer.replies.commentRepliesRenderer.contents[0].continuationItemRenderer
                        .continuationEndpoint.clickTrackingParams
            );

        if (legacyToken) return { token: legacyToken, cTrParams: legacyClick };

        const searchRoot = wrapTryCatch(() => threadItem.commentThreadRenderer) || threadItem;
        const token = objectScan(
            ['**.nextContinuationData.continuation', '**.continuationEndpoint.continuationCommand.token'],
            {
                joined: true,
                rtn: 'value',
                abort: true
            }
        )(searchRoot) as any;
        const click = objectScan(
            ['**.nextContinuationData.clickTrackingParams', '**.continuationEndpoint.clickTrackingParams'],
            {
                joined: true,
                rtn: 'value',
                abort: true
            }
        )(searchRoot) as any;

        return { token, cTrParams: click };
    } catch (e) {
        console.error(e);
        return {};
    }
}

/**
 * Recursively extracts comments and continuation tokens from subThreads.
 * Scans nested commentRepliesRenderer.subThreads arrays up to MAX_SUBTHREAD_DEPTH.
 *
 * @param commentRepliesRenderer - The replies renderer containing subThreads
 * @param frameworkUpdatesById - Map of entityKey/commentId to FW updates
 * @param parentComment - Direct parent comment for originComment reference
 * @param currentDepth - Current recursion depth (starts at 1 for first-level replies)
 * @returns Object containing extracted comments and continuation tokens
 */
export function extractSubThreads(
    commentRepliesRenderer: any,
    frameworkUpdatesById: Record<string, any>,
    parentComment: any,
    currentDepth = 1
): ExtractSubThreadsResult {
    const result: ExtractSubThreadsResult = {
        comments: [],
        continuations: []
    };

    if (!commentRepliesRenderer || currentDepth > MAX_SUBTHREAD_DEPTH) {
        return result;
    }

    const subThreads = wrapTryCatch(() => commentRepliesRenderer.subThreads) || [];
    if (!Array.isArray(subThreads) || subThreads.length === 0) {
        return result;
    }

    for (const subThread of subThreads) {
        try {
            // Case 1: continuationItemRenderer - load more at this level
            const continuationItem = wrapTryCatch(() => subThread.continuationItemRenderer);
            if (continuationItem) {
                // Extract common paths to reduce repeated property access
                const buttonCommand = wrapTryCatch(() => continuationItem.button?.buttonRenderer?.command);
                const endpoint = wrapTryCatch(() => continuationItem.continuationEndpoint);

                const token =
                    wrapTryCatch(() => buttonCommand?.continuationCommand?.token) ||
                    wrapTryCatch(() => endpoint?.continuationCommand?.token);
                const clickTrackingParams =
                    wrapTryCatch(() => buttonCommand?.clickTrackingParams) ||
                    wrapTryCatch(() => endpoint?.clickTrackingParams);

                if (token) {
                    result.continuations.push({
                        token,
                        clickTrackingParams,
                        originComment: parentComment,
                        replyLevel: currentDepth,
                        parentCommentId: wrapTryCatch(() => parentComment?.commentRenderer?.commentId)
                    });
                }
                continue;
            }

            // Case 2: commentThreadRenderer - nested comment
            const threadRenderer = wrapTryCatch(() => subThread.commentThreadRenderer);
            if (threadRenderer) {
                const vm = wrapTryCatch(() => threadRenderer.commentViewModel?.commentViewModel);
                const commentId = wrapTryCatch(() => vm?.commentId);

                if (commentId) {
                    // Generate comment object from framework updates
                    const update = frameworkUpdatesById[commentId];
                    const surfaceUpdate = frameworkUpdatesById[wrapTryCatch(() => vm.commentSurfaceKey)];
                    const toolbarStateUpdate = frameworkUpdatesById[wrapTryCatch(() => vm.toolbarStateKey)];

                    const comment = generateCommentObjectFromFW({
                        commentId,
                        update,
                        surfaceUpdate,
                        toolbarStateUpdate
                    });

                    if (comment) {
                        // Mark with depth for later replyLevel assignment
                        const enrichedComment = {
                            ...comment,
                            _subThreadDepth: currentDepth,
                            originComment: parentComment
                        };

                        // Recursively process nested replies with this comment as new parent
                        const nestedRepliesRenderer = wrapTryCatch(
                            () => threadRenderer.replies?.commentRepliesRenderer
                        );
                        if (nestedRepliesRenderer) {
                            const nestedResult = extractSubThreads(
                                nestedRepliesRenderer,
                                frameworkUpdatesById,
                                enrichedComment,
                                currentDepth + 1
                            );

                            // If no actual content or further tokens found for this nested comment,
                            // override its replyCount to 0 to avoid ghost expand buttons.
                            if (nestedResult.comments.length === 0 && nestedResult.continuations.length === 0) {
                                if (enrichedComment.commentRenderer) {
                                    enrichedComment.commentRenderer.replyCount = 0;
                                }
                            }

                            result.comments.push(enrichedComment);
                            result.comments.push(...nestedResult.comments);
                            result.continuations.push(...nestedResult.continuations);
                        } else {
                            // No replies renderer at all for this nested comment
                            if (enrichedComment.commentRenderer) {
                                enrichedComment.commentRenderer.replyCount = 0;
                            }
                            result.comments.push(enrichedComment);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[YCS] Error processing subThread:', e);
            continue;
        }
    }

    return result;
}

export function extractNextContinuation(response: any): { token?: string; clickTrackingParams?: string } {
    try {
        const reloadItems =
            wrapTryCatch(
                () => response.onResponseReceivedEndpoints[1].reloadContinuationItemsCommand.continuationItems
            ) || [];
        const appendItems =
            wrapTryCatch(
                () => response.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems
            ) || [];
        const items: any[] = Array.isArray(reloadItems) && reloadItems.length > 0 ? reloadItems : appendItems;
        if (!items || items.length === 0) return {};
        const last = items[items.length - 1];

        const token =
            wrapTryCatch(() => last.continuationItemRenderer.button.buttonRenderer.command.continuationCommand.token) ||
            wrapTryCatch(() => last.continuationItemRenderer.continuationEndpoint.continuationCommand.token);
        const clickTrackingParams =
            wrapTryCatch(() => last.continuationItemRenderer.button.buttonRenderer.command.clickTrackingParams) ||
            wrapTryCatch(() => last.continuationItemRenderer.continuationEndpoint.clickTrackingParams);
        return { token, clickTrackingParams };
    } catch (e) {
        console.error(e);
        return {};
    }
}

export function prepareFieldsComment(cmnt: any): object {
    try {
        const preservedAuthorText = wrapTryCatch(() => {
            const authorText = cmnt.commentRenderer?.authorText;
            if (!authorText) return undefined;
            const copy: any = {};
            if (typeof authorText.simpleText !== 'undefined') {
                copy.simpleText = authorText.simpleText;
            }
            if (Array.isArray(authorText.runs)) {
                copy.runs = authorText.runs.map((run: any) => {
                    const runCopy: any = {};
                    const navigationEndpoint = wrapTryCatch(() => run?.navigationEndpoint);
                    if (navigationEndpoint) {
                        runCopy.navigationEndpoint = navigationEndpoint;
                    }
                    const text = wrapTryCatch(() => run?.text);
                    if (typeof text !== 'undefined') {
                        runCopy.text = text;
                    }
                    const simpleRunText = wrapTryCatch(() => run?.simpleText);
                    if (typeof simpleRunText !== 'undefined') {
                        runCopy.simpleText = simpleRunText;
                    }
                    return runCopy;
                });
            }
            return copy;
        });

        const preservedAuthorEndpoint = wrapTryCatch(() => {
            const endpoint = cmnt.commentRenderer?.authorEndpoint;
            if (!endpoint) return undefined;
            const url = wrapTryCatch(() => endpoint.commandMetadata?.webCommandMetadata?.url);
            const browseId = wrapTryCatch(() => endpoint.browseEndpoint?.browseId);
            const canonicalBaseUrl = wrapTryCatch(() => endpoint.browseEndpoint?.canonicalBaseUrl);
            return { url, browseId, canonicalBaseUrl };
        });

        const preservedPublishedTimeTextRuns = wrapTryCatch(() => {
            const runs = cmnt.commentRenderer?.publishedTimeText?.runs;
            if (!Array.isArray(runs)) return undefined;
            return runs.map((run: any) => {
                const text = wrapTryCatch(() => run?.text);
                return typeof text !== 'undefined' ? { text } : {};
            });
        });

        const preservedContentRuns = wrapTryCatch(() => {
            const runs = cmnt.commentRenderer?.contentText?.runs;
            if (!Array.isArray(runs)) return undefined;
            return runs.map((run: any) => {
                const runCopy: any = {};
                const text = wrapTryCatch(() => run?.text);
                if (typeof text !== 'undefined') {
                    runCopy.text = text;
                }
                const navigationEndpoint = wrapTryCatch(() => run?.navigationEndpoint);
                if (navigationEndpoint) {
                    runCopy.navigationEndpoint = navigationEndpoint;
                }
                return runCopy;
            });
        });

        const preservedVoteCount = wrapTryCatch(() => {
            const voteCount = cmnt.commentRenderer?.voteCount;
            if (!voteCount) return undefined;
            const copy: any = {};
            const simpleText = wrapTryCatch(() => voteCount.simpleText);
            if (typeof simpleText !== 'undefined') {
                copy.simpleText = simpleText;
            }
            const runs = wrapTryCatch(() => voteCount.runs);
            if (Array.isArray(runs)) {
                copy.runs = runs.map((run: any) => {
                    const runCopy: any = {};
                    const text = wrapTryCatch(() => run?.text);
                    if (typeof text !== 'undefined') {
                        runCopy.text = text;
                    }
                    return runCopy;
                });
            }
            return copy;
        });

        if (wrapTryCatch(() => cmnt.commentRenderer?.actionButtons?.commentActionButtonsRenderer?.creatorHeart)) {
            try {
                cmnt.commentRenderer.creatorHeart = {
                    tooltip:
                        wrapTryCatch(
                            () =>
                                cmnt.commentRenderer.actionButtons.commentActionButtonsRenderer.creatorHeart
                                    .creatorHeartRenderer.heartIcon.tooltip
                        ) ||
                        wrapTryCatch(
                            () =>
                                cmnt.commentRenderer.actionButtons.commentActionButtonsRenderer.creatorHeart
                                    .creatorHeartRenderer.creatorThumbnail.accessibility.accessibilityData.label
                        )
                };
            } catch (err) {
                console.error(err);
            }
        }

        // Extract verified status from authorCommentBadge before deletion (legacy format fallback)
        if (
            wrapTryCatch(() => {
                const iconType =
                    cmnt.commentRenderer.authorCommentBadge?.authorCommentBadgeRenderer?.icon?.iconType || '';
                return iconType.indexOf('CHECK') >= 0 || iconType.indexOf('OFFICIAL_ARTIST_BADGE') >= 0;
            }) ||
            wrapTryCatch(() => {
                const tooltip = cmnt.commentRenderer.authorCommentBadge?.authorCommentBadgeRenderer?.iconTooltip || '';
                const lowerTooltip = typeof tooltip === 'string' ? tooltip.toLowerCase() : '';
                return lowerTooltip.includes('verified') || lowerTooltip.includes('official');
            })
        ) {
            cmnt.commentRenderer.verifiedAuthor = true;
        }

        wrapTryCatch(() => delete cmnt.commentRenderer.actionButtons);
        wrapTryCatch(() => delete cmnt.commentRenderer.expandButton);
        wrapTryCatch(() => delete cmnt.commentRenderer.surveyTooltipRenderer);
        wrapTryCatch(() => delete cmnt.commentRenderer.voteButton);
        wrapTryCatch(() => delete cmnt.commentRenderer.replyButton);
        wrapTryCatch(() => delete cmnt.commentRenderer.viewReplies);
        wrapTryCatch(() => delete cmnt.commentRenderer.collapsedReplies);
        wrapTryCatch(() => delete cmnt.commentRenderer.voteCount);
        wrapTryCatch(() => delete cmnt.commentRenderer.commentRuns);
        wrapTryCatch(() => delete cmnt.commentRenderer.navigationEndpoint);
        wrapTryCatch(() => delete cmnt.commentRenderer.sharedWith);
        wrapTryCatch(() => delete cmnt.commentRenderer.voteState);
        wrapTryCatch(() => delete cmnt.commentRenderer.actionMenu);
        wrapTryCatch(() => delete cmnt.commentRenderer.loggingDirectives);
        wrapTryCatch(() => delete cmnt.commentRenderer.voteStatus);
        wrapTryCatch(() => delete cmnt.commentRenderer.trackingParams);
        wrapTryCatch(() => delete cmnt.commentRenderer.isLiked);

        wrapTryCatch(() => delete cmnt.commentRenderer.analyticsTrackingParams);

        wrapTryCatch(() => delete cmnt.commentRenderer.authorText.accessibility);

        wrapTryCatch(() => delete cmnt.commentRenderer.authorCommentBadge);

        wrapTryCatch(() => delete cmnt.commentRenderer.authorThumbnail.thumbnails[0].width);
        wrapTryCatch(() => delete cmnt.commentRenderer.authorThumbnail.thumbnails[0].height);
        wrapTryCatch(() => delete cmnt.commentRenderer.authorThumbnail.thumbnails[0].thumbnail);
        wrapTryCatch(() => delete cmnt.commentRenderer.authorThumbnail.accessibility);
        wrapTryCatch(() => {
            if (cmnt.commentRenderer.authorThumbnail.thumbnails.length > 1) {
                cmnt.commentRenderer.authorThumbnail.thumbnails.length = 1;
            }
        });

        wrapTryCatch(() => delete cmnt.commentRenderer.authorEndpoint.clickTrackingParams);
        wrapTryCatch(() => delete cmnt.commentRenderer.commentSimpleboxEndpoint);
        wrapTryCatch(() => delete cmnt.commentRenderer.commentActionButtonsRenderer);

        wrapTryCatch(
            () =>
                delete cmnt.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.commandMetadata
                    .webCommandMetadata.webPageType
        );

        wrapTryCatch(
            () => delete cmnt.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.watchEndpoint.params
        );

        wrapTryCatch(() => delete cmnt.commentRenderer.authorEndpoint.commandMetadata.webCommandMetadata.apiUrl);
        wrapTryCatch(() => delete cmnt.commentRenderer.authorEndpoint.commandMetadata.webCommandMetadata.rootVe);
        wrapTryCatch(() => delete cmnt.commentRenderer.authorEndpoint.commandMetadata.webCommandMetadata.webPageType);

        wrapTryCatch(
            () => delete cmnt.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.clickTrackingParams
        );

        wrapTryCatch(() => {
            const runs = cmnt.commentRenderer?.contentText?.runs;
            if (!Array.isArray(runs)) return;
            for (const [i, textPart] of runs.entries()) {
                if (!textPart) continue;
                const originalText = wrapTryCatch(() => textPart?.text);
                const navEndpoint = wrapTryCatch(() => textPart?.navigationEndpoint);
                if (navEndpoint) {
                    wrapTryCatch(
                        () =>
                            delete cmnt.commentRenderer.contentText.runs[i].navigationEndpoint.commandMetadata
                                .webCommandMetadata.apiUrl
                    );
                    wrapTryCatch(
                        () =>
                            delete cmnt.commentRenderer.contentText.runs[i].navigationEndpoint.commandMetadata
                                .webCommandMetadata.rootVe
                    );
                    wrapTryCatch(
                        () =>
                            delete cmnt.commentRenderer.contentText.runs[i].navigationEndpoint.commandMetadata
                                .webCommandMetadata.webPageType
                    );

                    wrapTryCatch(
                        () => delete cmnt.commentRenderer.contentText.runs[i].navigationEndpoint.clickTrackingParams
                    );

                    if (typeof originalText !== 'undefined') {
                        cmnt.commentRenderer.contentText.runs[i].text = originalText;
                    }
                } else {
                    cmnt.commentRenderer.contentText.runs[i] = {};
                    if (typeof originalText !== 'undefined') {
                        cmnt.commentRenderer.contentText.runs[i].text = originalText;
                    }
                }
            }
        });

        if (preservedAuthorText) {
            cmnt.commentRenderer.authorText = cmnt.commentRenderer.authorText || {};
            if (typeof preservedAuthorText.simpleText !== 'undefined') {
                cmnt.commentRenderer.authorText.simpleText = preservedAuthorText.simpleText;
            }
            if (Array.isArray(preservedAuthorText.runs)) {
                cmnt.commentRenderer.authorText.runs = preservedAuthorText.runs.map((run: any, index: number) => {
                    const sanitized =
                        (cmnt.commentRenderer.authorText?.runs || [])[index] &&
                        typeof (cmnt.commentRenderer.authorText?.runs || [])[index] === 'object'
                            ? { ...(cmnt.commentRenderer.authorText?.runs || [])[index] }
                            : {};
                    if (run?.navigationEndpoint) {
                        sanitized.navigationEndpoint = run.navigationEndpoint;
                    }
                    if (typeof run?.text !== 'undefined') {
                        sanitized.text = run.text;
                    }
                    if (typeof run?.simpleText !== 'undefined') {
                        sanitized.simpleText = run.simpleText;
                    }
                    return sanitized;
                });
            }
        }

        if (preservedAuthorEndpoint) {
            cmnt.commentRenderer.authorEndpoint = cmnt.commentRenderer.authorEndpoint || {};
            if (typeof preservedAuthorEndpoint.url !== 'undefined') {
                cmnt.commentRenderer.authorEndpoint.commandMetadata = {
                    webCommandMetadata: { url: preservedAuthorEndpoint.url }
                };
            }
            if (
                typeof preservedAuthorEndpoint.browseId !== 'undefined' ||
                typeof preservedAuthorEndpoint.canonicalBaseUrl !== 'undefined'
            ) {
                cmnt.commentRenderer.authorEndpoint.browseEndpoint = {
                    ...(typeof preservedAuthorEndpoint.browseId !== 'undefined'
                        ? { browseId: preservedAuthorEndpoint.browseId }
                        : {}),
                    ...(typeof preservedAuthorEndpoint.canonicalBaseUrl !== 'undefined'
                        ? { canonicalBaseUrl: preservedAuthorEndpoint.canonicalBaseUrl }
                        : {})
                };
            }
        }

        if (Array.isArray(preservedPublishedTimeTextRuns)) {
            cmnt.commentRenderer.publishedTimeText = cmnt.commentRenderer.publishedTimeText || {};
            const sanitizedRuns =
                Array.isArray(cmnt.commentRenderer.publishedTimeText.runs) &&
                cmnt.commentRenderer.publishedTimeText.runs.length === preservedPublishedTimeTextRuns.length
                    ? cmnt.commentRenderer.publishedTimeText.runs
                    : new Array(preservedPublishedTimeTextRuns.length).fill({});
            cmnt.commentRenderer.publishedTimeText.runs = preservedPublishedTimeTextRuns.map(
                (run: any, index: number) => {
                    const sanitized =
                        sanitizedRuns[index] && typeof sanitizedRuns[index] === 'object'
                            ? { ...sanitizedRuns[index] }
                            : {};
                    if (typeof run?.text !== 'undefined') {
                        sanitized.text = run.text;
                    }
                    return sanitized;
                }
            );
        }

        if (Array.isArray(preservedContentRuns)) {
            cmnt.commentRenderer.contentText = cmnt.commentRenderer.contentText || {};
            const sanitizedRuns =
                Array.isArray(cmnt.commentRenderer.contentText.runs) &&
                cmnt.commentRenderer.contentText.runs.length === preservedContentRuns.length
                    ? cmnt.commentRenderer.contentText.runs
                    : new Array(preservedContentRuns.length).fill({});
            cmnt.commentRenderer.contentText.runs = preservedContentRuns.map((run: any, index: number) => {
                const sanitized =
                    sanitizedRuns[index] && typeof sanitizedRuns[index] === 'object' ? { ...sanitizedRuns[index] } : {};
                if (typeof run?.text !== 'undefined') {
                    sanitized.text = run.text;
                }
                if (run?.navigationEndpoint) {
                    sanitized.navigationEndpoint = run.navigationEndpoint;
                }
                return sanitized;
            });
        }

        if (
            preservedVoteCount &&
            (typeof preservedVoteCount.simpleText !== 'undefined' || Array.isArray(preservedVoteCount.runs))
        ) {
            const sanitized: any = {};
            if (typeof preservedVoteCount.simpleText !== 'undefined') {
                sanitized.simpleText = preservedVoteCount.simpleText;
            }
            if (Array.isArray(preservedVoteCount.runs)) {
                sanitized.runs = preservedVoteCount.runs.map((run: any) => {
                    const runCopy: any = {};
                    if (typeof run?.text !== 'undefined') {
                        runCopy.text = run.text;
                    }
                    return runCopy;
                });
            }
            cmnt.commentRenderer.voteCount = sanitized;
        }

        return cmnt;
    } catch (err) {
        console.error(err);
        return cmnt;
    }
}

function enrichCommentRenderer(comment: any, currentVideoId: string, originComment?: any, type: 'C' | 'R' = 'C'): any {
    if (!comment?.commentRenderer) return undefined;

    try {
        const contentText = comment.commentRenderer.contentText || {};
        const runs = contentText?.runs || [];
        const formatted = formatCommentRuns(runs, currentVideoId);
        const existingFullText = (contentText as any).fullText || '';
        const computedFullText = formatted.fullText || existingFullText || '';
        contentText.fullText = computedFullText;
        contentText.renderFullText =
            formatted.renderFullText || (contentText as any).renderFullText || computedFullText;
        comment.commentRenderer.contentText = contentText;
        if (formatted.isTimeline) {
            comment.commentRenderer.isTimeLine = 'timeline';
        }
    } catch (e) {
        console.error(e);
    }

    comment.typeComment = type;
    if (originComment) {
        comment.originComment = originComment;
    }

    return prepareFieldsComment(comment);
}

export function processParentComment(params: ProcessParentCommentParams): ProcessParentCommentResult {
    const { item, frameworkUpdates, currentVideoId } = params;
    const collected: any[] = [];
    const replyContinuations: ReplyContinuation[] = [];

    try {
        let baseComment: any | undefined;

        if (wrapTryCatch(() => item.commentThreadRenderer?.comment)) {
            baseComment = item.commentThreadRenderer.comment;
            applyFrameworkUpdatesToComment(baseComment, item, frameworkUpdates);
            const prepared = enrichCommentRenderer(baseComment, currentVideoId, undefined, 'C');
            if (prepared) {
                // Set replyLevel for parent comment
                const parentCommentId = wrapTryCatch(() => prepared.commentRenderer?.commentId);
                const parentFwUpdate = parentCommentId ? frameworkUpdates[parentCommentId] : undefined;
                prepared.replyLevel = wrapTryCatch(() => parentFwUpdate?.properties?.replyLevel) ?? 0;

                collected.push(prepared);
                const continuation = extractReplyContinuationFromItem(item);
                if (continuation.token) {
                    replyContinuations.push({
                        token: continuation.token,
                        clickTrackingParams: continuation.cTrParams,
                        originComment: prepared
                    });
                }
                const replies =
                    wrapTryCatch(
                        () =>
                            item.commentThreadRenderer.replies.commentRepliesRenderer.contents ||
                            item.commentThreadRenderer.replies.commentRepliesRenderer.continuationItems
                    ) || [];
                for (let reply of replies) {
                    if (!reply) continue;
                    if (!reply.commentRenderer) {
                        const normalized = normalizeCommentViewModel(reply);
                        if (normalized?.commentRenderer) {
                            reply = normalized;
                        }
                    }
                    applyFrameworkUpdatesToComment(reply, reply, frameworkUpdates);
                    const preparedReply = enrichCommentRenderer(reply, currentVideoId, prepared, 'R');
                    if (preparedReply) {
                        // Set replyLevel for direct replies
                        const replyId = wrapTryCatch(() => preparedReply.commentRenderer?.commentId);
                        const replyFwUpdate = replyId ? frameworkUpdates[replyId] : undefined;
                        preparedReply.replyLevel = wrapTryCatch(() => replyFwUpdate?.properties?.replyLevel) ?? 1;
                        collected.push(preparedReply);
                    }
                }

                // Process subThreads for nested replies
                const repliesRenderer = wrapTryCatch(() => item.commentThreadRenderer.replies?.commentRepliesRenderer);
                if (repliesRenderer?.subThreads) {
                    const subThreadResult = extractSubThreads(repliesRenderer, frameworkUpdates, prepared, 1);

                    // Re-evaluate parent replyCount if absolutely nothing was found
                    if (
                        replies.length === 0 &&
                        subThreadResult.comments.length === 0 &&
                        subThreadResult.continuations.length === 0 &&
                        replyContinuations.length === 0
                    ) {
                        if (prepared.commentRenderer) {
                            prepared.commentRenderer.replyCount = 0;
                        }
                    }

                    // Enrich subThread comments
                    for (const subComment of subThreadResult.comments) {
                        const enriched = enrichCommentRenderer(
                            subComment,
                            currentVideoId,
                            subComment.originComment,
                            'R'
                        );
                        if (enriched) {
                            const subCommentId = wrapTryCatch(() => enriched.commentRenderer?.commentId);
                            const subFwUpdate = subCommentId ? frameworkUpdates[subCommentId] : undefined;
                            enriched.replyLevel =
                                wrapTryCatch(() => subFwUpdate?.properties?.replyLevel) ??
                                subComment._subThreadDepth ??
                                1;
                            delete enriched._subThreadDepth;
                            collected.push(enriched);
                        }
                    }

                    // Add subThread continuations
                    replyContinuations.push(...subThreadResult.continuations);
                }
            }
        } else if (
            wrapTryCatch(() => item.commentThreadRenderer?.commentViewModel) ||
            wrapTryCatch(() => item.commentViewModel)
        ) {
            const normalized = normalizeCommentViewModel(item);
            if (normalized) {
                applyFrameworkUpdatesToComment(normalized, item, frameworkUpdates);
                const prepared = enrichCommentRenderer(normalized, currentVideoId, undefined, 'C');
                if (prepared) {
                    // Set replyLevel for parent comment
                    const parentCommentId = wrapTryCatch(() => prepared.commentRenderer?.commentId);
                    const parentFwUpdate = parentCommentId ? frameworkUpdates[parentCommentId] : undefined;
                    prepared.replyLevel = wrapTryCatch(() => parentFwUpdate?.properties?.replyLevel) ?? 0;

                    collected.push(prepared);
                    const continuation = extractReplyContinuationFromItem(item);
                    if (continuation.token) {
                        replyContinuations.push({
                            token: continuation.token,
                            clickTrackingParams: continuation.cTrParams,
                            originComment: prepared
                        });
                    }

                    // Process subThreads for nested replies (new format)
                    const repliesRenderer = wrapTryCatch(
                        () => item.commentThreadRenderer?.replies?.commentRepliesRenderer
                    );
                    if (repliesRenderer?.subThreads) {
                        const subThreadResult = extractSubThreads(repliesRenderer, frameworkUpdates, prepared, 1);

                        // Re-evaluate parent replyCount
                        if (
                            subThreadResult.comments.length === 0 &&
                            subThreadResult.continuations.length === 0 &&
                            replyContinuations.length === 0
                        ) {
                            if (prepared.commentRenderer) {
                                prepared.commentRenderer.replyCount = 0;
                            }
                        }

                        // Enrich subThread comments
                        for (const subComment of subThreadResult.comments) {
                            const enriched = enrichCommentRenderer(
                                subComment,
                                currentVideoId,
                                subComment.originComment,
                                'R'
                            );
                            if (enriched) {
                                const subCommentId = wrapTryCatch(() => enriched.commentRenderer?.commentId);
                                const subFwUpdate = subCommentId ? frameworkUpdates[subCommentId] : undefined;
                                enriched.replyLevel =
                                    wrapTryCatch(() => subFwUpdate?.properties?.replyLevel) ??
                                    subComment._subThreadDepth ??
                                    1;
                                delete enriched._subThreadDepth;
                                collected.push(enriched);
                            }
                        }

                        // Add subThread continuations
                        replyContinuations.push(...subThreadResult.continuations);
                    }
                }
            }
        }
    } catch (e) {
        console.error(e);
    }

    return { comments: collected, replyContinuations };
}

export function scheduleReplyFetches(params: ScheduleReplyFetchParams): void {
    const { continuations, queue, fetchContinuation, currentVideoId, onReply } = params;
    if (!continuations || continuations.length === 0) {
        return;
    }

    const seenTokens = new Set<string>();
    const stats = params.stats;

    const scheduleContinuation = (cont: ReplyContinuation | SubThreadContinuation): void => {
        if (stats) stats.total += 1;
        const token = (cont as any)?.token;
        if (token && seenTokens.has(token)) {
            if (stats) stats.skipped += 1;
            return;
        }
        if (token) {
            seenTokens.add(token);
            if (stats) stats.unique += 1;
        } else {
            if (stats) stats.tokenless += 1;
        }

        const task = queue.add(async () => {
            try {
                const batch = await fetchContinuation(cont);
                if (!batch) return;
                const fwById = batch.frameworkUpdates || {};
                for (const item of batch.comments || []) {
                    let comment = item;
                    if (wrapTryCatch(() => item.commentThreadRenderer?.comment)) {
                        comment = item.commentThreadRenderer.comment;
                    }

                    if (!comment?.commentRenderer) {
                        const normalized = normalizeCommentViewModel(comment);
                        if (normalized && normalized.commentRenderer) comment = normalized;
                    }
                    if (!comment?.commentRenderer) continue;
                    applyFrameworkUpdatesToComment(comment, comment, fwById);
                    const prepared = enrichCommentRenderer(comment, currentVideoId, cont.originComment, 'R');
                    if (prepared) {
                        // Extract replyLevel from FW or use continuation's replyLevel
                        const commentId = wrapTryCatch(() => prepared.commentRenderer?.commentId);
                        const fwUpdate = commentId ? fwById[commentId] : undefined;
                        prepared.replyLevel =
                            wrapTryCatch(() => fwUpdate?.properties?.replyLevel) ??
                            ('replyLevel' in cont ? (cont as SubThreadContinuation).replyLevel : 1);

                        try {
                            onReply(prepared);
                        } catch (callbackError) {
                            console.error(callbackError);
                        }

                        // Process subThreads from the original item (commentThreadRenderer)
                        const repliesRenderer = wrapTryCatch(
                            () => item.commentThreadRenderer?.replies?.commentRepliesRenderer
                        );
                        if (repliesRenderer?.subThreads) {
                            const subThreadResult = extractSubThreads(
                                repliesRenderer,
                                fwById,
                                prepared, // Use the prepared comment as parent
                                1 // subThread extraction starts at relative depth 1
                            );

                            // Re-evaluate current replyCount
                            if (subThreadResult.comments.length === 0 && subThreadResult.continuations.length === 0) {
                                if (prepared.commentRenderer) {
                                    prepared.commentRenderer.replyCount = 0;
                                }
                            }

                            for (const subComment of subThreadResult.comments) {
                                const subPrepared = enrichCommentRenderer(
                                    subComment,
                                    currentVideoId,
                                    subComment.originComment,
                                    'R'
                                );
                                if (subPrepared) {
                                    const subCommentId = wrapTryCatch(() => subPrepared.commentRenderer?.commentId);
                                    const subFwUpdate = subCommentId ? fwById[subCommentId] : undefined;

                                    // Calculate replyLevel: Parent Level + Relative Depth
                                    subPrepared.replyLevel =
                                        wrapTryCatch(() => subFwUpdate?.properties?.replyLevel) ??
                                        (prepared.replyLevel || 1) + (subComment._subThreadDepth || 1);

                                    delete subPrepared._subThreadDepth;
                                    onReply(subPrepared);
                                }
                            }

                            for (const subCont of subThreadResult.continuations) {
                                scheduleContinuation(subCont);
                            }
                        }
                    }
                }
                for (const next of batch.continuations || []) {
                    // Preserve replyLevel from SubThreadContinuation if present
                    const nextCont: ReplyContinuation | SubThreadContinuation = {
                        ...next,
                        originComment: cont.originComment
                    };
                    if ('replyLevel' in cont) {
                        (nextCont as SubThreadContinuation).replyLevel = (cont as SubThreadContinuation).replyLevel;
                    }
                    scheduleContinuation(nextCont);
                }
            } catch (error) {
                console.error(error);
            }
        });

        void task.catch((err) => {
            console.error(err);
        });
    };

    for (const continuation of continuations) {
        scheduleContinuation(continuation);
    }
}

export function dedupeParentComments(comments: any[]): any[] {
    const seenCommentIds = new Set<string>();
    const deduplicated: any[] = [];

    for (const cm of comments) {
        // Try to get commentId from various possible locations
        const id = wrapTryCatch(() => cm.commentRenderer?.commentId) || wrapTryCatch(() => cm.commentId);

        if (id) {
            if (!seenCommentIds.has(id)) {
                seenCommentIds.add(id);
                deduplicated.push(cm);
            }
        } else {
            // Keep items without IDs (fallback)
            deduplicated.push(cm);
        }
    }

    // Restore parent-child relationships after deduplication
    // This is needed because 'originComment' references might point to objects
    // that were discarded as duplicates.
    const commentMap = new Map<string, any>();
    for (const cm of deduplicated) {
        const id = wrapTryCatch(() => cm.commentRenderer?.commentId);
        if (id) {
            commentMap.set(id, cm);
        }
    }

    for (const cm of deduplicated) {
        if (cm.typeComment === 'R' && cm.originComment) {
            const originId = wrapTryCatch(() => cm.originComment.commentRenderer?.commentId);
            if (originId && commentMap.has(originId)) {
                // Re-link to the preserved parent instance
                cm.originComment = commentMap.get(originId);
            }
        }
    }

    return deduplicated;
}

/**
 * Validates that cached ytInitialData matches current video
 * Clears cache if mismatch detected
 *
 * @param currentVideoId - The video ID to validate against
 * @returns true if cached data is valid, false otherwise
 */
function validateCachedYtData(currentVideoId: string): boolean {
    const ytData = (GlobalStore as any).getInitYtData;
    if (!ytData) {
        return false;
    }

    const storedVideoId = extractVideoId();

    if (!storedVideoId) {
        console.log('[YCS] Cached ytInitialData missing videoId; keeping existing cache');
        return false;
    }

    if (storedVideoId !== currentVideoId) {
        console.log(`[YCS] VideoId mismatch (stored: ${storedVideoId}, current: ${currentVideoId}), clearing cache`);
        (GlobalStore as any).getInitYtData = undefined;
        clearCurrentVideoMemberOnly();
        clearCurrentVideoAgeRestricted();
        return false;
    }

    return true;
}

/**
 * Ensures member-only status is set for current video
 * Fetches ytInitialData if needed
 *
 * @param windowRef - Window reference
 * @param currentVideoId - Current video ID
 * @param signal - Optional abort signal
 */
async function ensureMemberOnlyStatus(
    windowRef: Window & typeof globalThis,
    currentVideoId: string,
    signal?: AbortSignal
): Promise<void> {
    // Already set
    if ((GlobalStore as any).isMemberOnly !== undefined) {
        return;
    }

    console.log(`[YCS] Ensuring member-only status for video: ${currentVideoId}`);

    // Try cached data first
    if (validateCachedYtData(currentVideoId)) {
        const ytData = (GlobalStore as any).getInitYtData;
        updateAccessRestrictionStatus(ytData);
        return;
    }

    // Fetch if needed - getInitYtData already calls updateAccessRestrictionStatus internally
    try {
        await getInitYtData(windowRef.location.href, signal as AbortSignal, windowRef);
    } catch (error) {
        console.error('[YCS] Failed to fetch ytInitialData:', error);
    }
}

async function getDetailsVideoIDV2(
    w: Window & typeof globalThis,
    url: string,
    signal: AbortSignal
): Promise<object | undefined> {
    try {
        if (typeof url !== 'string') return;

        const ytcfgData = await getPageCfgData(w, signal, url);
        const videoId = getVideoId(url);

        const params: RequestInit = {
            headers: buildInnertubeHeaders(ytcfgData, {}, w, { disableAuth: shouldDisableAuth() }),
            referrer: url,
            referrerPolicy: 'strict-origin-when-cross-origin',
            body: JSON.stringify(
                buildInnertubeBody({
                    ytcfgData,
                    videoId
                })
            ),
            method: 'POST',
            mode: 'cors',
            credentials: 'include'
        };

        const res = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${getInnertubeApiKey()}`, {
            ...params,
            signal,
            cache: 'no-store'
        });

        const data = await res.json();

        return data;
    } catch (err) {
        console.error(err);
        return;
    }
}

async function getDetailsCommentsVideoIDV2(
    w: Window & typeof globalThis,
    ps: any,
    signal: AbortSignal
): Promise<object | undefined> {
    try {
        if (typeof ps !== 'object') return;

        const ytcfgData = await getPageCfgData(w, signal, ps?.url);

        const params: RequestInit = {
            headers: buildInnertubeHeaders(ytcfgData, {}, w, { disableAuth: shouldDisableAuth() }),
            referrer: ps.url,
            referrerPolicy: 'strict-origin-when-cross-origin',
            body: JSON.stringify(
                buildInnertubeBody({
                    ytcfgData,
                    continuation: ps.continue,
                    clickTrackingParams: ''
                })
            ),
            method: 'POST',
            mode: 'cors',
            credentials: 'include'
        };

        const res = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${getInnertubeApiKey()}`, {
            ...params,
            signal,
            cache: 'no-store'
        });

        const data = await res.json();

        return data;
    } catch (err) {
        console.error(err);
        return;
    }
}

async function getParamsForComments(
    w: Window & typeof globalThis,
    params: any,
    signal?: AbortSignal
): Promise<object | undefined> {
    try {
        const ytcfgData = await getPageCfgData(w, signal, params?.url);

        const clickTrackingParams = params?.clickTrackingParams ?? params?.clickTracking;
        const bodyPayload = buildInnertubeBody({
            ytcfgData,
            continuation: params?.continue,
            clickTrackingParams: clickTrackingParams ?? undefined
        });

        // Update access restriction status if not set yet
        if ((GlobalStore as any).isMemberOnly === undefined) {
            const ytData: any = (GlobalStore as any).getInitYtData;
            if (ytData) {
                console.log(
                    '[YCS] [Comments] getParamsForComments: Using GlobalStore.getInitYtData for access restriction check'
                );
                updateAccessRestrictionStatus(ytData);
            } else {
                console.log(
                    "[YCS] [Comments] getParamsForComments: No ytInitialData available, will use conservative strategy (don't send Authorization to reduce request size)"
                );
            }
        }

        const headers = buildInnertubeHeaders(ytcfgData, {}, w, { disableAuth: shouldDisableAuth() });

        return {
            headers,
            referrerPolicy: 'strict-origin-when-cross-origin',
            body: JSON.stringify(bodyPayload),
            method: 'POST',
            mode: 'cors',
            credentials: 'include'
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

async function getParamsForReplies(
    w: Window & typeof globalThis,
    params: any,
    signal?: AbortSignal
): Promise<object | undefined> {
    try {
        const ytcfgData = await getPageCfgData(w, signal, params?.url);

        const clickTrackingParams = params?.clickTracking ?? params?.clickTrackingParams;
        const bodyPayload = buildInnertubeBody({
            ytcfgData,
            continuation: params?.continue,
            clickTrackingParams: clickTrackingParams ?? undefined
        });

        return {
            headers: buildInnertubeHeaders(ytcfgData, {}, w, { disableAuth: shouldDisableAuth() }),
            referrerPolicy: 'strict-origin-when-cross-origin',
            body: JSON.stringify(bodyPayload),
            method: 'POST',
            mode: 'cors',
            credentials: 'include'
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

async function fetchCommentPage(
    windowRef: Window & typeof globalThis,
    signal: AbortSignal | undefined,
    continuation?: CommentContinuation,
    sortOrder: CommentSortOrder = CommentSortOrder.TopComments
): Promise<{ response?: any; params?: RequestInit } | undefined> {
    try {
        let paramsCmnts;
        if (continuation) {
            // Ensure members-only status is updated before calling getParamsForComments
            const videoId = getVideoId(windowRef.location.href);
            if (videoId) {
                await ensureMemberOnlyStatus(windowRef, videoId, signal);
            }

            const continuationParams = {
                continue: (continuation as any).continue ?? continuation.token,
                clickTrackingParams:
                    (continuation as any).clickTrackingParams ??
                    (continuation as any).clickTracking ??
                    continuation.clickTrackingParams
            };
            paramsCmnts = await getParamsForComments(windowRef, continuationParams, signal);
        } else {
            const url = getCleanUrlVideo(windowRef.location.href) as string;
            const currentVideoId = getVideoId(windowRef.location.href);

            // Ensure members-only status is set before calling getDetailsVideoIDV2/getDetailsCommentsVideoIDV2
            if (currentVideoId) {
                await ensureMemberOnlyStatus(windowRef, currentVideoId, signal);
            }

            const detailsVideoV2 = await getDetailsVideoIDV2(windowRef, url, signal as AbortSignal);
            const detailsVideoV2Token = objectScan(
                [
                    '**.contents.twoColumnWatchNextResults.results.results.contents[?].itemSectionRenderer.contents[?].continuationItemRenderer.continuationEndpoint.continuationCommand.token'
                ],
                { joined: true, rtn: 'value', abort: true }
            )(detailsVideoV2);
            const detailsCmntsVIDV2 = await getDetailsCommentsVideoIDV2(
                windowRef,
                {
                    url,
                    continue: detailsVideoV2Token
                },
                signal as AbortSignal
            );

            const findPtrn = [
                `**.sortFilterSubMenuRenderer.subMenuItems[${sortOrder}].serviceEndpoint.clickTrackingParams`,
                `**.sortFilterSubMenuRenderer.subMenuItems[${sortOrder}].serviceEndpoint.continuationCommand.command.clickTrackingParams`,
                `**.sortFilterSubMenuRenderer.subMenuItems[${sortOrder}].trackingParams`
            ];

            let tokenComments;
            for (const ptrn of findPtrn) {
                try {
                    tokenComments = objectScan([`${ptrn}`], { joined: true, rtn: 'value', abort: true })(
                        detailsCmntsVIDV2
                    );
                    if (tokenComments) break;
                } catch (err) {
                    console.error(err);
                    continue;
                }
            }

            // Phase 2: Use GlobalStore.getInitYtData instead of window.ytInitialData
            // currentVideoId already declared above

            // Try to get token from detailsCmntsVIDV2 first
            let continuationToken = wrapTryCatch(() =>
                objectScan(
                    [
                        `**.sortFilterSubMenuRenderer.subMenuItems[${sortOrder}].serviceEndpoint.continuationCommand.token`
                    ],
                    {
                        joined: true,
                        rtn: 'value',
                        abort: true
                    }
                )(detailsCmntsVIDV2)
            ) as string | undefined;

            if (continuationToken) {
                console.log(`[YCS] ✓ Got continuation token from detailsCmntsVIDV2 for video: ${currentVideoId}`);
            } else {
                console.warn(`[YCS] ✗ detailsCmntsVIDV2 token not found for video: ${currentVideoId}`);

                // Fallback: Use GlobalStore.getInitYtData
                let globalYtData = (GlobalStore as any).getInitYtData;
                let needsFetch = false;

                // Check if GlobalStore exists and has sufficient data
                if (!globalYtData) {
                    needsFetch = true;
                    console.log(
                        `[YCS] 📥 GlobalStore.getInitYtData not available, will fetch for video: ${currentVideoId}`
                    );
                } else {
                    // Validate GlobalStore has necessary data structure
                    const ytDataSource = Array.isArray(globalYtData)
                        ? globalYtData.find((item: any) => item?.response || item?.contents)
                        : globalYtData;

                    const hasSortFilterMenu = wrapTryCatch(() =>
                        objectScan(['**.sortFilterSubMenuRenderer'], { joined: true, rtn: 'value', abort: true })(
                            ytDataSource
                        )
                    );

                    if (!hasSortFilterMenu) {
                        needsFetch = true;
                        console.log(
                            `[YCS] 📥 GlobalStore.getInitYtData exists but lacks sortFilterSubMenuRenderer data (likely from cache restore), will refetch for video: ${currentVideoId}`
                        );
                    }

                    // Validate videoId to prevent cross-video data pollution
                    if (!needsFetch) {
                        const storedVideoId = extractVideoId();
                        if (storedVideoId && storedVideoId !== currentVideoId) {
                            needsFetch = true;
                            globalYtData = undefined; // Clear local variable
                            (GlobalStore as any).getInitYtData = undefined; // Clear GlobalStore to prevent reuse in subsequent logic
                            console.log(
                                `[YCS] 📥 GlobalStore.getInitYtData contains mismatched videoId (stored: ${storedVideoId}, current: ${currentVideoId}), will refetch for video: ${currentVideoId}`
                            );
                        }
                    }
                }

                // Fetch ytInitialData if needed
                if (needsFetch) {
                    try {
                        globalYtData = await getInitYtData(windowRef.location.href, signal as AbortSignal, windowRef);
                        if (globalYtData) {
                            console.log(
                                `[YCS] ✓ Successfully fetched and populated GlobalStore.getInitYtData for video: ${currentVideoId}`
                            );
                            // Note: getInitYtData already calls updateAccessRestrictionStatus internally
                        }
                    } catch (error) {
                        console.error(
                            `[YCS] ✗ Failed to fetch GlobalStore.getInitYtData for video: ${currentVideoId}`,
                            error
                        );
                    }
                } else if (globalYtData) {
                    // If we're using cached data, ensure access restriction status is updated
                    updateAccessRestrictionStatus(globalYtData);
                }

                if (globalYtData) {
                    // Handle both array (legacy API) and object (new API) formats
                    const ytDataSource = Array.isArray(globalYtData)
                        ? globalYtData.find((item: any) => item?.response || item?.contents)
                        : globalYtData;

                    continuationToken = wrapTryCatch(() =>
                        objectScan(
                            [
                                `**.sortFilterSubMenuRenderer.subMenuItems[${sortOrder}].serviceEndpoint.continuationCommand.token`
                            ],
                            { joined: true, rtn: 'value', abort: true }
                        )(ytDataSource)
                    ) as string | undefined;

                    if (continuationToken) {
                        console.warn(
                            `[YCS] ⚠️  Using GlobalStore.getInitYtData fallback token for video: ${currentVideoId}`,
                            {
                                currentUrl: windowRef.location.href,
                                isArray: Array.isArray(globalYtData),
                                wasFetched: needsFetch
                            }
                        );
                    }
                } else {
                    console.warn(
                        `[YCS] ⚠️  GlobalStore.getInitYtData not available after fetch for video: ${currentVideoId}`
                    );
                }

                // Try HTML fallback for age-restricted videos when PBJ API fails
                if (!continuationToken) {
                    console.log(`[YCS] 📥 Attempting HTML fallback for video: ${currentVideoId}`);

                    try {
                        const htmlYtData = await getInitYtDataFromHtml(
                            windowRef.location.href,
                            signal as AbortSignal,
                            windowRef
                        );

                        if (htmlYtData) {
                            // Note: getInitYtDataFromHtml already calls updateAccessRestrictionStatus() internally
                            // So we don't need to update access restriction status here again

                            const ytDataSource = (htmlYtData as any).response || htmlYtData;

                            continuationToken = wrapTryCatch(() =>
                                objectScan(
                                    [
                                        `**.sortFilterSubMenuRenderer.subMenuItems[${sortOrder}].serviceEndpoint.continuationCommand.token`
                                    ],
                                    { joined: true, rtn: 'value', abort: true }
                                )(ytDataSource)
                            ) as string | undefined;

                            if (continuationToken) {
                                console.log(
                                    `[YCS] ✓ Got continuation token from HTML fallback for video: ${currentVideoId}`
                                );
                            } else {
                                console.warn(
                                    `[YCS] ⚠️ HTML fallback retrieved ytInitialData but no continuation token for video: ${currentVideoId}`
                                );
                            }
                        }
                    } catch (error) {
                        console.error(`[YCS] ✗ HTML fallback failed for video: ${currentVideoId}`, error);
                    }
                }

                if (!continuationToken) {
                    console.error(`[YCS] ✗ All token sources failed for video: ${currentVideoId}`);
                }
            }

            // ClickTrackingParams: try detailsCmntsVIDV2 first, then GlobalStore
            let clickTrackingParams = tokenComments;

            if (!clickTrackingParams) {
                // Fallback: Use GlobalStore (which may have been fetched above)
                const globalYtData = (GlobalStore as any).getInitYtData;

                if (globalYtData) {
                    // Handle both array (legacy API) and object (new API) formats
                    const ytDataSource = Array.isArray(globalYtData)
                        ? globalYtData.find((item: any) => item?.response || item?.contents)
                        : globalYtData;

                    clickTrackingParams = wrapTryCatch(() =>
                        objectScan(
                            [
                                `**.sortFilterSubMenuRenderer.subMenuItems[${sortOrder}].serviceEndpoint.clickTrackingParams`
                            ],
                            { joined: true, rtn: 'value', abort: true }
                        )(ytDataSource)
                    );
                }
            }

            // Log clickTrackingParams source
            if (tokenComments) {
                console.log(`[YCS] ✓ Using clickTrackingParams from detailsCmntsVIDV2 for video: ${currentVideoId}`);
            } else if (clickTrackingParams) {
                console.warn(
                    `[YCS] ⚠️  Using fallback clickTrackingParams from GlobalStore.getInitYtData for video: ${currentVideoId}`
                );
            } else {
                console.warn(`[YCS] ⚠️  No clickTrackingParams found for video: ${currentVideoId}`);
            }

            // Ensure access restriction status is updated before calling getParamsForComments
            if ((GlobalStore as any).isMemberOnly === undefined) {
                const finalYtData: any = (GlobalStore as any).getInitYtData;
                if (finalYtData) {
                    updateAccessRestrictionStatus(finalYtData);
                }
            }

            paramsCmnts = await getParamsForComments(
                windowRef,
                {
                    continue: continuationToken,
                    clickTrackingParams
                },
                signal
            );
        }

        if (!paramsCmnts) return undefined;

        const response = await fetchR(`https://www.youtube.com/youtubei/v1/next?key=${getInnertubeApiKey()}`, {
            ...paramsCmnts,
            signal,
            cache: 'no-store'
        } as RequestInit);
        return { response, params: paramsCmnts as RequestInit };
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

async function fetchPostPage(
    windowRef: Window & typeof globalThis,
    signal: AbortSignal | undefined,
    continuation?: CommentContinuation,
    sortOrder: CommentSortOrder = CommentSortOrder.NewestFirst
): Promise<{ response?: any; params?: RequestInit } | undefined> {
    try {
        let paramsCmnts;
        if (continuation) {
            const continuationParams = {
                continue: (continuation as any).continue ?? continuation.token,
                clickTrackingParams: ''
            };
            paramsCmnts = await getParamsForComments(windowRef, continuationParams, signal);
        } else {
            // Phase 1: Use ytInitialData from HTML to grab the continuation token from the post page
            const globalYtData = await getInitYtDataFromHtml(windowRef.location.href, signal as AbortSignal, windowRef);

            // Detect member-only status for community posts
            const isMemberOnly = isPostMemberOnlyFromYtInitialData(globalYtData);
            setCurrentVideoMemberOnly(isMemberOnly);

            const ytDataSource = Array.isArray(globalYtData)
                ? globalYtData.find((item: any) => item?.response || item?.contents)
                : globalYtData;
            // objectScan with ** traverses all nested levels, so wrapper objects are acceptable.
            const continuationToken = wrapTryCatch(() =>
                objectScan(['**.continuationItemRenderer.continuationEndpoint.continuationCommand.token'], {
                    joined: true,
                    rtn: 'value',
                    abort: true
                })(ytDataSource)
            ) as string | undefined;
            const clickTrackingParams = wrapTryCatch(() =>
                objectScan(['**.continuationItemRenderer.continuationEndpoint.clickTrackingParams'], {
                    joined: true,
                    rtn: 'value',
                    abort: true
                })(ytDataSource)
            ) as string | undefined;
            if (!continuationToken) {
                console.warn(
                    '[YCS] [Comments] fetchPostPage: continuation token not found in ytInitialData (wrapper is expected).'
                );
            }
            paramsCmnts = await getParamsForComments(
                windowRef,
                {
                    continue: continuationToken,
                    clickTrackingParams
                },
                signal
            );

            // Phase 2: Grab the continuation token of the comments based on sortOrder
            const response = await fetchR(`https://www.youtube.com/youtubei/v1/browse?key=${getInnertubeApiKey()}`, {
                ...paramsCmnts,
                signal,
                cache: 'no-store'
            } as RequestInit);
            const data = await response.json();
            const newContinuationToken = wrapTryCatch(() =>
                objectScan([`**.subMenuItems[${sortOrder}].serviceEndpoint.continuationCommand.token`], {
                    joined: true,
                    rtn: 'value',
                    abort: true
                })(data)
            ) as string | undefined;
            const newClickTrackingParams = wrapTryCatch(() =>
                objectScan(
                    [`**.subMenuItems[${sortOrder}].serviceEndpoint.continuationCommand.command.clickTrackingParams`],
                    {
                        joined: true,
                        rtn: 'value',
                        abort: true
                    }
                )(data)
            ) as string | undefined;
            paramsCmnts = await getParamsForComments(
                windowRef,
                {
                    continue: newContinuationToken,
                    clickTrackingParams: newClickTrackingParams
                },
                signal
            );
        }
        if (!paramsCmnts) return undefined;

        const response = await fetchR(`https://www.youtube.com/youtubei/v1/browse?key=${getInnertubeApiKey()}`, {
            ...paramsCmnts,
            signal,
            cache: 'no-store'
        } as RequestInit);
        return { response, params: paramsCmnts as RequestInit };
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

export async function fetchInitialCommentBatch(
    params: FetchInitialCommentBatchParams
): Promise<CommentBatchResult | undefined> {
    try {
        const sortOrder = params.sortOrder;
        const result = params.windowRef.location.href.includes('post')
            ? await fetchPostPage(params.windowRef, params.signal, undefined, sortOrder)
            : await fetchCommentPage(params.windowRef, params.signal, undefined, sortOrder);
        const response = result?.response;
        if (!response || response.status !== 200) return undefined;
        const data = await response.json();
        const frameworkUpdates = getFrameworkUpdatesById(data);
        const reloadItems =
            wrapTryCatch(() => data.onResponseReceivedEndpoints[1].reloadContinuationItemsCommand.continuationItems) ||
            [];
        const appendItems =
            wrapTryCatch(() => data.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems) ||
            [];
        const items = Array.isArray(reloadItems) && reloadItems.length > 0 ? reloadItems : appendItems;
        const comments = Array.isArray(items) ? migrateContinuationItemsWithFW(items, frameworkUpdates) : [];
        const next = extractNextContinuation({ onResponseReceivedEndpoints: data.onResponseReceivedEndpoints });
        const continuations = next.token ? [{ token: next.token, clickTrackingParams: next.clickTrackingParams }] : [];
        return { comments, continuations, frameworkUpdates };
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

export async function fetchContinuationBatch(params: FetchContinuationParams): Promise<CommentBatchResult | undefined> {
    try {
        const result = params.windowRef.location.href.includes('post')
            ? await fetchPostPage(params.windowRef, params.signal, params.continuation, params.sortOrder)
            : await fetchCommentPage(params.windowRef, params.signal, params.continuation, params.sortOrder);
        const response = result?.response;
        if (!response || response.status !== 200) return undefined;
        const data = await response.json();
        const frameworkUpdates = getFrameworkUpdatesById(data);
        const reloadItems =
            wrapTryCatch(() => data.onResponseReceivedEndpoints[1].reloadContinuationItemsCommand.continuationItems) ||
            [];
        const appendItems =
            wrapTryCatch(() => data.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems) ||
            [];
        const items = Array.isArray(reloadItems) && reloadItems.length > 0 ? reloadItems : appendItems;
        const comments = Array.isArray(items) ? migrateContinuationItemsWithFW(items, frameworkUpdates) : [];
        const next = extractNextContinuation({ onResponseReceivedEndpoints: data.onResponseReceivedEndpoints });
        const continuations = next.token ? [{ token: next.token, clickTrackingParams: next.clickTrackingParams }] : [];
        return { comments, continuations, frameworkUpdates };
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

export async function fetchRepliesBatch(params: FetchRepliesParams): Promise<CommentBatchResult | undefined> {
    try {
        const continuationParams = {
            continue: (params.continuation as any).continue ?? params.continuation.token,
            clickTrackingParams:
                (params.continuation as any).clickTrackingParams ??
                (params.continuation as any).clickTracking ??
                params.continuation.clickTrackingParams
        };
        const paramsCmnts = await getParamsForReplies(params.windowRef, continuationParams, params.signal);
        if (!paramsCmnts) return undefined;
        const baseUrl = params.windowRef.location.href.includes('post')
            ? 'https://www.youtube.com/youtubei/v1/browse'
            : 'https://www.youtube.com/youtubei/v1/next';
        const res = await fetchR(`${baseUrl}?key=${getInnertubeApiKey()}`, {
            ...paramsCmnts,
            signal: params.signal,
            cache: 'no-store'
        } as RequestInit);
        const data = await res.json();
        const frameworkUpdates = getFrameworkUpdatesById(data);
        const reloadRep =
            wrapTryCatch(() => data.onResponseReceivedEndpoints[1].reloadContinuationItemsCommand.continuationItems) ||
            [];
        const appendRep =
            wrapTryCatch(() => data.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems) ||
            [];
        const itemsRep = Array.isArray(reloadRep) && reloadRep.length > 0 ? reloadRep : appendRep;
        const comments = Array.isArray(itemsRep) ? migrateContinuationItemsWithFW(itemsRep, frameworkUpdates) : [];
        const next = extractNextContinuation({ onResponseReceivedEndpoints: data.onResponseReceivedEndpoints });
        const continuations = next.token ? [{ token: next.token, clickTrackingParams: next.clickTrackingParams }] : [];
        return { comments, continuations, frameworkUpdates };
    } catch (e) {
        console.error(e);
        return undefined;
    }
}
