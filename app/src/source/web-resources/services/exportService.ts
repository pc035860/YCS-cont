import { getCleanUrlVideo } from '../../utils/common';
import { downloadFile, openComments, openCommentsChat, openCommentsTrVideo } from '../../utils/dom';
import { getCommentsChatHtmlText, getCommentsHtmlText, getCommentsTrVideoHtmlText } from '../../utils/formatting';

interface ExportMeta {
    url?: string;
    title?: string;
    generatedAt?: Date | string;
}

interface ResolvedExportMeta {
    url: string;
    title: string;
    generatedAt: string;
}

function resolveMeta(meta?: ExportMeta): ResolvedExportMeta {
    const fallbackTitle = typeof document !== 'undefined' ? document.title : '';
    const fallbackUrl =
        typeof window !== 'undefined' ? (getCleanUrlVideo(window.location.href) ?? window.location.href) : '';

    let generatedAt = new Date();
    if (meta?.generatedAt instanceof Date) {
        generatedAt = meta.generatedAt;
    } else if (typeof meta?.generatedAt === 'string') {
        const parsed = new Date(meta.generatedAt);
        if (!Number.isNaN(parsed.getTime())) {
            generatedAt = parsed;
        }
    }

    return {
        title: meta?.title ?? fallbackTitle,
        url: meta?.url ?? fallbackUrl,
        generatedAt: generatedAt.toString()
    };
}

function buildDocument(sectionTitle: string, meta: ResolvedExportMeta, count: number, body: string): string {
    return `YCS - YouTube Comment Search\n\n${sectionTitle}\nFile created by ${meta.generatedAt}\nVideo URL: ${meta.url}\nTitle: ${meta.title}\nTotal: ${count}\\n${body}`;
}

export function openCommentsWindow(comments: any[], meta?: ExportMeta): void {
    const formatted = getCommentsHtmlText(comments);
    if (!formatted) return;

    const resolved = resolveMeta(meta);

    openComments({ ...formatted, meta: resolved });
}

export function downloadCommentsFile(comments: any[], meta?: ExportMeta): void {
    const formatted = getCommentsHtmlText(comments);
    if (!formatted) return;

    const resolved = resolveMeta(meta);
    const documentBody = buildDocument('Comments', resolved, formatted.count, formatted.html);

    downloadFile(documentBody, `Comments, ${resolved.title} (${formatted.count}).txt`, 'text/plain');
}

export function openChatWindow(chatMessages: any[], meta?: ExportMeta): void {
    const formatted = getCommentsChatHtmlText(chatMessages);
    if (!formatted) return;

    const resolved = resolveMeta(meta);

    openCommentsChat({ ...formatted, meta: resolved });
}

export function downloadChatFile(chatMessages: any[], meta?: ExportMeta): void {
    const formatted = getCommentsChatHtmlText(chatMessages);
    if (!formatted) return;

    const resolved = resolveMeta(meta);
    const documentBody = buildDocument('Comments chat', resolved, formatted.count, formatted.html);

    downloadFile(documentBody, `Comments chat, ${resolved.title} (${formatted.count}).txt`, 'text/plain');
}

export function openTranscriptWindow(cueGroups: any[], meta?: ExportMeta): void {
    const formatted = getCommentsTrVideoHtmlText(cueGroups);
    if (!formatted) return;

    const resolved = resolveMeta(meta);

    openCommentsTrVideo({ ...formatted, meta: resolved });
}

export function downloadTranscriptFile(cueGroups: any[], meta?: ExportMeta): void {
    const formatted = getCommentsTrVideoHtmlText(cueGroups);
    if (!formatted) return;

    const resolved = resolveMeta(meta);
    const documentBody = buildDocument('Transcript video', resolved, formatted.count, formatted.html);

    downloadFile(documentBody, `Transcript video, ${resolved.title} (${formatted.count}).txt`, 'text/plain');
}

export type { ExportMeta };
