/* eslint-disable @typescript-eslint/no-explicit-any */

import { safeUrl } from '../utils/formatting';
import { randomString } from '../utils/common';
import { markTextComment, getPiP } from '../utils/dom';
import { options } from '../config/options';
import {
    buildCommentViewModels,
    buildChatMessageViewModels,
    buildTranscriptViewModels,
    CommentViewModel,
    ChatMessageViewModel,
    TranscriptViewModel,
    MemberBadgeViewModel,
    DonatedChipViewModel
} from './viewModels';
import { iconExpand, iconExpandShowMore, iconReload, iconSortDown } from './icons';
import { EXPORT_FORMAT } from '../web-resources/services/exportService';

// Debug mode configuration
// Set to true for detailed diagnostic logs during development
// Set to false for production to reduce console noise
const DEBUG = false;

const LIKE_ICON_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">
        <g>
            <path
                d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"
            ></path>
        </g>
    </svg>
`;

const SPEECH_ICON_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="14px" height="14px">
        <linearGradient x1="12.686" x2="35.58" y1="4.592" y2="41.841" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#21ad64" />
            <stop offset="1" stop-color="#088242" />
        </linearGradient>
        <path
            d="M42,8H6c-1.105,0-2,0.895-2,2v26c0,1.105,0.895,2,2,2h8v7.998  c0,0.891,1.077,1.337,1.707,0.707L24.412,38H42c1.105,0,2-0.895,2-2V10C44,8.895,43.105,8,42,8z"
        />
    </svg>
`;

function createMemberBadgeElement(badge?: MemberBadgeViewModel): HTMLElement | null {
    if (!badge) return null;

    const img = document.createElement('img');
    img.alt = badge.tooltip;
    img.title = badge.tooltip;
    img.height = 14;
    img.width = 14;
    img.className = 'ycs-user-member';
    img.loading = 'lazy';
    img.src = badge.thumbnailUrl;
    return img;
}

function createDonatedChipElement(chip?: DonatedChipViewModel): HTMLElement | null {
    if (!chip) return null;

    // Create outer wrapper (YouTube Web Component structure)
    const wrapper = document.createElement('span');
    wrapper.id = 'paid-comment-chip';
    wrapper.slot = 'content';
    wrapper.className = 'style-scope ycs-chip ytd-comment-view-model';
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('tabindex', '0');

    // Set CSS Variables for dynamic colors
    if (chip.backgroundColor) {
        wrapper.style.setProperty('--yt-pdg-comment-chip-background-color', chip.backgroundColor);
    }
    if (chip.foregroundColor) {
        wrapper.style.setProperty('--yt-pdg-comment-chip-font-color', chip.foregroundColor);
    }
    wrapper.style.setProperty('--yt-pdg-comment-chip-cursor', 'pointer');

    // Create inner container
    const container = document.createElement('div');
    container.id = 'comment-chip-container';
    container.className = 'style-scope yt-pdg-comment-chip-renderer';

    // Create icon container
    const iconContainer = document.createElement('span');
    iconContainer.className = 'style-scope ycs-yt-icon yt-pdg-comment-chip-renderer';

    const iconShape = document.createElement('span');
    iconShape.className = 'yt-icon-shape style-scope yt-icon ytSpecIconShapeHost';

    const iconDiv = document.createElement('div');
    iconDiv.style.cssText = 'width: 100%; height: 100%; display: block; fill: currentcolor;';

    // SVG icon for donated chip (heart + dollar sign)
    iconDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" height="12" viewBox="0 0 12 12" width="12" focusable="false" aria-hidden="true" style="pointer-events: none; display: inherit; width: 100%; height: 100%;"><path d="M8.125 1C7.35 1 6.599 1.267 6 1.758 5.4 1.268 4.65.999 3.875 1c-.895 0-1.754.356-2.386.989C.856 2.62.5 3.479.5 4.375c0 2.249 1.392 3.908 2.604 4.935.74.62 1.551 1.148 2.419 1.571l.048.022.015.007.004.003h.002L6 10l-.407.914.407.18.406-.18L6 10c.134.305.27.61.407.913l.002-.001.005-.002.014-.007.048-.023c.868-.422 1.68-.95 2.42-1.57C10.107 8.283 11.5 6.624 11.5 4.375c0-.895-.356-1.754-.989-2.386C9.88 1.356 9.021 1 8.125 1ZM6 3.25c.133 0 .26.053.354.146.093.094.146.221.146.354v.327c.284.087.54.247.744.464l.008.009.003.004.001.003c.078.102.114.23.1.357-.014.128-.077.245-.175.327-.099.083-.225.124-.353.115-.128-.009-.248-.067-.334-.162l.002.004-.017-.016c-.13-.12-.302-.186-.48-.185-.199 0-.315.052-.37.096-.043.034-.07.078-.07.157 0 .015.002.03.005.046l.002.004.008.009c.013.01.028.02.044.028.113.06.287.098.571.153.237.047.582.111.86.269.15.085.3.207.41.385.112.18.163.386.163.606 0 .621-.477 1.048-1.122 1.192v.308c0 .133-.053.26-.146.354-.094.093-.221.146-.354.146-.133 0-.26-.053-.354-.146-.093-.094-.146-.221-.146-.354v-.306c-.272-.052-.526-.17-.739-.347-.139-.119-.251-.265-.33-.43l-.017-.043-.007-.017-.002-.006-.002-.004v-.002c-.04-.124-.03-.26.028-.376.059-.117.16-.207.284-.249.124-.042.26-.033.377.024.118.057.208.158.252.281l-.001-.004-.005-.014c.019.032.043.06.072.084.066.056.23.162.59.162.295 0 .463-.075.545-.136.078-.058.083-.105.083-.117 0-.061-.015-.08-.015-.081-.003-.004-.014-.022-.057-.046-.108-.062-.281-.102-.558-.157-.232-.045-.574-.105-.847-.25-.167-.085-.31-.211-.415-.367-.115-.178-.175-.387-.171-.599-.003-.18.036-.358.113-.52.077-.162.19-.305.332-.416.145-.114.311-.194.49-.244v-.32c0-.133.053-.26.146-.354.094-.093.221-.146.354-.146Z"></path></svg>`;

    iconShape.appendChild(iconDiv);
    iconContainer.appendChild(iconShape);

    // Create price text
    const priceSpan = document.createElement('span');
    priceSpan.id = 'comment-chip-price';
    priceSpan.className = 'style-scope yt-pdg-comment-chip-renderer';
    priceSpan.textContent = ` ${chip.amount} `;

    container.appendChild(iconContainer);
    container.appendChild(priceSpan);

    // Nest container inside wrapper
    wrapper.appendChild(container);

    return wrapper;
}

