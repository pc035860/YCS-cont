import urlRegex from 'url-regex';

import { isNumeric, wrapTryCatch } from '../common';
import { ICommentItem, ICommentsFuseResult } from '../interfaces/i_types';

function filterAuthorComments(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const fAuthor: any = [];

        for (const [, c] of comments.entries()) {
            if (c?.commentRenderer?.authorIsChannelOwner) {
                fAuthor.push({ item: c, refIndex: (c as any)._index });
            }
        }

        return fAuthor;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function filterLikesComments(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const fLike: any = [];
        const cmntsBigLikes = [];

        for (const [, c] of comments.entries()) {
            let likes = c?.commentRenderer?.voteCount?.simpleText || c?.commentRenderer?.likeCount;

            if (isNumeric(likes)) {
                likes = parseInt(likes as any);
            } else if (typeof likes === 'string' || typeof likes === 'number') {
                const bigLike = parseFloat(likes as any) * 1000;

                if (bigLike === bigLike) {
                    likes = bigLike;
                } else if (typeof likes === 'string') {
                    cmntsBigLikes.push({ item: c, refIndex: (c as any)._index });
                }
            }

            if (typeof likes === 'number' && likes === likes) {
                c.commentRenderer.likesForSort = likes;
                fLike.push({ item: c, refIndex: (c as any)._index });
            }
        }

        if (cmntsBigLikes.length > 0) {
            cmntsBigLikes.sort((f: any, s: any) => {
                if (f.item.commentRenderer.voteCount.simpleText > s.item.commentRenderer.voteCount.simpleText) {
                    return 1;
                }

                if (f.item.commentRenderer.voteCount.simpleText < s.item.commentRenderer.voteCount.simpleText) {
                    return -1;
                }

                return 0;
            });

            for (const bc of cmntsBigLikes) {
                fLike.unshift(bc);
            }
        }

        return fLike;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function filterRepliedComments(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const fReplied: any = [];

        for (const [, c] of comments.entries()) {
            let replied = c?.commentRenderer?.replyCount;
            replied = parseInt(replied as any);

            if (replied) {
                c.commentRenderer.repliedForSort = replied;
                fReplied.push({ item: c, refIndex: (c as any)._index });
            }
        }

        return fReplied;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function filterMemberComments(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const fMembers: any = [];

        for (const [, c] of comments.entries()) {
            const member = c?.commentRenderer?.sponsorCommentBadge?.sponsorCommentBadgeRenderer?.tooltip;

            if (member) {
                fMembers.push({ item: c, refIndex: (c as any)._index });
            }
        }

        return fMembers;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function filterHeartComments(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const fHeart: any = [];

        for (const [, c] of comments.entries()) {
            if (c?.commentRenderer?.creatorHeart) {
                fHeart.push({ item: c, refIndex: (c as any)._index });
            }
        }

        return fHeart;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function filterVerifiedComments(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const fVerified: any = [];

        for (const [, c] of comments.entries()) {
            if (c.commentRenderer.verifiedAuthor) {
                fVerified.push({ item: c, refIndex: (c as any)._index });
            }
        }

        return fVerified;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function filterLinksComments(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const fLinks: any = [];

        for (const [, c] of comments.entries()) {
            try {
                if (urlRegex().test(c.commentRenderer.contentText.fullText)) {
                    fLinks.push({ item: c, refIndex: (c as any)._index });
                }
            } catch (err) {
                console.error(err);
                continue;
            }
        }

        return fLinks;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function filterLinksTrpVideoComments(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const fLinks: any = [];

        for (const c of comments) {
            try {
                if (urlRegex().test(c.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.cue.simpleText)) {
                    fLinks.push({
                        item: c,
                        refIndex: c.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.startOffsetMs
                    });
                }
            } catch (err) {
                console.error(err);
                continue;
            }
        }

        return fLinks;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function filterAllTrpVideoComments(comments: any): [] {
    if (comments.length === 0) return [];

    try {
        const fAllTrpVideo: any = [];

        for (const c of comments) {
            try {
                fAllTrpVideo.push({
                    item: c,
                    refIndex: c.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.startOffsetMs
                });
            } catch (err) {
                console.error(err);
                continue;
            }
        }

        return fAllTrpVideo;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function filterNewestFirst(comments: any): ICommentsFuseResult[] | void {
    try {
        if (comments && comments.length === 0) return;

        const res: ICommentsFuseResult[] = [];

        for (const [, comment] of comments.entries()) {
            try {
                if (comment?.typeComment === 'C') {
                    res.push({
                        item: comment as ICommentItem,
                        refIndex: (comment as any)?._index as number
                    });
                }
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
    filterAuthorComments,
    filterLikesComments,
    filterRepliedComments,
    filterMemberComments,
    filterHeartComments,
    filterVerifiedComments,
    filterLinksComments,
    filterLinksTrpVideoComments,
    filterAllTrpVideoComments,
    filterNewestFirst
};
