import { wrapTryCatch, getCleanUrlVideo } from './common';

interface ExportMeta {
    url?: string;
    title?: string;
    generatedAt?: Date | string;
    broadcastStartTime?: string;
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
        title: typeof meta?.title === 'string' && meta.title ? meta.title : fallbackTitle,
        url: typeof meta?.url === 'string' && meta.url ? meta.url : fallbackUrl,
        generatedAt: generatedAt.toString()
    };
}

function safeUrl(raw: unknown): string {
    try {
        let url = String(raw || '');
        if (!url) return '#';
        if (url.startsWith('/')) url = `https://www.youtube.com${url}`;
        if (url.startsWith('www.')) url = `https://${url}`;
        const lower = url.toLowerCase();
        if (lower.startsWith('http://') || lower.startsWith('https://')) return url;
        return '#';
    } catch {
        return '#';
    }
}

function parseFormattedNumber(value?: string): { number: number; multiply: number } {
    try {
        if (!value) return { number: 0, multiply: 1 };
        let s = String(value).trim();
        if (!s) return { number: 0, multiply: 1 };

        s = s.replace(/[\u00A0\u202F\s]+/g, '');

        const escapeRegExp = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const units: Array<[string, number]> = [
            ['tūkst.', 1_000],
            ['хиљ.', 1_000],
            ['хил.', 1_000],
            ['тыс.', 1_000],
            ['тис.', 1_000],
            ['χιλ.', 1_000],
            ['hilj.', 1_000],
            ['tis.', 1_000],
            ['ming', 1_000],
            ['mijë', 1_000],
            ['elfu', 1_000],
            ['พัน', 1_000],
            ['ພັນ', 1_000],
            ['ពាន់', 1_000],
            ['ထောင်', 1_000],
            ['мянга', 1_000],
            ['миң', 1_000],
            ['հզր', 1_000],
            ['ათ.', 1_000],
            ['mil', 1_000],
            ['rb', 1_000],
            ['þ.', 1_000],
            ['ሺ', 1_000],
            ['ද', 1_000],
            ['千', 1_000],
            ['천', 1_000],
            ['E', 1_000],
            ['N', 1_000],
            ['B', 1_000],
            ['k', 1_000],
            ['သောင်း', 10_000],
            ['万', 10_000],
            ['萬', 10_000],
            ['만', 10_000],
            ['億', 100_000_000],
            ['m', 1_000_000],
            ['b', 1_000_000_000]
        ];

        let multiplier = 1;

        for (const [unit, mul] of units) {
            // Only accept pure numeric + unit format (e.g., "1.2k") to avoid language word suffix collisions.
            const unitPattern = new RegExp(`^[0-9][0-9.,]*${escapeRegExp(unit)}$`, 'i');
            if (unitPattern.test(s)) {
                multiplier = mul;
                s = s.substring(0, s.length - unit.length).trim();
                break;
            }
        }

        const lastDot = s.lastIndexOf('.');
        const lastComma = s.lastIndexOf(',');
        if (lastDot >= 0 && lastComma >= 0) {
            if (lastDot > lastComma) {
                s = s.replace(/,/g, '');
            } else {
                s = s.replace(/\./g, '');
                s = s.replace(',', '.');
            }
        } else if (multiplier > 1) {
            s = s.replace(/,/g, '');
        } else {
            const onlyDigits = s.replace(/[^0-9]/g, '');
            const n = Number(onlyDigits);
            return { number: Number.isFinite(n) ? n : 0, multiply: 1 };
        }

        const n = Number.parseFloat(s) * multiplier;
        if (!Number.isFinite(n)) return { number: 0, multiply: 1 };
        return { number: Math.round(n), multiply: multiplier };
    } catch {
        return { number: 0, multiply: 1 };
    }
}

function parseFormattedNumberToInt(value?: string): number {
    const result = parseFormattedNumber(value);
    return result.number;
}

