import {
    ISheetChatComments,
    ISheetChatDetails,
    ISheetComments,
    ISheetCommentsParam,
    ISheetDetails,
    ISheetDetailsChatParam,
    ISheetDetailsParam,
    ISheetDetailsTrVideoParam,
    ISheetReplies,
    ISheetRepliesParam,
    ISheetTrVideo,
    ISheetTrVideoDetails
} from './interfaces/i_assist';

function getSheetDetails(cmnts: ISheetDetailsParam): ISheetDetails | void {
    try {
        if (typeof cmnts !== 'object') return;

        return {
            'Cache timestamp': Number(cmnts?.cachedDate),
            URL: cmnts?.urlVideo,
            'Video ID': cmnts?.videoId,
            Title: cmnts?.titleVideo,
            'Total Comments': Number(cmnts?.totalComments),
            'Total Replies': Number(cmnts?.totalReplies),
            Total: Number(cmnts?.total)
        };
    } catch (err) {
        console.error(err);
    }
}

function getSheetChatDetails(cmnts: ISheetDetailsChatParam): ISheetChatDetails | void {
    try {
        if (typeof cmnts !== 'object') return;

        return {
            'Cache timestamp': Number(cmnts?.cachedDate),
            URL: cmnts?.urlVideo,
            'Video ID': cmnts?.videoId,
            Title: cmnts?.titleVideo,
            Total: Number(cmnts?.total)
        };
    } catch (err) {
        console.error(err);
    }
}

function getSheetComments(cmnts: Array<ISheetCommentsParam>): Array<ISheetComments> | [] {
    try {
        if (!Array.isArray(cmnts)) return [];

        const sheetCmnts: Array<ISheetComments> = [];

        for (const cmnt of cmnts) {
            sheetCmnts.push({
                URL: cmnt.commentUrl,
                'Author name': cmnt?.author?.nameAuthor,
                'Author Channel': cmnt?.author?.channel,
                'Comment message': cmnt?.commentMessage,
                'Channel owner': cmnt?.author?.authorIsChannelOwner,
                Member: cmnt?.member,
                Published: cmnt?.publishedTimeText,
                'Total likes': Number(cmnt?.totalLikes),
                Replies: Number(cmnt?.commentReplies?.replies?.length) | 0
            });
        }

        return sheetCmnts;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function getSheetChatComments(cmnts: ISheetDetailsChatParam): Array<ISheetChatComments> | [] {
    try {
        if (typeof cmnts !== 'object') return [];

        const sheetCmnts: Array<ISheetChatComments> = [];

        for (const cmnt of cmnts.commentsChat) {
            const [m, s] = cmnt.timestampText.split(':');
            const second = Number(m) * 60 + Number(s);

            sheetCmnts.push({
                'Timestamp Usec': Number(cmnt?.timestampUsec),
                URL: `https://youtu.be/${cmnts.videoId}?t=${second || 0}`,
                'Author name': cmnt?.author?.nameAuthor,
                'Author Channel': cmnt?.author?.channel,
                Member: cmnt?.author?.member,
                Message: cmnt?.message,
                'Purchase amount': cmnt?.purchaseAmount,
                'Amount currency': cmnt?.amountCurrency,
                'Video Offset Time Ms': Number(cmnt?.videoOffsetTimeMsec)
            });
        }

        return sheetCmnts;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function getSheetReplies(cmnts: Array<ISheetRepliesParam>): Array<ISheetReplies> | [] {
    try {
        if (!Array.isArray(cmnts)) return [];

        const sheetReplies: Array<ISheetReplies> = [];

        for (const cmnt of cmnts) {
            for (const reply of cmnt?.commentReplies?.replies || []) {
                if (reply) {
                    sheetReplies.push({
                        URL: reply?.url,
                        'Author name': reply?.author?.nameAuthor,
                        'Author Channel': reply?.author?.channel,
                        'Reply message': reply?.commentMessage,
                        Member: reply?.member,
                        Published: reply?.publishedTimeText,
                        'Total likes': Number(reply?.totalLikes)
                    });
                }
            }
        }

        return sheetReplies;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function getSheetTrVideoDetails(trVideo: ISheetDetailsTrVideoParam): ISheetTrVideoDetails | void {
    try {
        if (typeof trVideo !== 'object') return;

        return {
            'Cache timestamp': Number(trVideo?.cachedDate),
            URL: trVideo?.urlVideo,
            Title: trVideo?.titleVideo,
            'Video ID': trVideo?.videoId,
            'Title transcript': trVideo?.titleTrVideo,
            Total: Number(trVideo?.total)
        };
    } catch (err) {
        console.error(err);
    }
}

function getSheetTrVideo(trVideo: ISheetDetailsTrVideoParam): Array<ISheetTrVideo> | [] {
    try {
        if (typeof trVideo !== 'object') return [];

        const sheetCmnts: Array<ISheetTrVideo> = [];

        for (const tr of trVideo.trVideo) {
            sheetCmnts.push({
                URL: tr?.urlShare,
                'Video timestamp': tr?.formattedStartOffset,
                'Start Offset Ms.': Number(tr?.startOffsetMs),
                'Duration Ms.': Number(tr?.durationMs),
                Message: tr?.message
            });
        }

        return sheetCmnts;
    } catch (err) {
        console.error(err);
        return [];
    }
}

export {
    getSheetDetails,
    getSheetComments,
    getSheetReplies,
    getSheetChatDetails,
    getSheetChatComments,
    getSheetTrVideoDetails,
    getSheetTrVideo
};
