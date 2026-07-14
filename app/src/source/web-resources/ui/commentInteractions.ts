import { removeNodeList, navigateVideoToTimestamp } from '../../utils/dom';
import { iconCollapse, iconExpand, iconCurve } from '../../utils/icons';
import type { ICommentsFuseResult } from '../../utils/interfaces/i_types';
import { renderComment } from '../../utils/renderView';
import {
    expandOriginChainFor,
    safeGetComments,
    resolveQuery,
    safeDomKey,
    parseRefId,
    resolveRefIndex,
    resolveCommentId,
    resolveCurrentComment
} from './originChain';
import type { CommentStateAccessor, QueryGetter } from './originChain';

type CommentCollection = Array<Record<string, any>>;

/**
 * Optional instant-mode dependencies. When omitted, reply expansion behaves exactly as it did
 * before Task 18 (local-only, no on-demand fetch) - full-cache mode never provides these.
 */
export interface CommentInteractionsDeps {
    /**
     * Fetch the remaining replies for `commentId` (instant results only carry <=5 inline
     * replies) and merge them into the session so `stateAccessor.getComments()` picks them up.
     * Rejects with a `DOMException('AbortError')` on abort, or an `Error` carrying
     * `isQuotaExceeded: true` on Data API quota errors.
     */
    fetchMissingReplies?: (commentId: string, parentItem: Record<string, any>) => Promise<Record<string, any>[]>;
    /** Called when `fetchMissingReplies` rejects with a quota-exceeded error. */
    onReplyQuotaExceeded?: () => void;
}

const REPLY_LOADING_CLASS = 'ycs-reply-loading';
const REPLY_LOADING_TITLE = 'Loading replies…';
const REPLY_DEFAULT_TITLE = 'Open replies to the comment';

// === Scroll Position Lock Helpers ===

/**
 * Captures scroll position before DOM changes
 */
function captureScrollPosition(anchor: HTMLElement): { scrollContainer: HTMLElement | null; yBefore: number } {
    const scrollContainer = document.getElementById('ycs-search-result');
    const yBefore = anchor.getBoundingClientRect().top;
    return { scrollContainer, yBefore };
}

/**
 * Restores scroll position after DOM changes
 */
function restoreScrollPosition(anchor: HTMLElement, scrollContainer: HTMLElement | null, yBefore: number): void {
    if (!scrollContainer) return;
    const yAfter = anchor.getBoundingClientRect().top;
    const delta = yAfter - yBefore;
    if (delta !== 0) {
        scrollContainer.scrollTop += delta;
    }
}

export function registerCommentInteractions(
    container: HTMLElement,
    stateAccessor: CommentStateAccessor,
    queryGetter: QueryGetter,
    deps?: CommentInteractionsDeps
): void {
    if (!container || !stateAccessor?.getComments) return;
    if (container.dataset.ycsInteractionsBound === 'true') {
        return;
    }

    container.dataset.ycsInteractionsBound = 'true';

    container.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;

        const openCommentAllBtn = target.closest('.ycs-open-comment-all') as HTMLElement | null;
        if (openCommentAllBtn) {
            handleOpenCommentAll(openCommentAllBtn, stateAccessor, queryGetter);
            return;
        }

        const openCommentBtn = target.closest('.ycs-open-comment') as HTMLElement | null;
        if (openCommentBtn) {
            handleOpenComment(openCommentBtn, stateAccessor, queryGetter);
            return;
        }

        if (target.classList.contains('ycs-gotochat-video')) {
            handleGotoChatVideo(event);
            return;
        }

        if (target.classList.contains('ycs-goto-comment-time')) {
            handleGotoCommentTime(event);
            return;
        }

        const openReplyBtn = target.closest('.ycs-open-reply') as HTMLElement | null;
        if (openReplyBtn) {
            void handleOpenReply(openReplyBtn, stateAccessor, queryGetter, deps);
        }
    });
}

function buildOriginResult(
    originComment: Record<string, any> | undefined,
    refId: number | null
): ICommentsFuseResult | null {
    if (!originComment) return null;
    const refIndex = resolveRefIndex(originComment, refId ?? 0);
    return {
        item: originComment,
        refIndex
    };
}

