import { iconSortDown, iconSortUp } from '../../utils/icons';
import { renderComment, renderCommentChat, renderCommentTrVideo } from '../../utils/renderView';
import { CommentsSearchResult } from '../search/commentsSearch';
import { ChatSearchResult } from '../search/chatSearch';
import { TranscriptSearchResult } from '../search/transcriptSearch';

const BUTTON_LABELS: Record<string, string> = {
    ycs_btn_links: 'Links',
    ycs_btn_members: 'Members',
    ycs_btn_donated: 'Donated',
    ycs_btn_author: 'Author',
    ycs_btn_timestamps: 'Time stamps',
    ycs_btn_sort_first: 'All'
};

const BUTTON_PREFIX_HTML: Record<string, string> = {
    ycs_btn_heart: '<span class="ycs-creator-heart_icon">❤</span>',
    ycs_btn_verified: '<span class="ycs-creator-verified_icon">✔</span>'
};

interface ButtonState {
    order?: 'newest' | 'oldest';
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

        if (state.order) {
            const baseLabel = state.label ?? BUTTON_LABELS[id] ?? '';
            const prefix = BUTTON_PREFIX_HTML[id];
            const htmlLabel = prefix ? `${prefix}${baseLabel ? ` ${baseLabel}` : ''}` : baseLabel;
            const icon = state.order === 'oldest' ? iconSortUp() : iconSortDown();

            if (htmlLabel) {
                button.innerHTML = `${htmlLabel} ${icon}`;
                button.dataset.labelHtml = htmlLabel;
            } else {
                button.innerHTML = icon;
                button.dataset.labelHtml = '';
            }
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
        renderComment(selector, result.results, true, result.query);
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
