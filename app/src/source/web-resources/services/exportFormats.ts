import type { ChatItem, TranscriptCueGroup, CommentItem } from '../../utils/interfaces/i_types';
import {
    buildChatExportPayload,
    buildCommentsExportPayload,
    buildTranscriptExportPayload
} from '../../utils/export-core';
import {
    getSheetDetails,
    getSheetComments,
    getSheetReplies,
    getSheetChatDetails,
    getSheetChatComments,
    getSheetTrVideoDetails,
    getSheetTrVideo
} from '../../utils/sheets';

// Lazy-load xlsx only when user chooses .xlsx export
let xlsxModulePromise: Promise<any> | null = null;
function loadXLSX(): Promise<any> {
    if (!xlsxModulePromise) xlsxModulePromise = import('xlsx');
    return xlsxModulePromise;
}
type SheetBuilder<TPayload> = (XLSX: any, workbook: any, payload: TPayload, createdLabel: string) => void;

function createJsonResponse(fileName: string, payload: unknown): { content: string; fileName: string; mime: string } {
    return {
        content: JSON.stringify(payload),
        fileName,
        mime: 'application/json'
    };
}

function createXlsxWriter<TPayload>(
    payload: TPayload,
    fileName: string,
    builders: Array<SheetBuilder<TPayload>>
): { writeFunc: () => void } {
    return {
        writeFunc: () => {
            loadXLSX()
                .then((XLSX) => {
                    const workbook = XLSX.utils.book_new();
                    const created = `Report was created by ${new Date().toUTCString()}`;

                    for (const build of builders) {
                        try {
                            build(XLSX, workbook, payload, created);
                        } catch (err) {
                            console.error(err);
                        }
                    }

                    XLSX.writeFile(workbook, fileName);
                })
                .catch((e) => console.error(e));
        }
    };
}

// Wrapper functions to convert data into downloadable payloads
export function exportCommentsAsJSON(input: {
    titleVideo?: string;
    url?: string;
    videoId?: string;
    comments?: CommentItem[];
    cachedDate?: number;
}): { content: string; fileName: string; mime: string } | void {
    try {
        const payload = buildCommentsExportPayload(input);
        return createJsonResponse(`Comments, ${payload.titleVideo} (${payload.total}).json`, payload);
    } catch (e) {
        console.error(e);
        return;
    }
}

export function exportCommentsAsXLSX(input: {
    titleVideo?: string;
    url?: string;
    videoId?: string;
    comments?: CommentItem[];
    cachedDate?: number;
}): { writeFunc: () => void } | void {
    try {
        const payload = buildCommentsExportPayload(input);
        return createXlsxWriter(payload, `Comments, ${payload.titleVideo} (${payload.total}).xlsx`, [
            (XLSX, workbook, data, created) => {
                const details = getSheetDetails(data);
                if (!details) return;
                const sheet = XLSX.utils.json_to_sheet([details as any]);
                XLSX.utils.sheet_add_aoa(sheet, [[created]], { origin: 'A5' });
                XLSX.utils.book_append_sheet(workbook, sheet, 'Details');
            },
            (XLSX, workbook, data) => {
                const commentsSheet = XLSX.utils.json_to_sheet(getSheetComments(data.comments) as any);
                XLSX.utils.book_append_sheet(workbook, commentsSheet, 'Comments');
            },
            (XLSX, workbook, data) => {
                const repliesSheet = XLSX.utils.json_to_sheet(getSheetReplies(data.comments) as any);
                XLSX.utils.book_append_sheet(workbook, repliesSheet, 'Replies');
            }
        ]);
    } catch (e) {
        console.error(e);
        return;
    }
}

// Chat and Transcript exporters: simple JSON wrappers (XLSX can be added similarly)
export function exportChatAsJSON(
    chatMessages: ChatItem[],
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number }
): { content: string; fileName: string; mime: string } | void {
    try {
        const payload = buildChatExportPayload(chatMessages, meta);
        return createJsonResponse(`Comments chat, ${payload.titleVideo} (${payload.total}).json`, payload);
    } catch (e) {
        console.error(e);
        return;
    }
}

export function exportChatAsXLSX(
    chatMessages: ChatItem[],
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number }
): { writeFunc: () => void } | void {
    try {
        const payload = buildChatExportPayload(chatMessages, meta);
        return createXlsxWriter(payload, `Comments chat, ${payload.titleVideo} (${payload.total}).xlsx`, [
            (XLSX, workbook, data, created) => {
                const details = getSheetChatDetails(data);
                if (!details) return;
                const sheet = XLSX.utils.json_to_sheet([details as any]);
                XLSX.utils.sheet_add_aoa(sheet, [[created]], { origin: 'A5' });
                XLSX.utils.book_append_sheet(workbook, sheet, 'Details');
            },
            (XLSX, workbook, data) => {
                const commentsSheet = XLSX.utils.json_to_sheet(getSheetChatComments(data) as any);
                XLSX.utils.book_append_sheet(workbook, commentsSheet, 'Chat comments');
            }
        ]);
    } catch (e) {
        console.error(e);
        return;
    }
}

export function exportTranscriptAsJSON(
    cueGroups: TranscriptCueGroup[],
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number; titleTrVideo?: string }
): { content: string; fileName: string; mime: string } | void {
    try {
        const payload = buildTranscriptExportPayload(cueGroups, meta);
        return createJsonResponse(`Transcript video, ${payload.titleVideo} (${payload.total}).json`, payload);
    } catch (e) {
        console.error(e);
        return;
    }
}

export function exportTranscriptAsXLSX(
    cueGroups: TranscriptCueGroup[],
    meta: { titleVideo?: string; url?: string; videoId?: string; cachedDate?: number; titleTrVideo?: string }
): { writeFunc: () => void } | void {
    try {
        const payload = buildTranscriptExportPayload(cueGroups, meta);
        return createXlsxWriter(payload, `Transcript video, ${payload.titleVideo} (${payload.total}).xlsx`, [
            (XLSX, workbook, data, created) => {
                const details = getSheetTrVideoDetails(data);
                if (!details) return;
                const sheet = XLSX.utils.json_to_sheet([details as any]);
                XLSX.utils.sheet_add_aoa(sheet, [[created]], { origin: 'A5' });
                XLSX.utils.book_append_sheet(workbook, sheet, 'Details');
            },
            (XLSX, workbook, data) => {
                const transcriptSheet = XLSX.utils.json_to_sheet(getSheetTrVideo(data) as any);
                XLSX.utils.book_append_sheet(workbook, transcriptSheet, 'Transcript video');
            }
        ]);
    } catch (e) {
        console.error(e);
        return;
    }
}

export default {};
