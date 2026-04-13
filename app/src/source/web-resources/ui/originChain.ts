import { GlobalStore } from '../../utils/common';
import { iconExpand } from '../../utils/icons';
import type { ICommentsFuseResult } from '../../utils/interfaces/i_types';
import { renderComment } from '../../utils/renderView';

type CommentCollection = Array<Record<string, any>>;

export interface CommentStateAccessor {
    getComments(): CommentCollection;
}

export type QueryGetter = () => string;

export interface OriginChainDeps {
    stateAccessor: CommentStateAccessor;
    queryGetter: QueryGetter;
}

export function safeGetComments(stateAccessor: CommentStateAccessor): CommentCollection {
    try {
        const comments = stateAccessor.getComments();
        return Array.isArray(comments) ? comments : [];
    } catch (error) {
        console.error(error);
        return [];
    }
}

export function resolveQuery(queryGetter: QueryGetter): string {
    try {
        const value = queryGetter?.();
        return typeof value === 'string' ? value : '';
    } catch (error) {
        console.error(error);
        return '';
    }
}

export function safeDomKey(value: string): string {
    return value.replace(/[^\w-]/g, '_');
}

export function parseRefId(target: HTMLElement): number | null {
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

export function resolveRefIndex(entry: Record<string, any> | undefined, fallback = 0): number {
    const originIndex = Number.parseInt(String((entry as any)?._index ?? ''), 10);
    return Number.isFinite(originIndex) ? originIndex : fallback;
}

export function resolveCurrentComment(
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

function createOriginChainWrapper(key: string): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.id = `ycs-com-all-${key}`;
    wrap.className = `ycs-com-all-${key} ycs-origin-chain`;
    wrap.dataset.ycsOrigin = 'chain';
    return wrap;
}

function readMarginLeftPx(element: HTMLElement): number {
    try {
        const computedStyle = window.getComputedStyle(element);
        const value = parseFloat(computedStyle.marginLeft);
        return Number.isFinite(value) ? value : 0;
    } catch {
        return 0;
    }
}

export function expandOriginChainFor(container: HTMLElement, deps: OriginChainDeps): boolean {
    const button = container.querySelector<HTMLElement>('.ycs-open-comment-all');
    const refId = button ? parseRefId(button) : null;
    const commentId = button?.dataset.commentId;
    if (refId === null && !commentId) return false;

    const key = commentId ? safeDomKey(commentId) : `idx-${refId ?? 0}`;

    if (document.getElementById(`ycs-com-all-${key}`)) return false;

    const comments = safeGetComments(deps.stateAccessor);
    const current = resolveCurrentComment(comments, commentId, refId);
    const ancestors = collectAncestorChain(current);
    if (ancestors.length === 0) return false;

    const query = resolveQuery(deps.queryGetter);
    const wrap = createOriginChainWrapper(key);

    const sourceMarginLeft = readMarginLeftPx(container);
    const EXTRA_OFFSET = 16;
    wrap.style.marginLeft = `${sourceMarginLeft + EXTRA_OFFSET}px`;
    wrap.style.paddingLeft = '12px';

    container.insertAdjacentElement('beforebegin', wrap);

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

    const arrow = document.createElement('div');
    arrow.className = 'ycs-origin-chain-arrow';
    wrap.appendChild(arrow);

    container.classList.add('ycs-origin-trigger');

    return true;
}

export function autoExpandAllRepliesIn(root: HTMLElement, deps: OriginChainDeps): void {
    if (!(GlobalStore as any).autoExpandReplyContext) return;

    const buttons = Array.from(root.querySelectorAll<HTMLElement>('.ycs-open-comment-all'));
    const seen = new Set<HTMLElement>();

    for (const btn of buttons) {
        const container = btn.closest<HTMLElement>('.ycs-render-comment');
        if (!container || seen.has(container)) continue;
        seen.add(container);

        const expanded = expandOriginChainFor(container, deps);
        if (expanded) {
            btn.innerHTML = iconExpand();
            btn.title = 'Close all parent comments.';
        }
    }
}