function createHeartElement(tooltip?: string): HTMLElement | null {
    if (!tooltip) return null;

    const container = document.createElement('div');
    container.className = 'ycs-heart-wrap';
    container.title = tooltip;

    const icon = document.createElement('span');
    icon.className = 'ycs-heart-icon';
    icon.textContent = '❤';
    container.appendChild(icon);

    return container;
}

function createVerifiedElement(isVerified: boolean): HTMLElement | null {
    if (!isVerified) return null;

    const container = document.createElement('div');
    container.className = 'ycs-verified-wrap';
    container.title = 'Verified user';

    const icon = document.createElement('span');
    icon.className = 'ycs-verified-icon';
    icon.textContent = '✔';
    container.appendChild(icon);

    return container;
}

function createLikeCountElement(countText?: string): HTMLElement | null {
    if (!countText) return null;

    const container = document.createElement('div');
    container.className = 'ycs-wrap-like';

    const icon = document.createElement('span');
    icon.className = 'ycs-icon-like';
    icon.innerHTML = LIKE_ICON_SVG;

    const count = document.createElement('span');
    count.className = 'ycs-like-count';
    count.textContent = countText;

    container.append(icon, count);
    return container;
}

function createReplyCountElement(model: CommentViewModel): HTMLElement | null {
    if (!model.replyCount || model.replyCount <= 0 || !model.commentId) return null;

    const container = document.createElement('div');
    container.className = 'ycs-wrap-like';

    const icon = document.createElement('span');
    icon.className = 'ycs-icons__speech';
    icon.innerHTML = SPEECH_ICON_SVG;

    const count = document.createElement('span');
    count.className = 'ycs-like-count';
    count.textContent = String(model.replyCount);

    const button = document.createElement('button');
    button.className = 'ycs-open-reply';
    button.title = 'Open replies to the comment';
    button.textContent = '+';
    button.setAttribute('data-idcom', model.commentId);

    container.append(icon, count, button);
    return container;
}

function createCommentElement(model: CommentViewModel, index: number): HTMLElement {
    const container = document.createElement('div');
    container.id = `ycs-number-comment-${index}`;
    container.className = 'ycs-render-comment';

    const left = document.createElement('div');
    left.className = 'ycs-left';

    const profileLink = document.createElement('a');
    profileLink.href = safeUrl(model.authorProfileUrl);
    profileLink.target = '_blank';
    profileLink.rel = 'noopener noreferrer';

    const avatarWrapper = document.createElement('div');
    avatarWrapper.className = 'ycs-render-img';

    const avatar = document.createElement('img');
    avatar.alt = model.authorName;
    avatar.height = 40;
    avatar.width = 40;
    avatar.loading = 'lazy';
    avatar.src = model.authorAvatarUrl || '';

    avatarWrapper.appendChild(avatar);
    profileLink.appendChild(avatarWrapper);
    left.appendChild(profileLink);

    const block = document.createElement('div');
    block.className = 'ycs-comment-block';

    const header = document.createElement('div');
    header.className = 'ycs-head-block__dib ycs-head-block ycs-head__title-main';

    const titleLink = document.createElement('a');
    titleLink.className = 'ycs-head__title';
    titleLink.href = safeUrl(model.authorProfileUrl);
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = model.authorName;
    titleLink.appendChild(titleSpan);
    header.appendChild(titleLink);

    const verified = createVerifiedElement(model.isVerified);
    if (verified) {
        header.appendChild(verified);
    }

    const meta = document.createElement('div');
    meta.className = 'ycs-head-block__dib ycs-head-block__lh ycs-time-size';

    const badge = createMemberBadgeElement(model.memberBadge);
    if (badge) {
        meta.appendChild(badge);
    }

    const donatedChip = createDonatedChipElement(model.donatedChip);
    if (donatedChip) {
        meta.appendChild(donatedChip);
    }

    const publishedLink = document.createElement('a');
    publishedLink.className = 'ycs-datetime-goto';
    publishedLink.href = safeUrl(model.publishedUrl);
    publishedLink.target = '_blank';
    publishedLink.rel = 'noopener noreferrer';
    publishedLink.title = 'Open a comment, a reply, in a new window, for edit';
    publishedLink.textContent = model.publishedText;
    meta.appendChild(publishedLink);

    const heart = createHeartElement(model.heartTooltip);
    if (heart) {
        meta.appendChild(heart);
    }

    const like = createLikeCountElement(model.likeCountText);
    if (like) {
        meta.appendChild(like);
    }

    const replies = createReplyCountElement(model);
    if (replies) {
        meta.appendChild(replies);
    }

    if (model.isReply && model.isReplyType && model.refIndex) {
        const button = document.createElement('button');
        button.id = model.refIndex;
        button.title = 'Open the comment to the reply here.';
        button.className = 'ycs-open-comment';
        button.innerHTML = iconExpand();
        meta.appendChild(button);
    }

    header.appendChild(meta);

    const content = document.createElement('div');
    content.className = 'ycs-comment__main-text';
    content.innerHTML = model.contentHtml;

    block.append(header, content);
    container.append(left, block);

    return container;
}

