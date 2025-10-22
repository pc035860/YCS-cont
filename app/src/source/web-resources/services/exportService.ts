import { downloadFile, openComments, openCommentsChat, openCommentsTrVideo } from '../../utils/dom';
import {
    getCommentsChatHtmlText,
    getCommentsHtmlText,
    getCommentsTrVideoHtmlText,
    resolveMeta
} from '../../utils/formatting';
import type { ChatItem, CommentItem, TranscriptCueGroup } from '../../utils/interfaces/i_types';
import type { ExportMeta, ResolvedExportMeta } from '../../utils/formatting';

function buildDocument(sectionTitle: string, meta: ResolvedExportMeta, count: number, body: string): string {
    return `\nYCS - YouTube Comment Search\n\n${sectionTitle}\nFile created by ${meta.generatedAt}\nVideo URL: ${meta.url}\nTitle: ${meta.title}\nTotal: ${count}\n${body}`;
}

export function openCommentsWindow(comments: CommentItem[], meta?: ExportMeta): void {
    const formatted = getCommentsHtmlText(comments);
    if (!formatted) return;

    const resolved = resolveMeta(meta);

    openComments({ ...formatted, meta: resolved });
}

export function downloadCommentsFile(comments: CommentItem[], meta?: ExportMeta): void {
    const formatted = getCommentsHtmlText(comments);
    if (!formatted) return;

    const resolved = resolveMeta(meta);
    const documentBody = buildDocument('Comments', resolved, formatted.count, formatted.html);

    downloadFile(documentBody, `Comments, ${resolved.title} (${formatted.count}).txt`, 'text/plain');
}

export function openChatWindow(chatMessages: ChatItem[], meta?: ExportMeta): void {
    const formatted = getCommentsChatHtmlText(chatMessages);
    if (!formatted) return;

    const resolved = resolveMeta(meta);

    openCommentsChat({ ...formatted, meta: resolved });
}

export function downloadChatFile(chatMessages: ChatItem[], meta?: ExportMeta): void {
    const formatted = getCommentsChatHtmlText(chatMessages);
    if (!formatted) return;

    const resolved = resolveMeta(meta);
    const documentBody = buildDocument('Comments chat', resolved, formatted.count, formatted.html);

    downloadFile(documentBody, `Comments chat, ${resolved.title} (${formatted.count}).txt`, 'text/plain');
}

export function openTranscriptWindow(cueGroups: TranscriptCueGroup[], meta?: ExportMeta): void {
    const formatted = getCommentsTrVideoHtmlText(cueGroups);
    if (!formatted) return;

    const resolved = resolveMeta(meta);

    openCommentsTrVideo({ ...formatted, meta: resolved });
}

export function downloadTranscriptFile(cueGroups: TranscriptCueGroup[], meta?: ExportMeta): void {
    const formatted = getCommentsTrVideoHtmlText(cueGroups);
    if (!formatted) return;

    const resolved = resolveMeta(meta);
    const documentBody = buildDocument('Transcript video', resolved, formatted.count, formatted.html);

    downloadFile(documentBody, `Transcript video, ${resolved.title} (${formatted.count}).txt`, 'text/plain');
}

export type { ExportMeta };
