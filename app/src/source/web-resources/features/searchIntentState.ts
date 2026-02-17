export interface SearchIntentSnapshot {
    query: string;
    hasActiveFilter: boolean;
    isCollapsed: boolean;
}

export interface SearchIntentState {
    markSearchExecuted(): void;
    resetExecution(): void;
    isIntentActive(snapshot: SearchIntentSnapshot): boolean;
}

export function createSearchIntentState(): SearchIntentState {
    let hasExecutedSearch = false;

    const hasQuery = (query: string): boolean => query.trim().length > 0;

    return {
        markSearchExecuted(): void {
            hasExecutedSearch = true;
        },
        resetExecution(): void {
            hasExecutedSearch = false;
        },
        isIntentActive(snapshot: SearchIntentSnapshot): boolean {
            if (snapshot.isCollapsed) return false;
            if (snapshot.hasActiveFilter) return true;

            if (!hasQuery(snapshot.query)) {
                hasExecutedSearch = false;
                return false;
            }

            return hasExecutedSearch;
        }
    };
}