function createChatElement(model: ChatMessageViewModel, index: number): HTMLElement {
    const container = document.createElement('div');
    container.id = `ycs-number-comment-${index}`;
    container.className = 'ycs-render-comment';

    const left = document.createElement('div');
    left.className = 'ycs-left';

    const profileLink = document.createElement('a');
    profileLink.href = safeUrl(model.authorProfileUrl);
    profileLink.target = '_blank';
    profileLink.rel = 'noopener noreferrer';

    const avatarWrapper = document.createElement('div');
    avatarWrapper.className = 'ycs-render-img';

    const avatar = document.createElement('img');
    avatar.alt = model.authorName;
    avatar.height = 40;
    avatar.width = 40;
    avatar.loading = 'lazy';
    avatar.src = model.authorAvatarUrl || '';

    avatarWrapper.appendChild(avatar);
    profileLink.appendChild(avatarWrapper);
    left.appendChild(profileLink);

    const block = document.createElement('div');
    block.className = 'ycs-comment-block';

    const header = document.createElement('div');
    header.className = 'ycs-head-block__dib ycs-head-block ycs-head__title-main';

    const titleLink = document.createElement('a');
    titleLink.className = 'ycs-head__title';
    titleLink.href = safeUrl(model.authorProfileUrl);
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = model.authorName;
    titleLink.appendChild(titleSpan);
    header.appendChild(titleLink);

    const verified = createVerifiedElement(model.isVerified);
    if (verified) {
        header.appendChild(verified);
    }

    const meta = document.createElement('div');
    meta.className = 'ycs-head-block__dib ycs-head-block__lh ycs-time-size';

    const badge = createMemberBadgeElement(model.memberBadge);
    if (badge) {
        meta.appendChild(badge);
    }

    const donatedChip = createDonatedChipElement(model.donatedChip);
    if (donatedChip) {
        meta.appendChild(donatedChip);
    }

    const timestampLink = document.createElement('a');
    timestampLink.className = 'ycs-datetime-goto';
    timestampLink.title = 'GMT0';
    timestampLink.href = safeUrl(model.gotoVideoUrl || '');
    timestampLink.target = '_blank';
    timestampLink.rel = 'noopener noreferrer';
    timestampLink.textContent = model.timestampGmtText;
    meta.appendChild(timestampLink);

    const chatLabel = document.createElement('span');
    chatLabel.className = 'ycs_chat_info';
    chatLabel.textContent = '(chat)';
    meta.appendChild(chatLabel);

    if (model.gotoVideoOffset && model.timestampLabel) {
        const goto = document.createElement('span');
        goto.className = 'ycs-cpointer ycs-gotochat-video ycs_goto_chat';
        goto.title = 'Go to the video by time.';
        goto.dataset.offsetvideo = model.gotoVideoOffset;
        goto.textContent = `|▶ Go to: ${model.timestampLabel}`;
        meta.appendChild(goto);
    }

    header.appendChild(meta);

    const content = document.createElement('div');
    content.className = 'ycs-comment__main-text';
    content.innerHTML = model.messageHtml;

    block.append(header, content);
    container.append(left, block);

    return container;
}

function createTranscriptElement(model: TranscriptViewModel, index: number): HTMLElement {
    const container = document.createElement('div');
    container.id = `ycs-number-comment-${index}`;
    container.className = 'ycs-render-comment ycs-oc-ml';

    const left = document.createElement('div');
    left.className = 'ycs-left';

    const gotoLink = document.createElement('a');
    gotoLink.className = 'ycs-goto-video ycs-cpointer';
    gotoLink.href = safeUrl(model.shareUrl);
    gotoLink.target = '_blank';
    gotoLink.rel = 'noopener noreferrer';
    gotoLink.title = 'Go to the video by time.';
    if (model.gotoOffset) {
        gotoLink.dataset.offsetvideo = model.gotoOffset;
    }
    gotoLink.textContent = `|▶ Go to: ${model.formattedOffset}`;
    left.appendChild(gotoLink);

    const shareWrap = document.createElement('div');
    shareWrap.className = 'ycs-head-block__dib ycs-head-block ycs-head__title-main';

    const shareLink = document.createElement('a');
    shareLink.className = 'ycs-datetime-goto';
    shareLink.href = safeUrl(model.shareUrl);
    shareLink.target = '_blank';
    shareLink.rel = 'noopener noreferrer';
    shareLink.title = 'Timestamp link';
    shareLink.textContent = 'Share link';
    shareWrap.appendChild(shareLink);
    left.appendChild(shareWrap);

    const content = document.createElement('div');
    content.className = 'ycs-comment__main-text ycs-clear';
    content.textContent = model.cueText;

    container.append(left, content);

    return container;
}

