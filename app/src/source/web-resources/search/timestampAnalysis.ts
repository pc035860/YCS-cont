import type { CommentItem } from '../../utils/interfaces/i_types';

export interface Interval {
    startMs: number;
    endMs: number;
}

export interface IntervalData extends Interval {
    count: number;
    timestamps: number[]; // All timestamps in this interval
}

/**
 * Extract all timestamps from comments (in milliseconds)
 */
export function extractTimestamps(comments: CommentItem[]): number[] {
    const timestamps: number[] = [];

    for (const comment of comments) {
        // Check if this is a timestamp comment
        if (comment?.commentRenderer?.isTimeLine === 'timeline') {
            // Extract timestamp from navigationEndpoint
            const runs = comment.commentRenderer?.contentText?.runs;
            if (runs && runs.length > 0) {
                for (const run of runs) {
                    if (run.navigationEndpoint?.watchEndpoint?.startTimeSeconds) {
                        const seconds = run.navigationEndpoint.watchEndpoint.startTimeSeconds;
                        timestamps.push(seconds * 1000); // Convert to milliseconds
                    }
                }
            }
        }
    }

    // Filter out invalid timestamps (negative or too large values)
    const validTimestamps = timestamps.filter((ts) => ts >= 0 && ts < 24 * 60 * 60 * 1000); // 0 to 24 hours

    return validTimestamps.sort((a, b) => a - b); // Sort by time
}

/**
 * Intelligently divide time intervals
 * Dynamically adjust interval size based on video length, target 30-50 intervals
 */
export function createTimeIntervals(timestamps: number[], videoDurationMs: number): Interval[] {
    if (timestamps.length === 0) {
        return [];
    }

    const videoDurationMinutes = videoDurationMs / (1000 * 60);
    let targetIntervalCount: number;
    let intervalSizeMs: number;

    // Dynamically adjust interval count and size based on video length
    if (videoDurationMinutes < 10) {
        // Short videos: 10-30 seconds/interval, target 30-40 intervals
        targetIntervalCount = Math.min(40, Math.max(30, Math.ceil(videoDurationMinutes * 2)));
        intervalSizeMs = videoDurationMs / targetIntervalCount;
    } else if (videoDurationMinutes < 60) {
        // Medium videos: 1-2 minutes/interval, target 30-50 intervals
        targetIntervalCount = Math.min(50, Math.max(30, Math.ceil(videoDurationMinutes / 1.5)));
        intervalSizeMs = videoDurationMs / targetIntervalCount;
    } else {
        // Long videos: 2-3 minutes/interval, target 30-50 intervals
        targetIntervalCount = Math.min(50, Math.max(30, Math.ceil(videoDurationMinutes / 2.5)));
        intervalSizeMs = videoDurationMs / targetIntervalCount;
    }

    const intervals: Interval[] = [];
    let currentStart = 0;

    while (currentStart < videoDurationMs) {
        const currentEnd = Math.min(currentStart + intervalSizeMs, videoDurationMs);

        // Ensure interval length is not 0
        if (currentEnd > currentStart) {
            intervals.push({
                startMs: Math.round(currentStart),
                endMs: Math.round(currentEnd)
            });
        }

        currentStart = currentEnd;

        // If we've reached the end of the video, stop creating more intervals
        if (currentEnd >= videoDurationMs) {
            break;
        }
    }

    // Ensure the last interval correctly covers to the end of the video
    if (intervals.length > 0) {
        const lastInterval = intervals[intervals.length - 1];
        // If the last interval doesn't cover to the end of the video, adjust it
        if (lastInterval.endMs < videoDurationMs) {
            intervals[intervals.length - 1] = {
                startMs: lastInterval.startMs,
                endMs: videoDurationMs
            };
        }
    }

    return intervals;
}

/**
 * Count timestamps in each interval
 */
export function aggregateTimestamps(timestamps: number[], intervals: Interval[]): IntervalData[] {
    return intervals.map((interval, index) => {
        const timestampsInInterval = timestamps.filter((ts) => {
            // For the last interval, use special handling
            if (index === intervals.length - 1) {
                // If the last interval length is 0, include all timestamps >= startMs
                if (interval.startMs === interval.endMs) {
                    return ts >= interval.startMs;
                }
                // Otherwise handle normally
                return ts >= interval.startMs && ts <= interval.endMs;
            }
            // For other intervals, don't include end time (avoid duplicate counting)
            return ts >= interval.startMs && ts < interval.endMs;
        });

        return {
            ...interval,
            count: timestampsInInterval.length,
            timestamps: timestampsInInterval
        };
    });
}

/**
 * Filter comments by time interval
 * Returns comments that have timestamps within the specified interval
 */
export function filterCommentsByInterval(comments: CommentItem[], startMs: number, endMs: number): CommentItem[] {
    const filteredComments: CommentItem[] = [];

    for (const comment of comments) {
        // Check if this is a timestamp comment
        if (comment?.commentRenderer?.isTimeLine === 'timeline') {
            // Extract timestamps from navigationEndpoint
            const runs = comment.commentRenderer?.contentText?.runs;
            if (runs && runs.length > 0) {
                let hasTimestampInInterval = false;

                for (const run of runs) {
                    if (run.navigationEndpoint?.watchEndpoint?.startTimeSeconds) {
                        const timestampMs = run.navigationEndpoint.watchEndpoint.startTimeSeconds * 1000;
                        // Check if timestamp is within the interval [startMs, endMs)
                        if (timestampMs >= startMs && timestampMs < endMs) {
                            hasTimestampInInterval = true;
                            break;
                        }
                    }
                }

                if (hasTimestampInInterval) {
                    filteredComments.push(comment);
                }
            }
        }
    }

    // Sort by timestamp (earliest first)
    return filteredComments.sort((a, b) => {
        const getFirstTimestamp = (comment: CommentItem): number => {
            const runs = comment.commentRenderer?.contentText?.runs;
            if (runs && runs.length > 0) {
                for (const run of runs) {
                    if (run.navigationEndpoint?.watchEndpoint?.startTimeSeconds) {
                        return run.navigationEndpoint.watchEndpoint.startTimeSeconds * 1000;
                    }
                }
            }
            return 0;
        };

        return getFirstTimestamp(a) - getFirstTimestamp(b);
    });
}

/**
 * Format time as HH:MM:SS or MM:SS format
 */
export function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}
