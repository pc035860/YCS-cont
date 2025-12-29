import { encode } from 'html-entities';
import { deepFindObjKey, getObj, wrapTryCatch } from '../../common';
import { safeUrl } from '../../formatting';

export interface ChatProcessingContext {
    chatMap: Map<number, object>;
    currentVideoId?: string;
    onCommentAdded?: (count: number) => void;
    broadcastStartTime?: string; // ISO timestamp for calculating videoOffsetTimeMsec in live chat
}

export interface FormatChatRunsOptions {
    currentVideoId?: string;
}

export interface FormatChatRunsResult {
    fullText: string;
    richText: string;
    hasTimelineLink: boolean;
}

export function addDonatedChipFromPaidRenderer(renderer: any): void {
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

export function prepareChatCommentFields(comment: any): any {
    try {
        const renderer = wrapTryCatch(
            () => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer
        );
        if (!renderer) return comment;

        const badgeRenderer = wrapTryCatch(() => renderer.authorBadges?.[0]?.liveChatAuthorBadgeRenderer);
        const iconType = wrapTryCatch(() => badgeRenderer?.icon?.iconType) as string | undefined;
        const tooltip = wrapTryCatch(() => badgeRenderer?.tooltip) as string | undefined;

        if (typeof iconType === 'string' && (iconType.indexOf('VERIFIED') >= 0 || iconType.indexOf('CHECK') >= 0)) {
            renderer.verifiedAuthor = true;
        } else if (typeof tooltip === 'string' && tooltip.indexOf('Verified') >= 0) {
            renderer.verifiedAuthor = true;
        }

        return comment;
    } catch (error) {
        console.error(error);
        return comment;
    }
}

export function markTimelineLinks(comment: any, hasTimelineLink: boolean): void {
    if (!hasTimelineLink) return;

    try {
        const renderer = wrapTryCatch(
            () => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer
        );
        if (!renderer) return;

        renderer.isTimeLine = 'timeline';
    } catch (error) {
        console.error(error);
    }
}

export function ensureTextMessageRenderer(comment: any): void {
    try {
        const action = wrapTryCatch(() => comment?.replayChatItemAction?.actions?.[0]) as any;
        if (!action) return;

        const existingTimestamp = wrapTryCatch(
            () => action?.addChatItemAction?.item?.liveChatTextMessageRenderer?.timestampUsec
        );
        if (existingTimestamp) return;

        const paidRenderer = wrapTryCatch(() => action?.addChatItemAction?.item?.liveChatPaidMessageRenderer);
        if (paidRenderer) {
            action.addChatItemAction = action.addChatItemAction || { item: {} };
            action.addChatItemAction.item = action.addChatItemAction.item || {};
            action.addChatItemAction.item.liveChatTextMessageRenderer = paidRenderer;
            addDonatedChipFromPaidRenderer(action.addChatItemAction.item.liveChatTextMessageRenderer);
            return;
        }

        const bannerRenderer = wrapTryCatch(
            () =>
                action?.addBannerToLiveChatCommand?.bannerRenderer?.liveChatBannerRenderer?.contents
                    ?.liveChatTextMessageRenderer
        );
        if (bannerRenderer) {
            action.addChatItemAction = { item: { liveChatTextMessageRenderer: bannerRenderer } };
            return;
        }

        const tickerRenderer = wrapTryCatch(
            () =>
                action?.addLiveChatTickerItemAction?.item?.liveChatTickerPaidMessageItemRenderer?.showItemEndpoint
                    ?.showLiveChatItemEndpoint?.renderer?.liveChatPaidMessageRenderer
        );
        if (tickerRenderer) {
            action.addChatItemAction = { item: { liveChatTextMessageRenderer: tickerRenderer } };
            addDonatedChipFromPaidRenderer(action.addChatItemAction.item.liveChatTextMessageRenderer);
            return;
        }

        const pathComment = wrapTryCatch(() => {
            const matches = deepFindObjKey(comment, 'timestampUsec');
            if (!Array.isArray(matches) || matches.length === 0) return undefined;
            return Object.keys(matches[0])[0].split('.').slice(0, -1).join('.');
        }) as string | undefined;

        if (pathComment) {
            const foundComment = getObj(comment, pathComment, undefined) as any;
            if (foundComment?.authorName && foundComment?.message) {
                action.addChatItemAction = { item: { liveChatTextMessageRenderer: foundComment } };
            }
        }
    } catch (error) {
        console.error(error);
    }
}

export function formatChatRuns(runs: any[], options: FormatChatRunsOptions = {}): FormatChatRunsResult {
    const result: FormatChatRunsResult = {
        fullText: '',
        richText: '',
        hasTimelineLink: false
    };

    const items = Array.isArray(runs) ? runs : [];

    for (const run of items) {
        try {
            const text = (wrapTryCatch(() => run?.text) as string) || '';
            result.fullText += text;

            const startTimeValue = wrapTryCatch(() => run?.navigationEndpoint?.watchEndpoint?.startTimeSeconds) as
                | string
                | number
                | undefined;
            const startTimeSeconds = Number.parseInt(String(startTimeValue ?? ''), 10);

            if (!Number.isNaN(startTimeSeconds) && startTimeSeconds >= 0) {
                const linkVideoId = (wrapTryCatch(() => run?.navigationEndpoint?.watchEndpoint?.videoId) ||
                    '') as string;
                const href = `https://www.youtube.com/watch?v=${linkVideoId}&t=${startTimeSeconds}s`;
                result.richText += `<a class="ycs-cpointer ycs-goto-comment-time" href="${href}" data-offsetvideo="${startTimeSeconds}" data-video-id="${linkVideoId}">${encode(text || '')}</a>`;

                if (options.currentVideoId && String(linkVideoId || '') === String(options.currentVideoId || '')) {
                    result.hasTimelineLink = true;
                }

                continue;
            }

            if (run?.navigationEndpoint) {
                const rawHref =
                    run?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ||
                    run?.navigationEndpoint?.urlEndpoint?.url ||
                    run?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url ||
                    '';
                const href = safeUrl(rawHref);

                result.richText += `<a class="ycs-cpointer ycs-comment-link" href="${href}" target="_blank">${encode(text || '')}</a>`;
                continue;
            }

            const emoji = wrapTryCatch(() => (run as any).emoji);
            if (emoji) {
                const thumbnails = (wrapTryCatch(() => emoji.image.thumbnails) as any[]) || [];
                const url = (thumbnails[thumbnails.length - 1] || {}).url || '';
                const shortcut = (wrapTryCatch(() => emoji.shortcuts?.[0]) as string) || '';
                const label = (wrapTryCatch(() => emoji.image.accessibility.accessibilityData.label) as string) || '';

                if (!text) {
                    if (shortcut) {
                        result.fullText += shortcut;
                    } else if (label) {
                        result.fullText += `:${label}:`;
                    } else {
                        result.fullText += ':emoji:';
                    }
                }

                const alt = shortcut || label || 'emoji';
                const style = 'margin-left: 2px; margin-right: 2px;';

                if (url) {
                    result.richText += `<img src="${url}" alt="${encode(alt)}" title="${encode(alt)}" width="24" height="24" style="${style}" class="ycs-attachment">`;
                } else {
                    result.richText += alt;
                }

                continue;
            }

            const attachmentImage = wrapTryCatch(() => (run as any).attachment?.image);
            if (attachmentImage) {
                const url = attachmentImage?.url || '';
                const width = attachmentImage?.width || 24;
                const height = attachmentImage?.height || 24;
                const margin = attachmentImage?.margin || { left: 0, right: 0 };
                const style = `margin-left: ${margin.left || 0}px; margin-right: ${margin.right || 0}px;`;
                const alt = (run as any)?.text || '';

                result.richText += `<img src="${url}" alt="${encode(alt)}" title="${encode(alt)}" width="${width}" height="${height}" style="${style}" class="ycs-attachment">`;
                continue;
            }

            result.richText += encode(text || '');
        } catch (error) {
            console.error(error);
            const fallbackText = (wrapTryCatch(() => run?.text) as string) || '';
            result.richText += encode(fallbackText);
        }
    }

    if (!result.richText) {
        result.richText = result.fullText;
    }

    return result;
}