function renderComment(el: string | HTMLElement, data: any, isReply = true, querySearch?: string): void {
    if (!el) return;

    const target = typeof el === 'string' ? document.querySelector(el) : el;
    if (!target) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'ycs_wrap_comments';
    target.appendChild(wrapper);

    const models = buildCommentViewModels(Array.isArray(data) ? data : [], { isReply });
    const range = 200;
    let currentPos = 0;

    const appendBatch = (parent: HTMLElement, startIndex: number, endIndex: number): void => {
        const fragment = document.createDocumentFragment();
        for (let index = startIndex; index < endIndex && index < models.length; index += 1) {
            fragment.appendChild(createCommentElement(models[index], index + 1));
        }
        parent.appendChild(fragment);
    };

    const initialEnd = Math.min(range, models.length);
    appendBatch(wrapper, currentPos, initialEnd);
    currentPos = initialEnd;

    if (models.length > currentPos) {
        const showMore = document.createElement('div');
        showMore.id = 'ycs_search_show_more';
        showMore.className = 'ycs-render-comment ycs-show_more_block';

        const button = document.createElement('div');
        button.id = 'ycs__show-more-button';
        button.className = 'ycs-title';
        button.innerHTML = `Show more, found comments (${models.length - currentPos}) ${iconExpandShowMore()}`;
        showMore.appendChild(button);
        wrapper.appendChild(showMore);

        showMore.addEventListener('click', () => {
            const nextEnd = Math.min(currentPos + range, models.length);
            if (nextEnd <= currentPos) return;

            const batchClass = randomString(15);
            const batchWrapper = document.createElement('div');
            batchWrapper.className = batchClass;
            showMore.insertAdjacentElement('beforebegin', batchWrapper);

            appendBatch(batchWrapper, currentPos, nextEnd);

            if (querySearch) {
                markTextComment(`.${batchClass}`, querySearch);
            }

            currentPos = nextEnd;

            if (currentPos >= models.length) {
                showMore.remove();
            } else {
                button.innerHTML = `Show more, found comments (${models.length - currentPos}) ${iconExpandShowMore()}`;
            }
        });
    }

    if (querySearch) {
        markTextComment(el, querySearch);
    }
}

function renderCommentChat(selector: string, data: any, querySearch?: string): void {
    if (typeof selector !== 'string') return;

    const target = document.querySelector(selector);
    if (!target) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'ycs_wrap_comments_chat';
    target.appendChild(wrapper);

    const models = buildChatMessageViewModels(Array.isArray(data) ? data : []);
    const range = 200;
    let currentPos = 0;

    const appendBatch = (parent: HTMLElement, startIndex: number, endIndex: number): void => {
        const fragment = document.createDocumentFragment();
        for (let index = startIndex; index < endIndex && index < models.length; index += 1) {
            fragment.appendChild(createChatElement(models[index], index + 1));
        }
        parent.appendChild(fragment);
    };

    const initialEnd = Math.min(range, models.length);
    appendBatch(wrapper, currentPos, initialEnd);
    currentPos = initialEnd;

    if (models.length > currentPos) {
        const showMore = document.createElement('div');
        showMore.id = 'ycs_search_chat_show_more';
        showMore.className = 'ycs-render-comment ycs-show_more_block';

        const button = document.createElement('div');
        button.id = 'ycs__show-more-button';
        button.className = 'ycs-title';
        button.innerHTML = `Show more, found chat replay (${models.length - currentPos}) ${iconExpandShowMore()}`;
        showMore.appendChild(button);
        wrapper.appendChild(showMore);

        showMore.addEventListener('click', () => {
            const nextEnd = Math.min(currentPos + range, models.length);
            if (nextEnd <= currentPos) return;

            const batchClass = randomString(15);
            const batchWrapper = document.createElement('div');
            batchWrapper.className = batchClass;
            showMore.insertAdjacentElement('beforebegin', batchWrapper);

            appendBatch(batchWrapper, currentPos, nextEnd);

            if (querySearch) {
                markTextComment(`.${batchClass}`, querySearch);
            }

            currentPos = nextEnd;

            if (currentPos >= models.length) {
                showMore.remove();
            } else {
                button.innerHTML = `Show more, found chat replay (${models.length - currentPos}) ${iconExpandShowMore()}`;
            }
        });
    }

    if (querySearch) {
        markTextComment(selector, querySearch);
    }
}

function renderCommentTrVideo(selector: string, data: any, querySearch?: string): void {
    if (typeof selector !== 'string') return;

    const target = document.querySelector(selector);
    if (!target) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'ycs_wrap_comments_trvideo';
    target.appendChild(wrapper);

    const models = buildTranscriptViewModels(Array.isArray(data) ? data : []);
    const range = 200;
    let currentPos = 0;

    const appendBatch = (parent: HTMLElement, startIndex: number, endIndex: number): void => {
        const fragment = document.createDocumentFragment();
        for (let index = startIndex; index < endIndex && index < models.length; index += 1) {
            fragment.appendChild(createTranscriptElement(models[index], index + 1));
        }
        parent.appendChild(fragment);
    };

    const initialEnd = Math.min(range, models.length);
    appendBatch(wrapper, currentPos, initialEnd);
    currentPos = initialEnd;

    if (models.length > currentPos) {
        const showMore = document.createElement('div');
        showMore.id = 'ycs_search_trvideo_show_more';
        showMore.className = 'ycs-render-comment ycs-show_more_block';

        const button = document.createElement('div');
        button.id = 'ycs__show-more-button';
        button.className = 'ycs-title';
        button.innerHTML = `Show more, found transcript video (${models.length - currentPos}) ${iconExpandShowMore()}`;
        showMore.appendChild(button);
        wrapper.appendChild(showMore);

        showMore.addEventListener('click', () => {
            const nextEnd = Math.min(currentPos + range, models.length);
            if (nextEnd <= currentPos) return;

            const batchClass = randomString(15);
            const batchWrapper = document.createElement('div');
            batchWrapper.className = batchClass;
            showMore.insertAdjacentElement('beforebegin', batchWrapper);

            appendBatch(batchWrapper, currentPos, nextEnd);

            if (querySearch) {
                markTextComment(`.${batchClass}`, querySearch);
            }

            currentPos = nextEnd;

            if (currentPos >= models.length) {
                showMore.remove();
            } else {
                button.innerHTML = `Show more, found transcript video (${models.length - currentPos}) ${iconExpandShowMore()}`;
            }
        });
    }

    if (querySearch) {
        markTextComment(selector, querySearch);
    }
}

