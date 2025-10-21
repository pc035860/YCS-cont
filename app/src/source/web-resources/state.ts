export interface CountBuckets {
    comments: number;
    commentsChat: number;
    commentsTrVideo: number;
}

export interface WebResourcesState {
    comments: any[];
    commentsChat: Map<number, any>;
    commentsTrVideo?: any;
    count: CountBuckets;
    countSearch: CountBuckets;
    controller: AbortController;
}

function createCounts(): CountBuckets {
    return {
        comments: 0,
        commentsChat: 0,
        commentsTrVideo: 0
    };
}

export function createState(): WebResourcesState {
    return {
        comments: [],
        commentsChat: new Map<number, any>(),
        commentsTrVideo: undefined,
        count: createCounts(),
        countSearch: createCounts(),
        controller: new AbortController()
    };
}

export type CountKey = keyof CountBuckets;

export function getComments(state: WebResourcesState): any[] {
    return state.comments;
}

export function setComments(state: WebResourcesState, comments: any[]): WebResourcesState {
    return {
        ...state,
        comments
    };
}

export function clearComments(state: WebResourcesState): WebResourcesState {
    return setComments(state, []);
}

export function getCommentsChat(state: WebResourcesState): Map<number, any> {
    return state.commentsChat;
}

export function setCommentsChat(state: WebResourcesState, commentsChat: Map<number, any>): WebResourcesState {
    return {
        ...state,
        commentsChat
    };
}

export function clearCommentsChat(state: WebResourcesState): WebResourcesState {
    return setCommentsChat(state, new Map<number, any>());
}

export function getCommentsTrVideo(state: WebResourcesState): any | undefined {
    return state.commentsTrVideo;
}

export function setCommentsTrVideo(state: WebResourcesState, transcript?: any): WebResourcesState {
    return {
        ...state,
        commentsTrVideo: transcript
    };
}

export function clearCommentsTrVideo(state: WebResourcesState): WebResourcesState {
    return setCommentsTrVideo(state, undefined);
}

export function getCounts(state: WebResourcesState): CountBuckets {
    return state.count;
}

export function setCount(state: WebResourcesState, key: CountKey, value: number): WebResourcesState {
    return {
        ...state,
        count: {
            ...state.count,
            [key]: value
        }
    };
}

export function incrementCount(state: WebResourcesState, key: CountKey, value = 1): WebResourcesState {
    return setCount(state, key, state.count[key] + value);
}

export function resetCounts(state: WebResourcesState): WebResourcesState {
    return {
        ...state,
        count: createCounts()
    };
}

export function getSearchCounts(state: WebResourcesState): CountBuckets {
    return state.countSearch;
}

export function setSearchCount(state: WebResourcesState, key: CountKey, value: number): WebResourcesState {
    return {
        ...state,
        countSearch: {
            ...state.countSearch,
            [key]: value
        }
    };
}

export function incrementSearchCount(state: WebResourcesState, key: CountKey, value = 1): WebResourcesState {
    return setSearchCount(state, key, state.countSearch[key] + value);
}

export function resetSearchCounts(state: WebResourcesState): WebResourcesState {
    return {
        ...state,
        countSearch: createCounts()
    };
}

export function getController(state: WebResourcesState): AbortController {
    return state.controller;
}

export function setController(state: WebResourcesState, controller: AbortController): WebResourcesState {
    return {
        ...state,
        controller
    };
}

export function resetController(state: WebResourcesState): WebResourcesState {
    return setController(state, new AbortController());
}
