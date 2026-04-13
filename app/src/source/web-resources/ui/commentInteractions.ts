import { removeNodeList, navigateVideoToTimestamp } from '../../utils/dom';
import { iconCollapse, iconExpand, iconCurve } from '../../utils/icons';
import { ICommentsFuseResult } from '../../utils/interfaces/i_types';
import { renderComment } from '../../utils/renderView';

type CommentCollection = Array<Record<string, any>>;

export interface CommentStateAccessor {
    getComments(): CommentCollection;
}

export type QueryGetter = () => string;

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
            handleOpenReply(openReplyBtn, stateAccessor, queryGetter);
            return;
        }

        const replyBtn = target.closest('.ycs-reply-btn') as HTMLElement | null;
        if (replyBtn) {
            handleReplyClick(replyBtn);
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

function safeDomKey(value: string): string {
    return value.replace(/[^\w-]/g, '_');
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

function resolveCommentId(entry: Record<string, any> | undefined): string | undefined {
    if (!entry) return undefined;
    return (
        (entry as any)?.commentRenderer?.commentId ||
        (entry as any)?.commentId ||
        (entry as any)?.id ||
        (entry as any)?.commentKey
    );
}

function buildCommentIdMap(comments: CommentCollection): Map<string, Record<string, any>> {
    const map = new Map<string, Record<string, any>>();
    for (const entry of comments) {
        const id = resolveCommentId(entry);
        if (id) {
            map.set(id, entry);
        }
    }
    return map;
}

function resolveRefIndex(entry: Record<string, any> | undefined, fallback = 0): number {
    const originIndex = Number.parseInt(String((entry as any)?._index ?? ''), 10);
    return Number.isFinite(originIndex) ? originIndex : fallback;
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

function createOriginChainWrapper(key: string): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.id = `ycs-com-all-${key}`;
    wrap.className = `ycs-com-all-${key} ycs-origin-chain`;
    wrap.dataset.ycsOrigin = 'chain';
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

function resolveCurrentComment(
    comments: CommentCollection,
    commentId: string | undefined,
    refId: number | null
): Record<string, any> | undefined {
    if (commentId) {
        const map = buildCommentIdMap(comments);
        const found = map.get(commentId);
        if (found) return found;
    }
    return refId !== null ? findCommentByIndex(comments, refId) : undefined;
}

function collectAncestorChain(current: Record<string, any> | undefined): Record<string, any>[] {
    const chain: Record<string, any>[] = [];
    const seen = new Set<string>();
    let node = current;
    while (node?.originComment) {
        const parent = node.originComment as Record<string, any>;
        const id = resolveCommentId(parent);
        if (id) {
            if (seen.has(id)) break;
            seen.add(id);
        }
        chain.push(parent);
        node = parent;
    }
    return chain.reverse();
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

    const comments = safeGetComments(stateAccessor);
    const current = resolveCurrentComment(comments, commentId, refId);
    const ancestors = collectAncestorChain(current);
    if (ancestors.length === 0) return;

    const query = resolveQuery(queryGetter);
    const wrap = createOriginChainWrapper(key);

    // Get source's current marginLeft to position origin chain relative to it
    const computedStyle = window.getComputedStyle(commentContainer);
    const sourceMarginLeft = parseFloat(computedStyle.marginLeft) || 0;
    const EXTRA_OFFSET = 16;
    wrap.style.marginLeft = `${sourceMarginLeft + EXTRA_OFFSET}px`;
    wrap.style.paddingLeft = '12px'; // Space for border-left

    commentContainer.insertAdjacentElement('beforebegin', wrap);

    const results: ICommentsFuseResult[] = ancestors.map((ancestor, index) => ({
        item: { ...ancestor, replyLevel: index } as any,
        refIndex: resolveRefIndex(ancestor, refId ?? 0)
    }));
    renderComment(wrap, results, {
        querySearch: query,
        resetReplyLevel: false,
        hideExpandUp: true,
        forceSmallAvatar: true
    });

    // Add arrow element at chain bottom pointing to source
    const arrow = document.createElement('div');
    arrow.className = 'ycs-origin-chain-arrow';
    wrap.appendChild(arrow);

    // Mark source as origin trigger (for styling only, no margin change)
    commentContainer.classList.add('ycs-origin-trigger');

    // === Scroll Position Lock ===
    restoreScrollPosition(commentContainer, scrollContainer, yBefore);

    target.innerHTML = iconExpand();
    target.title = 'Close all parent comments.';
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

function createRepliesContainer(commentContainer: HTMLElement, commentId: string): HTMLDivElement {
    const wrapper = document.createElement('div');
    const safeId = commentId.replace(/[^\w-]/g, '_');
    wrapper.id = `ycs-com-replies-${safeId}`;

    // Check parent avatar size to align vertical line (border-left)
    // Vertical line is 2px wide, so we offset to align its center with avatar center
    const isNestedParent = commentContainer.querySelector('.ycs-render-img--nested') !== null;
    const marginLeft = isNestedParent ? 7 : 15;

    wrapper.className = `ycs-com-replies-${safeId} ycs-com-replies ycs-com-rp ycs-nested-replies-container`;
    wrapper.style.marginLeft = `${marginLeft}px`;

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

    const syntheticWrap = commentContainer.querySelector('.ycs-synthetic-replies-wrap');
    if (syntheticWrap) syntheticWrap.remove();

    const comments = safeGetComments(stateAccessor);
    const replies = collectRepliesForComment(comments, commentId, 0);
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

function getLoggedInUserAvatar(): string {
    const img = document.querySelector('#avatar-btn img') as HTMLImageElement | null;
    return img?.src || '';
}

function createSyntheticReplyElement(text: string): HTMLElement {
    const container = document.createElement('div');
    container.className = 'ycs-render-comment ycs-synthetic-reply ycs-reply-fade-in';
    container.style.marginLeft = '56px';

    const left = document.createElement('div');
    left.className = 'ycs-left';

    const avatarWrapper = document.createElement('div');
    avatarWrapper.className = 'ycs-render-img ycs-render-img--nested';

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.alt = 'You';
    avatar.height = 32;
    avatar.width = 32;
    avatar.src = getLoggedInUserAvatar();

    avatarWrapper.appendChild(avatar);
    left.appendChild(avatarWrapper);

    const block = document.createElement('div');
    block.className = 'ycs-comment-block ycs-comment-block--nested';

    const header = document.createElement('div');
    header.className = 'ycs-head-block__dib ycs-head-block ycs-head__title-main';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'ycs-head__title';
    titleSpan.textContent = 'You';
    header.appendChild(titleSpan);

    const meta = document.createElement('div');
    meta.className = 'ycs-head-block__dib ycs-head-block__lh ycs-time-size';

    const time = document.createElement('span');
    time.textContent = 'Just now';
    meta.appendChild(time);
    header.appendChild(meta);

    const content = document.createElement('div');
    content.className = 'ycs-comment__main-text';
    content.textContent = text;

    block.append(header, content);
    container.append(left, block);

    return container;
}

function handleReplyClick(target: HTMLElement): void {
    const commentContainer = target.closest('.ycs-render-comment') as HTMLElement | null;
    if (!commentContainer) return;

    const createReplyParams = target.dataset.createReplyParams;
    if (!createReplyParams) return;

    const block = commentContainer.querySelector('.ycs-comment-block') as HTMLElement | null;
    if (!block) return;

    const existing = block.querySelector('.ycs-reply-form') as HTMLElement | null;
    if (existing) {
        if (existing.dataset.sending === 'true') return;
        existing.remove();
        return;
    }

    const form = document.createElement('div');
    form.className = 'ycs-reply-form';

    const textarea = document.createElement('textarea');
    textarea.className = 'ycs-reply-textarea';
    textarea.placeholder = 'Add a reply...';
    textarea.rows = 3;

    const actions = document.createElement('div');
    actions.className = 'ycs-reply-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'ycs-reply-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.type = 'button';

    const sendBtn = document.createElement('button');
    sendBtn.className = 'ycs-reply-send';
    sendBtn.textContent = 'Reply';
    sendBtn.type = 'button';
    sendBtn.disabled = true;

    const status = document.createElement('div');
    status.className = 'ycs-reply-status';

    let countdownActive = false;

    textarea.addEventListener('input', () => {
        if (!countdownActive) {
            sendBtn.disabled = textarea.value.trim().length === 0;
        }
    });

    cancelBtn.addEventListener('click', () => {
        form.remove();
    });

    sendBtn.addEventListener('click', async () => {
        const text = textarea.value.trim();
        if (!text) return;

        sendBtn.disabled = true;
        textarea.disabled = true;
        cancelBtn.disabled = true;
        form.dataset.sending = 'true';
        status.textContent = 'Sending...';
        status.className = 'ycs-reply-status ycs-reply-sending';

        try {
            const { sendCommentReply, canSendReply } = await import('../../utils/innertube/reply');

            const rateCheck = canSendReply();
            if (!rateCheck.allowed) {
                let remaining = Math.ceil(rateCheck.waitMs / 1000);
                status.textContent = `Please wait ${remaining}s`;
                status.className = 'ycs-reply-status ycs-reply-countdown';
                countdownActive = true;
                sendBtn.disabled = true;
                textarea.disabled = false;
                cancelBtn.disabled = false;
                form.dataset.sending = '';

                const observer = new MutationObserver(() => {
                    if (!form.isConnected) {
                        clearInterval(countdownId);
                        observer.disconnect();
                    }
                });

                const countdownId = setInterval(() => {
                    remaining -= 1;
                    if (remaining <= 0) {
                        clearInterval(countdownId);
                        observer.disconnect();
                        countdownActive = false;
                        status.textContent = '';
                        status.className = 'ycs-reply-status';
                        sendBtn.disabled = textarea.value.trim().length === 0;
                    } else {
                        status.textContent = `Please wait ${remaining}s`;
                    }
                }, 1000);

                observer.observe(form.parentElement || document.body, { childList: true });

                return;
            }

            const result = await sendCommentReply({
                createReplyParams,
                commentText: text,
                globalContext: window
            });

            if (result.success) {
                const parentId = target.dataset.commentId;
                const safeId = parentId ? safeDomKey(parentId) : undefined;
                const syntheticEl = createSyntheticReplyElement(text);

                let repliesContainer = safeId ? commentContainer.querySelector(`.ycs-com-replies-${safeId}`) : null;
                if (!repliesContainer) {
                    repliesContainer = commentContainer.querySelector('.ycs-synthetic-replies-wrap');
                }
                if (!repliesContainer) {
                    repliesContainer = document.createElement('div');
                    repliesContainer.className = 'ycs-synthetic-replies-wrap';
                    commentContainer.appendChild(repliesContainer);
                }
                repliesContainer.appendChild(syntheticEl);

                if (result.responseData) {
                    document.dispatchEvent(
                        new CustomEvent('ycs-reply-success', {
                            detail: { responseData: result.responseData }
                        })
                    );
                }

                status.textContent = 'Reply sent!';
                status.className = 'ycs-reply-status ycs-reply-success';
                textarea.value = '';
                sendBtn.disabled = true;
                setTimeout(() => form.remove(), 1500);
            } else {
                if (result.error?.includes('expired')) {
                    status.textContent = 'Token expired \u2014 please reload comments and retry';
                } else {
                    status.textContent = result.error || 'Failed to send reply';
                }
                status.className = 'ycs-reply-status ycs-reply-error';
                textarea.disabled = false;
                cancelBtn.disabled = false;
                sendBtn.disabled = textarea.value.trim().length === 0;
            }
        } catch (e) {
            console.error('[YCS] Reply form error:', e);
            status.textContent = 'Unexpected error';
            status.className = 'ycs-reply-status ycs-reply-error';
            textarea.disabled = false;
            cancelBtn.disabled = false;
            sendBtn.disabled = textarea.value.trim().length === 0;
        } finally {
            form.dataset.sending = '';
        }
    });

    actions.append(cancelBtn, sendBtn);
    form.append(textarea, actions, status);
    block.appendChild(form);
    textarea.focus();
}
