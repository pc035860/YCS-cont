import type { ChatItem, CommentItem, TranscriptData, TranscriptTrackInfo } from '../utils/interfaces/i_types';

export interface CountBuckets {
    comments: number;
    commentsChat: number;
    commentsTrVideo: number;
}

export interface WebResourcesState {
    comments: CommentItem[];
    commentsChat: Map<number, ChatItem>;
    commentsTrVideo?: TranscriptData;
    transcriptTracks?: TranscriptTrackInfo[];
    selectedTranscriptLanguage?: string;
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
        commentsChat: new Map<number, ChatItem>(),
        commentsTrVideo: undefined,
        transcriptTracks: undefined,
        selectedTranscriptLanguage: undefined,
        count: createCounts(),
        countSearch: createCounts(),
        controller: new AbortController()
    };
}

export type CountKey = keyof CountBuckets;

export function getComments(state: WebResourcesState): CommentItem[] {
    return state.comments;
}

export function setComments(state: WebResourcesState, comments: CommentItem[]): WebResourcesState {
    return {
        ...state,
        comments
    };
}

export function clearComments(state: WebResourcesState): WebResourcesState {
    return setComments(state, []);
}

export function getCommentsChat(state: WebResourcesState): Map<number, ChatItem> {
    return state.commentsChat;
}

export function setCommentsChat(state: WebResourcesState, commentsChat: Map<number, ChatItem>): WebResourcesState {
    return {
        ...state,
        commentsChat
    };
}

export function clearCommentsChat(state: WebResourcesState): WebResourcesState {
    return setCommentsChat(state, new Map<number, ChatItem>());
}

export function getCommentsTrVideo(state: WebResourcesState): TranscriptData | undefined {
    return state.commentsTrVideo;
}

export function setCommentsTrVideo(state: WebResourcesState, transcript?: TranscriptData): WebResourcesState {
    return {
        ...state,
        commentsTrVideo: transcript
    };
}

export function clearCommentsTrVideo(state: WebResourcesState): WebResourcesState {
    return setCommentsTrVideo(state, undefined);
}

export function getTranscriptTracks(state: WebResourcesState): TranscriptTrackInfo[] | undefined {
    return state.transcriptTracks;
}

export function setTranscriptTracks(
    state: WebResourcesState,
    transcriptTracks?: TranscriptTrackInfo[]
): WebResourcesState {
    return {
        ...state,
        transcriptTracks
    };
}

export function clearTranscriptTracks(state: WebResourcesState): WebResourcesState {
    return setTranscriptTracks(state, undefined);
}

export function getSelectedTranscriptLanguage(state: WebResourcesState): string | undefined {
    return state.selectedTranscriptLanguage;
}

export function setSelectedTranscriptLanguage(state: WebResourcesState, languageCode?: string): WebResourcesState {
    return {
        ...state,
        selectedTranscriptLanguage: languageCode
    };
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