function createOriginWrapper(key: string): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.id = `ycs-com-${key}`;
    wrap.className = `ycs-com-${key} ycs-origin-wrap`;
    wrap.dataset.ycsOrigin = 'parent';
    return wrap;
}

function extractReplyAuthorUrl(origin: Record<string, any> | undefined): string | undefined {
    const runs = origin?.commentRenderer?.contentText?.runs;
    if (!Array.isArray(runs)) return undefined;

    for (const run of runs) {
        const url = run?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl;
        if (url) {
            return url;
        }
    }

    return undefined;
}

function buildAuthorReplyResults(
    comments: CommentCollection,
    origin: Record<string, any> | undefined,
    refId: number
): ICommentsFuseResult[] {
    if (!origin?.originComment) return [];

    const replyUrl = extractReplyAuthorUrl(origin);
    if (!replyUrl) return [];

    const replies: ICommentsFuseResult[] = [];

    for (const entry of comments) {
        if (
            (entry as any)?.typeComment === 'R' &&
            (entry as any)?.originComment === origin.originComment &&
            (entry as any)?.commentRenderer?.authorEndpoint?.browseEndpoint?.canonicalBaseUrl === replyUrl
        ) {
            replies.push({
                item: entry as any,
                refIndex: Number((entry as any)?._index ?? refId)
            });
        }
    }

    return replies;
}

function createReplyAuthorWrapper(key: string): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.id = `ycs-com-rauth-${key}`;
    wrap.className = `ycs-com-${key} ycs-oc-ml ycs-origin-wrap`;
    wrap.dataset.ycsOrigin = 'author';
    return wrap;
}

function shouldRemoveOriginMargin(key: string): boolean {
    const hasSingle = Boolean(document.getElementById(`ycs-com-${key}`));
    const hasAuthor = Boolean(document.getElementById(`ycs-com-rauth-${key}`));
    const hasAll = Boolean(document.getElementById(`ycs-com-all-${key}`));
    return !hasSingle && !hasAuthor && !hasAll;
}

function collapseOriginComment(
    key: string,
    container: HTMLElement,
    toggle: HTMLElement,
    scrollContainer: HTMLElement | null,
    yBefore: number
): void {
    removeNodeList(`.ycs-com-${key}`);
    restoreScrollPosition(container, scrollContainer, yBefore);
    if (shouldRemoveOriginMargin(key)) {
        container.classList.remove('ycs-oc-ml');
        container.classList.remove('ycs-origin-trigger');
        container.querySelector('.ycs-curve-icon-wrap')?.remove();
    }
    toggle.innerHTML = iconExpand();
    toggle.title = 'Open the comment to the reply here.';
}

function collapseOriginChain(
    key: string,
    container: HTMLElement,
    toggle: HTMLElement,
    scrollContainer: HTMLElement | null,
    yBefore: number
): void {
    removeNodeList(`.ycs-com-all-${key}`);
    restoreScrollPosition(container, scrollContainer, yBefore);
    if (shouldRemoveOriginMargin(key)) {
        // Only remove the trigger class; no margin modification needed
        container.classList.remove('ycs-origin-trigger');
    }
    toggle.innerHTML = iconCollapse();
    toggle.title = 'Open all parent comments to root.';
}

