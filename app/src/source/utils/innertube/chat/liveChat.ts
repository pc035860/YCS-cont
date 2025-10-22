import { wrapTryCatch } from '../../common';
import {
    ChatProcessingContext,
    ensureTextMessageRenderer,
    formatChatRuns,
    markTimelineLinks,
    prepareChatCommentFields
} from './utils';

/**
 * Process incoming live chat actions and normalize them into the shared map.
 * Manual testing: open a live stream, trigger chat fetching, and verify that
 * new messages still appear and timeline links keep jumping to the expected
 * timestamps.
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
