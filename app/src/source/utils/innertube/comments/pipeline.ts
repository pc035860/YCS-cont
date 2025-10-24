import objectScan from 'object-scan';
import Queue from 'p-queue';

import { fetchR } from '../../libs';
import { getCleanUrlVideo, getVideoId, wrapTryCatch } from '../../common';
import { parseFormattedNumber } from '../../formatting';
import { normalizeCommentViewModel } from './normalize';
import { buildInnertubeBody, buildInnertubeHeaders } from '../request';
import { getInnertubeApiKey, getPageCfgData } from '../core';

export interface CommentContinuation {
    token: string;
    clickTrackingParams?: string;
}

export interface ReplyContinuation extends CommentContinuation {
    originComment?: any;
}

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
                renderFullTextComment += `<a class="ycs-cpointer ycs-goto-comment-time" href="https://www.youtube.com/watch?v=${linkVideoId}&t=${timeValue}s" data-offsetvideo="${timeValue}" data-video-id="${linkVideoId}">${text || ''}</a>`;
                if (isSameVideo) {
                    isTimeline = true;
                }
            } else if (navigationEndpoint) {
                const href = (wrapTryCatch(() => navigationEndpoint?.browseEndpoint?.canonicalBaseUrl) ||
                    wrapTryCatch(() => navigationEndpoint?.urlEndpoint?.url) ||
                    wrapTryCatch(() => navigationEndpoint?.commandMetadata?.webCommandMetadata?.url) ||
                    text ||
                    '#') as string;
                renderFullTextComment += `<a class="ycs-cpointer ycs-comment-link" href="${href}" target="_blank">${text || ''}</a>`;
            } else if (wrapTryCatch(() => (partTextComment as any).emoji)) {
                const url =
                    wrapTryCatch(() => {
                        const thumbnails = (partTextComment as any).emoji.image.thumbnails;
                        return thumbnails[thumbnails.length - 1].url;
                    }) || '';
                const alt = (wrapTryCatch(() => (partTextComment as any).emoji.shortcuts?.[0]) as string) || '';
                const style = `margin-left: 2px; margin-right: 2px;`;
                renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="24" height="24" style="${style}" class="ycs-attachment">`;
            } else if (wrapTryCatch(() => (partTextComment as any).attachment?.image)) {
                const image: any = wrapTryCatch(() => (partTextComment as any).attachment.image);
                const url = image?.url || '';
                const width = image?.width || 24;
                const height = image?.height || 24;
                const margin = image?.margin || { left: 0, right: 0 };
                const style = `margin-left: ${margin.left || 0}px; margin-right: ${margin.right || 0}px;`;
                const alt = text || '';
                renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="${width}" height="${height}" style="${style}" class="ycs-attachment">`;
            } else {
                renderFullTextComment += text || '';
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
            renderFullTextComment += fallbackText;
            fullTextComment += fallbackText;
        }
    }

    return { fullText: fullTextComment, renderFullText: renderFullTextComment, isTimeline };
}

export interface FetchInitialCommentBatchParams {
    windowRef: Window & typeof globalThis;
    signal?: AbortSignal;
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
                        const canonicalBaseUrl = webUrl ? `https://www.youtube.com${webUrl}` : undefined;
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
        const replyCount = parseFormattedNumber(wrapTryCatch(() => update.toolbar?.replyCount) || '0').number;

