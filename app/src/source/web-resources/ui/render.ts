import { renderComment, renderCommentChat, renderCommentTrVideo } from '../../utils/renderView';
import { CommentsSearchResult } from '../search/commentsSearch';
import { ChatSearchResult } from '../search/chatSearch';
import { TranscriptSearchResult } from '../search/transcriptSearch';

interface ButtonState {
    title?: string;
    label?: string;
    dataset?: Record<string, string>;
}

type ButtonStateMap = Record<string, ButtonState>;

function applyButtonStates(states: ButtonStateMap): void {
    for (const [id, state] of Object.entries(states)) {
        const button = document.getElementById(id) as HTMLElement | null;
        if (!button || !state) continue;

        if (state.dataset) {
            for (const [key, value] of Object.entries(state.dataset)) {
                if (value !== undefined) {
                    button.dataset[key as keyof DOMStringMap] = value;
                }
            }
        }

        if (state.title) {
            button.title = state.title;
        }
    }
}

function clearTarget(selector: string): HTMLElement | null {
    const target = document.querySelector(selector) as HTMLElement | null;
    if (target) {
        target.textContent = '';
    }
    return target;
}

export function renderCommentsResult(selector: string, result: CommentsSearchResult): void {
    const target = clearTarget(selector);
    if (!target) return;

    if (result.results.length > 0) {
        renderComment(selector, result.results, { querySearch: result.query });
    }

    applyButtonStates(result.buttonStates);
}

export function renderChatResult(selector: string, result: ChatSearchResult): void {
    const target = clearTarget(selector);
    if (!target) return;

    if (result.results.length > 0) {
        renderCommentChat(selector, result.results, result.query);
    }

    applyButtonStates(result.buttonStates);
}

export function renderTranscriptResult(selector: string, result: TranscriptSearchResult): void {
    const target = clearTarget(selector);
    if (!target) return;

    if (result.results.length > 0) {
        renderCommentTrVideo(selector, result.results, result.query);
    }

    applyButtonStates(result.buttonStates);
}
