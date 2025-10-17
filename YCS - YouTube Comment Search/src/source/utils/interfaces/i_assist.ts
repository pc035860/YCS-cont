export interface GetParams {
    ctoken: string | null;
    continuation: string | null;
    itct: string | null;
    params: {
        credentials: string;
        headers: object;
        referrer: string;
        referrerPolicy: string;
        body: string;
        method: string;
        mode: string;
    };
}


export interface ISheetDetails {
    'Cache timestamp': number;
    URL: string;
    'Video ID': string;
    Title: string;
    'Total Comments': number;
    'Total Replies': number;
    Total: number;
}

export interface ISheetDetailsParam {
    cachedDate: number;
    urlVideo: string;
    videoId: string;
    titleVideo: string;
    totalComments: number;
    totalReplies: number;
    total: number;
}


export interface ISheetCommentsParam {
    author: {
        nameAuthor: string;
        authorIsChannelOwner: boolean;
        channel: string;
    }
    commentReplies: {
        replies: Array<ISheetCommentsParam>
    }
    commentMessage: string;
    commentUrl: string;
    member: string;
    publishedTimeText: string;
    totalLikes: number;
}


export interface ISheetComments {
    URL: string;
    'Author name': string;
    'Author Channel': string;
    'Comment message': string;
    'Channel owner': boolean;
    Member: string | undefined;
    Published: string;
    'Total likes': number;
    Replies: number;
}

export type ISheetRepliesParam = ISheetCommentsParam


export interface ISheetReplies {
    'Сommented URL': string;
    'URL Reply': string;
    'Author name': string;
    Channel: string;
    'Reply message': string;
    Member: string;
    Published: string;
    'Total likes': number;
}


export interface ISheetDetailsChatParam {
    cachedDate: number;
    urlVideo: string;
    videoId: string;
    titleVideo: string;
    total: number;
    commentsChat: Array<ISheetChatCommentsParam>
}


export interface ISheetChatDetails {
    'Cache timestamp': number;
    URL: string;
    'Video ID': string;
    Title: string;
    Total: number;
}

export interface ISheetChatCommentsParam {
    timestampUsec: number;
    author: {
        nameAuthor: string;
        channel: string;
        member: string;
    }
    commentMessage: string;
    timestampText: string;
}

export interface ISheetChatComments {
    'Timestamp Usec': number;
    URL: string;
    'Author name': string;
    'Author Channel': string;
    Member: string;
    'Comment message': string;
    'Timestamp comment': string;
}

export interface ISheetDetailsTrVideoParam {
    cachedDate: number;
    urlVideo: string;
    titleVideo: string;
    videoId: string;
    titleTrVideo: string;
    total: number;
    trVideo: Array<ISheetTrVideoParam>
}

export interface ISheetTrVideoDetails {
    'Cache timestamp': number;
    URL: string;
    Title: string;
    'Video ID': string;
    'Title transcript': string;
    Total: number;
}

export interface ISheetTrVideoParam {
    urlShare: string;
    formattedStartOffset: string;
    startOffsetMs: number;
    durationMs: number;
    message: string;
}


export interface ISheetTrVideo {
    URL: string;
    'Video timestamp': string;
    'Start Offset Ms.': number;
    'Duration Ms.': number;
    Message: string;
}


/**
 * API version type for chat continuation data
 */
export type ChatApiVersion = 'new' | 'old' | 'fallback';

/**
 * Result structure for getCDChat function
 */
export interface ChatContinuationResult {
    /**
     * The continuation data object from YouTube API
     */
    continuationData: object | null;

    /**
     * API version detected based on the continuation token source path
     * - 'new': From continuations[0].reloadContinuationData
     * - 'old': From header.viewSelector path
     * - 'fallback': From deep search
     */
    apiVersion: ChatApiVersion;

    /**
     * The JSON path where the continuation data was found
     * Useful for debugging and logging
     */
    sourcePath?: string;
}