/**
 * Check if element is visible (CSS properties only)
 * - Not affected by Page Visibility API state
 * - Supports extension loading in background tabs
 */
function isElementVisible(element: Element | null): boolean {
    if (!element || !(element instanceof HTMLElement)) return false;

    // Only check CSS properties, not affected by page visibility state
    const style = window.getComputedStyle(element);
    return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) !== 0 &&
        element.offsetParent !== null
    );
}

function renderLoadComments(selector: string, preferredInsertionMode?: 'appendChild' | 'insertAfter'): void {
    if (typeof selector !== 'string') return;

    if (DEBUG) {
        console.log('YCS: renderLoadComments', selector, preferredInsertionMode);
    }

    const renderViewMode = (): string => {
        try {
            if (getPiP().supported) {
                return '<button id="ycs_view_mode" class="ycs-btn-search ycs-title ycs_noselect" name="View Mode" type="button" title="⌨ HOTKEY: [ Alt + ~ ] Viewer mode for more easier searches and video watching">V. Mode</button>';
            } else {
                return '';
            }
        } catch (err) {
            console.error(err);
            return '';
        }
    };

    const node = document.querySelector(selector);

    // Visibility check and fallback mechanism
    let targetElement: HTMLElement | null = node as HTMLElement | null;
    let insertionMode: 'appendChild' | 'insertAfter' = preferredInsertionMode || 'appendChild';

    // Only check visibility and fallback when using appendChild mode
    // insertAfter mode skips visibility check (element may be temporarily hidden during SPA navigation)
    if (insertionMode === 'appendChild' && targetElement && !isElementVisible(targetElement)) {
        if (DEBUG) {
            console.log('YCS: Original insertion point is hidden, trying fallback');
        }

        const fallbackElement = document.querySelector('ytd-watch-metadata');

        if (DEBUG) {
            console.log('YCS: fallbackElement', fallbackElement);
            console.log('YCS: isElementVisible(fallbackElement)', isElementVisible(fallbackElement));
        }

        // Fallback element: only check existence, not visibility
        // Reason: During SPA navigation, element may be temporarily hidden but will become visible soon
        if (fallbackElement) {
            targetElement = fallbackElement as HTMLElement;
            insertionMode = 'insertAfter';
            if (DEBUG) {
                console.log(
                    'YCS: Using fallback insertion point (ytd-watch-metadata)',
                    isElementVisible(fallbackElement) ? '(visible)' : '(not visible yet, will be visible soon)'
                );
            }
        } else {
            console.warn('YCS: Fallback element not found');
            return;
        }
    }

    if (!targetElement) {
        console.warn('YCS: No valid insertion point found');
        return;
    }

    const nodeTag = document.createElement('div');
    nodeTag.className = 'ycs-app';
    nodeTag.innerHTML = `
        <div class="ycs-app-toggle"><p class="ycs-title ycs-left">YouTube Comment Search <span id="ycs-count-load-collapsed"></span></p><div class="ycs-right"><button class="ycs-btn-toggle-app ycs-btn-search ycs_noselect" type="button">Show YCS</button></div></div>
        <div class="ycs-app-main">
            <div class="ycs-head-search">
                <p class="ycs-title ycs-left" id="ycs_title_information">
                    YouTube Comment Search <span id="ycs-count-load"></span>
                </p>
                <div class="ycs_load_all ycs-right">
                    <button class="ycs-btn-toggle-app ycs-btn-search ycs_noselect" type="button">hide YCS</button>
                    <button id="ycs-load-all" class="ycs-btn-search ycs-title ycs_noselect" name="Load all comments" type="button"
                        title="Load all available comments">
                        Load all
                    </button>
                    <button id="ycs_load_stop" class="ycs_btn_load-stop ycs-title ycs_noselect" name="Stop load all comments" type="button"
                        title="Stop load all available comments">
                        stop
                    </button>
                </div>
            </div>
            <div class="ycs-title ycs-clear ycs-infobar">
                <div id="ycs-desc__search">

                    <div>
                        <p class="ycs-infobar-field"><span id="ycs_status_cmnt">${iconReload()}</span> Comments: </p>
                        <div class="ycs-infobar__search">
                            <span id="ycs_cmnts">0</span>

                            <div class="ycs_infobar_btns ycs_noselect">
                                <div class="ycs_load_wrap">
                                    <button id="ycs-load-cmnts" class="ycs-btn-search ycs-title" name="Load comments" type="button"
                                        title="Load comments">
                                        load
                                    </button>
                                </div>
                                <div class="ycs_open_wrap">
                                    <button id="ycs_open_all_comments_window" class="ycs-btn-search ycs-title"
                                        name="Open comments in the new popup window" title="Open comments in the new popup window">
                                        open
                                    </button>
                                </div>
                                <div class="ycs_save_wrap ycs_dropdown_wrap">
                                    <button id="ycs_save_all_comments" class="ycs-btn-search ycs-title ycs_dropdown_trigger" name="Save comments to file"
                                        title="Save comments to file">
                                        save ▾
                                    </button>
                                    <div id="ycs_save_all_comments_menu" class="ycs_dropdown_menu" aria-hidden="true">
                                        <div class="ycs_dropdown_item" data-format="${EXPORT_FORMAT.TXT}">.TXT</div>
                                        <div class="ycs_dropdown_item" data-format="${EXPORT_FORMAT.JSON}">.JSON</div>
                                        <div class="ycs_dropdown_item" data-format="${EXPORT_FORMAT.XLSX}">.XLSX</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <span id="ycs_anchor_vmode" class="ycs-hidden"></span>
                    <div>
                        <p class="ycs-infobar-field"><span id="ycs_status_chat">${iconReload()}</span> Chat replay: </p>
                        <div class="ycs-infobar__search">
                            <span id="ycs_cmnts_chat">0</span>

                            <div class="ycs_infobar_btns ycs_noselect">
                                <div class="ycs_load_wrap">
                                    <button id="ycs-load-chat" class="ycs-btn-search ycs-title" name="Load chat replay" type="button"
                                        title="Load chat replay">
                                        load
                                    </button>
                                </div>
                                <div class="ycs_open_wrap">
                                    <button id="ycs_open_all_comments_chat_window" class="ycs-btn-search ycs-title"
                                        name="Open chat comments in the new popup window"
                                        title="Open chat comments in the new popup window">
                                        open
                                    </button>
                                </div>
                                <div class="ycs_save_wrap ycs_dropdown_wrap">
                                    <button id="ycs_save_all_comments_chat" class="ycs-btn-search ycs-title ycs_dropdown_trigger"
                                        name="Save chat comments to file" title="Save chat comments to file">
                                        save ▾
                                    </button>
                                    <div id="ycs_save_all_comments_chat_menu" class="ycs_dropdown_menu" aria-hidden="true">
                                        <div class="ycs_dropdown_item" data-format="${EXPORT_FORMAT.TXT}">.TXT</div>
                                        <div class="ycs_dropdown_item" data-format="${EXPORT_FORMAT.JSON}">.JSON</div>
                                        <div class="ycs_dropdown_item" data-format="${EXPORT_FORMAT.XLSX}">.XLSX</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <p class="ycs-infobar-field"><span id="ycs_status_trvideo">${iconReload()}</span> Transcript video: </p>
                        <div class="ycs-infobar__search">
                            <span id="ycs_cmnts_video">0</span>

                            <div class="ycs_infobar_btns ycs_noselect">
                                <div class="ycs_load_wrap">
                                    <button id="ycs-load-transcript-video" class="ycs-btn-search ycs-title" name="Load transcript video"
                                        type="button" title="Load transcript video">
                                        load
                                    </button>
                                </div>
                                <div class="ycs_open_wrap">
                                    <button id="ycs_open_all_comments_trvideo_window" class="ycs-btn-search ycs-title"
                                        name="Open transcript video in the new popup window"
                                        title="Open transcript video in the new popup window">
                                        open
                                    </button>
                                </div>
                                <div class="ycs_save_wrap ycs_dropdown_wrap">
                                    <button id="ycs_save_all_comments_trvideo" class="ycs-btn-search ycs-title ycs_dropdown_trigger"
                                        name="Save transcript video to file" title="Save transcript video to file">
                                        save ▾
                                    </button>
                                    <div id="ycs_save_all_comments_trvideo_menu" class="ycs_dropdown_menu" aria-hidden="true">
                                        <div class="ycs_dropdown_item" data-format="${EXPORT_FORMAT.TXT}">.TXT</div>
                                        <div class="ycs_dropdown_item" data-format="${EXPORT_FORMAT.JSON}">.JSON</div>
                                        <div class="ycs_dropdown_item" data-format="${EXPORT_FORMAT.XLSX}">.XLSX</div>
                                    </div>
                                </div>
                                <div class="ycs_language_wrap ycs_dropdown_wrap">
                                    <button id="ycs_transcript_language" class="ycs-btn-search ycs-title" type="button">
                                        language ▾
                                    </button>
                                    <div id="ycs_transcript_language_menu" class="ycs_dropdown_menu" aria-hidden="true"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <div id="ycs-search"></div>
            <div><p class="ycs-title ycs_notify_box"><i></i></p></div>

            <div class="ycs_extra_panel ycs-right">
                <div>
                    ${renderViewMode()}
                </div>
            </div>

            <div id="ycs-search-result" class="ycs-clear"></div>

            <div id="ycs_modal_window" class="ycs_modal">
                <div class="ycs_modal-content">
                    <button id="ycs_btn_close_modal" class="ycs_btn_close ycs_noselect">✖</button>
                    <div class="ycs_modal_body">
                        <h2>Instructions</h2>
                        <ol>
                            <li>Open video on YouTube</li>
                            <li>Find the YCS extension under the current video and click the button "Load all" or choose to load the categories
                            </li>
                            <li>Write the search query, press Enter or click the button Search</li>
                        </ol>
                        <hr />
                        <h2>FAQ</h2>
                        <ol>
                            <li>
                                <p><strong>How to like, reply to a comment?</strong><br />In the search results, click on the date (like, "2
                                    months ago") of the comment and will open a new window with an active comment or reply under the video,
                                    where you can do any action.</p>
                            </li>
                            <li>
                                <p><strong>How do I find all timestamped comments and replies on a video?</strong><br />Click on the "Timestamps" button under the search bar.</p>
                            </li>
                            <li>
                                <p><strong>How can I find addressed to user's comments, replies?</strong><br />Write&nbsp;<code>@</code>&nbsp;in
                                    the input field.</p>
                            </li>
                            <li>
                                <p><strong>How can I view the contents of the video transcript at a specific minute?</strong><br />You can write
                                    a search query for Trp. Video, in the&nbsp;<code>mm:ss</code>&nbsp;format. For
                                    example:<br /><code>:</code>&nbsp;- all the text of the video transcript.<br /><code>15:</code>&nbsp;- all
                                    the text in the 15th minute.</p>
                            </li>
                            <li>
                                <p><strong>How can I view the comment for a found reply?</strong><br />Click on
                                    the&nbsp;<strong>▼</strong>&nbsp;button.</p>
                            </li>
                            <li>
                                <p><strong>How can I see the all replies to the found comment?</strong><br />In the header of the found comment,
                                    you can find the reply icon and the count, to see the replies click on
                                    the&nbsp;<strong>+</strong>&nbsp;button.</p>
                            </li>
                            <li>
                                <p><strong>How to use search in YouTube shorts?</strong><br />
                                    Open a YouTube video short. Click badge <strong>YCS</strong> (right of the address bar) and click on the button <strong>Open YT short</strong>.</p>
                            </li>
                        </ol>

                        <div>
                            <p>You can use the search engine (YCS), while loading comments, chat, transcript video.</p>
                            &nbsp;&nbsp;
                        </div>

                    </div>
                </div>
            </div>

        </div>
    `;

    // Execute based on insertion mode
    if (insertionMode === 'appendChild') {
        targetElement.appendChild(nodeTag);
    } else if (insertionMode === 'insertAfter') {
        // insertAfter implementation: check parentNode to avoid TypeError
        if (targetElement.parentNode) {
            targetElement.parentNode.insertBefore(nodeTag, targetElement.nextSibling);
        } else {
            console.error('YCS: Cannot insertAfter - parent node not found');
            return;
        }
    }
}

