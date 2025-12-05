/**
 * YouTube Data API to CommentItem Transformation
 *
 * Transforms YouTube Data API v3 responses to the internal CommentItem format
 * used by YCS for rendering and searching.
 */

import type {
    CommentItem,
    CommentRenderer,
    CommentRun,
    YouTubeApiComment,
    YouTubeApiCommentThread
} from '../interfaces/i_types';
import { decodeHtml } from '../common';

/**
 * Regex pattern to match timestamps in comment text (e.g., "1:23", "1:23:45")
 */
const TIMESTAMP_REGEX = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g;

/**
 * Parse timestamp string to seconds (e.g., "1:23" -> 83)
 */
function parseTimestampToSeconds(match: string): number | null {
    const parts = match.split(':').map(Number);
    if (parts.length === 2) {
        // MM:SS format
        const [minutes, seconds] = parts;
        return minutes * 60 + seconds;
    } else if (parts.length === 3) {
        // HH:MM:SS format
        const [hours, minutes, seconds] = parts;
        return hours * 3600 + minutes * 60 + seconds;
    }
    return null;
}

/**
 * Parse YouTube URL time parameter to seconds
 * Handles various formats: t=83, t=83s, t=1m23s, t=1h2m3s
 * Also handles HTML entity encoded ampersands (&amp;)
 */
function parseYouTubeTimeParam(url: string): number | null {
    // Decode HTML entities (e.g., &amp; -> &)
    const decoded = url.replace(/&amp;/g, '&');

    // Format 1: t=123 or t=123s (pure seconds)
    const secondsMatch = decoded.match(/[?&]t=(\d+)s?(?:&|$)/);
    if (secondsMatch) {
        return parseInt(secondsMatch[1], 10);
    }

    // Format 2: t=1h2m3s or t=2m3s or t=3s (hours/minutes/seconds)
    const hmsMatch = decoded.match(/[?&]t=(?:(\d+)h)?(?:(\d+)m)?(\d+)s/);
    if (hmsMatch) {
        const hours = parseInt(hmsMatch[1] || '0', 10);
        const minutes = parseInt(hmsMatch[2] || '0', 10);
        const seconds = parseInt(hmsMatch[3] || '0', 10);
        return hours * 3600 + minutes * 60 + seconds;
    }

    return null;
}

/**
 * Parse HTML text content and extract runs with timestamp detection
 *
 * @param textDisplay - HTML formatted text from YouTube API
 * @param videoId - Current video ID for timestamp link validation
 * @returns Array of CommentRun objects
 */
function parseTextToRuns(textDisplay: string, videoId: string): { runs: CommentRun[]; hasTimeline: boolean } {
    const runs: CommentRun[] = [];
    let hasTimeline = false;

    // Simple HTML to text conversion (preserve structure for runs)
    // YouTube API returns textDisplay with <a> tags for links and <br> for newlines
    let text = textDisplay;

    // Replace <br> with newlines
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Extract links and convert to runs
    const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
    let lastIndex = 0;
    let match;

    // Create a working copy to extract links
    const tempText = text;
    const segments: Array<{ type: 'text' | 'link'; content: string; url?: string; start: number; end: number }> = [];

    while ((match = linkRegex.exec(tempText)) !== null) {
        // Add text before the link
        if (match.index > lastIndex) {
            segments.push({
                type: 'text',
                content: tempText.slice(lastIndex, match.index),
                start: lastIndex,
                end: match.index
            });
        }

        // Add the link
        segments.push({
            type: 'link',
            content: match[2], // Link text
            url: match[1], // URL
            start: match.index,
            end: match.index + match[0].length
        });

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < tempText.length) {
        segments.push({
            type: 'text',
            content: tempText.slice(lastIndex),
            start: lastIndex,
            end: tempText.length
        });
    }

    // Process segments and detect timestamps
    for (const segment of segments) {
        if (segment.type === 'link') {
            // Check if this is a YouTube timestamp link
            const url = segment.url ?? '';
            const isYouTubeLink = url.includes('youtube.com') || url.includes('youtu.be');
            const startTimeSeconds = parseYouTubeTimeParam(url);

            if (isYouTubeLink && startTimeSeconds !== null) {
                // Decode HTML entities for video ID extraction
                const decodedUrl = url.replace(/&amp;/g, '&');
                // Check if this links to the current video
                const urlVideoId =
                    decodedUrl.match(/[?&]v=([^&]+)/)?.[1] || decodedUrl.match(/youtu\.be\/([^?&]+)/)?.[1];

                if (urlVideoId === videoId || !urlVideoId) {
                    hasTimeline = true;
                    runs.push({
                        text: segment.content,
                        navigationEndpoint: {
                            watchEndpoint: {
                                startTimeSeconds
                            }
                        }
                    });
                    continue;
                }
            }

            // Regular link
            runs.push({
                text: segment.content,
                navigationEndpoint: {
                    commandMetadata: {
                        webCommandMetadata: {
                            url: segment.url
                        }
                    }
                }
            });
        } else {
            // Text segment - check for inline timestamps
            let content = segment.content;
            // Strip remaining HTML tags
            content = decodeHtml(content.replace(/<[^>]*>/g, ''));

            // Check for timestamp patterns in text
            let textLastIndex = 0;
            let timestampMatch;
            const timestampRegex = new RegExp(TIMESTAMP_REGEX.source, 'g');

            while ((timestampMatch = timestampRegex.exec(content)) !== null) {
                // Add text before timestamp
                if (timestampMatch.index > textLastIndex) {
                    runs.push({
                        text: content.slice(textLastIndex, timestampMatch.index)
                    });
                }

                // Add timestamp as clickable link
                const seconds = parseTimestampToSeconds(timestampMatch[0]);
                if (seconds !== null) {
                    hasTimeline = true;
                    runs.push({
                        text: timestampMatch[0],
                        navigationEndpoint: {
                            watchEndpoint: {
                                startTimeSeconds: seconds
                            }
                        }
                    });
                } else {
                    runs.push({
                        text: timestampMatch[0]
                    });
                }

                textLastIndex = timestampMatch.index + timestampMatch[0].length;
            }

            // Add remaining text
            if (textLastIndex < content.length) {
                runs.push({
                    text: content.slice(textLastIndex)
                });
            }
        }
    }

    // If no segments were found, just add the plain text
    if (runs.length === 0) {
        const plainText = decodeHtml(textDisplay.replace(/<[^>]*>/g, ''));
        runs.push({ text: plainText });
    }

    return { runs, hasTimeline };
}

