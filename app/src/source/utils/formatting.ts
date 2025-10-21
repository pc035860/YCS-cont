import { escapeHtml, wrapTryCatch, getCleanUrlVideo } from './common';

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
        title: typeof meta?.title === 'string' && meta.title ? meta.title : fallbackTitle,
        url: typeof meta?.url === 'string' && meta.url ? meta.url : fallbackUrl,
        generatedAt: generatedAt.toString()
    };
}

function esc(input: unknown): string {
    try {
        const s = String(input ?? '');
        return escapeHtml(s);
    } catch {
        return '';
    }
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

function sanitizeHtml(html: unknown): string {
    try {
        let s = String(html || '');
        if (!s) return '';
        s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        s = s
            .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
            .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
            .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
        s = s.replace(/href\s*=\s*"([^"]*)"/gi, (_m, p1) => `href="${esc(safeUrl(p1))}" rel="noopener noreferrer"`);
        s = s.replace(/href\s*=\s*'([^']*)'/gi, (_m, p1) => `href='${esc(safeUrl(p1))}' rel="noopener noreferrer"`);
        s = s.replace(/src\s*=\s*"([^"]*)"/gi, (_m, p1) => {
            const u = safeUrl(p1);
            return u === '#' ? 'src=""' : `src="${esc(u)}"`;
        });
        s = s.replace(/src\s*=\s*'([^']*)'/gi, (_m, p1) => {
            const u = safeUrl(p1);
            return u === '#' ? "src=''" : `src='${esc(u)}'`;
        });
        return s;
    } catch {
        return '';
    }
}

function parseFormattedNumber(value?: string): { number: number; multiply: number } {
    try {
        if (!value) return { number: 0, multiply: 1 };
        let s = String(value).trim();
        if (!s) return { number: 0, multiply: 1 };

        s = s.replace(/[\u00A0\u202F\s]+/g, '');

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
        const lower = s.toLowerCase();

        for (const [unit, mul] of units) {
            const unitLower = unit.toLowerCase();
            if (lower.endsWith(unitLower)) {
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

        return `${dateTime.toISOString().split('T')[0]}, ${dateTime.toISOString().split('T')[1].split('.')[0].slice(0, 5)}`;
    }

    return '';
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

        for (const c of cmnts) {
            if (wrapTryCatch(() => c.commentRenderer.replyCount > 0)) {
                for (const r of replies) {
                    if (r?.originComment.commentRenderer.commentId === c.commentRenderer.commentId) {
                        c.commentRenderer.ycsReplies.push(r);
                        replies.delete(r);
                    }
                }
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
youtube.com${r?.commentRenderer?.authorEndpoint?.commandMetadata?.webCommandMetadata?.url || ''}\n
youtube.com${wrapTryCatch(() => r.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url) || ''}
${wrapTryCatch(() => r.commentRenderer.publishedTimeText.runs[0].text) || ''} | like: ${r?.commentRenderer?.likeCount || r?.commentRenderer?.voteCount?.simpleText || 0}${renderCountReply(r)}${getUserMember(r)}\n
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
youtube.com${c?.commentRenderer?.authorEndpoint?.commandMetadata?.webCommandMetadata?.url || ''}\n
youtube.com${wrapTryCatch(() => c.commentRenderer.publishedTimeText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url) || ''}
${wrapTryCatch(() => c.commentRenderer.publishedTimeText.runs[0].text) || ''} | like: ${c?.commentRenderer?.likeCount || c?.commentRenderer?.voteCount?.simpleText || 0}${renderCountReply(c)}${getUserMember(c)}\n
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
${wrapTryCatch(() => c.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.cue.simpleText) || ''}
${wrapTryCatch(() => c.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.formattedStartOffset.simpleText) || ''}
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

export {
    resolveMeta,
    esc,
    safeUrl,
    sanitizeHtml,
    parseFormattedNumber,
    parseFormattedNumberToInt,
    msToRoundSec,
    msToShareVideo,
    tmUsecToDateTime,
    formatBytes,
    getCommentsHtmlText,
    getCommentsChatHtmlText,
    getCommentsTrVideoHtmlText
};

export type { ExportMeta, ResolvedExportMeta };