// Generate HTML for a single button
function generateFilterButtonHTML(buttonId: string): string {
    const buttonConfigs: Record<
        string,
        { name: string; title: string; dataSort?: string; dataSortChat?: string; dataSortTrp?: string; icon?: string }
    > = {
        ycs_btn_timestamps: {
            name: 'timestamps',
            title: 'Show comments, replies, chat with time stamps (Newest)',
            dataSort: 'newest',
            dataSortChat: 'newest'
        },
        ycs_btn_timestamp_viz: {
            name: 'timestampViz',
            title: 'Show timestamp distribution chart',
            icon: '<span>📊</span>'
        },
        ycs_btn_author: {
            name: 'author',
            title: 'Show comments, replies, chat from the author (Newest)',
            dataSort: 'newest',
            dataSortChat: 'newest'
        },
        ycs_btn_heart: {
            name: 'heart',
            title: 'Show comments and replies that the author likes (Newest)',
            dataSort: 'newest',
            icon: '<span class="ycs-creator-heart_icon">❤</span>'
        },
        ycs_btn_verified: {
            name: 'verified',
            title: 'Show comments, replies and chat from a verified authors (Newest)',
            dataSort: 'newest',
            dataSortChat: 'newest',
            icon: '<span class="ycs-creator-verified_icon">✔</span>'
        },
        ycs_btn_links: {
            name: 'links',
            title: 'Shows links in comments, replies, chat, video transcript (Newest)',
            dataSort: 'newest',
            dataSortChat: 'newest',
            dataSortTrp: 'newest'
        },
        ycs_btn_likes: {
            name: 'likes',
            title: 'Show comments, replies by number of likes (sort largest to smallest)'
        },
        ycs_btn_replied_comments: {
            name: 'replied',
            title: 'Show comments by number of replies (sort largest to smallest)'
        },
        ycs_btn_members: {
            name: 'members',
            title: 'Show comments, replies, chat from channel members (Newest)',
            dataSort: 'newest',
            dataSortChat: 'newest'
        },
        ycs_btn_donated: {
            name: 'donated',
            title: 'Show chat comments from users who have donated (Newest)',
            dataSort: 'newest',
            dataSortChat: 'newest'
        },
        ycs_btn_sort_first: {
            name: 'sortFirst',
            title: 'Show all comments, chat, video transcript sorted by date (Newest)',
            dataSort: 'newest',
            dataSortChat: 'newest',
            dataSortTrp: 'newest'
        },
        ycs_btn_random: {
            name: 'random',
            title: 'Show a random comment'
        },
        ycs_btn_quick_chat: {
            name: 'quickChat',
            title: 'Show chat replay (Newest)',
            dataSort: 'newest',
            dataSortChat: 'newest'
        },
        ycs_btn_quick_transcript: {
            name: 'quickTranscript',
            title: 'Show transcript (Newest)',
            dataSort: 'newest',
            dataSortTrp: 'newest'
        }
    };

    const config = buttonConfigs[buttonId];
    if (!config) return '';

    const dataSortAttr = config.dataSort ? `data-sort="${config.dataSort}"` : '';
    const dataSortChatAttr = config.dataSortChat ? `data-sort-chat="${config.dataSortChat}"` : '';
    const dataSortTrpAttr = config.dataSortTrp ? `data-sort-trp="${config.dataSortTrp}"` : '';
    const sortIcon = config.dataSort ? iconSortDown() : '';
    const icon = config.icon || '';

    return `
        <button id="${buttonId}"
            ${dataSortAttr}
            ${dataSortChatAttr}
            ${dataSortTrpAttr}
            class="ycs-btn-search ycs-title"
            name="${config.name}" type="button"
            title="${config.title}">
            ${icon}
            ${
                config.name === 'timestamps'
                    ? 'Time stamps'
                    : config.name === 'timestampViz'
                      ? 'Chart'
                      : config.name === 'author'
                        ? 'Author'
                        : config.name === 'heart'
                          ? ''
                          : config.name === 'verified'
                            ? ''
                            : config.name === 'links'
                              ? 'Links'
                              : config.name === 'likes'
                                ? 'Likes'
                                : config.name === 'replied'
                                  ? 'Replied'
                                  : config.name === 'members'
                                    ? 'Members'
                                    : config.name === 'donated'
                                      ? 'Donated'
                                      : config.name === 'sortFirst'
                                        ? 'All'
                                        : config.name === 'random'
                                          ? 'Random'
                                          : config.name === 'quickChat'
                                            ? 'Chat'
                                            : config.name === 'quickTranscript'
                                              ? 'Transcript'
                                              : config.name
            }
            ${sortIcon}
        </button>`;
}

