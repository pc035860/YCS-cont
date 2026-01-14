import type { NormalizedCommentRenderer } from '../interfaces/i_assist';

// Derived fields that flatten raw structures for aggregation.
export interface DerivedComment {
    origin: Record<string, any>;
    author: string;
    content: string;
    likeCount: number;
    replyCount: number;
    verified: boolean;
    isMember: boolean;
    isDonated: boolean;
    hasCreatorHeart: boolean;
    hasLinks: boolean;
    isTimeline: boolean;
    isChannelOwner: boolean;
    publishedTimeText: string;
    hasEmoji: boolean;
}

export interface FilterConfig<T = any> {
    id: string;
    name: string;
    enabled: boolean;
    options?: T;
    filter: (item: DerivedComment, options?: T) => boolean;
}

export interface FilterResult {
    items: Array<Record<string, any>>; // Return original items
    originalCount: number;
    filteredCount: number;
    removedCount: number;
    stats: Record<string, { removed: number; percentage: number }>;
    elapsedTime: number;
}

export type CommentItemLike = NormalizedCommentRenderer | Record<string, any>;