function handleOpenComment(target: HTMLElement, stateAccessor: CommentStateAccessor, queryGetter: QueryGetter): void {
    const refId = parseRefId(target);
    const commentId = target.dataset.commentId;
    if (refId === null && !commentId) return;

    const commentContainer = target.closest('.ycs-render-comment') as HTMLElement | null;
    if (!commentContainer) return;

    const key = commentId ? safeDomKey(commentId) : `idx-${refId ?? 0}`;

    // === Scroll Position Lock ===
    const { scrollContainer, yBefore } = captureScrollPosition(commentContainer);

    const existing = document.getElementById(`ycs-com-${key}`);
    if (existing) {
        collapseOriginComment(key, commentContainer, target, scrollContainer, yBefore);
        return;
    }

    const comments = safeGetComments(stateAccessor);
    const current = resolveCurrentComment(comments, commentId, refId);
    const originComment = current?.originComment as Record<string, any> | undefined;
    const originResult = buildOriginResult(originComment, refId);
    const query = resolveQuery(queryGetter);

    const wrap = createOriginWrapper(key);
    commentContainer.insertAdjacentElement('beforebegin', wrap);

    if (originResult) {
        renderComment(wrap, [originResult], { querySearch: query });
    }

    commentContainer.classList.add('ycs-oc-ml');
    commentContainer.classList.add('ycs-origin-trigger');

    if (!commentContainer.querySelector('.ycs-curve-icon-wrap')) {
        const curve = document.createElement('div');
        curve.className = 'ycs-curve-icon-wrap';
        curve.innerHTML = iconCurve();
        commentContainer.appendChild(curve);
    }

    const replyAuthorResults = buildAuthorReplyResults(comments, current, refId ?? 0);
    if (replyAuthorResults.length > 0) {
        const replyWrap = createReplyAuthorWrapper(key);
        commentContainer.insertAdjacentElement('beforebegin', replyWrap);
        renderComment(replyWrap, replyAuthorResults, { isReply: false, querySearch: query });
    }

    // === Scroll Position Lock ===
    restoreScrollPosition(commentContainer, scrollContainer, yBefore);

    target.innerHTML = iconCollapse();
    target.title = 'Close the comment to the reply here.';
}

function handleOpenCommentAll(
    target: HTMLElement,
    stateAccessor: CommentStateAccessor,
    queryGetter: QueryGetter
): void {
    const refId = parseRefId(target);
    const commentId = target.dataset.commentId;
    if (refId === null && !commentId) return;

    const commentContainer = target.closest('.ycs-render-comment') as HTMLElement | null;
    if (!commentContainer) return;

    const key = commentId ? safeDomKey(commentId) : `idx-${refId ?? 0}`;

    // === Scroll Position Lock ===
    const { scrollContainer, yBefore } = captureScrollPosition(commentContainer);

    const existing = document.getElementById(`ycs-com-all-${key}`);
    if (existing) {
        collapseOriginChain(key, commentContainer, target, scrollContainer, yBefore);
        return;
    }

    const expanded = expandOriginChainFor(commentContainer, { stateAccessor, queryGetter });

    // === Scroll Position Lock ===
    restoreScrollPosition(commentContainer, scrollContainer, yBefore);

    if (expanded) {
        target.innerHTML = iconExpand();
        target.title = 'Close all parent comments.';
    }
}

function handleGotoChatVideo(event: Event): void {
    event.preventDefault();

    const target = event.target as HTMLElement | null;
    if (!target) return;

    const video = document.getElementsByTagName('video')[0];
    if (!video) return;

    navigateVideoToTimestamp(target, video);
}

function handleGotoCommentTime(event: Event): void {
    event.preventDefault();

    const target = event.target as HTMLElement | null;
    if (!target) return;

    const video = document.getElementsByTagName('video')[0];
    if (!video) return;

    navigateVideoToTimestamp(target, video);
}

function collectRepliesForComment(
    comments: CommentCollection,
    commentId: string | undefined,
    refId: number
): ICommentsFuseResult[] {
    if (!commentId) return [];

    const replies: ICommentsFuseResult[] = [];

    for (const entry of comments) {
        // Use commentId comparison instead of object reference (fixes JSON serialization issue)
        // Also handle potential variation in where commentId is stored
        const entryOriginId =
            (entry as any)?.originComment?.commentRenderer?.commentId || (entry as any)?.originComment?.commentId;

        if (entryOriginId === commentId) {
            replies.push({
                item: entry as any,
                refIndex: Number((entry as any)?._index ?? refId)
            });
        }
    }

    return replies;
}

/** Find the parent comment matching `commentId` in the local collection. */
function findParentComment(comments: CommentCollection, commentId: string): Record<string, any> | undefined {
    return comments.find((entry) => resolveCommentId(entry) === commentId);
}

