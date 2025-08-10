
export interface IStorageEstimate extends StorageEstimate {
    usageDetails: {
        indexedDB: number;
    }
}

export interface ICommentsFuseResult {
    item: ICommentItem;
    refIndex: number;
    score?: number;
}

export interface ICommentItem {
    /**
     * Stable original index used for sorting across filters/searches.
     * Newest-first when sorted ascending.
     */
    _index?: number;
    commentRenderer: {
        authorEndpoint: unknown;
        authorIsChannelOwner: boolean;
        authorText: {
            simpleText: string;
        }
        authorThumbnail: {
            thumbnails: unknown;
        }
        commentId: string;
        contentText: {
            fullText: string;
            renderFullText: string;
            runs: unknown;
        }
        isTimeLine: 'timeline' | unknown;
        publishedTimeText: unknown;
    }
    typeComment: 'C' | 'R';
}

export interface IParamSearch {
    links?: boolean;
    likes?: boolean;
    members?: boolean;
    replied?: boolean;
    author?: boolean;
    heart?: boolean;
    verified?: boolean;
    donated?: boolean;
    random?: boolean;
    timestamp?: boolean;
    sortFirst?: boolean;
    sortOrder?: 'newest' | 'oldest';
}

export type ISelectedSearch = 'comments' | 'chat' | 'video' | 'all';