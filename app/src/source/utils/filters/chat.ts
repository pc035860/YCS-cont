import urlRegex from 'url-regex';

import { GlobalStore, wrapTryCatch } from '../common';
import { ICommentItem, ICommentsFuseResult } from '../interfaces/i_types';

function filterAuthorChat(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const fAuthor: any = [];
        const channelID = wrapTryCatch(() => GlobalStore.getInitYtData[2].playerResponse.videoDetails.channelId);

        if (channelID) {
            for (const [, c] of comments.entries()) {
                try {
                    const authorExternalChannelId = wrapTryCatch(
                        () =>
                            c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer
                                .authorExternalChannelId
                    );
                    if (authorExternalChannelId === channelID) {
                        const ts = wrapTryCatch(
                            () =>
                                c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer
                                    .timestampUsec
                        );
                        const ref = typeof ts === 'string' || typeof ts === 'number' ? parseInt(ts as any, 10) : undefined;
                        fAuthor.push({ item: c, refIndex: Number.isFinite(ref) ? ref : 0 });
                    }
                } catch (err) {
                    console.error(err);
                    continue;
                }
            }
        } else {
            console.log('Not AUTHOR FOR CHAT COMMENTS!');
        }

        return fAuthor;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function filterMembersChat(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const fMembers: any = [];

        for (const c of comments) {
            const authorBadge: any = wrapTryCatch(
                () => c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorBadges
            );
            let member: any;

            if (authorBadge?.length > 0) {
                for (const m of authorBadge) {
                    if (m?.liveChatAuthorBadgeRenderer?.customThumbnail) {
                        member = m;
                        break;
                    }
                }
            }

            if (member) {
                const ts = wrapTryCatch(
                    () =>
                        c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.timestampUsec
                );
                const ref = typeof ts === 'string' || typeof ts === 'number' ? parseInt(ts as any, 10) : undefined;
                fMembers.push({ item: c, refIndex: Number.isFinite(ref) ? ref : 0 });
            }
        }

        return fMembers;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function filterDonatedChat(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const fDonated: any = [];

        for (const c of comments) {
            if (
                wrapTryCatch(
                    () =>
                        c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer
                            .purchaseAmountText.simpleText
                )
            ) {
                const ts = wrapTryCatch(
                    () =>
                        c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.timestampUsec
                );
                const ref = typeof ts === 'string' || typeof ts === 'number' ? parseInt(ts as any, 10) : undefined;
                fDonated.push({ item: c, refIndex: Number.isFinite(ref) ? ref : 0 });
            }
        }

        return fDonated;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function filterVerifiedChatComments(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const fVerified: any = [];

        for (const [, c] of comments.entries()) {
            if (
                wrapTryCatch(
                    () =>
                        c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.verifiedAuthor
                )
            ) {
                const ts = wrapTryCatch(
                    () =>
                        c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.timestampUsec
                );
                const ref = typeof ts === 'string' || typeof ts === 'number' ? parseInt(ts as any, 10) : undefined;
                fVerified.push({ item: c, refIndex: Number.isFinite(ref) ? ref : 0 });
            }
        }

        return fVerified;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function filterLinksChatComments(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const fLinks: any = [];

        for (const [, c] of comments.entries()) {
            if (
                wrapTryCatch(() =>
                    urlRegex().test(
                        c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.fullText
                    )
                )
            ) {
                const ts = wrapTryCatch(
                    () =>
                        c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.timestampUsec
                );
                const ref = typeof ts === 'string' || typeof ts === 'number' ? parseInt(ts as any, 10) : undefined;
                fLinks.push({ item: c, refIndex: Number.isFinite(ref) ? ref : 0 });
            }
        }

        return fLinks;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function filterChatNewestFirst(comments: Map<number, object>): ICommentsFuseResult[] | void {
    try {
        if (comments.size === 0) return;

        const res: ICommentsFuseResult[] = [];

        for (const [i, comment] of comments.entries()) {
            try {
                res.push({
                    item: comment as ICommentItem,
                    refIndex: i as number
                });
            } catch (err) {
                console.error(err);
                continue;
            }
        }

        if (res?.length > 0) {
            return res;
        }
    } catch (err) {
        console.error(err);
    }
}

export {
    filterAuthorChat,
    filterMembersChat,
    filterDonatedChat,
    filterVerifiedChatComments,
    filterLinksChatComments,
    filterChatNewestFirst
};
