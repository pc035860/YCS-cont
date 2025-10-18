export interface IReplyComment {
    originComment: {
        commentRenderer: {
            commentId: string;
        };
    };
}

export interface IReply {
    commentUrl: string;
    author: {
        nameAuthor: string;
        channel: string;
        authorIsChannelOwner: boolean;
    };
    commentMessage: string;
    publishedTimeText: string;
    totalLikes: string;
    member: string;
}

export interface IComment {
    commentUrl: string;
    author: {
        nameAuthor: string;
        channel: string;
        authorIsChannelOwner: boolean;
    };
    commentMessage: string;
    publishedTimeText: string;
    totalLikes: string;
    member: string;
    commentReplies?: {
        replies: IReply[];
    };
}