/** True total reply count from the Data API thread response (`renderer.replyCount`). */
function getExpectedReplyCount(parentItem: Record<string, any> | undefined): number {
    const raw = parentItem?.commentRenderer?.replyCount;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
        const parsed = Number.parseInt(raw, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function setReplyButtonLoading(target: HTMLElement, loading: boolean): void {
    if (loading) {
        target.classList.add(REPLY_LOADING_CLASS);
        target.title = REPLY_LOADING_TITLE;
    } else {
        target.classList.remove(REPLY_LOADING_CLASS);
        target.title = REPLY_DEFAULT_TITLE;
    }
}

function createRepliesContainer(commentContainer: HTMLElement, commentId: string): HTMLDivElement {
    const wrapper = document.createElement('div');
    const safeId = safeDomKey(commentId);
    wrapper.id = `ycs-com-replies-${safeId}`;

    // Check parent avatar size to align vertical line (border-left)
    // Vertical line is 2px wide, so we offset to align its center with avatar center
    const isNestedParent = commentContainer.querySelector('.ycs-render-img--nested') !== null;
    const marginLeft = isNestedParent ? 7 : 15;

    wrapper.className = `ycs-com-replies-${safeId} ycs-com-replies ycs-com-rp ycs-nested-replies-container`;
    wrapper.style.marginLeft = `${marginLeft}px`;

    return wrapper;
}

async function handleOpenReply(
    target: HTMLElement,
    stateAccessor: CommentStateAccessor,
    queryGetter: QueryGetter,
    deps?: CommentInteractionsDeps
): Promise<void> {
    const commentId = target.dataset.idcom;
    if (!commentId) return;

    const commentContainer = target.closest('.ycs-render-comment') as HTMLElement | null;
    if (!commentContainer) return;

    const safeId = safeDomKey(commentId);
    const existingReplies = commentContainer.querySelector(`.ycs-com-replies-${safeId}`);
    if (existingReplies) {
        existingReplies.remove();
        target.innerHTML = '+';
        target.title = 'Open replies to the comment';
        return;
    }

    // Guard against double-click while an on-demand fetch is already in flight for this button.
    if (target.classList.contains(REPLY_LOADING_CLASS)) return;

    let comments = safeGetComments(stateAccessor);
    let replies = collectRepliesForComment(comments, commentId, 0);

    if (deps?.fetchMissingReplies) {
        const parentItem = findParentComment(comments, commentId);
        const expectedCount = getExpectedReplyCount(parentItem);

        if (parentItem && replies.length < expectedCount) {
            setReplyButtonLoading(target, true);
            try {
                await deps.fetchMissingReplies(commentId, parentItem);
            } catch (error) {
                setReplyButtonLoading(target, false);
                if (error instanceof DOMException && error.name === 'AbortError') {
                    return;
                }
                if ((error as { isQuotaExceeded?: boolean } | undefined)?.isQuotaExceeded) {
                    deps.onReplyQuotaExceeded?.();
                    return;
                }
                console.error('[YCS] Failed to fetch missing replies:', error);
                return;
            }

            setReplyButtonLoading(target, false);
            comments = safeGetComments(stateAccessor);
            replies = collectRepliesForComment(comments, commentId, 0);
        }
    }

    if (replies.length === 0) {
        console.warn(`[YCS] No replies found in local state for comment ID: ${commentId}`);
        return;
    }

    const query = resolveQuery(queryGetter);
    const wrapper = createRepliesContainer(commentContainer, commentId);
    commentContainer.insertAdjacentElement('beforeend', wrapper);

    // Determine if we are inside an origin chain to maintain small avatar size
    const isOriginChain = commentContainer.closest('.ycs-origin-chain') !== null;

    // hideExpandUp = true to keep UI clean in nested views
    // forceSmallAvatar = isOriginChain to maintain small avatar size when inside origin chain
    renderComment(wrapper, replies, {
        querySearch: query,
        hideExpandUp: true,
        forceSmallAvatar: isOriginChain
    });

    target.innerHTML = String.fromCharCode(8722);
    target.title = 'Close replies to the comment';
}
