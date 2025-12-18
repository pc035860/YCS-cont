import { removeNodeList, navigateVideoToTimestamp } from '../../utils/dom';
import { iconCollapse, iconExpand } from '../../utils/icons';
import { ICommentsFuseResult } from '../../utils/interfaces/i_types';
import { renderComment } from '../../utils/renderView';

type CommentCollection = Array<Record<string, any>>;

export interface CommentStateAccessor {
    getComments(): CommentCollection;
}

export type QueryGetter = () => string;

export function registerCommentInteractions(
    container: HTMLElement,
    stateAccessor: CommentStateAccessor,
    queryGetter: QueryGetter
): void {
    if (!container || !stateAccessor?.getComments) return;
    if (container.dataset.ycsInteractionsBound === 'true') {
        return;
    }

    container.dataset.ycsInteractionsBound = 'true';

    container.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;

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
            handleOpenReply(openReplyBtn, stateAccessor, queryGetter);
        }
    });
}

function safeGetComments(stateAccessor: CommentStateAccessor): CommentCollection {
    try {
        const comments = stateAccessor.getComments();
        return Array.isArray(comments) ? comments : [];
    } catch (error) {
        console.error(error);
        return [];
    }
}

function resolveQuery(queryGetter: QueryGetter): string {
    try {
        const value = queryGetter?.();
        return typeof value === 'string' ? value : '';
    } catch (error) {
        console.error(error);
        return '';
    }
}

function parseRefId(target: HTMLElement): number | null {
    const raw = target.getAttribute('id');
    if (!raw) return null;
    const refId = Number.parseInt(raw, 10);
    return Number.isFinite(refId) ? refId : null;
}

function findCommentByIndex(comments: CommentCollection, refId: number): Record<string, any> | undefined {
    return comments.find((item) => Number.parseInt(String((item as any)?._index ?? ''), 10) === refId);
}

function buildOriginResult(origin: Record<string, any> | undefined, refId: number): ICommentsFuseResult | null {
    if (!origin?.originComment) return null;
    return {
        item: origin.originComment,
        refIndex: refId
    };
}

function createOriginWrapper(refId: number): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.id = `ycs-com-${refId}`;
    wrap.className = wrap.id;
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

function createReplyAuthorWrapper(refId: number): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.id = `ycs-com-rauth-${refId}`;
    wrap.className = `ycs-com-${refId} ycs-oc-ml`;
    return wrap;
}

function collapseOriginComment(refId: number, container: HTMLElement, toggle: HTMLElement): void {
    removeNodeList(`.ycs-com-${refId}`);
    container.classList.remove('ycs-oc-ml');
    toggle.innerHTML = iconExpand();
    toggle.title = 'Open the comment to the reply here.';
}

function handleOpenComment(target: HTMLElement, stateAccessor: CommentStateAccessor, queryGetter: QueryGetter): void {
    const refId = parseRefId(target);
    if (refId === null) return;

    const commentContainer = target.closest('.ycs-render-comment') as HTMLElement | null;
    if (!commentContainer) return;

    const existing = document.getElementById(`ycs-com-${refId}`);
    if (existing) {
        collapseOriginComment(refId, commentContainer, target);
        return;
    }

    const comments = safeGetComments(stateAccessor);
    const origin = findCommentByIndex(comments, refId);
    const originResult = buildOriginResult(origin, refId);
    const query = resolveQuery(queryGetter);

    const wrap = createOriginWrapper(refId);
    commentContainer.insertAdjacentElement('beforebegin', wrap);

    if (originResult) {
        renderComment(wrap, [originResult], true, query);
    }

    commentContainer.classList.add('ycs-oc-ml');

    const replyAuthorResults = buildAuthorReplyResults(comments, origin, refId);
    if (replyAuthorResults.length > 0) {
        const replyWrap = createReplyAuthorWrapper(refId);
        commentContainer.insertAdjacentElement('beforebegin', replyWrap);
        renderComment(replyWrap, replyAuthorResults, false, query);
    }

    target.innerHTML = iconCollapse();
    target.title = 'Close the comment to the reply here.';
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

function createRepliesContainer(commentId: string): HTMLDivElement {
    const wrapper = document.createElement('div');
    // Ensure ID is safe for DOM
    const safeId = commentId.replace(/[^\w-]/g, '_');
    wrapper.id = `ycs-com-replies-${safeId}`;
    wrapper.className = `ycs-com-replies-${safeId} ycs-com-replies ycs-com-rp ycs-nested-replies-container`;
    return wrapper;
}

function handleOpenReply(target: HTMLElement, stateAccessor: CommentStateAccessor, queryGetter: QueryGetter): void {
    const commentId = target.dataset.idcom;
    if (!commentId) return;

    const commentContainer = target.closest('.ycs-render-comment') as HTMLElement | null;
    if (!commentContainer) return;

    const safeId = commentId.replace(/[^\w-]/g, '_');
    const existingReplies = commentContainer.querySelector(`.ycs-com-replies-${safeId}`);
    if (existingReplies) {
        existingReplies.remove();
        target.innerHTML = '+';
        target.title = 'Open replies to the comment';
        return;
    }

    const comments = safeGetComments(stateAccessor);
    const replies = collectRepliesForComment(comments, commentId, 0);
    if (replies.length === 0) {
        console.warn(`[YCS] No replies found in local state for comment ID: ${commentId}`);
        // If replies are expected but not found, it might be due to a re-linking failure or async delay
        return;
    }

    const query = resolveQuery(queryGetter);
    const wrapper = createRepliesContainer(commentId);
    commentContainer.insertAdjacentElement('beforeend', wrapper);

    // Use resetReplyLevel = true to prevent recursive indentation multiplication
    renderComment(wrapper, replies, false, query, true);

    target.innerHTML = String.fromCharCode(8722);
    target.title = 'Close replies to the comment';
}
