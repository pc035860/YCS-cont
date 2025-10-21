export type SortOrder = 'newest' | 'oldest';

export interface SearchContext {
    extendedSearch: {
        enabled: boolean;
        title: boolean;
        main: boolean;
    };
    sortOrders: {
        comments: Partial<Record<string, SortOrder>>;
        chat: Partial<Record<string, SortOrder>>;
        transcript: Partial<Record<string, SortOrder>>;
    };
}
