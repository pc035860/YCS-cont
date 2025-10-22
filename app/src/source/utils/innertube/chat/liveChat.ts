import { wrapTryCatch } from '../../common';
import {
    ChatProcessingContext,
    ensureTextMessageRenderer,
    formatChatRuns,
    markTimelineLinks,
    prepareChatCommentFields
} from './utils';

/**
 * 處理直播聊天室回傳的 actions，將訊息整理進共用 Map。
 * 手動測試：於直播影片載入擴充功能後觸發留言抓取，確認新訊息與時間軸連結仍可正確跳轉。
 */
export function processLiveChatActions(actions: any[], context: ChatProcessingContext): void {
    if (!Array.isArray(actions) || actions.length === 0) return;

    for (const action of actions) {
        try {
            const comment = {
                replayChatItemAction: {
                    actions: [action]
                }
            };

            ensureTextMessageRenderer(comment);

            const timestampUsec = wrapTryCatch(
                () =>
                    comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer
                        .timestampUsec
            ) as string | undefined;

            const timestamp = Number.parseInt(String(timestampUsec ?? ''), 10);
            if (!timestamp || Number.isNaN(timestamp) || context.chatMap.has(timestamp)) {
                continue;
            }

            const renderer = wrapTryCatch(
                () => comment.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer
            );
            if (!renderer) continue;

            renderer.message = renderer.message || {};
            const runs = (wrapTryCatch(() => renderer.message.runs) as any[]) || [];
            const formatted = formatChatRuns(runs, { currentVideoId: context.currentVideoId });

            if (formatted.fullText) {
                renderer.message.fullText = formatted.fullText;
                renderer.message.renderFullText = formatted.richText;
            }

            markTimelineLinks(comment, formatted.hasTimelineLink);

            const hasAuthor = wrapTryCatch(() => renderer.authorName);
            if (!hasAuthor) continue;

            const prepared = prepareChatCommentFields(comment);
            context.chatMap.set(timestamp, prepared);

            if (context.onCommentAdded) {
                context.onCommentAdded(context.chatMap.size);
            }
        } catch (error) {
            console.error(error);
        }
    }
}