function renderSearch(node: HTMLElement): void {
    if (!node) return;

    node.innerHTML = `
        <div>
            <div>
                <div class="ycs-searchbox">
                    <input title="Write the search query, press Enter or click the button Search."
                        class="ycs-search__input ycs_noselect" type="text" id="ycs-input-search" placeholder="Search">
                </div>
                <select title="Select a search category." name="ycs_search_select"
                    id="ycs_search_select" class="ycs-btn-search ycs-title ycs-search-select ycs_noselect">
                    <option value="comments">Comments</option>
                    <option value="chat">Chat replay</option>
                    <option value="video">Trpt. video</option>
                    <option selected value="all">All</option>
                </select>
                <button id="ycs_btn_search" class="ycs-btn-search ycs-title ycs_noselect" type="button">
                    Search
                </button><button id="ycs_btn_search_clear_text" class="ycs-btn-search ycs-title ycs-search-clear" type="button" title="Clear text" style="margin-left:1px;">✕</button>

                <div class="ycs-ext-search_block">
                    <p id="ycs-search-total-result" class="ycs-title"></p>
                    <div class="ycs-ext-search_option">
                        <label for="ycs_extended_search" class="ycs_noselect ycs-title" title="Enables the use of unix-like search commands">
                            <input type="checkbox" name="ycs_extended_search" id="ycs_extended_search">
                            <span class="ycs-ext-search_title">Extended search</span>
                        </label>
                        <div class="ycs-ext-search-opts">
                            <fieldset>

                                <label for="ycs_extended_search_title" class="ycs_noselect ycs-title" title="Extended search by title">
                                    <input type="radio" id="ycs_extended_search_title" name="ycs_ext_search_opts" value="title" disabled>
                                    <span class="ycs-ext-search_title">Title</span>
                                </label>

                                <label for="ycs_extended_search_main" class="ycs_noselect ycs-title" title="Extended search by main text">
                                    <input type="radio" id="ycs_extended_search_main" name="ycs_ext_search_opts" value="main" disabled checked>
                                    <span class="ycs-ext-search_title">Main</span>
                                </label>

                            </fieldset>
                        </div>
                        <a href="https://github.com/sonigy/YCS#extended-search" class="ycs-title ycs-ext-search_link" target="_blank" rel="noopener noreferrer" title="How to use">?</a>
                    </div>
                </div>

                <button id="ycs_btn_open_modal" class="ycs_noselect" title="FAQ">?</button>
            </div>
            <div class="ycs-search-result-infobar">

                <div class="ycs-btn-panel ycs_noselect" id="ycs-btn-panel">
                    <!-- Buttons will be dynamically generated by JavaScript -->
                </div>
            </div>
        </div>
    `;
}

