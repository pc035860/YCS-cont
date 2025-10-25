import { downloadFile, openComments, openCommentsChat, openCommentsTrVideo } from '../../utils/dom';
import {
    getCommentsChatHtmlText,
    getCommentsHtmlText,
    getCommentsTrVideoHtmlText,
    resolveMeta
} from '../../utils/formatting';
import type { ChatItem, CommentItem, TranscriptCueGroup } from '../../utils/interfaces/i_types';
import type { ExportMeta, ResolvedExportMeta } from '../../utils/formatting';

export const EXPORT_FORMAT = {
    TXT: 'txt',
    JSON: 'json',
    XLSX: 'xlsx'
} as const;

export type ExportFormat = (typeof EXPORT_FORMAT)[keyof typeof EXPORT_FORMAT];

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

// New format-specific download helpers (JSON / XLSX)
import {
    exportCommentsAsJSON,
    exportCommentsAsXLSX,
    exportChatAsJSON,
    exportChatAsXLSX,
    exportTranscriptAsJSON,
    exportTranscriptAsXLSX
} from './exportFormats';

export function downloadCommentsFileJSON(comments: CommentItem[], meta?: ExportMeta): void {
    try {
        const body = { titleVideo: meta?.title || '', url: meta?.url || '', comments: comments } as any;
        const payload = exportCommentsAsJSON(body);
        if (!payload) return;

        downloadFile(payload.content, payload.fileName, payload.mime);
    } catch (e) {
        console.error(e);
    }
}

export function downloadCommentsFileXLSX(comments: CommentItem[], meta?: ExportMeta): void {
    try {
        const body = { titleVideo: meta?.title || '', url: meta?.url || '', comments: comments } as any;
        const payload = exportCommentsAsXLSX(body);
        if (!payload || !payload.writeFunc) return;

        payload.writeFunc();
    } catch (e) {
        console.error(e);
    }
}

export function downloadChatFileJSON(chatMessages: ChatItem[], meta?: ExportMeta): void {
    try {
        const body = { titleVideo: meta?.title || '', url: meta?.url || '' } as any;
        const payload = exportChatAsJSON(chatMessages, body);
        if (!payload) return;

        downloadFile(payload.content, payload.fileName, payload.mime);
    } catch (e) {
        console.error(e);
    }
}

export function downloadChatFileXLSX(chatMessages: ChatItem[], meta?: ExportMeta): void {
    try {
        const body = { titleVideo: meta?.title || '', url: meta?.url || '' } as any;
        const payload = exportChatAsXLSX(chatMessages, body);
        if (!payload || !payload.writeFunc) return;

        payload.writeFunc();
    } catch (e) {
        console.error(e);
    }
}

export function downloadTranscriptFileJSON(cueGroups: TranscriptCueGroup[], meta?: ExportMeta): void {
    try {
        const body = { titleVideo: meta?.title || '', url: meta?.url || '' } as any;
        const payload = exportTranscriptAsJSON(cueGroups, body);
        if (!payload) return;

        downloadFile(payload.content, payload.fileName, payload.mime);
    } catch (e) {
        console.error(e);
    }
}

export function downloadTranscriptFileXLSX(cueGroups: TranscriptCueGroup[], meta?: ExportMeta): void {
    try {
        const body = { titleVideo: meta?.title || '', url: meta?.url || '' } as any;
        const payload = exportTranscriptAsXLSX(cueGroups, body);
        if (!payload || !payload.writeFunc) return;

        payload.writeFunc();
    } catch (e) {
        console.error(e);
    }
}

export type { ExportMeta };
