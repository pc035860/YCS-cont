export interface IStorageEstimate extends StorageEstimate {
    usageDetails: {
        indexedDB: number;
    };
}

export interface CommentRun extends Record<string, unknown> {
    text?: string;
    simpleText?: string;
    navigationEndpoint?: {
        commandMetadata?: {
            webCommandMetadata?: {
                url?: string;
                webPageType?: string;
                apiUrl?: string;
                rootVe?: number;
            };
        };
        watchEndpoint?: {
            startTimeSeconds?: number;
        };
    };
}

export interface CommentRenderer extends Record<string, unknown> {
    authorEndpoint?: {
        commandMetadata?: {
            webCommandMetadata?: {
                url?: string;
                webPageType?: string;
                apiUrl?: string;
                rootVe?: number;
            };
        };
    };
    authorIsChannelOwner?: boolean;
    authorText?: {
        simpleText?: string;
    };
    authorThumbnail?: {
        thumbnails?: Array<{
            url?: string;
            width?: number;
            height?: number;
        }>;
    };
    commentId: string;
    contentText?: {
        fullText?: string;
        renderFullText?: string;
        runs?: CommentRun[];
    };
    creatorHeart?: {
        tooltip?: string;
    };
    donatedChip?: unknown;
    isTimeLine?: 'timeline' | string;
    likeCount?: number | string;
    likesForSort?: number;
    publishedTimeText?: {
        simpleText?: string;
        runs?: Array<{
            text?: string;
            navigationEndpoint?: {
                commandMetadata?: {
                    webCommandMetadata?: {
                        url?: string;
                    };
                };
                watchEndpoint?: {
                    startTimeSeconds?: number;
                };
            };
        }>;
    };
    replyCount?: number | string;
    repliedForSort?: number;
    sponsorCommentBadge?: {
        sponsorCommentBadgeRenderer?: {
            tooltip?: string;
            [key: string]: unknown;
        };
    };
    verifiedAuthor?: boolean;
    voteCount?: {
        simpleText?: string;
    };
    ycsReplies?: CommentItem[];
}

export interface CommentItem extends Record<string, unknown> {
    /**
     * Stable original index used for sorting across filters/searches.
     * Newest-first when sorted ascending.
     */
    _index?: number;
    commentRenderer: CommentRenderer;
    originComment?: CommentItem;
    typeComment: 'C' | 'R';
}

export interface LiveChatTextMessageRenderer extends Record<string, unknown> {
    authorName?: {
        simpleText?: string;
    };
    authorPhoto?: {
        thumbnails?: Array<{
            url?: string;
            width?: number;
            height?: number;
        }>;
    };
    authorExternalChannelId?: string;
    authorBadges?: Array<{
        liveChatAuthorBadgeRenderer?: {
            icon?: {
                iconType?: string;
            };
            tooltip?: string;
            customThumbnail?: unknown;
        };
    }>;
    message?: {
        runs?: Array<{
            text?: string;
        }>;
        simpleText?: string;
        fullText?: string;
        renderFullText?: string;
    };
    purchaseAmountText?: {
        simpleText?: string;
    };
    timestampUsec?: string | number;
    timestampText?: {
        simpleText?: string;
    };
    isTimeLine?: string;
    verifiedAuthor?: boolean;
}

export interface LiveChatItem extends Record<string, unknown> {
    liveChatTextMessageRenderer?: LiveChatTextMessageRenderer;
    liveChatPaidMessageRenderer?: Record<string, unknown>;
}

export interface ChatAction extends Record<string, unknown> {
    addChatItemAction?: {
        item: LiveChatItem;
    };
    addBannerToLiveChatCommand?: {
        bannerRenderer?: {
            liveChatBannerRenderer?: {
                contents?: {
                    liveChatTextMessageRenderer?: LiveChatTextMessageRenderer;
                };
            };
        };
    };
    addLiveChatTickerItemAction?: {
        item?: {
            liveChatTickerPaidMessageItemRenderer?: {
                showItemEndpoint?: {
                    showLiveChatItemEndpoint?: {
                        renderer?: {
                            liveChatPaidMessageRenderer?: Record<string, unknown>;
                            liveChatTextMessageRenderer?: LiveChatTextMessageRenderer;
                        };
                    };
                };
            };
        };
    };
}

export interface ReplayChatItemAction extends Record<string, unknown> {
    actions: ChatAction[];
    videoOffsetTimeMsec?: string;
}

export interface ChatItem extends Record<string, unknown> {
    replayChatItemAction: ReplayChatItemAction;
}

export interface PlayerSeekContinuationData extends Record<string, unknown> {
    continuation: string;
    clickTrackingParams?: string;
}

export interface LiveChatReplayContinuationData extends Record<string, unknown> {
    timeUntilLastMessageMsec?: number;
    continuation: string;
    clickTrackingParams?: string;
}

export interface LiveChatContinuationItem extends Record<string, unknown> {
    playerSeekContinuationData?: PlayerSeekContinuationData;
    liveChatReplayContinuationData?: LiveChatReplayContinuationData;
}

export interface TranscriptCue extends Record<string, unknown> {
    transcriptCueRenderer?: {
        startOffsetMs?: number;
        durationMs?: number;
        cue?: {
            simpleText?: string;
            runs?: Array<{
                text?: string;
            }>;
        };
        navigationEndpoint?: {
            commandMetadata?: {
                webCommandMetadata?: {
                    url?: string;
                };
            };
            watchEndpoint?: {
                startTimeSeconds?: number;
            };
        };
    };
}

export interface TranscriptCueGroupRenderer extends Record<string, unknown> {
    formattedStartOffset?: {
        simpleText?: string;
    };
    cues?: TranscriptCue[];
}

export interface TranscriptCueGroup extends Record<string, unknown> {
    transcriptCueGroupRenderer?: TranscriptCueGroupRenderer;
}

export interface TranscriptBodyRenderer extends Record<string, unknown> {
    cueGroups?: TranscriptCueGroup[];
}

export interface TranscriptRendererBody extends Record<string, unknown> {
    transcriptBodyRenderer?: TranscriptBodyRenderer;
}

export interface TranscriptRenderer extends Record<string, unknown> {
    body?: TranscriptRendererBody;
}

export interface TranscriptUpdateEngagementPanelAction extends Record<string, unknown> {
    content?: {
        transcriptRenderer?: TranscriptRenderer;
    };
}

export interface TranscriptAction extends Record<string, unknown> {
    updateEngagementPanelAction?: TranscriptUpdateEngagementPanelAction;
}

export interface TranscriptData extends Record<string, unknown> {
    actions?: TranscriptAction[];
}

export type FuseSupportedItem = CommentItem | ChatItem | TranscriptCueGroup;

export interface ICommentsFuseResult<T extends FuseSupportedItem = FuseSupportedItem> {
    item: T;
    refIndex: number;
    score?: number;
}

export type ICommentItem = CommentItem;

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
    quickChat?: boolean;
    quickTranscript?: boolean;
    sortOrder?: 'newest' | 'oldest';
}

export type ISelectedSearch = 'comments' | 'chat' | 'video' | 'all';

export interface IYCSOptions {
    autoload?: boolean;
    highlightText?: boolean;
    highlightExact?: boolean;
    cache?: boolean;
    autoClear?: number;
    hiddenByDefault?: boolean;
    filterButtons?: Array<{ id: string; enabled: boolean }>;
}