/**
 * Format runs to fullText and renderFullText
 */
function formatRunsToText(runs: CommentRun[]): { fullText: string; renderFullText: string } {
    let fullText = '';
    let renderFullText = '';

    for (const run of runs) {
        const text = run.text ?? '';
        fullText += text;

        if (run.navigationEndpoint?.watchEndpoint?.startTimeSeconds !== undefined) {
            // Timestamp link
            const seconds = run.navigationEndpoint.watchEndpoint.startTimeSeconds;
            renderFullText += `<a class="ycs-goto-comment-time" href="#" data-offsetvideo="${seconds}">${text}</a>`;
        } else if (run.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url) {
            // External link
            const url = run.navigationEndpoint.commandMetadata.webCommandMetadata.url;
            renderFullText += `<a class="ycs-comment-link" href="${url}" target="_blank" rel="noopener">${text}</a>`;
        } else {
            renderFullText += text;
        }
    }

    return { fullText, renderFullText };
}

/**
 * Convert ISO 8601 date to relative time string
 */
function formatRelativeTime(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0) {
        return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
    } else if (diffMonths > 0) {
        return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    } else if (diffWeeks > 0) {
        return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
    } else if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
        return 'just now';
    }
}

/**
 * Transform a YouTube API comment to internal CommentRenderer format
 */
function transformApiCommentToRenderer(
    apiComment: YouTubeApiComment,
    videoId: string,
    replyCount?: number
): CommentRenderer {
    const { runs, hasTimeline } = parseTextToRuns(apiComment.snippet.textDisplay, videoId);
    const { fullText, renderFullText } = formatRunsToText(runs);

    const renderer: CommentRenderer = {
        commentId: apiComment.id,
        authorText: {
            simpleText: apiComment.snippet.authorDisplayName
        },
        authorThumbnail: {
            thumbnails: [
                {
                    url: apiComment.snippet.authorProfileImageUrl,
                    width: 48,
                    height: 48
                }
            ]
        },
        authorEndpoint: {
            commandMetadata: {
                webCommandMetadata: {
                    url: apiComment.snippet.authorChannelUrl
                }
            }
        },
        contentText: {
            runs,
            fullText,
            renderFullText
        },
        likeCount: apiComment.snippet.likeCount,
        publishedTimeText: {
            simpleText: formatRelativeTime(apiComment.snippet.publishedAt)
        }
    };

    // Add reply count if provided (for top-level comments)
    if (replyCount !== undefined && replyCount > 0) {
        renderer.replyCount = replyCount;
    }

    // Mark as timeline comment if timestamps were found
    if (hasTimeline) {
        renderer.isTimeLine = 'timeline';
    }

    // Note: The following fields are NOT available from YouTube Data API:
    // - authorIsChannelOwner (would require additional API call)
    // - verifiedAuthor (not in API response)
    // - creatorHeart (not in API response)
    // - sponsorCommentBadge (not in API response)
    // - donatedChip (not in API response)

    return renderer;
}

/**
 * Transform a YouTube API comment thread to CommentItem array
 *
 * @param thread - YouTube API comment thread
 * @param videoId - Current video ID
 * @returns Array of CommentItem (parent + replies)
 */
export function transformThreadToCommentItems(thread: YouTubeApiCommentThread, videoId: string): CommentItem[] {
    const items: CommentItem[] = [];

    // Transform top-level comment
    const parentRenderer = transformApiCommentToRenderer(
        thread.snippet.topLevelComment,
        videoId,
        thread.snippet.totalReplyCount
    );

    const parentItem: CommentItem = {
        commentRenderer: parentRenderer,
        typeComment: 'C'
    };

    items.push(parentItem);

    // Transform replies if present
    // Note: replies.comments only contains a subset of replies
    // Full replies need to be fetched separately using comments.list
    if (thread.replies?.comments) {
        for (let i = 0; i < thread.replies.comments.length; i++) {
            const replyRenderer = transformApiCommentToRenderer(thread.replies.comments[i], videoId);

            const replyItem: CommentItem = {
                commentRenderer: replyRenderer,
                originComment: parentItem,
                typeComment: 'R'
            };

            items.push(replyItem);
        }
    }

    return items;
}

/**
 * Transform a YouTube API comment (reply) to CommentItem
 *
 * @param apiComment - YouTube API comment
 * @param videoId - Current video ID
 * @param parentItem - Parent comment item
 * @returns CommentItem for the reply
 */
export function transformReplyToCommentItem(
    apiComment: YouTubeApiComment,
    videoId: string,
    parentItem: CommentItem
): CommentItem {
    const renderer = transformApiCommentToRenderer(apiComment, videoId);

    return {
        commentRenderer: renderer,
        originComment: parentItem,
        typeComment: 'R'
    };
}
