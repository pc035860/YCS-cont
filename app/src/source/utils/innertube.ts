// @ts-expect-error [No have types]
import objectScan from 'object-scan';
import Queue from 'p-queue';

import type { ChatContinuationResult, GetParams } from './interfaces/i_assist';
import { fetchR } from './libs';
import { GlobalStore, deepFindObjKey, getCleanUrlVideo, getObj, getVideoId, wrapTryCatch } from './common';
import { parseFormattedNumber } from './formatting';
import { showLoadComments } from './dom';

async function findInitYParams(initData: [object]): Promise<string | undefined> {
    try {
        if (initData) {
            let param;
            for (const obj of initData) {
                const findObj = deepFindObjKey(obj, 'serializedShareEntity')[0];
                if (findObj) {
                    [, param] = (Object as any).entries(findObj)[0];
                }

                if (param) break;
            }
            return param;
        }
    } catch (e) {
        console.error(e);
        return;
    }

    return;
}

async function _fetchPageCfgData(videoId: string, signal?: AbortSignal): Promise<any | undefined> {
    try {
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            method: 'GET',
            mode: 'no-cors',
            credentials: 'include',
            signal,
            cache: 'default'
        } as RequestInit);

        const html = await response.text();
        const splittedHtml = html.split('window.ytplayer={};\nytcfg.set(');

        if (splittedHtml.length <= 1) {
            throw new Error('Failed to load video html');
        }

        try {
            return JSON.parse(splittedHtml[1].split('); window.ytcfg.obfuscatedData_')[0].replace('\n', ''));
        } catch (error) {
            console.error(error);
            return undefined;
        }
    } catch (error) {
        console.error(error);
        return undefined;
    }
}

const pageCfgDataPool: Record<string, Promise<any> | any> = {};

async function getPageCfgData(
    globalContext: Window & typeof globalThis,
    signal?: AbortSignal,
    optUrl?: string
): Promise<any | undefined> {
    const existingData = (globalContext as any)?.ytcfg?.data_ ?? null;
    if (existingData) {
        return existingData;
    }

    const url = optUrl ?? globalContext.location?.href ?? window.location.href;
    const videoId = getVideoId(url);

    if (!videoId) {
        return undefined;
    }

    if (!pageCfgDataPool[videoId]) {
        pageCfgDataPool[videoId] = _fetchPageCfgData(videoId, signal);
    }

    try {
        return await pageCfgDataPool[videoId];
    } catch (error) {
        console.error(error);
        return undefined;
    }
}

async function getParams(w: Window & typeof globalThis, signal?: AbortSignal): Promise<GetParams> {
    const ytcfgData = await getPageCfgData(w, signal);
    const cleanUrl = getCleanUrlVideo(w.location.href) ?? w.location.href;

    return {
        ctoken: null,
        continuation: null,
        itct: null,
        params: {
            credentials: 'include',
            headers: {
                accept: '*/*',
                'accept-language': ytcfgData?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'cache-control': 'no-cache',
                'content-type': 'application/x-www-form-urlencoded',
                pragma: 'no-cache',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'x-spf-previous': cleanUrl,
                'x-spf-referer': cleanUrl,
                'x-youtube-identity-token': ytcfgData?.ID_TOKEN,
                'x-youtube-client-name': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_VERSION,
                'x-youtube-device': ytcfgData?.DEVICE || 'cbr=Chrome&cplatform=DESKTOP',
                'x-youtube-page-cl': ytcfgData?.PAGE_CL,
                'x-youtube-page-label': ytcfgData?.PAGE_BUILD_LABEL,
                'x-youtube-time-zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
                'x-youtube-utc-offset': Math.abs(new Date().getTimezoneOffset()),
                'x-youtube-variants-checksum': ytcfgData?.VARIANTS_CHECKSUM
            },
            referrer: cleanUrl,
            referrerPolicy: 'origin-when-cross-origin',
            body: `session_token=${ytcfgData?.XSRF_TOKEN ?? ''}`,
            method: 'POST',
            mode: 'cors'
        }
    };
}

