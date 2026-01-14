import type { FilterConfig } from './types';
import { createFilter } from './engine';

export function createAuthorFilter(author: string): FilterConfig<string> {
    const needle = (author || '').toLowerCase();
    return createFilter('author', 'Author Filter', (item) => item.author.toLowerCase().includes(needle), author);
}

export function createChannelOwnerFilter(only = true): FilterConfig<boolean> {
    return createFilter(
        'channelOwner',
        'Channel Owner Filter',
        (item, flag) => (!flag ? true : item.isChannelOwner),
        only
    );
}

export function createTextFilter(text: string): FilterConfig<string> {
    const needle = (text || '').toLowerCase();
    return createFilter('text', 'Text Filter', (item) => item.content.toLowerCase().includes(needle), text);
}

export function createLikesFilter(opts: { min?: number; max?: number }): FilterConfig<{ min?: number; max?: number }> {
    return createFilter(
        'likes',
        'Likes Filter',
        (item, o) => {
            const minOk = o?.min === undefined || item.likeCount >= (o.min as number);
            const maxOk = o?.max === undefined || item.likeCount <= (o.max as number);
            return minOk && maxOk;
        },
        opts
    );
}

export function createRepliesFilter(opts: {
    min?: number;
    max?: number;
}): FilterConfig<{ min?: number; max?: number }> {
    return createFilter(
        'replies',
        'Replies Filter',
        (item, o) => {
            const minOk = o?.min === undefined || item.replyCount >= (o.min as number);
            const maxOk = o?.max === undefined || item.replyCount <= (o.max as number);
            return minOk && maxOk;
        },
        opts
    );
}

export function createVerifiedFilter(only = true): FilterConfig<boolean> {
    return createFilter('verified', 'Verified Filter', (item, flag) => (!flag ? true : item.verified), only);
}

export function createMemberFilter(only = true): FilterConfig<boolean> {
    return createFilter('member', 'Member Filter', (item, flag) => (!flag ? true : item.isMember), only);
}

export function createCreatorHeartFilter(only = true): FilterConfig<boolean> {
    return createFilter(
        'creatorHeart',
        'Creator Heart Filter',
        (item, flag) => (!flag ? true : item.hasCreatorHeart),
        only
    );
}

export function createLinksFilter(only = true): FilterConfig<boolean> {
    return createFilter('links', 'Links Filter', (item, flag) => (!flag ? true : item.hasLinks), only);
}

export function createTimelineFilter(only = true): FilterConfig<boolean> {
    return createFilter('timeline', 'Timeline Filter', (item, flag) => (!flag ? true : item.isTimeline), only);
}

export function createDonatedFilter(only = true): FilterConfig<boolean> {
    return createFilter('donated', 'Donated Filter', (item, flag) => (!flag ? true : item.isDonated), only);
}

export function createOriginalCommentsFilter(only = true): FilterConfig<boolean> {
    return createFilter(
        'origin',
        'Original Comments Filter',
        (item, flag) => (!flag ? true : item.origin.typeComment === 'C'),
        only
    );
}

export function createEmojiCommentsFilter(only = true): FilterConfig<boolean> {
    return createFilter('emoji', 'Emoji Comments Filter', (item, flag) => (!flag ? true : item.hasEmoji), only);
}
