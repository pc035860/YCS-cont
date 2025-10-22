import { wrapTryCatch } from '../../common';
import {
    ChatProcessingContext,
    ensureTextMessageRenderer,
    formatChatRuns,
    markTimelineLinks,
    prepareChatCommentFields
} from './utils';

/**
 * 處理回放批次資料，確保訊息欄位一致並寫入暫存 Map。
 * 手動測試：播放聊天室回放影片並執行抓取，驗證留言數量與時間軸標記與舊版結果相同。
 */
export function processReplayBatch(actions: any[], context: ChatProcessingContext): void {
    if (!Array.isArray(actions) || actions.length === 0) return;

    for (const comment of actions) {
        try {
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