// Dynamically load filter buttons
function loadFilterButtons(filterButtons?: Array<{ id: string; enabled: boolean }>): void {
    try {
        const buttonsToUse = filterButtons || options.filterButtons;
        const enabledButtons = buttonsToUse.filter((button: { id: string; enabled: boolean }) => button.enabled);

        const panel = document.getElementById('ycs-btn-panel');
        if (!panel) return;

        // Clear existing buttons
        panel.innerHTML = '';

        // Generate and insert buttons
        enabledButtons.forEach((button: { id: string; enabled: boolean }) => {
            const buttonHTML = generateFilterButtonHTML(button.id);
            panel.insertAdjacentHTML('beforeend', buttonHTML);
        });

        // Add Clear button (always visible)
        panel.insertAdjacentHTML(
            'beforeend',
            `
            <button id="ycs_btn_clear"
                class="ycs-btn-search ycs-title ycs-search-clear"
                style="visibility:hidden;"
                name="clear" type="button"
                title="Clear search">
                X
            </button>
        `
        );
    } catch (err) {
        console.error('Error loading filter buttons:', err);
        // If loading fails, use default settings
        const panel = document.getElementById('ycs-btn-panel');
        if (panel) {
            panel.innerHTML =
                options.filterButtons
                    .filter((button) => button.enabled)
                    .map((button) => generateFilterButtonHTML(button.id))
                    .join('') +
                `
                <button id="ycs_btn_clear"
                    class="ycs-btn-search ycs-title ycs-search-clear"
                    style="visibility:hidden;"
                    name="clear" type="button"
                    title="Clear search">
                    X
                </button>
            `;
        }
    }
}

export { renderComment, renderLoadComments, renderSearch, renderCommentTrVideo, renderCommentChat, loadFilterButtons };