        const comment: any = {
            commentRenderer: {
                commentId,
                likeCount,
                replyCount,
                authorText: { simpleText: wrapTryCatch(() => author.displayName) },
                authorThumbnail: { thumbnails: [{ url: wrapTryCatch(() => author.avatarThumbnailUrl) }] },
                authorEndpoint: wrapTryCatch(() => author.channelCommand?.innertubeCommand),
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
                        collected.push(preparedReply);
                    }
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
                    collected.push(prepared);
                    const continuation = extractReplyContinuationFromItem(item);
                    if (continuation.token) {
                        replyContinuations.push({
                            token: continuation.token,
                            clickTrackingParams: continuation.cTrParams,
                            originComment: prepared
                        });
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

    const scheduleContinuation = (cont: ReplyContinuation): void => {
        const task = queue.add(async () => {
            try {
                const batch = await fetchContinuation(cont);
                if (!batch) return;
                const fwById = batch.frameworkUpdates || {};
                for (let comment of batch.comments || []) {
                    if (!comment?.commentRenderer) {
                        const normalized = normalizeCommentViewModel(comment);
                        if (normalized && normalized.commentRenderer) comment = normalized;
                    }
                    if (!comment?.commentRenderer) continue;
                    applyFrameworkUpdatesToComment(comment, comment, fwById);
                    const prepared = enrichCommentRenderer(comment, currentVideoId, cont.originComment, 'R');
                    if (prepared) {
                        try {
                            onReply(prepared);
                        } catch (callbackError) {
                            console.error(callbackError);
                        }
                    }
                }
                for (const next of batch.continuations || []) {
                    scheduleContinuation({ ...next, originComment: cont.originComment });
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
    const parentByCommentId = new Map<string, any>();
    for (const cm of comments) {
        if ((cm as any)?.typeComment === 'C') {
            const id = (cm as any)?.commentRenderer?.commentId;
            if (id && !parentByCommentId.has(id)) {
                parentByCommentId.set(id, cm);
            }
        }
    }

    const deduplicated: typeof comments = [];
    for (const cm of comments) {
        if ((cm as any)?.typeComment === 'C') {
            const id = (cm as any)?.commentRenderer?.commentId;
            if (id && parentByCommentId.get(id) === cm) {
                deduplicated.push(cm);
            } else if (!id) {
                deduplicated.push(cm);
            }
        } else if ((cm as any)?.typeComment === 'R') {
            const originId = (cm as any)?.originComment?.commentRenderer?.commentId;
            if (originId && parentByCommentId.has(originId)) {
                (cm as any).originComment = parentByCommentId.get(originId);
            }
            deduplicated.push(cm);
        } else {
            deduplicated.push(cm);
        }
    }

    return deduplicated;
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
            headers: buildInnertubeHeaders(ytcfgData),
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
            headers: buildInnertubeHeaders(ytcfgData),
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

        return {
            headers: buildInnertubeHeaders(ytcfgData),
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
            headers: buildInnertubeHeaders(ytcfgData),
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
    continuation?: CommentContinuation
): Promise<{ response?: any; params?: RequestInit } | undefined> {
    try {
        let paramsCmnts;
        if (continuation) {
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
                '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.clickTrackingParams',
                '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.continuationCommand.command.clickTrackingParams',
                '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].trackingParams'
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

            const continuationToken =
                (wrapTryCatch(() =>
                    objectScan(
                        [
                            '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.continuationCommand.token'
                        ],
                        { joined: true, rtn: 'value', abort: true }
                    )(detailsCmntsVIDV2)
                ) as string | undefined) ||
                (wrapTryCatch(() =>
                    objectScan(
                        [
                            '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.continuationCommand.token'
                        ],
                        { joined: true, rtn: 'value', abort: true }
                    )((windowRef as any).ytInitialData)
                ) as string | undefined);

            const fallbackClickTracking = wrapTryCatch(() =>
                objectScan(
                    ['**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.clickTrackingParams'],
                    { joined: true, rtn: 'value', abort: true }
                )((windowRef as any).ytInitialData)
            );

            const clickTrackingParams = tokenComments ?? fallbackClickTracking;

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

export async function fetchInitialCommentBatch(
    params: FetchInitialCommentBatchParams
): Promise<CommentBatchResult | undefined> {
    try {
        const result = await fetchCommentPage(params.windowRef, params.signal);
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
        const result = await fetchCommentPage(params.windowRef, params.signal, params.continuation);
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
        const res = await fetchR(`https://www.youtube.com/youtubei/v1/next?key=${getInnertubeApiKey()}`, {
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
