import type { CommentItemLike, DerivedComment, FilterConfig, FilterResult } from './types';

export function createFilter<T = any>(
    id: string,
    name: string,
    filter: (item: DerivedComment, options?: T) => boolean,
    options?: T
): FilterConfig<T> {
    return { id, name, enabled: true, filter, options };
}

export function deriveComment(item: CommentItemLike): DerivedComment {
    const commentRenderer = (item as any)?.commentRenderer ?? {};

    const runs: Array<{ text?: string } | undefined> = commentRenderer?.contentText?.runs || [];
    const content = runs.map((r) => r?.text ?? '').join('');
    const author = commentRenderer?.authorText?.simpleText || commentRenderer?.authorText || '';

    const rawLike = commentRenderer?.likesForSort ?? commentRenderer?.likeCount ?? 0;
    const likeCount = Number(rawLike) || 0;
    if (commentRenderer) {
        commentRenderer.likesForSort = likeCount;
    }

    const rawReply = commentRenderer?.repliedForSort ?? commentRenderer?.replyCount ?? 0;
    const replyCount = Number(rawReply) || 0;
    if (commentRenderer) {
        commentRenderer.repliedForSort = replyCount;
    }

    const verified = Boolean(commentRenderer?.verifiedAuthor);
    const isMember = Boolean(commentRenderer?.sponsorCommentBadge?.sponsorCommentBadgeRenderer?.tooltip);
    const isDonated = Boolean(commentRenderer?.donatedChip);
    const hasCreatorHeart = Boolean(
        commentRenderer?.actionButtons?.commentActionButtonsRenderer?.creatorHeart || commentRenderer?.creatorHeart
    );
    const hasLinks = /https?:\/\//i.test(content);
    const isTimeline = commentRenderer?.isTimeLine === 'timeline';
    const publishedTimeText = commentRenderer?.publishedTimeText?.runs?.[0]?.text || '';
    const isChannelOwner = Boolean(commentRenderer?.authorIsChannelOwner);

    return {
        origin: item as Record<string, any>,
        author: String(author || ''),
        content: String(content || ''),
        likeCount,
        replyCount,
        verified,
        isMember,
        isDonated,
        hasCreatorHeart,
        hasLinks,
        isTimeline,
        isChannelOwner,
        publishedTimeText
    };
}

export function applyFilters(items: CommentItemLike[], filters: FilterConfig[]): FilterResult {
    const start = performance.now();
    const originalCount = items.length;
    const enabled = filters.filter((f) => f.enabled);
    const stats: Record<string, { removed: number; percentage: number }> = {};
    enabled.forEach((f) => (stats[f.id] = { removed: 0, percentage: 0 }));

    const result: Array<Record<string, any>> = [];

    for (let i = 0; i < items.length; i++) {
        const derived = deriveComment(items[i]);
        let keep = true;
        for (const f of enabled) {
            try {
                if (!f.filter(derived, f.options)) {
                    stats[f.id].removed++;
                    keep = false;
                    break;
                }
            } catch (e) {
                // Keep the item when a filter throws so we do not drop data unexpectedly.
                // Still record the error for debugging instead of altering removal statistics.
                console.error('[YCS] Filter error', f.id, e);
            }
        }
        if (keep) result.push(derived.origin);
    }

    Object.keys(stats).forEach((id) => {
        stats[id].percentage = originalCount > 0 ? (stats[id].removed / originalCount) * 100 : 0;
    });

    return {
        items: result,
        originalCount,
        filteredCount: result.length,
        removedCount: originalCount - result.length,
        stats,
        elapsedTime: performance.now() - start
    };
}
