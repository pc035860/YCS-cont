import objectScan from 'object-scan';
import Queue from 'p-queue';

import { showLoadComments } from '../dom';
import { fetchR } from '../libs';
import { GlobalStore, deepFindObjKey, getCleanUrlVideo, getVideoId, wrapTryCatch } from '../common';
import { parseFormattedNumber } from '../formatting';
import { normalizeCommentViewModel } from './comments/normalize';
import { buildInnertubeBody, buildInnertubeHeaders } from './request';
import { getInnertubeApiKey, getPageCfgData } from './core';
function getFrameworkUpdatesById(response: any): Record<string, any> {
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

/**
 * Build sponsor badge object from frameworkUpdates data
 * @param options - Badge configuration with optional existing tooltip preservation
 * @returns Sponsor badge object or undefined if no badge URL provided
 */
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

function applyFrameworkUpdatesToComment(commentObj: any, vmSource: any, fwById: Record<string, any>): void {
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

            // Preserve existing tooltip if frameworkUpdates doesn't provide one
            const existingHeartTooltip = wrapTryCatch(() => commentObj.commentRenderer?.creatorHeart?.tooltip);
            const heartTooltip =
                wrapTryCatch(() => toolbarUpdate.toolbar?.heartActiveTooltip) ||
                wrapTryCatch(() => update?.toolbar?.heartActiveTooltip);
            const finalTooltip = heartTooltip || existingHeartTooltip || 'hearted';

            commentObj.commentRenderer.creatorHeart = { tooltip: finalTooltip } as any;
        }

        // Extract donated chip from surfaceUpdate
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

// Additional functions omitted for brevity in this snippet
function generateCommentObjectFromFW(params: {
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
                                    browseId: wrapTryCatch(() => browseEndpoint.browseId),
                                    canonicalBaseUrl
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
        const likeCountLiked = wrapTryCatch(() => update.toolbar.likeCountLiked);
        let likeCount = 0;
        try {
            const parsed = parseFormattedNumber(likeCountLiked);
            if (parsed.multiply === 1) {
                likeCount = Math.max(0, parsed.number - 1);
            } else {
                likeCount = parsed.number;
            }
        } catch {
            // If parsing fails, keep likeCount as 0
        }
        const replyCount = parseFormattedNumber(wrapTryCatch(() => update.toolbar.replyCount) || '0').number;

        const comment: any = {
            commentRenderer: {
                commentId,
                likeCount,
                replyCount,
                authorText: { simpleText: wrapTryCatch(() => author.displayName) },
                authorThumbnail: { thumbnails: [{ url: wrapTryCatch(() => author.avatarThumbnailUrl) }] },
                authorEndpoint: wrapTryCatch(() => author.channelCommand.innertubeCommand),
                contentText: { runs, fullText: baseText }
            }
        };

        try {
            const hasTimeline =
                Array.isArray(runs) &&
                runs.some((r: any) => {
                    const vId = wrapTryCatch(() => r.navigationEndpoint.watchEndpoint.videoId) as any;
                    const v = wrapTryCatch(() => r.navigationEndpoint.watchEndpoint.startTimeSeconds) as any;
                    const n = typeof v === 'string' ? parseInt(v, 10) : v;
                    const currentVideoId = (getVideoId(window.location.href) || '') as string;
                    return Number.isFinite(n) && n >= 0 && String(vId || '') === String(currentVideoId || '');
                });
            if (hasTimeline) {
                comment.commentRenderer.isTimeLine = 'timeline';
            }
        } catch {
            // If timeline detection fails, skip setting isTimeLine property
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
        }

        if (toolbarStateUpdate && wrapTryCatch(() => toolbarStateUpdate.heartState) === 'TOOLBAR_HEART_STATE_HEARTED') {
            comment.commentRenderer.creatorHeart = {
                tooltip: wrapTryCatch(() => update.toolbar?.heartActiveTooltip) || 'hearted'
            } as any;
        }

        const sponsorBadge = buildSponsorBadge({
            sponsorBadgeUrl: wrapTryCatch(() => author.sponsorBadgeUrl),
            sponsorBadgeA11y: wrapTryCatch(() => author.sponsorBadgeA11y)
        });
        if (sponsorBadge) {
            comment.commentRenderer.sponsorCommentBadge = sponsorBadge;
        }

        // Extract donated chip from surfaceUpdate
        const donatedChip = wrapTryCatch(() => surfaceUpdate?.pdgCommentChip);
        if (donatedChip) {
            comment.commentRenderer.donatedChip = donatedChip;
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

function migrateContinuationItemsWithFW(continuationItems: any[], frameworkUpdatesById: Record<string, any>): any[] {
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

function extractReplyContinuationFromItem(threadItem: any): { token?: string; cTrParams?: string } {
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

function extractNextContinuation(response: any): { token?: string; clickTrackingParams?: string } {
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
async function getAllCommentsModeV2(
    elShowLoading: HTMLElement,
    signal: AbortSignal | undefined = undefined,
    container: object[] | undefined = undefined
): Promise<object[]> {
    const _getTokensComments = async (): Promise<any | undefined> => {
        try {
            const detailsVideoV2 = await getDetailsVideoIDV2(
                window,
                getCleanUrlVideo(window.location.href) as string,
                signal as AbortSignal
            );
            const detailsVideoV2Token = objectScan(
                [
                    '**.contents.twoColumnWatchNextResults.results.results.contents[?].itemSectionRenderer.contents[?].continuationItemRenderer.continuationEndpoint.continuationCommand.token'
                ],
                { joined: true, rtn: 'value', abort: true }
            )(detailsVideoV2);
            console.log('objectScan detailsVideoV2Token: ', detailsVideoV2Token);

            const detailsCmntsVIDV2 = await getDetailsCommentsVideoIDV2(
                window,
                {
                    url: getCleanUrlVideo(window.location.href),
                    continue: detailsVideoV2Token
                },
                signal as AbortSignal
            );

            console.log('detailsCmntsVIDV2: ', detailsCmntsVIDV2);

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

            const nextToken = objectScan(
                ['**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.continuationCommand.token'],
                { joined: true, rtn: 'value', abort: true }
            )(detailsCmntsVIDV2);

            return {
                continue: nextToken,
                clickTrackingParams: tokenComments
            };
        } catch (err) {
            console.error(err);
            return;
        }
    };

    const _prepareFieldsComment = (cmnt: any): object => {
        try {
            if (wrapTryCatch(() => cmnt.commentRenderer.actionButtons.commentActionButtonsRenderer.creatorHeart)) {
                try {
                    cmnt.commentRenderer.creatorHeart = {
                        tooltip: wrapTryCatch(
                            () =>
                                cmnt.commentRenderer.actionButtons.commentActionButtonsRenderer.creatorHeart
                                    .creatorHeartRenderer.creatorThumbnail.accessibility.accessibilityData.label
                        )
                    };
                } catch (err) {
                    console.error(err);
                }
            }

            if (
                wrapTryCatch(
                    () =>
                        cmnt.commentRenderer.authorCommentBadge.authorCommentBadgeRenderer.icon.iconType.indexOf(
                            'CHECK'
                        ) >= 0
                ) ||
                wrapTryCatch(
                    () =>
                        cmnt.commentRenderer.authorCommentBadge.authorCommentBadgeRenderer.iconTooltip.indexOf(
                            'Verified'
                        ) >= 0
                )
            ) {
                try {
                    cmnt.commentRenderer.verifiedAuthor = true;
                } catch (err) {
                    console.error(err);
                }
            }

            const fields = [
                'actionButtons',
                'authorCommentBadge',
                'collapseButton',
                'expandButton',
                'loggingDirectives',
                'voteStatus',
                'trackingParams',
                'isLiked'
            ];

            for (const f of fields) {
                wrapTryCatch(() => delete cmnt.commentRenderer[f]);
            }

            wrapTryCatch(() => delete cmnt.commentRenderer.authorThumbnail.accessibility);
            wrapTryCatch(() => (cmnt.commentRenderer.authorThumbnail.thumbnails.length = 1));
            wrapTryCatch(() => delete cmnt.commentRenderer.authorThumbnail.thumbnails[0].height);
            wrapTryCatch(() => delete cmnt.commentRenderer.authorThumbnail.thumbnails[0].width);

            wrapTryCatch(
                () =>
                    delete cmnt.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.commandMetadata
                        .webCommandMetadata.rootVe
            );
            wrapTryCatch(
                () =>
                    delete cmnt.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.commandMetadata
                        .webCommandMetadata.webPageType
            );

            wrapTryCatch(
                () => delete cmnt.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.watchEndpoint.params
            );

            wrapTryCatch(() => delete cmnt.commentRenderer.authorEndpoint.clickTrackingParams);

            wrapTryCatch(() => delete cmnt.commentRenderer.authorEndpoint.commandMetadata.webCommandMetadata.apiUrl);
            wrapTryCatch(() => delete cmnt.commentRenderer.authorEndpoint.commandMetadata.webCommandMetadata.rootVe);
            wrapTryCatch(
                () => delete cmnt.commentRenderer.authorEndpoint.commandMetadata.webCommandMetadata.webPageType
            );

            wrapTryCatch(() => delete cmnt.commentRenderer.authorEndpoint.browseEndpoint.browseId);

            wrapTryCatch(
                () => delete cmnt.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.clickTrackingParams
            );

            if (wrapTryCatch(() => cmnt.commentRenderer.contentText.runs.length > 0)) {
                for (const [i, textPart] of cmnt.commentRenderer.contentText.runs.entries()) {
                    if (textPart.navigationEndpoint) {
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

                        wrapTryCatch(() => delete cmnt.commentRenderer.contentText.runs[i].text);
                    } else {
                        wrapTryCatch(() => delete cmnt.commentRenderer.contentText.runs[i]);
                    }
                }
            }

            return cmnt;
        } catch (err) {
            console.error(err);
            return cmnt;
        }
    };

    const comments: object[] = container || [];

    const replyQueue = new Queue({ concurrency: 4 });

    /**
     * Проходит в первой пачки комментариев и добаляет их в [comments] массив, предварительно соединив текст => fullText.
     * Также смотрит есть ли ответы (replies), добавляет их в массив
     */
    // eslint-disable-next-line require-await
    async function _getAllRepliesComment(cmnts: any, nodeStatusLoading: HTMLElement): Promise<void> {
        if (!cmnts) return;

        // For authorized and unauthorized users
        const cmts: any = cmnts;
        console.log('cmts: ', cmts);

        for (const c of cmts) {
            try {
                // If new model exists, normalize it into legacy slot before processing
                if (
                    wrapTryCatch(() => c.commentThreadRenderer) &&
                    !wrapTryCatch(() => c.commentThreadRenderer.comment) &&
                    (wrapTryCatch(() => c.commentThreadRenderer.commentViewModel) ||
                        wrapTryCatch(() => c.commentViewModel))
                ) {
                    const normalizedEarly = normalizeCommentViewModel(c);
                    if (normalizedEarly) {
                        c.commentThreadRenderer.comment = normalizedEarly;
                        try {
                            console.log(
                                'normalized VM -> comment runs:',
                                normalizedEarly?.commentRenderer?.contentText?.runs?.length || 0
                            );
                        } catch {
                            // Ignore console.log errors (debug output only)
                        }
                    }
                }

                if (c.commentThreadRenderer?.comment) {
                    let fullTextComment = '';
                    let renderFullTextComment = '';

                    const contentText = c.commentThreadRenderer?.comment?.commentRenderer?.contentText?.runs || [];
                    for (const partTextComment of contentText) {
                        const text =
                            (partTextComment as any)?.text ??
                            (partTextComment as any)?.simpleText ??
                            wrapTryCatch(() => (partTextComment as any)?.textRun?.content) ??
                            wrapTryCatch(() => (partTextComment as any)?.textRun?.text) ??
                            wrapTryCatch(() => (partTextComment as any)?.content) ??
                            '';
                        const navigationEndpoint =
                            (partTextComment as any)?.navigationEndpoint ??
                            wrapTryCatch(() => (partTextComment as any)?.textRun?.navigationEndpoint);

                        fullTextComment += text || '';

                        try {
                            if (
                                parseInt(
                                    wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.startTimeSeconds) as any
                                ) >= 0
                            ) {
                                renderFullTextComment += `<a class="ycs-cpointer ycs-goto-comment-time" href="https://www.youtube.com/watch?v=${wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.videoId)}&t=${wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.startTimeSeconds)}s" data-offsetvideo="${wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.startTimeSeconds)}">${text || ''}</a>`;

                                if (c.commentThreadRenderer?.comment?.commentRenderer) {
                                    c.commentThreadRenderer.comment.commentRenderer.isTimeLine = 'timeline';
                                }
                            } else if (navigationEndpoint) {
                                renderFullTextComment += `<a class="ycs-cpointer ycs-comment-link" href="${wrapTryCatch(() => navigationEndpoint?.browseEndpoint?.canonicalBaseUrl) || wrapTryCatch(() => navigationEndpoint?.urlEndpoint?.url) || wrapTryCatch(() => navigationEndpoint?.commandMetadata?.webCommandMetadata?.url) || text || '#'}" target="_blank">${text || ''}</a>`;
                            } else if (wrapTryCatch(() => (partTextComment as any).emoji)) {
                                const url =
                                    wrapTryCatch(() => {
                                        const thumbnails = (partTextComment as any).emoji.image.thumbnails;
                                        return thumbnails[thumbnails.length - 1].url;
                                    }) || '';
                                const alt =
                                    (wrapTryCatch(() => (partTextComment as any).emoji.shortcuts?.[0]) as string) || '';
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
                            renderFullTextComment += text || '';
                            continue;
                        }
                    }

                    if (c.commentThreadRenderer?.comment?.commentRenderer?.contentText) {
                        c.commentThreadRenderer.comment.commentRenderer.contentText.fullText = fullTextComment;
                        c.commentThreadRenderer.comment.commentRenderer.contentText.renderFullText =
                            renderFullTextComment;
                    }

                    if (c.commentThreadRenderer?.comment?.commentRenderer) {
                        c.commentThreadRenderer.comment.typeComment = 'C';
                        comments.push(_prepareFieldsComment(c.commentThreadRenderer.comment));
                        showLoadComments(comments.length, nodeStatusLoading);
                    }
                }
                // Handle new commentViewModel shape by normalizing into legacy commentRenderer
                else if (
                    wrapTryCatch(() => c.commentThreadRenderer?.commentViewModel) ||
                    wrapTryCatch(() => c.commentViewModel)
                ) {
                    const normalized = normalizeCommentViewModel(c);
                    if (normalized && normalized.commentRenderer?.contentText?.runs) {
                        let fullTextComment = '';
                        let renderFullTextComment = '';

                        const contentText = normalized.commentRenderer.contentText?.runs ?? [];
                        for (const partTextComment of contentText) {
                            const text = partTextComment?.text ?? '';
                            fullTextComment += text;
                            try {
                                const navigationEndpoint = partTextComment?.navigationEndpoint;
                                const watchEndpoint = navigationEndpoint?.watchEndpoint;
                                const startTimeSeconds = watchEndpoint?.startTimeSeconds;
                                const startTimeValue =
                                    typeof startTimeSeconds === 'string' ? parseInt(startTimeSeconds, 10) : Number.NaN;

                                if (!Number.isNaN(startTimeValue) && startTimeValue >= 0) {
                                    const currentVideoId = String(getVideoId(window.location.href) || '');
                                    const linkVideoId = watchEndpoint?.videoId ?? '';
                                    const isSameVideo = linkVideoId === currentVideoId;
                                    const timeParam = startTimeSeconds ?? String(startTimeValue);

                                    renderFullTextComment += `<a class="ycs-cpointer ycs-goto-comment-time" href="https://www.youtube.com/watch?v=${linkVideoId}&t=${timeParam}s" data-offsetvideo="${timeParam}" data-video-id="${linkVideoId}">${text}</a>`;
                                    if (isSameVideo) {
                                        normalized.commentRenderer.isTimeLine = 'timeline';
                                    }
                                } else if (navigationEndpoint) {
                                    const href =
                                        navigationEndpoint.browseEndpoint?.canonicalBaseUrl ??
                                        navigationEndpoint.urlEndpoint?.url ??
                                        navigationEndpoint.commandMetadata?.webCommandMetadata?.url ??
                                        (text || '#');

                                    renderFullTextComment += `<a class="ycs-cpointer ycs-comment-link" href="${href}" target="_blank">${text}</a>`;
                                } else if (partTextComment?.emoji) {
                                    const thumbnails = partTextComment.emoji.image?.thumbnails ?? [];
                                    const url = thumbnails[thumbnails.length - 1]?.url ?? '';
                                    const alt = partTextComment.emoji.shortcuts?.[0] ?? '';
                                    const style = 'margin-left: 2px; margin-right: 2px;';
                                    renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="24" height="24" style="${style}" class="ycs-attachment">`;
                                } else if (partTextComment?.attachment?.image) {
                                    const image = partTextComment.attachment.image;
                                    const url = image.url ?? '';
                                    const width = image.width ?? 24;
                                    const height = image.height ?? 24;
                                    const margin = image.margin ?? { left: 0, right: 0 };
                                    const style = `margin-left: ${margin.left ?? 0}px; margin-right: ${margin.right ?? 0}px;`;
                                    const alt = text;
                                    renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="${width}" height="${height}" style="${style}" class="ycs-attachment">`;
                                } else {
                                    renderFullTextComment += text;
                                }
                            } catch (e) {
                                console.error(e);
                                renderFullTextComment += text;
                                continue;
                            }
                        }

                        normalized.typeComment = 'C';
                        if (normalized.commentRenderer?.contentText) {
                            normalized.commentRenderer.contentText.fullText = fullTextComment;
                            normalized.commentRenderer.contentText.renderFullText = renderFullTextComment;
                        }
                        comments.push(_prepareFieldsComment(normalized));
                        showLoadComments(comments.length, nodeStatusLoading);
                    }
                }

                const nextComments = extractReplyContinuationFromItem(c);

                if (nextComments.token) {
                    replyQueue.add(async () => {
                        try {
                            const paramsCmnts = await getParamsForReplies(
                                window,
                                {
                                    continue: nextComments.token,
                                    clickTracking: nextComments.cTrParams
                                },
                                signal
                            );
                            const res = await fetchR(
                                `https://www.youtube.com/youtubei/v1/next?key=${getInnertubeApiKey()}`,
                                { ...paramsCmnts, signal, cache: 'no-store' } as RequestInit
                            );
                            let data = await res.json();
                            console.log('Queue replies: ', data);

                            // replies: prefer FW-driven migration
                            const fwRep = getFrameworkUpdatesById(data);
                            const reloadRep =
                                wrapTryCatch(
                                    () =>
                                        data.onResponseReceivedEndpoints[1].reloadContinuationItemsCommand
                                            .continuationItems
                                ) || [];
                            const appendRep =
                                wrapTryCatch(
                                    () =>
                                        data.onResponseReceivedEndpoints[0].appendContinuationItemsAction
                                            .continuationItems
                                ) || [];
                            const itemsRep = Array.isArray(reloadRep) && reloadRep.length > 0 ? reloadRep : appendRep;
                            const repliesContainer: any[] =
                                Array.isArray(itemsRep) && itemsRep.length > 0
                                    ? migrateContinuationItemsWithFW(itemsRep, fwRep)
                                    : [];
                            if (repliesContainer && repliesContainer.length > 0) {
                                const replies: any = repliesContainer || [];
                                for (let comment of replies) {
                                    if (!comment?.commentRenderer) {
                                        const norm = normalizeCommentViewModel(comment);
                                        if (norm && norm.commentRenderer) comment = norm;
                                    }
                                    if (!comment?.commentRenderer) continue;
                                    try {
                                        applyFrameworkUpdatesToComment(comment, comment, getFrameworkUpdatesById(data));
                                    } catch (e) {
                                        console.error(e);
                                    }

                                    let fullTextComment = '';
                                    let renderFullTextComment = '';

                                    const contentText = comment.commentRenderer?.contentText?.runs || [];
                                    for (const partTextComment of contentText) {
                                        let textStr = '';
                                        let navigationEndpoint: any;
                                        try {
                                            textStr =
                                                (partTextComment as any)?.text ??
                                                (partTextComment as any)?.simpleText ??
                                                (wrapTryCatch(
                                                    () => (partTextComment as any)?.textRun?.content
                                                ) as string) ??
                                                (wrapTryCatch(
                                                    () => (partTextComment as any)?.textRun?.text
                                                ) as string) ??
                                                (wrapTryCatch(() => (partTextComment as any)?.content) as string) ??
                                                '';
                                            navigationEndpoint =
                                                (partTextComment as any)?.navigationEndpoint ??
                                                wrapTryCatch(
                                                    () => (partTextComment as any)?.textRun?.navigationEndpoint
                                                );

                                            fullTextComment += textStr || '';

                                            if (
                                                parseInt(
                                                    wrapTryCatch(
                                                        () => navigationEndpoint?.watchEndpoint?.startTimeSeconds
                                                    ) as any
                                                ) >= 0
                                            ) {
                                                const currentVideoId = (getVideoId(window.location.href) ||
                                                    '') as string;
                                                const linkVideoId = (wrapTryCatch(
                                                    () => navigationEndpoint?.watchEndpoint?.videoId
                                                ) || '') as string;
                                                const isSameVideo =
                                                    String(linkVideoId || '') === String(currentVideoId || '');

                                                renderFullTextComment += `<a class="ycs-cpointer ycs-goto-comment-time" href="https://www.youtube.com/watch?v=${linkVideoId}&t=${wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.startTimeSeconds)}s" data-offsetvideo="${wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.startTimeSeconds)}" data-video-id="${linkVideoId}">${textStr || ''}</a>`;

                                                if (isSameVideo && comment.commentRenderer) {
                                                    comment.commentRenderer.isTimeLine = 'timeline';
                                                }
                                            } else if (navigationEndpoint) {
                                                const hrefNav = (wrapTryCatch(
                                                    () => navigationEndpoint?.browseEndpoint?.canonicalBaseUrl
                                                ) ||
                                                    wrapTryCatch(() => navigationEndpoint?.urlEndpoint?.url) ||
                                                    wrapTryCatch(
                                                        () =>
                                                            navigationEndpoint?.commandMetadata?.webCommandMetadata?.url
                                                    ) ||
                                                    textStr ||
                                                    '#') as string;
                                                renderFullTextComment += `<a class="ycs-cpointer ycs-comment-link" href="${hrefNav}" target="_blank">${textStr || ''}</a>`;
                                            } else if (wrapTryCatch(() => (partTextComment as any).emoji)) {
                                                const url =
                                                    wrapTryCatch(() => {
                                                        const thumbnails = (partTextComment as any).emoji.image
                                                            .thumbnails;
                                                        return thumbnails[thumbnails.length - 1].url;
                                                    }) || '';
                                                const alt =
                                                    (wrapTryCatch(
                                                        () => (partTextComment as any).emoji.shortcuts?.[0]
                                                    ) as string) || '';
                                                const style = `margin-left: 2px; margin-right: 2px;`;
                                                renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="24" height="24" style="${style}" class="ycs-attachment">`;
                                            } else if (wrapTryCatch(() => (partTextComment as any).attachment?.image)) {
                                                const image: any = wrapTryCatch(
                                                    () => (partTextComment as any).attachment.image
                                                );
                                                const url = image?.url || '';
                                                const width = image?.width || 24;
                                                const height = image?.height || 24;
                                                const margin = image?.margin || { left: 0, right: 0 };
                                                const style = `margin-left: ${margin.left || 0}px; margin-right: ${margin.right || 0}px;`;
                                                const alt = textStr || '';
                                                renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="${width}" height="${height}" style="${style}" class="ycs-attachment">`;
                                            } else {
                                                renderFullTextComment += textStr || '';
                                            }
                                        } catch (e) {
                                            console.error(e);
                                            renderFullTextComment += textStr || '';
                                        }
                                    }

                                    if (comment?.commentRenderer?.contentText) {
                                        comment.commentRenderer.contentText.fullText = fullTextComment;
                                        comment.commentRenderer.contentText.renderFullText = renderFullTextComment;
                                    }

                                    comment.typeComment = 'R';
                                    comment.originComment = c.commentThreadRenderer.comment;
                                    comments.push(_prepareFieldsComment(comment));

                                    showLoadComments(comments.length, nodeStatusLoading);
                                }
                            }

                            // eslint-disable-next-line no-constant-condition
                            while (true) {
                                const { token: rToken, clickTrackingParams: rClick } = extractNextContinuation(data);
                                if (!rToken) break;
                                const rPrms = { continue: rToken, clickTracking: rClick };

                                const rParamsCmnts = await getParamsForReplies(window, rPrms, signal);

                                const resReplies = await fetchR(
                                    `https://www.youtube.com/youtubei/v1/next?key=${getInnertubeApiKey()}`,
                                    { ...rParamsCmnts, signal, cache: 'no-store' } as RequestInit
                                );
                                data = await resReplies.json();
                                const fwMore = getFrameworkUpdatesById(data);
                                const reloadMore =
                                    wrapTryCatch(
                                        () =>
                                            data.onResponseReceivedEndpoints[1].reloadContinuationItemsCommand
                                                .continuationItems
                                    ) || [];
                                const appendMore =
                                    wrapTryCatch(
                                        () =>
                                            data.onResponseReceivedEndpoints[0].appendContinuationItemsAction
                                                .continuationItems
                                    ) || [];
                                const itemsMore =
                                    Array.isArray(reloadMore) && reloadMore.length > 0 ? reloadMore : appendMore;
                                const moreReplies: any[] =
                                    Array.isArray(itemsMore) && itemsMore.length > 0
                                        ? migrateContinuationItemsWithFW(itemsMore, fwMore)
                                        : [];
                                if (moreReplies && moreReplies.length > 0) {
                                    const replies: any = moreReplies;
                                    for (let comment of replies) {
                                        if (!comment?.commentRenderer) {
                                            const norm = normalizeCommentViewModel(comment);
                                            if (norm && norm.commentRenderer) comment = norm;
                                        }
                                        if (!comment?.commentRenderer) continue;
                                        try {
                                            applyFrameworkUpdatesToComment(
                                                comment,
                                                comment,
                                                getFrameworkUpdatesById(data)
                                            );
                                        } catch (e) {
                                            console.error(e);
                                        }

                                        let fullTextComment = '';
                                        let renderFullTextComment = '';

                                        const contentText = comment.commentRenderer?.contentText?.runs || [];
                                        for (const partTextComment of contentText) {
                                            try {
                                                const text =
                                                    (partTextComment as any)?.text ??
                                                    (partTextComment as any)?.simpleText ??
                                                    wrapTryCatch(() => (partTextComment as any)?.textRun?.content) ??
                                                    wrapTryCatch(() => (partTextComment as any)?.textRun?.text) ??
                                                    wrapTryCatch(() => (partTextComment as any)?.content) ??
                                                    '';
                                                const navigationEndpoint =
                                                    (partTextComment as any)?.navigationEndpoint ??
                                                    wrapTryCatch(
                                                        () => (partTextComment as any)?.textRun?.navigationEndpoint
                                                    );

                                                if (typeof text === 'string' && text.length > 0) {
                                                    fullTextComment += text;
                                                }

                                                if (
                                                    parseInt(
                                                        wrapTryCatch(
                                                            () => navigationEndpoint?.watchEndpoint?.startTimeSeconds
                                                        ) as any
                                                    ) >= 0
                                                ) {
                                                    const currentVideoId = (getVideoId(window.location.href) ||
                                                        '') as string;
                                                    const linkVideoId = (wrapTryCatch(
                                                        () => navigationEndpoint?.watchEndpoint?.videoId
                                                    ) || '') as string;
                                                    const isSameVideo =
                                                        String(linkVideoId || '') === String(currentVideoId || '');

                                                    renderFullTextComment += `<a class="ycs-cpointer ycs-goto-comment-time" href="https://www.youtube.com/watch?v=${linkVideoId}&t=${wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.startTimeSeconds)}s" data-offsetvideo="${wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.startTimeSeconds)}" data-video-id="${linkVideoId}">${text || ''}</a>`;

                                                    if (isSameVideo && comment.commentRenderer) {
                                                        comment.commentRenderer.isTimeLine = 'timeline';
                                                    }
                                                } else if (navigationEndpoint) {
                                                    const href = (wrapTryCatch(
                                                        () => navigationEndpoint?.browseEndpoint?.canonicalBaseUrl
                                                    ) ||
                                                        wrapTryCatch(() => navigationEndpoint?.urlEndpoint?.url) ||
                                                        wrapTryCatch(
                                                            () =>
                                                                navigationEndpoint?.commandMetadata?.webCommandMetadata
                                                                    ?.url
                                                        ) ||
                                                        (text as string) ||
                                                        '#') as string;
                                                    const lbl = (text as string) || '';
                                                    renderFullTextComment += `<a class="ycs-cpointer ycs-comment-link" href="${href}" target="_blank">${lbl}</a>`;
                                                } else {
                                                    renderFullTextComment += (text as string) || '';
                                                }
                                            } catch (e) {
                                                console.error(e);
                                                const fallbackText: string = ((): string => {
                                                    try {
                                                        const t =
                                                            (partTextComment as any)?.text ??
                                                            (partTextComment as any)?.simpleText ??
                                                            (wrapTryCatch(
                                                                () => (partTextComment as any)?.textRun?.content
                                                            ) as string) ??
                                                            (wrapTryCatch(
                                                                () => (partTextComment as any)?.textRun?.text
                                                            ) as string) ??
                                                            (wrapTryCatch(
                                                                () => (partTextComment as any)?.content
                                                            ) as string) ??
                                                            '';
                                                        return typeof t === 'string' ? t : '';
                                                    } catch {
                                                        return '';
                                                    }
                                                })();
                                                renderFullTextComment += fallbackText;
                                            }
                                        }

                                        if (comment?.commentRenderer?.contentText) {
                                            comment.commentRenderer.contentText.fullText = fullTextComment;
                                            comment.commentRenderer.contentText.renderFullText = renderFullTextComment;
                                        }

                                        comment.typeComment = 'R';
                                        comment.originComment = c.commentThreadRenderer.comment;
                                        comments.push(_prepareFieldsComment(comment));
                                        showLoadComments(comments.length, nodeStatusLoading);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    });
                }
            } catch (e) {
                console.error(e);
                continue;
            }
        }
    }

    try {
        let response, data: any;
        try {
            console.log('Try get comments with inner tube api key');

            const tokensComments = await _getTokensComments();
            console.log('_getTokenComments(): ', tokensComments);

            console.log('tokenComments: ', tokensComments);

            let paramsCmnts;
            if (tokensComments.clickTrackingParams) {
                paramsCmnts = await getParamsForComments(
                    window,
                    {
                        continue: tokensComments.continue,
                        clickTrackingParams: tokensComments.clickTrackingParams
                    },
                    signal
                );

                console.log('WITHOUT REFRESH!');
            } else {
                paramsCmnts = await getParamsForComments(
                    window,
                    {
                        continue: wrapTryCatch(() =>
                            objectScan(
                                [
                                    '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.continuationCommand.token'
                                ],
                                { joined: true, rtn: 'value', abort: true }
                            )((window as any).ytInitialData)
                        ),
                        clickTrackingParams: wrapTryCatch(() =>
                            objectScan(
                                [
                                    '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.clickTrackingParams'
                                ],
                                { joined: true, rtn: 'value', abort: true }
                            )((window as any).ytInitialData)
                        )
                    },
                    signal
                );

                console.log(
                    'objectScan REFRESH: ',
                    wrapTryCatch(() =>
                        objectScan(
                            [
                                '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.continuationCommand.token'
                            ],
                            { joined: true, rtn: 'value', abort: true }
                        )((window as any).ytInitialData)
                    )
                );
            }

            if (paramsCmnts) {
                response = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${getInnertubeApiKey()}`, {
                    ...paramsCmnts,
                    signal,
                    cache: 'no-store'
                } as RequestInit);
            }

            if (response?.status === 200) {
                const res = await response.json();
                console.log('response: ', response);
                data = res;
                console.log('data; ', data);
            } else {
                // removeNodeList('.iframe_ytInitialData');
                return [];
            }
        } catch (err) {
            console.error(err);
            // removeNodeList('.iframe_ytInitialData');
            return [];
        }

        // Prefer FW-driven migration when possible
        let cmnts: any = (() => {
            try {
                const fw = getFrameworkUpdatesById(data);
                // try to find continuation items from both reload and append
                const reloadItems =
                    wrapTryCatch(
                        () => data.onResponseReceivedEndpoints[1].reloadContinuationItemsCommand.continuationItems
                    ) || [];
                const appendItems =
                    wrapTryCatch(
                        () => data.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems
                    ) || [];
                const items = Array.isArray(reloadItems) && reloadItems.length > 0 ? reloadItems : appendItems;
                if (Array.isArray(items) && items.length > 0) {
                    return migrateContinuationItemsWithFW(items, fw);
                }
            } catch (e) {
                console.error(e);
            }
            return [];
        })();
        try {
            const hasCTRBase = (cmnts || []).filter((x: any) => !!wrapTryCatch(() => x.commentThreadRenderer)).length;
            const hasCTR = (cmnts || []).filter(
                (x: any) => !!wrapTryCatch(() => x.commentThreadRenderer.comment)
            ).length;
            const hasCV = (cmnts || []).filter(
                (x: any) =>
                    !!wrapTryCatch(() => x.commentThreadRenderer.commentViewModel) ||
                    !!wrapTryCatch(() => x.commentViewModel)
            ).length;
            const hasCont = (cmnts || []).filter((x: any) => !!wrapTryCatch(() => x.continuationItemRenderer)).length;
            console.log(
                'batch stats (top): hasCTRBase:',
                hasCTRBase,
                'hasCTR:',
                hasCTR,
                'hasCV:',
                hasCV,
                'hasCont:',
                hasCont,
                'len:',
                (cmnts || []).length
            );
            if ((cmnts || []).length > 0) {
                console.log('first item keys (top):', Object.keys(cmnts[0]));
            }
        } catch (e) {
            console.error(e);
        }

        // Build frameworkUpdates map once per page batch
        let fwById: Record<string, any> = getFrameworkUpdatesById(data);

        while (cmnts?.length > 0) {
            // Before pushing comments, try to enrich via frameworkUpdates when possible
            try {
                for (const it of cmnts) {
                    const target = wrapTryCatch(() => it.commentThreadRenderer?.comment) || it;
                    if (target) applyFrameworkUpdatesToComment(target, it, fwById);
                }
            } catch (e) {
                console.error(e);
            }

            await _getAllRepliesComment(cmnts, elShowLoading);

            const { token: nextToken } = extractNextContinuation({
                onResponseReceivedEndpoints: data.onResponseReceivedEndpoints
            });
            if (nextToken) {
                console.log('Comment next Token: ', nextToken);

                const paramsCmnts = await getParamsForComments(window, { continue: nextToken }, signal);
                const res = await fetchR(`https://www.youtube.com/youtubei/v1/next?key=${getInnertubeApiKey()}`, {
                    ...paramsCmnts,
                    signal,
                    cache: 'no-store'
                } as RequestInit);

                if (res?.status === 200) {
                    const resJson = await res.json();
                    console.log('resJson: ', resJson);
                    // Update current response context for next token extraction
                    data = resJson;
                    // Try FW migration first on next pages
                    try {
                        const fwNext = getFrameworkUpdatesById(resJson);
                        const reloadItemsN =
                            wrapTryCatch(
                                () =>
                                    resJson.onResponseReceivedEndpoints[1].reloadContinuationItemsCommand
                                        .continuationItems
                            ) || [];
                        const appendItemsN =
                            wrapTryCatch(
                                () =>
                                    resJson.onResponseReceivedEndpoints[0].appendContinuationItemsAction
                                        .continuationItems
                            ) || [];
                        const itemsN =
                            Array.isArray(reloadItemsN) && reloadItemsN.length > 0 ? reloadItemsN : appendItemsN;
                        cmnts =
                            Array.isArray(itemsN) && itemsN.length > 0
                                ? migrateContinuationItemsWithFW(itemsN, fwNext)
                                : [];
                    } catch {
                        cmnts = [];
                    }
                    fwById = getFrameworkUpdatesById(resJson);
                    try {
                        const hasCTRBase2 = (cmnts || []).filter(
                            (x: any) => !!wrapTryCatch(() => x.commentThreadRenderer)
                        ).length;
                        const hasCTR2 = (cmnts || []).filter(
                            (x: any) => !!wrapTryCatch(() => x.commentThreadRenderer.comment)
                        ).length;
                        const hasCV2 = (cmnts || []).filter(
                            (x: any) =>
                                !!wrapTryCatch(() => x.commentThreadRenderer.commentViewModel) ||
                                !!wrapTryCatch(() => x.commentViewModel)
                        ).length;
                        const hasCont2 = (cmnts || []).filter(
                            (x: any) => !!wrapTryCatch(() => x.continuationItemRenderer)
                        ).length;
                        console.log(
                            'batch stats (next): hasCTRBase:',
                            hasCTRBase2,
                            'hasCTR:',
                            hasCTR2,
                            'hasCV:',
                            hasCV2,
                            'hasCont:',
                            hasCont2,
                            'len:',
                            (cmnts || []).length
                        );
                        if ((cmnts || []).length > 0) {
                            console.log('first item keys (next):', Object.keys(cmnts[0]));
                        }
                    } catch (e) {
                        console.error(e);
                    }
                    // frameworkUpdates: mark heart/pinned attributes (if available)
                    try {
                        const mutations =
                            wrapTryCatch(() => resJson.frameworkUpdates.entityBatchUpdate.mutations) || [];
                        if (Array.isArray(mutations) && mutations.length > 0) {
                            const byId: Record<string, any> = {};
                            for (const m of mutations) {
                                const id = wrapTryCatch(() => m.entityKey);
                                if (id) byId[id] = m;
                            }
                            // Can use byId here to supplement comment properties if needed
                        }
                    } catch (e) {
                        console.error(e);
                    }
                    console.log('cmnts; ', cmnts);
                } else {
                    cmnts = [];
                }
            } else {
                cmnts = [];
                console.log('else last comment: ', cmnts);
            }

            console.log('iteration comments: ', comments.length);
        }
        console.log('END iteration push, now comments size is: ', comments.length);
    } catch (e) {
        console.error(e);
        // console.log('errorRequestComments: ', errorRequestComments);
        return comments;
    }

    // console.log('reply Queue: ', replyQueue);

    await replyQueue.onIdle();

    // ========== Deduplicate parent comments (keep first occurrence) ==========
    // Phase 1: Build map of commentId -> first parent comment object
    const parentByCommentId = new Map<string, any>();
    for (const cm of comments) {
        if ((cm as any)?.typeComment === 'C') {
            const id = (cm as any)?.commentRenderer?.commentId;
            if (id && !parentByCommentId.has(id)) {
                parentByCommentId.set(id, cm); // Only record first occurrence
            }
        }
    }

    // Phase 2: Filter array - keep first occurrence of each parent, all replies
    const deduplicated: typeof comments = [];
    for (const cm of comments) {
        if ((cm as any)?.typeComment === 'C') {
            // Parent comment: only keep the first occurrence
            const id = (cm as any)?.commentRenderer?.commentId;
            if (id && parentByCommentId.get(id) === cm) {
                deduplicated.push(cm);
            } else if (!id) {
                // Keep parent comments without ID (safety fallback)
                deduplicated.push(cm);
            }
            // Later duplicate parent comments are filtered out
        } else if ((cm as any)?.typeComment === 'R') {
            // Reply: update originComment to point to kept first parent
            // (replies may have been fetched via duplicate parent's continuation)
            const originId = (cm as any)?.originComment?.commentRenderer?.commentId;
            if (originId && parentByCommentId.has(originId)) {
                (cm as any).originComment = parentByCommentId.get(originId);
            }
            deduplicated.push(cm);
        } else {
            // Other types: keep as-is
            deduplicated.push(cm);
        }
    }

    // Phase 3: Replace original array in-place
    comments.length = 0;
    comments.push(...deduplicated);
    // ========== End deduplication ==========

    // Assign stable original index for all loaded comments (newest-first ascending)
    try {
        if (Array.isArray(comments) && comments.length > 0) {
            const totalLen = comments.length;
            for (let idx = 0; idx < totalLen; idx++) {
                const cm: any = comments[idx];
                cm._index = idx;
            }
        }
    } catch (e) {
        console.error(e);
    }

    return comments;
}

export { getAllCommentsModeV2, extractNextContinuation, applyFrameworkUpdatesToComment, generateCommentObjectFromFW };
