export interface CommentStateAccessor {
    getComments(): Array<Record<string, any>>;
}

export type QueryGetter = () => string;

export interface OriginChainDeps {
    stateAccessor: CommentStateAccessor;
    queryGetter: QueryGetter;
}

export function expandOriginChainFor(_container: HTMLElement, _deps: OriginChainDeps): boolean {
    return false;
}

export function autoExpandAllRepliesIn(_root: HTMLElement, _deps: OriginChainDeps): void {
    return;
}