function normalizeCommentFromViewModel(item: any): any | undefined {
    try {
        const commentVM =
            wrapTryCatch(() => item.commentThreadRenderer.commentViewModel) ||
            wrapTryCatch(() => item.commentViewModel);
        if (!commentVM) return undefined;

        const candidates = [] as any[];
        const preferredPaths = [
            '**.commentContentViewModel.content',
            '**.attributedText.content',
            '**.content.content',
            '**.content',
            '**.commentContentViewModel.content.runs',
            '**.attributedText.runs',
            '**.content.runs',
            '**.content.content.runs',
            '**.textContent.runs',
            '**.body.runs',
            '**.commentText.runs',
            '**.contentText.runs',
            '**.runs'
        ];
        for (const p of preferredPaths) {
            const arrs = objectScan([p], { joined: true, rtn: 'value' })(commentVM) as any[];
            for (const arr of arrs) {
                if (Array.isArray(arr)) candidates.push(arr);
            }
            if (candidates.length > 0) break;
        }

        if (candidates.length === 0) {
            const anyArrays = objectScan(['**.*'], { rtn: 'value' })(commentVM) as any[];
            for (const v of anyArrays) {
                if (
                    Array.isArray(v) &&
                    v.length > 0 &&
                    v.some(
                        (r: any) =>
                            typeof r === 'object' &&
                            (wrapTryCatch(() => r.text) ||
                                wrapTryCatch(() => r.emoji) ||
                                wrapTryCatch(() => r.attachment) ||
                                wrapTryCatch(() => r.navigationEndpoint))
                    )
                ) {
                    candidates.push(v);
                    break;
                }
            }
        }

        const runsLike = (candidates.find((a) => a && Array.isArray(a) && a.some((r: any) => typeof r === 'object')) ||
            []) as any[];

        const mapElementToRun = (elem: any): any | undefined => {
            try {
                if (!elem || typeof elem !== 'object') return undefined;
                const text = wrapTryCatch(() => elem.text) || wrapTryCatch(() => elem.simpleText);
                if (typeof text === 'string') {
                    return { text, navigationEndpoint: wrapTryCatch(() => elem.navigationEndpoint) };
                }
                const textRunContent =
                    wrapTryCatch(() => elem.textRun.content) || wrapTryCatch(() => elem.textRun.text);
                if (typeof textRunContent === 'string') {
                    return {
                        text: textRunContent,
                        navigationEndpoint: wrapTryCatch(() => elem.textRun.navigationEndpoint)
                    };
                }
                const nestedText =
                    wrapTryCatch(() => elem.content) ||
                    wrapTryCatch(() => elem.string) ||
                    wrapTryCatch(() => elem.value);
                if (typeof nestedText === 'string') {
                    return { text: nestedText };
                }
                const emoji = wrapTryCatch(() => elem.emoji) || wrapTryCatch(() => elem.emojiRun.emoji);
                if (emoji) {
                    return { emoji };
                }
                const attachment =
                    wrapTryCatch(() => elem.attachment) ||
                    wrapTryCatch(() => elem.image) ||
                    wrapTryCatch(() => elem.inlineObject);
                if (attachment) {
                    return { attachment };
                }
                return undefined;
            } catch {
                return undefined;
            }
        };

        const collectRunsFromElements = (elements: any[]): any[] => {
            const acc: any[] = [];
            for (const elem of elements) {
                const mapped = mapElementToRun(elem);
                if (mapped) acc.push(mapped);
                const nestedSegs =
                    wrapTryCatch(() => elem.attributedText?.content) ||
                    wrapTryCatch(() => elem.content?.content) ||
                    wrapTryCatch(() => elem.content);
                if (Array.isArray(nestedSegs) && nestedSegs.length > 0) {
                    acc.push(...collectRunsFromElements(nestedSegs));
                }
            }
            return acc;
        };

        let runs = collectRunsFromElements(runsLike).filter((x: any) => !!x);

        if (!runs || runs.length === 0) {
            const parts: any[] = [];
            const textValues = objectScan(['**.simpleText', '**.text', '**.content'], { joined: true, rtn: 'value' })(
                commentVM
            ) as any[];
            for (const t of textValues) {
                if (typeof t === 'string' && t.trim().length > 0) {
                    parts.push({ text: t });
                }
            }
            if (parts.length > 0) runs = parts;
        }

        return { commentRenderer: { contentText: { runs: runs || [] } } };
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

/**
 * Extracts donate chip information from liveChatPaidMessageRenderer
 * and adds it to the renderer as donatedChip structure for unified chip badge rendering
 */
function addDonatedChipFromPaidRenderer(renderer: any): void {
    const purchaseAmount =
        wrapTryCatch(() => renderer.purchaseAmountText?.simpleText) ??
        wrapTryCatch(() => (renderer.purchaseAmountText?.runs || []).map((run: any) => run?.text || '').join(''));

    if (!purchaseAmount) return;

    renderer.donatedChip = {
        pdgCommentChipRenderer: {
            chipText: {
                simpleText: purchaseAmount
            },
            chipColorPalette: {
                backgroundColor: renderer.headerBackgroundColor ?? renderer.bodyBackgroundColor,
                foregroundTitleColor: renderer.headerTextColor ?? renderer.bodyTextColor
            }
        }
    };
}

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
async function getInitYtData(url: string, signal: AbortSignal | undefined): Promise<[object] | undefined> {
    try {
        if (!url) return;

        const paramsTemplate = (await getParams(window, signal)).params as RequestInit;
        const headers = { ...(paramsTemplate.headers as Record<string, string>) };
        delete headers['content-type'];

        const requestInit: RequestInit = {
            ...paramsTemplate,
            method: 'GET',
            headers
        };

        delete (requestInit as any).body;

        const targetUrl = `${getCleanUrlVideo(url) ?? url}&pbj=1`;
        const res = await fetch(targetUrl, { ...requestInit, signal, cache: 'no-store' });

        const result = await res.json();
        (GlobalStore as any).getInitYtData = result;

        return result;
    } catch (e) {
        console.error(e);
        return;
    }
}

async function getParamsForChat(
    w: Window & typeof globalThis,
    cLiveChat: any,
    signal?: AbortSignal,
    useLegacyApi = false,
    playerOffsetMs = 0
): Promise<object | undefined> {
    if (!cLiveChat) return;

    try {
        const ytcfgData = await getPageCfgData(w, signal);

        const bodyPayload: any = {
            context: { client: ytcfgData?.INNERTUBE_CONTEXT?.client },
            continuation: cLiveChat.continuation
        };

        if (useLegacyApi) {
            bodyPayload.currentPlayerState = {
                playerOffsetMs: playerOffsetMs.toString()
            };
        }

        return {
            headers: {
                accept: '*/*',
                'accept-language': ytcfgData?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'content-type': 'application/json',
                pragma: 'no-cache',
                'cache-control': 'no-store',
                'x-youtube-client-name': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_VERSION
            },
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
            headers: {
                accept: '*/*',
                'accept-language': ytcfgData?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'content-type': 'application/json',
                pragma: 'no-cache',
                'cache-control': 'no-store',
                'x-youtube-client-name': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_VERSION
            },
            referrer: url,
            referrerPolicy: 'strict-origin-when-cross-origin',
            body: JSON.stringify({
                context: { client: ytcfgData?.INNERTUBE_CONTEXT?.client },
                videoId
            }),
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
            headers: {
                accept: '*/*',
                'accept-language': ytcfgData?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'content-type': 'application/json',
                pragma: 'no-cache',
                'cache-control': 'no-store',
                'x-youtube-client-name': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_VERSION
            },
            referrer: ps.url,
            referrerPolicy: 'strict-origin-when-cross-origin',
            body: JSON.stringify({
                context: { client: ytcfgData?.INNERTUBE_CONTEXT?.client },
                clickTracking: { clickTrackingParams: '' },
                continuation: ps.continue
            }),
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
        const body: Record<string, unknown> = {
            context: { client: ytcfgData?.INNERTUBE_CONTEXT?.client },
            continuation: params?.continue
        };

        const clickTrackingParams = params?.clickTrackingParams ?? params?.clickTracking;
        if (clickTrackingParams) {
            body.clickTracking = { clickTrackingParams };
        }

        return {
            headers: {
                accept: '*/*',
                'accept-language': ytcfgData?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'content-type': 'application/json',
                pragma: 'no-cache',
                'cache-control': 'no-store',
                'x-youtube-client-name': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_VERSION
            },
            referrerPolicy: 'strict-origin-when-cross-origin',
            body: JSON.stringify(body),
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
        const body: Record<string, unknown> = {
            context: { client: ytcfgData?.INNERTUBE_CONTEXT?.client },
            continuation: params?.continue
        };

        const clickTrackingParams = params?.clickTracking ?? params?.clickTrackingParams;
        if (clickTrackingParams) {
            body.clickTracking = { clickTrackingParams };
        }

        return {
            headers: {
                accept: '*/*',
                'accept-language': ytcfgData?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'content-type': 'application/json',
                pragma: 'no-cache',
                'cache-control': 'no-store',
                'x-youtube-client-name': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_VERSION
            },
            referrerPolicy: 'strict-origin-when-cross-origin',
            body: JSON.stringify(body),
            method: 'POST',
            mode: 'cors',
            credentials: 'include'
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

async function getParamsForLiveChat(
    w: Window & typeof globalThis,
    cLiveChat: any,
    signal?: AbortSignal
): Promise<object | undefined> {
    if (!cLiveChat) return;

    try {
        const ytcfgData = await getPageCfgData(w, signal);

        return {
            headers: {
                accept: '*/*',
                'accept-language': ytcfgData?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'content-type': 'application/json',
                pragma: 'no-cache',
                'cache-control': 'no-store',
                'x-youtube-client-name': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_VERSION
            },
            referrerPolicy: 'strict-origin-when-cross-origin',
            body: JSON.stringify({
                context: { client: ytcfgData?.INNERTUBE_CONTEXT?.client },
                continuation: cLiveChat.continuation
            }),
            method: 'POST',
            mode: 'cors',
            credentials: 'include'
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

async function getParamsForTranscript(
    w: Window & typeof globalThis,
    param: string,
    signal?: AbortSignal
): Promise<object | undefined> {
    try {
        const ytcfgData = await getPageCfgData(w, signal);
        const cleanUrl = getCleanUrlVideo(w.location.href) ?? w.location.href;

        return {
            headers: {
                accept: '*/*',
                'accept-language': ytcfgData?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
                'content-type': 'application/json',
                pragma: 'no-cache',
                'cache-control': 'no-store',
                'x-youtube-client-name': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
                'x-youtube-client-version': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_VERSION || ''
            },
            referrer: cleanUrl,
            referrerPolicy: 'origin-when-cross-origin',
            body: JSON.stringify({ context: { client: ytcfgData?.INNERTUBE_CONTEXT?.client || {} }, params: param }),
            method: 'POST',
            mode: 'cors',
            credentials: 'include'
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

function getInnertubeApiKey(): string | undefined {
    try {
        const ytcfgData = (window as any)?.ytcfg?.data_;

        const innertubeApiKey =
            ytcfgData?.INNERTUBE_API_KEY ||
            ytcfgData?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_WATCH?.innertubeApiKey ||
            ytcfgData?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_CHANNEL_TRAILER
                ?.innertubeApiKey ||
            ytcfgData?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_PLAYLIST_OVERVIEW
                ?.innertubeApiKey ||
            ytcfgData?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_VERTICAL_LANDING_PAGE_PROMO
                ?.innertubeApiKey ||
            ytcfgData?.WEB_PLAYER_CONTEXT_CONFIGS?.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_SPONSORSHIPS_OFFER
                ?.innertubeApiKey ||
            (window as any)?.ytplayer?.web_player_context_config?.innertubeApiKey ||
            (window as any)?.ytcfg?.INNERTUBE_API_KEY;

        return innertubeApiKey;
    } catch (e) {
        console.error(e);
        return;
    }
}

function getTranscriptPot(): string | undefined {
    try {
        const visited = new WeakSet<object>();
        const urls: string[] = [];

        const walk = (obj: unknown): void => {
            if (!obj || typeof obj !== 'object') return;
            if (visited.has(obj as object)) return;
            visited.add(obj as object);
            for (const key in obj as any) {
                if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
                try {
                    const value: any = (obj as any)[key];
                    if (typeof value === 'string' && value.includes('pot=')) {
                        urls.push(value);
                    } else if (value && typeof value === 'object') {
                        walk(value);
                    }
                } catch {
                    continue;
                }
            }
        };

        walk(window as any);
        if (urls.length === 0) return;
        const buf = new URL(urls[0]).searchParams.get('pot');
        return buf ? encodeURIComponent(buf) : undefined;
    } catch (e) {
        console.error(e);
        return;
    }
}

async function getCDChat(signal: AbortSignal): Promise<ChatContinuationResult> {
    try {
        const ytData = (await getInitYtData(window.location.href, signal)) as any;

        if (ytData) {
            const newApiData = wrapTryCatch(
                () =>
                    ytData.response.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.continuations[0]
                        .reloadContinuationData
            );

            if (newApiData) {
                return {
                    continuationData: newApiData,
                    apiVersion: 'new',
                    sourcePath: 'continuations[0].reloadContinuationData'
                };
            }

            const oldApiData = wrapTryCatch(
                () =>
                    ytData[3].response.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.header
                        .liveChatHeaderRenderer.viewSelector.sortFilterSubMenuRenderer.subMenuItems[1].continuation
                        .reloadContinuationData
            );

            if (oldApiData) {
                return {
                    continuationData: oldApiData,
                    apiVersion: 'old',
                    sourcePath:
                        '[3].response.header.viewSelector.sortFilterSubMenuRenderer.subMenuItems[1].continuation.reloadContinuationData'
                };
            }

            const rCData = deepFindObjKey(ytData, 'reloadContinuationData');
            if (rCData.length > 0) {
                const fallbackData = Object.values(rCData[rCData.length - 1])[0] as object;
                return {
                    continuationData: fallbackData,
                    apiVersion: 'fallback',
                    sourcePath: 'deepSearch(reloadContinuationData)'
                };
            }
        }

        return {
            continuationData: null,
            apiVersion: 'fallback',
            sourcePath: undefined
        };
    } catch (e) {
        console.error(e);
        return {
            continuationData: null,
            apiVersion: 'fallback',
            sourcePath: undefined
        };
    }
}

async function getLiveChat(signal: AbortSignal): Promise<object[] | undefined> {
    try {
        const result = await getCDChat(signal);

        if (!result.continuationData) {
            console.log('No continuation data available for live chat');
            return;
        }

        const params = await getParamsForLiveChat(window, result.continuationData, signal);

        if (params) {
            const res = await fetch(
                `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${getInnertubeApiKey()}`,
                { ...params, signal, cache: 'no-store' }
            );

            const cmnts = await res.json();

            return cmnts?.continuationContents?.liveChatContinuation;
        }

        return;
    } catch (e) {
        console.error(e);
        return;
    }
}

async function getChatComments(
    signal: AbortSignal,
    elShowLoading: HTMLElement,
    container: Map<number, object> | undefined = undefined
): Promise<Map<number, object> | undefined> {
    try {
        const _prepareFieldsChatComments = (cmnt: any): object => {
            try {
                if (
                    wrapTryCatch(
                        () =>
                            cmnt.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorBadges[0].liveChatAuthorBadgeRenderer.icon.iconType.indexOf(
                                'VERIFIED'
                            ) >= 0
                    ) ||
                    wrapTryCatch(
                        () =>
                            cmnt.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorBadges[0].liveChatAuthorBadgeRenderer.icon.iconType.indexOf(
                                'CHECK'
                            ) >= 0
                    ) ||
                    wrapTryCatch(
                        () =>
                            cmnt.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorBadges[0].liveChatAuthorBadgeRenderer.tooltip.indexOf(
                                'Verified'
                            ) >= 0
                    )
                ) {
                    try {
                        cmnt.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.verifiedAuthor = true;
                    } catch (err) {
                        console.error(err);
                    }
                }

                return cmnt;
            } catch (err) {
                console.error(err);
                return cmnt;
            }
        };

        const result = await getCDChat(signal);
        if (!result.continuationData) {
            console.log('STOP CHAT CD!!!! No continuation data available');
            return;
        }

        const cDChat = result.continuationData;
        const useLegacyApi = result.apiVersion === 'old';

        // Log detected API version
        console.log(`[getChatComments] Detected API version: ${result.apiVersion}`);
        console.log(`[getChatComments] Source path: ${result.sourcePath}`);

        const chatCmnts = container || new Map<number, object>();

        const liveChatData: any = await getLiveChat(signal);

        if (liveChatData) {
            try {
                if (liveChatData?.actions?.length > 0) {
                    console.log('IS LIVECHAT!!!!!', liveChatData);

                    for (const c of liveChatData.actions) {
                        try {
                            const protoComment = {
                                replayChatItemAction: {
                                    actions: [
                                        {
                                            addChatItemAction: {}
                                        }
                                    ]
                                }
                            };

                            protoComment.replayChatItemAction.actions[0] = c;
                            const comment: any = protoComment;

                            if (
                                !wrapTryCatch(
                                    () =>
                                        comment.replayChatItemAction.actions[0].addChatItemAction.item
                                            .liveChatTextMessageRenderer.timestampUsec
                                )
                            ) {
                                if (
                                    wrapTryCatch(
                                        () =>
                                            comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                .liveChatPaidMessageRenderer
                                    )
                                ) {
                                    comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                        comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatPaidMessageRenderer;
                                    console.log('Done! Added liveChatPaidMessageRenderer: ', comment);

                                    // Extract donate chip information from liveChatPaidMessageRenderer
                                    addDonatedChipFromPaidRenderer(
                                        comment.replayChatItemAction.actions[0].addChatItemAction.item
                                            .liveChatTextMessageRenderer
                                    );
                                } else if (
                                    wrapTryCatch(
                                        () =>
                                            comment.replayChatItemAction.actions[0].addBannerToLiveChatCommand
                                                .bannerRenderer.liveChatBannerRenderer.contents
                                                .liveChatTextMessageRenderer
                                    )
                                ) {
                                    comment.replayChatItemAction.actions[0].addChatItemAction = {
                                        item: { liveChatTextMessageRenderer: {} }
                                    };
                                    comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                        comment.replayChatItemAction.actions[0].addBannerToLiveChatCommand.bannerRenderer.liveChatBannerRenderer.contents.liveChatTextMessageRenderer;
                                    console.log('Done! Added liveChatBannerRenderer: ', comment);
                                } else if (
                                    wrapTryCatch(
                                        () =>
                                            comment.replayChatItemAction.actions[0].addLiveChatTickerItemAction.item
                                                .liveChatTickerPaidMessageItemRenderer.showItemEndpoint
                                                .showLiveChatItemEndpoint.renderer.liveChatPaidMessageRenderer
                                    )
                                ) {
                                    comment.replayChatItemAction.actions[0].addChatItemAction = {
                                        item: { liveChatTextMessageRenderer: {} }
                                    };
                                    comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                        comment.replayChatItemAction.actions[0].addLiveChatTickerItemAction.item.liveChatTickerPaidMessageItemRenderer.showItemEndpoint.showLiveChatItemEndpoint.renderer.liveChatPaidMessageRenderer;
                                    console.log('Done! Added LiveChatTickerItemAction: ', comment);

                                    // Extract donate chip information from liveChatPaidMessageRenderer
                                    addDonatedChipFromPaidRenderer(
                                        comment.replayChatItemAction.actions[0].addChatItemAction.item
                                            .liveChatTextMessageRenderer
                                    );
                                } else {
                                    // console.log('deepFindObjKey: ', deepFindObjKey(comment, 'timestampUsec'));
                                    const pathComment = wrapTryCatch(() =>
                                        Object.keys(deepFindObjKey(comment, 'timestampUsec')[0])[0]
                                            .split('.')
                                            .slice(0, -1)
                                            .join('.')
                                    ) as string | undefined;
                                    // console.log('pathComment: ', pathComment);
                                    if (pathComment) {
                                        const findedComment = getObj(comment, pathComment, undefined) as any;
                                        console.log('-----------------> GET OBJECT LIVE CHAT COMMENT: ', findedComment);

                                        if (findedComment && findedComment?.authorName && findedComment?.message) {
                                            console.log('-----------------> FINDED LIVE CHAT COMMENT: ', findedComment);
                                            comment.replayChatItemAction.actions[0].addChatItemAction = {
                                                item: { liveChatTextMessageRenderer: {} }
                                            };
                                            comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                                findedComment;
                                        }
                                    }
                                }
                            }

                            const timestampUsec: string | undefined = wrapTryCatch(
                                () =>
                                    comment.replayChatItemAction.actions[0].addChatItemAction.item
                                        .liveChatTextMessageRenderer.timestampUsec
                            ) as any;

                            if (timestampUsec && !chatCmnts.has(parseInt(timestampUsec, 10))) {
                                const chatMsgs =
                                    (wrapTryCatch(
                                        () =>
                                            comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                .liveChatTextMessageRenderer.message.runs
                                    ) as any) || [];

                                let fullText = '';
                                let renderFullTextComment = '';

                                // Removed hardcoded HTML for purchaseAmountText
                                // Now handled by donatedChip structure and chip badge rendering

                                for (const msg of chatMsgs) {
                                    try {
                                        fullText += msg?.text || '';

                                        if (parseInt(msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds) >= 0) {
                                            const currentVideoId = (getVideoId(window.location.href) || '') as string;
                                            const linkVideoId = (wrapTryCatch(
                                                () => msg?.navigationEndpoint?.watchEndpoint?.videoId
                                            ) || '') as string;
                                            const isSameVideo =
                                                String(linkVideoId || '') === String(currentVideoId || '');

                                            renderFullTextComment += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${linkVideoId}&t=${msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}s" data-offsetvideo="${msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}" data-video-id="${linkVideoId}">${msg?.text || ''}</a>`;

                                            if (
                                                isSameVideo &&
                                                wrapTryCatch(
                                                    () =>
                                                        comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                            .liveChatTextMessageRenderer
                                                )
                                            ) {
                                                comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.isTimeLine =
                                                    'timeline';
                                            }
                                        } else if (msg?.navigationEndpoint) {
                                            renderFullTextComment += `<a class="ycs-cpointer ycs-comment-link" href="${msg?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || msg?.navigationEndpoint?.urlEndpoint?.url || msg?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || msg?.text || '#'}" target="_blank">${msg?.text || ''}</a>`;
                                        } else if (wrapTryCatch(() => (msg as any).emoji)) {
                                            const url =
                                                wrapTryCatch(() => {
                                                    const thumbnails = (msg as any).emoji.image.thumbnails;
                                                    return thumbnails[thumbnails.length - 1].url;
                                                }) || '';
                                            const alt =
                                                (wrapTryCatch(() => (msg as any).emoji.shortcuts?.[0]) as string) || '';
                                            const style = `margin-left: 2px; margin-right: 2px;`;
                                            renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="24" height="24" style="${style}" class="ycs-attachment">`;
                                        } else if (wrapTryCatch(() => (msg as any).attachment?.image)) {
                                            const image: any = wrapTryCatch(() => (msg as any).attachment.image);
                                            const url = image?.url || '';
                                            const width = image?.width || 24;
                                            const height = image?.height || 24;
                                            const margin = image?.margin || { left: 0, right: 0 };
                                            const style = `margin-left: ${margin.left || 0}px; margin-right: ${margin.right || 0}px;`;
                                            const alt = (msg as any)?.text || '';
                                            renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="${width}" height="${height}" style="${style}" class="ycs-attachment">`;
                                        } else {
                                            renderFullTextComment += msg?.text || '';
                                        }
                                    } catch (e) {
                                        console.error(e);
                                        renderFullTextComment += msg?.text || '';
                                    }
                                }

                                if (fullText) {
                                    comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.fullText =
                                        fullText;

                                    comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.renderFullText =
                                        renderFullTextComment || fullText;
                                }

                                if (
                                    wrapTryCatch(
                                        () =>
                                            comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                .liveChatTextMessageRenderer.authorName
                                    )
                                ) {
                                    chatCmnts.set(parseInt(timestampUsec, 10), _prepareFieldsChatComments(comment));
                                    showLoadComments(chatCmnts.size, elShowLoading);
                                }
                            }
                        } catch (err) {
                            console.error(err);
                            continue;
                        }
                    }
                }
            } catch (e) {
                console.error(e);
                return chatCmnts;
            }
        } else {
            // Chat Replay branch - handle both legacy and new API
            if (useLegacyApi) {
                // ========== Legacy API Logic ==========
                try {
                    let currentOffsetTimeMsec = 0;
                    let next = true;

                    while (next) {
                        console.log('Loop chat comments (Legacy API)');
                        const params = await getParamsForChat(window, cDChat, signal, true, currentOffsetTimeMsec);

                        if (params) {
                            const res = await fetchR(
                                `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?key=${getInnertubeApiKey()}`,
                                { ...params, signal, cache: 'no-store' }
                            );

                            const response = await res.json();
                            const cmnts = response?.continuationContents?.liveChatContinuation?.actions;
                            console.log('Chat comments (Legacy): ', cmnts);

                            if (cmnts && cmnts.length > 0) {
                                // Extract videoOffsetTimeMsec from last comment
                                const lastOffsetTimeInCmnts = wrapTryCatch(() => {
                                    const offsetData = deepFindObjKey(
                                        cmnts[cmnts.length - 1],
                                        'videoOffsetTimeMsec'
                                    )[0];
                                    return (Object as any).entries(offsetData)[0][1];
                                }) as number | undefined;

                                console.log('lastOffsetTimeInCmnts: ', lastOffsetTimeInCmnts);

                                // Check if we've reached the end
                                if (currentOffsetTimeMsec === lastOffsetTimeInCmnts) {
                                    console.log('BREAK! Reached end of chat replay (Legacy API)');
                                    next = false;
                                    break;
                                }

                                // Process all comments
                                for (const comment of cmnts) {
                                    try {
                                        if (
                                            !wrapTryCatch(
                                                () =>
                                                    comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                        .liveChatTextMessageRenderer.timestampUsec
                                            )
                                        ) {
                                            if (
                                                wrapTryCatch(
                                                    () =>
                                                        comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                            .liveChatPaidMessageRenderer
                                                )
                                            ) {
                                                comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                                    comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatPaidMessageRenderer;
                                                console.log('Done! Added liveChatPaidMessageRenderer: ', comment);

                                                // Extract donate chip information from liveChatPaidMessageRenderer
                                                addDonatedChipFromPaidRenderer(
                                                    comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                        .liveChatTextMessageRenderer
                                                );
                                            } else if (
                                                wrapTryCatch(
                                                    () =>
                                                        comment.replayChatItemAction.actions[0]
                                                            .addBannerToLiveChatCommand.bannerRenderer
                                                            .liveChatBannerRenderer.contents.liveChatTextMessageRenderer
                                                )
                                            ) {
                                                comment.replayChatItemAction.actions[0].addChatItemAction = {
                                                    item: { liveChatTextMessageRenderer: {} }
                                                };
                                                comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                                    comment.replayChatItemAction.actions[0].addBannerToLiveChatCommand.bannerRenderer.liveChatBannerRenderer.contents.liveChatTextMessageRenderer;
                                                console.log('Done! Added liveChatBannerRenderer: ', comment);
                                            } else if (
                                                wrapTryCatch(
                                                    () =>
                                                        comment.replayChatItemAction.actions[0]
                                                            .addLiveChatTickerItemAction.item
                                                            .liveChatTickerPaidMessageItemRenderer.showItemEndpoint
                                                            .showLiveChatItemEndpoint.renderer
                                                            .liveChatPaidMessageRenderer
                                                )
                                            ) {
                                                comment.replayChatItemAction.actions[0].addChatItemAction = {
                                                    item: { liveChatTextMessageRenderer: {} }
                                                };
                                                comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                                    comment.replayChatItemAction.actions[0].addLiveChatTickerItemAction.item.liveChatTickerPaidMessageItemRenderer.showItemEndpoint.showLiveChatItemEndpoint.renderer.liveChatPaidMessageRenderer;
                                                console.log('Done! Added LiveChatTickerItemAction: ', comment);

                                                // Extract donate chip information from liveChatPaidMessageRenderer
                                                addDonatedChipFromPaidRenderer(
                                                    comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                        .liveChatTextMessageRenderer
                                                );
                                            } else {
                                                // console.log('deepFindObjKey: ', deepFindObjKey(comment, 'timestampUsec'));
                                                const pathComment = wrapTryCatch(() =>
                                                    Object.keys(deepFindObjKey(comment, 'timestampUsec')[0])[0]
                                                        .split('.')
                                                        .slice(0, -1)
                                                        .join('.')
                                                ) as string | undefined;
                                                // console.log('pathComment: ', pathComment);
                                                if (pathComment) {
                                                    const findedComment = getObj(
                                                        comment,
                                                        pathComment,
                                                        undefined
                                                    ) as any;
                                                    console.log(
                                                        '-----------------> GET OBJECT CHAT COMMENT: ',
                                                        findedComment
                                                    );

                                                    if (
                                                        findedComment &&
                                                        findedComment?.authorName &&
                                                        findedComment?.message
                                                    ) {
                                                        console.log(
                                                            '-----------------> FINDED CHAT COMMENT: ',
                                                            findedComment
                                                        );
                                                        comment.replayChatItemAction.actions[0].addChatItemAction = {
                                                            item: { liveChatTextMessageRenderer: {} }
                                                        };
                                                        comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                                            findedComment;
                                                    }
                                                }
                                            }
                                        }

                                        const timestampUsec: string | undefined = wrapTryCatch(
                                            () =>
                                                comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                    .liveChatTextMessageRenderer.timestampUsec
                                        ) as any;

                                        if (timestampUsec && !chatCmnts.has(parseInt(timestampUsec, 10))) {
                                            const chatMsgs =
                                                (wrapTryCatch(
                                                    () =>
                                                        comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                            .liveChatTextMessageRenderer.message.runs
                                                ) as any) || [];

                                            let fullText = '';
                                            let renderFullTextComment = '';

                                            // Removed hardcoded HTML for purchaseAmountText
                                            // Now handled by donatedChip structure and chip badge rendering

                                            for (const msg of chatMsgs) {
                                                try {
                                                    fullText += msg?.text || '';

                                                    if (
                                                        parseInt(
                                                            msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds
                                                        ) >= 0
                                                    ) {
                                                        renderFullTextComment += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${msg?.navigationEndpoint?.watchEndpoint?.videoId}&t=${msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}s" data-offsetvideo="${msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}">${msg?.text || ''}</a>`;

                                                        const currentVideoId = (getVideoId(window.location.href) ||
                                                            '') as string;
                                                        const linkVideoId = (wrapTryCatch(
                                                            () => msg?.navigationEndpoint?.watchEndpoint?.videoId
                                                        ) || '') as string;
                                                        const isSameVideo =
                                                            String(linkVideoId || '') === String(currentVideoId || '');

                                                        if (
                                                            isSameVideo &&
                                                            wrapTryCatch(
                                                                () =>
                                                                    comment.replayChatItemAction.actions[0]
                                                                        .addChatItemAction.item
                                                                        .liveChatTextMessageRenderer
                                                            )
                                                        ) {
                                                            comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.isTimeLine =
                                                                'timeline';
                                                        }
                                                    } else if (msg?.navigationEndpoint) {
                                                        renderFullTextComment += `<a class="ycs-cpointer ycs-comment-link" href="${msg?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || msg?.navigationEndpoint?.urlEndpoint?.url || msg?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || msg?.text || '#'}" target="_blank">${msg?.text || ''}</a>`;
                                                    } else if (wrapTryCatch(() => (msg as any).emoji)) {
                                                        const emoji: any = wrapTryCatch(() => (msg as any).emoji) || {};
                                                        const thumbnails =
                                                            wrapTryCatch(() => emoji.image.thumbnails) || [];
                                                        const url =
                                                            wrapTryCatch(() => thumbnails[thumbnails.length - 1].url) ||
                                                            '';
                                                        const shortcut =
                                                            (wrapTryCatch(() => emoji.shortcuts?.[0]) as string) || '';
                                                        const label =
                                                            (wrapTryCatch(
                                                                () => emoji.image.accessibility.accessibilityData.label
                                                            ) as string) || '';

                                                        // Always add a textual placeholder into fullText for exports/search
                                                        if (shortcut) {
                                                            fullText += shortcut;
                                                        } else if (label) {
                                                            fullText += `:${label}:`;
                                                        } else {
                                                            fullText += ':emoji:';
                                                        }

                                                        // Prefer image in rich HTML, fallback to shortcut text if no image URL
                                                        const alt = shortcut || label || 'emoji';
                                                        const style = `margin-left: 2px; margin-right: 2px;`;
                                                        if (url) {
                                                            renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="24" height="24" style="${style}" class="ycs-attachment">`;
                                                        } else {
                                                            renderFullTextComment += alt;
                                                        }
                                                    } else if (wrapTryCatch(() => (msg as any).attachment?.image)) {
                                                        const image: any = wrapTryCatch(
                                                            () => (msg as any).attachment.image
                                                        );
                                                        const url = image?.url || '';
                                                        const width = image?.width || 24;
                                                        const height = image?.height || 24;
                                                        const margin = image?.margin || { left: 0, right: 0 };
                                                        const style = `margin-left: ${margin.left || 0}px; margin-right: ${margin.right || 0}px;`;
                                                        const alt = (msg as any)?.text || '';
                                                        renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="${width}" height="${height}" style="${style}" class="ycs-attachment">`;
                                                    } else {
                                                        renderFullTextComment += msg?.text || '';
                                                    }
                                                } catch (e) {
                                                    console.error(e);
                                                    renderFullTextComment += msg?.text || '';
                                                }
                                            }

                                            if (fullText) {
                                                comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.fullText =
                                                    fullText;

                                                comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.renderFullText =
                                                    renderFullTextComment || fullText;
                                            }

                                            if (
                                                wrapTryCatch(
                                                    () =>
                                                        comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                            .liveChatTextMessageRenderer.authorName
                                                )
                                            ) {
                                                chatCmnts.set(
                                                    parseInt(timestampUsec, 10),
                                                    _prepareFieldsChatComments(comment)
                                                );
                                                showLoadComments(chatCmnts.size, elShowLoading);
                                            }
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        continue;
                                    }
                                }

                                // Update playerOffsetMs for next iteration
                                if (lastOffsetTimeInCmnts !== undefined) {
                                    currentOffsetTimeMsec = lastOffsetTimeInCmnts;
                                }
                            } else {
                                next = false;
                            }
                        } else {
                            next = false;
                        }
                    }

                    return chatCmnts;
                } catch (e) {
                    console.error('Legacy API error:', e);
                    return chatCmnts;
                }
            } else {
                // ========== New API Logic ==========
                try {
                    let nextContinuation = cDChat;

                    while (nextContinuation) {
                        console.log('Loop chat comments (New API)');
                        const params = await getParamsForChat(window, nextContinuation, signal, false);

                        if (params) {
                            const res = await fetchR(
                                `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay`,
                                { ...params, signal, cache: 'no-store' }
                            );

                            const response = await res.json();
                            const cmnts = response?.continuationContents?.liveChatContinuation?.actions;
                            console.log('Chat comments (New): ', cmnts);

                            // Extract next continuation token
                            const continuations = response?.continuationContents?.liveChatContinuation?.continuations;
                            const continuationToken = continuations?.[0]?.liveChatReplayContinuationData?.continuation;
                            if (continuationToken) {
                                nextContinuation = { continuation: continuationToken };
                            } else {
                                break;
                            }

                            if (cmnts && cmnts.length > 0) {
                                for (const comment of cmnts) {
                                    try {
                                        if (
                                            !wrapTryCatch(
                                                () =>
                                                    comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                        .liveChatTextMessageRenderer.timestampUsec
                                            )
                                        ) {
                                            if (
                                                wrapTryCatch(
                                                    () =>
                                                        comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                            .liveChatPaidMessageRenderer
                                                )
                                            ) {
                                                comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                                    comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatPaidMessageRenderer;
                                                console.log('Done! Added liveChatPaidMessageRenderer: ', comment);

                                                // Extract donate chip information from liveChatPaidMessageRenderer
                                                addDonatedChipFromPaidRenderer(
                                                    comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                        .liveChatTextMessageRenderer
                                                );
                                            } else if (
                                                wrapTryCatch(
                                                    () =>
                                                        comment.replayChatItemAction.actions[0]
                                                            .addBannerToLiveChatCommand.bannerRenderer
                                                            .liveChatBannerRenderer.contents.liveChatTextMessageRenderer
                                                )
                                            ) {
                                                comment.replayChatItemAction.actions[0].addChatItemAction = {
                                                    item: { liveChatTextMessageRenderer: {} }
                                                };
                                                comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                                    comment.replayChatItemAction.actions[0].addBannerToLiveChatCommand.bannerRenderer.liveChatBannerRenderer.contents.liveChatTextMessageRenderer;
                                                console.log('Done! Added liveChatBannerRenderer: ', comment);
                                            } else if (
                                                wrapTryCatch(
                                                    () =>
                                                        comment.replayChatItemAction.actions[0]
                                                            .addLiveChatTickerItemAction.item
                                                            .liveChatTickerPaidMessageItemRenderer.showItemEndpoint
                                                            .showLiveChatItemEndpoint.renderer
                                                            .liveChatPaidMessageRenderer
                                                )
                                            ) {
                                                comment.replayChatItemAction.actions[0].addChatItemAction = {
                                                    item: { liveChatTextMessageRenderer: {} }
                                                };
                                                comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                                    comment.replayChatItemAction.actions[0].addLiveChatTickerItemAction.item.liveChatTickerPaidMessageItemRenderer.showItemEndpoint.showLiveChatItemEndpoint.renderer.liveChatPaidMessageRenderer;
                                                console.log('Done! Added LiveChatTickerItemAction: ', comment);

                                                // Extract donate chip information from liveChatPaidMessageRenderer
                                                addDonatedChipFromPaidRenderer(
                                                    comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                        .liveChatTextMessageRenderer
                                                );
                                            } else {
                                                const pathComment = wrapTryCatch(() =>
                                                    Object.keys(deepFindObjKey(comment, 'timestampUsec')[0])[0]
                                                        .split('.')
                                                        .slice(0, -1)
                                                        .join('.')
                                                ) as string | undefined;

                                                if (pathComment) {
                                                    const findedComment = getObj(
                                                        comment,
                                                        pathComment,
                                                        undefined
                                                    ) as any;
                                                    console.log(
                                                        '-----------------> GET OBJECT CHAT COMMENT: ',
                                                        findedComment
                                                    );

                                                    if (
                                                        findedComment &&
                                                        findedComment?.authorName &&
                                                        findedComment?.message
                                                    ) {
                                                        console.log(
                                                            '-----------------> FINDED CHAT COMMENT: ',
                                                            findedComment
                                                        );
                                                        comment.replayChatItemAction.actions[0].addChatItemAction = {
                                                            item: { liveChatTextMessageRenderer: {} }
                                                        };
                                                        comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                                            findedComment;
                                                    }
                                                }
                                            }
                                        }

                                        const timestampUsec: string | undefined = wrapTryCatch(
                                            () =>
                                                comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                    .liveChatTextMessageRenderer.timestampUsec
                                        ) as any;

                                        if (timestampUsec && !chatCmnts.has(parseInt(timestampUsec, 10))) {
                                            const chatMsgs =
                                                (wrapTryCatch(
                                                    () =>
                                                        comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                            .liveChatTextMessageRenderer.message.runs
                                                ) as any) || [];

                                            let fullText = '';
                                            let renderFullTextComment = '';

                                            // Removed hardcoded HTML for purchaseAmountText
                                            // Now handled by donatedChip structure and chip badge rendering

                                            for (const msg of chatMsgs) {
                                                try {
                                                    fullText += msg?.text || '';

                                                    if (
                                                        parseInt(
                                                            msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds
                                                        ) >= 0
                                                    ) {
                                                        renderFullTextComment += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${msg?.navigationEndpoint?.watchEndpoint?.videoId}&t=${msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}s" data-offsetvideo="${msg?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}">${msg?.text || ''}</a>`;

                                                        const currentVideoId = (getVideoId(window.location.href) ||
                                                            '') as string;
                                                        const linkVideoId = (wrapTryCatch(
                                                            () => msg?.navigationEndpoint?.watchEndpoint?.videoId
                                                        ) || '') as string;
                                                        const isSameVideo =
                                                            String(linkVideoId || '') === String(currentVideoId || '');

                                                        if (
                                                            isSameVideo &&
                                                            wrapTryCatch(
                                                                () =>
                                                                    comment.replayChatItemAction.actions[0]
                                                                        .addChatItemAction.item
                                                                        .liveChatTextMessageRenderer
                                                            )
                                                        ) {
                                                            comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.isTimeLine =
                                                                'timeline';
                                                        }
                                                    } else if (msg?.navigationEndpoint) {
                                                        renderFullTextComment += `<a class="ycs-cpointer ycs-comment-link" href="${msg?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || msg?.navigationEndpoint?.urlEndpoint?.url || msg?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || msg?.text || '#'}" target="_blank">${msg?.text || ''}</a>`;
                                                    } else if (wrapTryCatch(() => (msg as any).emoji)) {
                                                        const emoji: any = wrapTryCatch(() => (msg as any).emoji) || {};
                                                        const thumbnails =
                                                            wrapTryCatch(() => emoji.image.thumbnails) || [];
                                                        const url =
                                                            wrapTryCatch(() => thumbnails[thumbnails.length - 1].url) ||
                                                            '';
                                                        const shortcut =
                                                            (wrapTryCatch(() => emoji.shortcuts?.[0]) as string) || '';
                                                        const label =
                                                            (wrapTryCatch(
                                                                () => emoji.image.accessibility.accessibilityData.label
                                                            ) as string) || '';

                                                        if (shortcut) {
                                                            fullText += shortcut;
                                                        } else if (label) {
                                                            fullText += `:${label}:`;
                                                        } else {
                                                            fullText += ':emoji:';
                                                        }

                                                        const alt = shortcut || label || 'emoji';
                                                        const style = `margin-left: 2px; margin-right: 2px;`;
                                                        if (url) {
                                                            renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="24" height="24" style="${style}" class="ycs-attachment">`;
                                                        } else {
                                                            renderFullTextComment += alt;
                                                        }
                                                    } else if (wrapTryCatch(() => (msg as any).attachment?.image)) {
                                                        const image: any = wrapTryCatch(
                                                            () => (msg as any).attachment.image
                                                        );
                                                        const url = image?.url || '';
                                                        const width = image?.width || 24;
                                                        const height = image?.height || 24;
                                                        const margin = image?.margin || { left: 0, right: 0 };
                                                        const style = `margin-left: ${margin.left || 0}px; margin-right: ${margin.right || 0}px;`;
                                                        const alt = (msg as any)?.text || '';
                                                        renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="${width}" height="${height}" style="${style}" class="ycs-attachment">`;
                                                    } else {
                                                        renderFullTextComment += msg?.text || '';
                                                    }
                                                } catch (e) {
                                                    console.error(e);
                                                    renderFullTextComment += msg?.text || '';
                                                }
                                            }

                                            if (fullText) {
                                                comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.fullText =
                                                    fullText;

                                                comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.renderFullText =
                                                    renderFullTextComment || fullText;
                                            }

                                            if (
                                                wrapTryCatch(
                                                    () =>
                                                        comment.replayChatItemAction.actions[0].addChatItemAction.item
                                                            .liveChatTextMessageRenderer.authorName
                                                )
                                            ) {
                                                chatCmnts.set(
                                                    parseInt(timestampUsec, 10),
                                                    _prepareFieldsChatComments(comment)
                                                );
                                                showLoadComments(chatCmnts.size, elShowLoading);
                                            }
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        continue;
                                    }
                                }
                            }

                            // Check if there are more messages
                            if (!nextContinuation) {
                                console.log('No more continuation, finished loading chat');
                                break;
                            }
                        } else {
                            break;
                        }
                    }

                    return chatCmnts;
                } catch (e) {
                    console.error('New API error:', e);
                    return chatCmnts;
                }
            }
        }
    } catch (e) {
        console.error(e);
        return;
    }

    return;
}

async function getTranscriptBaseUrl(w: any, signal: AbortSignal): Promise<string> {
    const baseUrl = getCleanUrlVideo(w.location.href) as string;
    const htmlResp = await fetch(baseUrl, {
        method: 'GET',
        mode: 'no-cors' as RequestMode,
        credentials: 'include',
        signal,
        cache: 'no-store'
    } as RequestInit);
    const html = await htmlResp.text();
    const splitted = html.split('"captions":');
    if (splitted.length <= 1) throw new Error('Fail to load video html');
    const captions = JSON.parse(
        splitted[1].split(',"videoDetails')[0].replace('\n', '')
    ).playerCaptionsTracklistRenderer;
    const tracks: any[] = (captions.captionTracks || []) as any[];
    const generatedTracks = tracks.filter(({ kind }: any) => kind === 'asr');
    const englishTracks = generatedTracks.filter(({ languageCode }: any) => languageCode === 'en');
    const chosen = (englishTracks[0] || generatedTracks[0] || tracks[0]) as any;
    const base = chosen?.baseUrl as string;
    return base;
}

function buildTranscriptFromTimedText(xmlText: string): object | undefined {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'application/xml');
        const nodes = Array.from(doc.getElementsByTagName('text')) as Element[];
        const entries: any[] = nodes.map((n) => ({
            start: parseFloat(n.getAttribute('start') || '0'),
            duration: parseFloat(n.getAttribute('dur') || '0'),
            text: n.textContent || ''
        }));
        const cueGroups = entries.map(({ text, start }) => ({
            transcriptCueGroupRenderer: {
                formattedStartOffset: { simpleText: toFormatted(start) },
                cues: [{ transcriptCueRenderer: { startOffsetMs: start * 1000, cue: { simpleText: text } } }]
            }
        }));
        return {
            actions: [
                {
                    updateEngagementPanelAction: {
                        content: {
                            transcriptRenderer: {
                                body: {
                                    transcriptBodyRenderer: { cueGroups }
                                }
                            }
                        }
                    }
                }
            ]
        };
    } catch (e) {
        console.error(e);
        try {
            const entries: any[] = [];
            const regex = /<text start="([0-9.]+)" dur="([0-9.]+)">([\s\S]*?)<\/text>/g;
            let m: RegExpExecArray | null;
            while ((m = regex.exec(xmlText))) {
                const start = parseFloat(m[1]);
                const text = m[3].replace(/<\/?\w+[^>]*>/g, '');
                entries.push({ start, text });
            }
            const cueGroups = entries.map(({ text, start }) => ({
                transcriptCueGroupRenderer: {
                    formattedStartOffset: { simpleText: toFormatted(start) },
                    cues: [{ transcriptCueRenderer: { startOffsetMs: start * 1000, cue: { simpleText: text } } }]
                }
            }));
            return {
                actions: [
                    {
                        updateEngagementPanelAction: {
                            content: {
                                transcriptRenderer: {
                                    body: { transcriptBodyRenderer: { cueGroups } }
                                }
                            }
                        }
                    }
                ]
            };
        } catch {
            return;
        }
    }
}

function toFormatted(sec: number): string {
    try {
        let left = sec;
        const h = Math.floor(left / 3600);
        left -= h * 3600;
        const m = Math.floor(left / 60);
        left -= m * 60;
        const s = Math.floor(left);

        let output = `${s}`.padStart(2, '0');

        if (m || h) {
            let seg: string;

            if (!m) {
                seg = '00';
            } else {
                if (h) {
                    seg = `${m}`.padStart(2, '0');
                } else {
                    seg = m.toString();
                }
            }

            output = `${seg}:${output}`;
        }

        if (h) {
            output = `${h}:${output}`;
        }

        if (!m && !h) {
            output = `0:${output}`;
        }

        return output;
    } catch {
        return '0:00';
    }
}

async function getTranscriptVideo(signal: AbortSignal): Promise<object | undefined> {
    try {
        const initData = await getInitYtData(getCleanUrlVideo(window.location.href) as any, signal);

        // Try youtubei get_transcript first
        try {
            if (initData) {
                const ytInitParam = await findInitYParams(initData);
                if (ytInitParam) {
                    const params = await getParamsForTranscript(window, ytInitParam, signal);
                    console.log('PARAMS for TRANSCRIPT', params);
                    const resp = await fetch(
                        `https://www.youtube.com/youtubei/v1/get_transcript?key=${getInnertubeApiKey()}`,
                        { ...params, signal, cache: 'no-store' }
                    );
                    const json = await resp.json();
                    const ok = wrapTryCatch(
                        () =>
                            json.actions[0].updateEngagementPanelAction.content.transcriptRenderer.body
                                .transcriptBodyRenderer.cueGroups.length > 0
                    );
                    if (ok) return json;
                }
            }
        } catch (e) {
            console.error('youtubei get_transcript attempt failed', e);
        }

        // Fallback A: direct timedtext without pot
        try {
            const base = await getTranscriptBaseUrl(window, signal);
            if (base) {
                const viaTimedText = await fetch(base, {
                    method: 'GET',
                    mode: 'no-cors' as RequestMode,
                    credentials: 'include',
                    signal,
                    cache: 'no-store'
                } as RequestInit);
                const text = await viaTimedText.text();
                const built = buildTranscriptFromTimedText(text);
                const ok = wrapTryCatch(
                    () =>
                        (built as any).actions[0].updateEngagementPanelAction.content.transcriptRenderer.body
                            .transcriptBodyRenderer.cueGroups.length > 0
                );
                if (ok) return built;
            }
        } catch (e) {
            console.error('direct timedtext fallback failed', e);
        }

        // Fallback B: timedtext with pot param
        try {
            const pot = getTranscriptPot();
            if (pot) {
                const base = await getTranscriptBaseUrl(window, signal);
                const viaTimedText = await fetch(`${base}&potc=1&pot=${pot}&c=WEB`, {
                    method: 'GET',
                    mode: 'no-cors' as RequestMode,
                    credentials: 'include',
                    signal,
                    cache: 'no-store'
                } as RequestInit);
                const text = await viaTimedText.text();
                return buildTranscriptFromTimedText(text);
            }
        } catch (e) {
            console.error('timedtext with pot failed', e);
        }
    } catch (e) {
        console.error(e);
        return;
    }

    return;
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
                    const normalizedEarly = normalizeCommentFromViewModel(c);
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
                                renderFullTextComment += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.videoId)}&t=${wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.startTimeSeconds)}s" data-offsetvideo="${wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.startTimeSeconds)}">${text || ''}</a>`;

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
                    const normalized = normalizeCommentFromViewModel(c);
                    if (normalized && normalized.commentRenderer?.contentText?.runs) {
                        let fullTextComment = '';
                        let renderFullTextComment = '';

                        const contentText = normalized.commentRenderer.contentText.runs || [];
                        for (const partTextComment of contentText) {
                            fullTextComment += partTextComment?.text || '';
                            try {
                                if (
                                    parseInt(partTextComment?.navigationEndpoint?.watchEndpoint?.startTimeSeconds) >= 0
                                ) {
                                    const currentVideoId = (getVideoId(window.location.href) || '') as string;
                                    const linkVideoId = (wrapTryCatch(
                                        () => partTextComment?.navigationEndpoint?.watchEndpoint?.videoId
                                    ) || '') as string;
                                    const isSameVideo = String(linkVideoId || '') === String(currentVideoId || '');

                                    renderFullTextComment += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${linkVideoId}&t=${partTextComment?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}s" data-offsetvideo="${partTextComment?.navigationEndpoint?.watchEndpoint?.startTimeSeconds}" data-video-id="${linkVideoId}">${partTextComment?.text || ''}</a>`;
                                    try {
                                        if (isSameVideo) normalized.commentRenderer.isTimeLine = 'timeline';
                                    } catch {
                                        // If timeline property setting fails, continue processing
                                    }
                                } else if (partTextComment?.navigationEndpoint) {
                                    renderFullTextComment += `<a class="ycs-cpointer ycs-comment-link" href="${partTextComment?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || partTextComment?.navigationEndpoint?.urlEndpoint?.url || partTextComment?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || partTextComment?.text || '#'}" target="_blank">${partTextComment?.text || ''}</a>`;
                                } else if (wrapTryCatch(() => (partTextComment as any).emoji)) {
                                    const url =
                                        wrapTryCatch(() => {
                                            const thumbnails = (partTextComment as any).emoji.image.thumbnails;
                                            return thumbnails[thumbnails.length - 1].url;
                                        }) || '';
                                    const alt =
                                        (wrapTryCatch(() => (partTextComment as any).emoji.shortcuts?.[0]) as string) ||
                                        '';
                                    const style = `margin-left: 2px; margin-right: 2px;`;
                                    renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="24" height="24" style="${style}" class="ycs-attachment">`;
                                } else if (wrapTryCatch(() => (partTextComment as any).attachment?.image)) {
                                    const image: any = wrapTryCatch(() => (partTextComment as any).attachment.image);
                                    const url = image?.url || '';
                                    const width = image?.width || 24;
                                    const height = image?.height || 24;
                                    const margin = image?.margin || { left: 0, right: 0 };
                                    const style = `margin-left: ${margin.left || 0}px; margin-right: ${margin.right || 0}px;`;
                                    const alt = (partTextComment as any)?.text || '';
                                    renderFullTextComment += `<img src="${url}" alt="${alt}" title="${alt}" width="${width}" height="${height}" style="${style}" class="ycs-attachment">`;
                                } else {
                                    renderFullTextComment += partTextComment?.text || '';
                                }
                            } catch (e) {
                                console.error(e);
                                renderFullTextComment += partTextComment?.text || '';
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
                                        const norm = normalizeCommentFromViewModel(comment);
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

                                                renderFullTextComment += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${linkVideoId}&t=${wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.startTimeSeconds)}s" data-offsetvideo="${wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.startTimeSeconds)}" data-video-id="${linkVideoId}">${textStr || ''}</a>`;

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
                                            const norm = normalizeCommentFromViewModel(comment);
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

                                                    renderFullTextComment += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${linkVideoId}&t=${wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.startTimeSeconds)}s" data-offsetvideo="${wrapTryCatch(() => navigationEndpoint?.watchEndpoint?.startTimeSeconds)}" data-video-id="${linkVideoId}">${text || ''}</a>`;

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

export {
    getParams,
    getAllCommentsModeV2,
    getTranscriptVideo,
    getParamsForChat,
    getChatComments,
    getInitYtData,
    extractNextContinuation,
    // Test exports
    applyFrameworkUpdatesToComment,
    generateCommentObjectFromFW
};
