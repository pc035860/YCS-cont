import type { ChatItem, CommentItem, TranscriptData, TranscriptTrackInfo } from '../utils/interfaces/i_types';

export interface CountBuckets {
    comments: number;
    commentsChat: number;
    commentsTrVideo: number;
}

/**
 * State for live chat recording feature
 */
export interface LiveRecordingState {
    isRecording: boolean;
    pollIntervalId: ReturnType<typeof setInterval> | null; // 5s polling interval
    timerIntervalId: ReturnType<typeof setInterval> | null; // 1s timer display interval
    broadcastStartTime: string | null; // ISO timestamp from YouTube API
    recordingStartTime: number | null; // Local timestamp when recording started
    lastContinuation: unknown; // Continuation token for next poll
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
    liveRecording: LiveRecordingState;
}

function createCounts(): CountBuckets {
    return {
        comments: 0,
        commentsChat: 0,
        commentsTrVideo: 0
    };
}

function createLiveRecordingState(): LiveRecordingState {
    return {
        isRecording: false,
        pollIntervalId: null,
        timerIntervalId: null,
        broadcastStartTime: null,
        recordingStartTime: null,
        lastContinuation: null
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
        controller: new AbortController(),
        liveRecording: createLiveRecordingState()
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

export function getLiveRecording(state: WebResourcesState): LiveRecordingState {
    return state.liveRecording;
}

export function setLiveRecording(
    state: WebResourcesState,
    liveRecording: Partial<LiveRecordingState>
): WebResourcesState {
    return {
        ...state,
        liveRecording: {
            ...state.liveRecording,
            ...liveRecording
        }
    };
}

export function resetLiveRecording(state: WebResourcesState): WebResourcesState {
    return {
        ...state,
        liveRecording: createLiveRecordingState()
    };
}