function msToRoundSec(msNumber: string | number): number | undefined {
    try {
        const value = typeof msNumber === 'string' ? parseFloat(msNumber) : msNumber;
        if (!Number.isNaN(value) && value > 0) {
            return parseInt((value / 1000) as any, 10);
        }

        return;
    } catch (e) {
        console.error(e);
        return;
    }
}

function msToShareVideo(msNumber: string | number): string | undefined {
    try {
        const u = new URL(window.location.href);
        const vParam = u.searchParams.get('v');

        const shareUrl = `https://youtu.be/${vParam}?t=${msToRoundSec(msNumber) || 0}`;

        return shareUrl;
    } catch (e) {
        console.error(e);
        return;
    }
}

function tmUsecToDateTime(microSec: string | number): string {
    const value = typeof microSec === 'string' ? parseFloat(microSec) : microSec;
    if (!Number.isNaN(value) && value > 0) {
        const dateTime = new Date((value as any) / 1000);

        // Format as local time: YYYY-MM-DD, HH:MM
        const year = dateTime.getFullYear();
        const month = String(dateTime.getMonth() + 1).padStart(2, '0');
        const day = String(dateTime.getDate()).padStart(2, '0');
        const hours = String(dateTime.getHours()).padStart(2, '0');
        const minutes = String(dateTime.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}, ${hours}:${minutes}`;
    }

    return '';
}

/**
 * Format duration in milliseconds to H:MM:SS
 */
function formatDurationHMS(durationMs: number): string {
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');

    return `${hours}:${mm}:${ss}`;
}

/**
 * Format relative timestamp from broadcast start
 * @param timestampUsec - Message timestamp in microseconds
 * @param broadcastStartTime - Broadcast start ISO timestamp
 * @returns Formatted string like "+0:12:34" or "+1:30:00"
 */
function formatRelativeTimestamp(timestampUsec: string | number, broadcastStartTime: string): string {
    try {
        const messageTimeMs = Number(timestampUsec) / 1000; // Convert usec to ms
        const broadcastStartMs = new Date(broadcastStartTime).getTime();

        if (Number.isNaN(messageTimeMs) || Number.isNaN(broadcastStartMs)) {
            return '';
        }

        const offsetMs = messageTimeMs - broadcastStartMs;
        if (offsetMs < 0) {
            return '-' + formatDurationHMS(Math.abs(offsetMs));
        }

        return '+' + formatDurationHMS(offsetMs);
    } catch (e) {
        console.error('[YCS] formatRelativeTimestamp error:', e);
        return '';
    }
}

/**
 * Format recording duration for timer display
 * @param startTimeMs - Recording start timestamp in milliseconds
 * @returns Formatted string like "00:05:30"
 */
function formatRecordingDuration(startTimeMs: number): string {
    try {
        const now = Date.now();
        const durationMs = now - startTimeMs;

        if (durationMs < 0) return '00:00:00';

        const totalSeconds = Math.floor(durationMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const hh = hours.toString().padStart(2, '0');
        const mm = minutes.toString().padStart(2, '0');
        const ss = seconds.toString().padStart(2, '0');

        return `${hh}:${mm}:${ss}`;
    } catch (e) {
        console.error('[YCS] formatRecordingDuration error:', e);
        return '00:00:00';
    }
}

function formatBytes(bytes: number, decimals = 2): string | void {
    try {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    } catch (err) {
        console.error(err);
    }
}

function getCommentsHtmlText(comments: any): any | undefined {
    if (!Array.isArray(comments)) return;

    try {
        let html = '';
        let countComment = 0;

        const cmnts: Set<any> = new Set();
        const replies: Set<any> = new Set();

        for (const c of comments) {
            if (c?.typeComment === 'C') {
                c.commentRenderer.ycsReplies = [];
                cmnts.add(c);
            } else if (c?.typeComment === 'R') {
                replies.add(c);
            }
        }

        // Helper to find root comment by tracing originComment chain
        const findRootComment = (reply: any): any | null => {
            let current = reply?.originComment;
            let maxDepth = 100;
            while (current && maxDepth-- > 0) {
                // Found root comment (typeComment === 'C')
                if (current.typeComment === 'C') return current;
                // Reached end of chain (no more originComment) - this is the root
                if (!current.originComment) return current;
                current = current.originComment;
            }
            return null;
        };

        // Associate all replies (including nested) to their root comments
        for (const r of replies) {
            const root = findRootComment(r);
            if (root && cmnts.has(root)) {
                root.commentRenderer.ycsReplies.push(r);
            }
        }

        const getUserMember = (cmnt: any): string => {
            try {
                if (cmnt?.commentRenderer?.sponsorCommentBadge?.sponsorCommentBadgeRenderer?.tooltip) {
                    const tooltip = cmnt.commentRenderer.sponsorCommentBadge.sponsorCommentBadgeRenderer.tooltip;
                    return ` | member: ${tooltip}`;
                }

                return '';
            } catch (err) {
                console.error(err);
                return '';
            }
        };

        const formatYoutubeUrl = (path: string): string => {
            // Absolute URLs (e.g. Data API's authorChannelUrl) are passed through unchanged;
            // relative paths from full-scan renderers get the legacy `youtube.com` prefix.
            if (path && /^https?:\/\//i.test(path)) return path;
            return `youtube.com${path || ''}`;
        };

        const authorChannelLine = (cmnt: any): string =>
            formatYoutubeUrl(cmnt?.commentRenderer?.authorEndpoint?.commandMetadata?.webCommandMetadata?.url || '');

        // Returns the fully-formatted nav line + trailing newline, OR '' when the
        // renderer has no nav URL (Data API path never emits publishedTimeText.runs
        // → skip the line entirely instead of leaving an orphan `youtube.com` row).
        const publishedNavigationBlock = (cmnt: any): string => {
            const rawUrl =
                (wrapTryCatch(
                    () =>
                        cmnt.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.commandMetadata
                            .webCommandMetadata.url
                ) as string) || '';
            if (!rawUrl) return '';
            return `${formatYoutubeUrl(rawUrl)}\n`;
        };

        const publishedTimeLine = (cmnt: any): string =>
            (wrapTryCatch(() => cmnt.commentRenderer.publishedTimeText.runs[0].text) as string) ||
            cmnt?.commentRenderer?.publishedTimeText?.simpleText ||
            '';

        const renderTypeComment = (cmnt: any): string => {
            try {
                if (cmnt?.typeComment === 'C') {
                    return '[COMMENT]';
                } else if (cmnt?.typeComment === 'R') {
                    return '[REPLY]';
                }

                return '';
            } catch (err) {
                console.error(err);
                return '';
            }
        };

        const renderCountReply = (cmnt: any): string => {
            try {
                if (cmnt?.typeComment === 'C') {
                    return ` | reply: ${cmnt?.commentRenderer?.replyCount || 0}`;
                }

                return '';
            } catch (err) {
                console.error(err);
                return '';
            }
        };

        const renderReplies = (cmnt: any): string => {
            try {
                if (cmnt?.commentRenderer?.ycsReplies?.length > 0) {
                    let resReplies = '\nReplies:\n';

                    for (const r of cmnt.commentRenderer.ycsReplies) {
                        countComment++;

                        resReplies += `
${renderTypeComment(r)}
${r?.commentRenderer?.authorText?.simpleText || ''}
${authorChannelLine(r)}\n
${publishedNavigationBlock(r)}${publishedTimeLine(r)} | like: ${r?.commentRenderer?.likeCount || r?.commentRenderer?.voteCount?.simpleText || 0}${renderCountReply(r)}${getUserMember(r)}\n
${r?.commentRenderer?.contentText?.fullText || ''}\n
                        `;
                    }

                    return resReplies;
                }

                return '';
            } catch (err) {
                console.error(err);
                return '';
            }
        };

        for (const c of cmnts) {
            try {
                countComment++;

                html += `
\n#####\n
${renderTypeComment(c)}
${c?.commentRenderer?.authorText?.simpleText || ''}
${authorChannelLine(c)}\n
${publishedNavigationBlock(c)}${publishedTimeLine(c)} | like: ${c?.commentRenderer?.likeCount || c?.commentRenderer?.voteCount?.simpleText || 0}${renderCountReply(c)}${getUserMember(c)}\n
${c?.commentRenderer?.contentText?.fullText || ''}
${renderReplies(c)}
#####\n`;
            } catch (e) {
                console.error(e);
                continue;
            }
        }

        return {
            count: countComment,
            html: html
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

function getCommentsChatHtmlText(comments: any): any | undefined {
    if (!Array.isArray(comments)) return;

    try {
        let html = '';
        let countComment = 0;

        for (const c of comments) {
            try {
                countComment++;

                html += `
\n#####\n
${wrapTryCatch(() => c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorName.simpleText) || ''}
youtube.com/channel/${wrapTryCatch(() => c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorExternalChannelId) || ''}\n
date: ${wrapTryCatch(() => new Date(c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.timestampUsec / 1000).toISOString().slice(0, -5)) || ''}\n
${wrapTryCatch(() => c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText) ? 'donated: ' + c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText + '\n' : ''}
${wrapTryCatch(() => c.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.fullText) || ''}
\n#####\n`;
            } catch (e) {
                console.error(e);
                continue;
            }
        }

        return {
            count: countComment,
            html: html
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

function getCommentsTrVideoHtmlText(comments: any): any | undefined {
    if (!Array.isArray(comments)) return;

    try {
        let html = '';
        let countComment = 0;

        for (const c of comments) {
            try {
                countComment++;

                html += `
\n#####\n
Time: ${wrapTryCatch(() => c.transcriptCueGroupRenderer.formattedStartOffset.simpleText) || ''}

${wrapTryCatch(() => c.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.cue.simpleText) || ''}

start offset: ${wrapTryCatch(() => c.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.startOffsetMs) || 0} | duration: ${wrapTryCatch(() => c.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.durationMs) || 0}
\n#####\n`;
            } catch (e) {
                console.error(e);
                continue;
            }
        }

        return {
            count: countComment,
            html: html
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

/**
 * Format milliseconds to SRT timestamp: HH:MM:SS,mmm
 * Guards against negative (clamps to 0) and NaN (returns 00:00:00,000).
 */
function formatSrtTimestamp(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) {
        return '00:00:00,000';
    }

    // Floor first to avoid Math.round producing millis=1000 on fractional input
    const totalMs = Math.floor(ms);
    const totalSeconds = Math.floor(totalMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const millis = totalMs % 1000;

    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    const fff = millis.toString().padStart(3, '0');

    return `${hh}:${mm}:${ss},${fff}`;
}

interface SrtItem {
    startOffsetMs: number;
    durationMs: number;
    message: string;
}

/**
 * Build SRT subtitle file content from transcript export items.
 * Expects message text to already be decoded (HTML entities resolved at source).
 */
function buildSrtContent(items: SrtItem[]): string {
    const blocks: string[] = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const start = formatSrtTimestamp(item.startOffsetMs);
        const end = formatSrtTimestamp(item.startOffsetMs + item.durationMs);
        blocks.push(`${i + 1}\n${start} --> ${end}\n${item.message}`);
    }
    return blocks.join('\n\n') + (blocks.length > 0 ? '\n' : '');
}

export {
    resolveMeta,
    safeUrl,
    parseFormattedNumber,
    parseFormattedNumberToInt,
    msToRoundSec,
    msToShareVideo,
    tmUsecToDateTime,
    formatDurationHMS,
    formatRelativeTimestamp,
    formatRecordingDuration,
    formatBytes,
    formatSrtTimestamp,
    buildSrtContent,
    getCommentsHtmlText,
    getCommentsChatHtmlText,
    getCommentsTrVideoHtmlText
};

export type { ExportMeta, ResolvedExportMeta };
