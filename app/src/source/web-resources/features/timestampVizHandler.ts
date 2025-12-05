/**
 * Timestamp Visualization Handler Module
 *
 * Handles timestamp visualization functionality including:
 * - Analyzing timestamps mentioned in comments
 * - Creating time interval distribution charts
 * - Interactive chart with comment filtering by interval
 * - Floating button for interval navigation
 */

import { extractVideoDuration } from '../../utils/common';
import type { CommentItem } from '../../utils/interfaces/i_types';
import {
    extractTimestamps,
    createTimeIntervals,
    aggregateTimestamps,
    filterCommentsByInterval,
    formatTime
} from '../search/timestampAnalysis';
import { runSearch as runCommentsSearch } from '../search/commentsSearch';
import { SearchContext } from '../search/types';
import { renderTimestampChart } from '../ui/timestampChart';
import { showFloatingButton } from '../ui/timestampFloatingButton';
import { renderCommentsResult } from '../ui/render';
import { registerCommentInteractions } from '../ui/commentInteractions';
import type { WebResourcesState } from '../state';

// ============================================
// DI Interface Definitions
// ============================================

export interface TimestampVizStateDeps {
    getComments: () => CommentItem[];
    getState: () => WebResourcesState;
}

export interface TimestampVizCallbacks {
    updateTotalResultDisplay: (text: string) => void;
    getSearchQuery: () => string;
}

export interface TimestampVizDeps {
    state: TimestampVizStateDeps;
    callbacks: TimestampVizCallbacks;
}

// ============================================
// Factory Function
// ============================================

/**
 * Creates a timestamp visualization handler with injected dependencies
 * @param deps - Dependencies for timestamp visualization
 * @returns Function to handle timestamp visualization
 */
export function createTimestampVizHandler(deps: TimestampVizDeps): () => void {
    const { state, callbacks } = deps;

    return (): void => {
        try {
            const comments = state.getComments();
            if (!comments || comments.length === 0) {
                const container = document.getElementById('ycs-search-result');
                if (container) {
                    container.innerHTML =
                        '<div class="ycs-timestamp-chart"><div class="ycs-chart-title">No comments loaded</div></div>';
                }
                callbacks.updateTotalResultDisplay('No comments available for timestamp analysis');
                return;
            }

            // Get search query and filter comments if needed
            const query = callbacks.getSearchQuery();
            let filteredComments = comments;

            if (query.trim()) {
                // Use existing search logic to filter comments by search query
                const context: SearchContext = {
                    extendedSearch: { enabled: false, title: false, main: false },
                    sortOrders: { comments: {}, chat: {}, transcript: {} }
                };
                const searchResult = runCommentsSearch(query.trim(), {}, state.getState(), context);
                filteredComments = searchResult.results.map((result) => result.item as CommentItem);
            }

            // Extract timestamps from filtered comments
            const timestamps = extractTimestamps(filteredComments);
            if (timestamps.length === 0) {
                const container = document.getElementById('ycs-search-result');
                if (container) {
                    container.innerHTML = `<div class="ycs-timestamp-chart"><div class="ycs-chart-title">No timestamps found in comments</div></div>`;
                }
                callbacks.updateTotalResultDisplay(`No timestamps found in comments`);
                return;
            }

            // Get video duration
            const videoDurationMs = extractVideoDuration();
            if (!videoDurationMs) {
                const container = document.getElementById('ycs-search-result');
                if (container) {
                    container.innerHTML =
                        '<div class="ycs-timestamp-chart"><div class="ycs-chart-title">Unable to get video duration</div></div>';
                }
                callbacks.updateTotalResultDisplay('Unable to get video duration');
                return;
            }

            // Create time intervals
            const intervals = createTimeIntervals(timestamps, videoDurationMs);
            const intervalData = aggregateTimestamps(timestamps, intervals);

            // Create result container for interval results
            const container = document.getElementById('ycs-search-result');
            if (container) {
                // Clear previous results
                container.innerHTML = '';

                // Create chart container
                const chartContainer = document.createElement('div');
                chartContainer.id = 'ycs-timestamp-chart-container';

                // Create results container
                const resultsContainer = document.createElement('div');
                resultsContainer.id = 'ycs-timestamp-interval-results';

                container.appendChild(chartContainer);
                container.appendChild(resultsContainer);

                // Update statistics after DOM is updated
                const totalTimestamps = timestamps.length;
                const totalIntervals = intervals.length;
                callbacks.updateTotalResultDisplay(
                    `Found ${totalTimestamps} timestamps across ${totalIntervals} intervals`
                );

                // Render chart with click handler
                renderTimestampChart(
                    chartContainer,
                    intervalData,
                    videoDurationMs,
                    filteredComments,
                    (startMs: number, endMs: number) => {
                        // Filter comments by interval
                        const intervalComments = filterCommentsByInterval(filteredComments, startMs, endMs);

                        // Convert to ICommentsFuseResult format
                        const fuseResults = intervalComments.map((comment, index) => {
                            const originalIndex = Number((comment as any)?._index);
                            return {
                                item: comment,
                                refIndex: Number.isFinite(originalIndex) ? originalIndex : index,
                                score: 0
                            };
                        });

                        // Create search result object
                        const searchResult = {
                            results: fuseResults,
                            total: intervalComments.length,
                            summary: `${intervalComments.length} items in ${formatTime(startMs)} - ${formatTime(endMs)}`,
                            query: query.trim(),
                            buttonStates: {}
                        };

                        // Render results
                        renderCommentsResult('#ycs-timestamp-interval-results', searchResult);

                        // Update statistics display with the interval summary
                        callbacks.updateTotalResultDisplay(searchResult.summary);

                        // Register comment interactions for the new results
                        const resultsContainer = document.getElementById('ycs-timestamp-interval-results');
                        if (resultsContainer) {
                            registerCommentInteractions(
                                resultsContainer,
                                {
                                    getComments: () => state.getComments()
                                },
                                () => query.trim()
                            );
                        }

                        // Scroll to results and show floating button
                        const searchResultContainer = document.getElementById('ycs-search-result');
                        if (searchResultContainer) {
                            // Find the results container and scroll to it
                            const resultsContainer = document.getElementById('ycs-timestamp-interval-results');
                            if (resultsContainer) {
                                // Calculate the position of the results container relative to the scrollable container
                                const containerRect = searchResultContainer.getBoundingClientRect();
                                const resultsRect = resultsContainer.getBoundingClientRect();
                                const scrollTop =
                                    searchResultContainer.scrollTop + (resultsRect.top - containerRect.top);

                                // Scroll to the results container
                                searchResultContainer.scrollTop = scrollTop;
                            }
                            showFloatingButton(searchResultContainer, startMs, endMs, intervalComments.length);
                        }
                    }
                );
            }
        } catch (error) {
            console.error('Error in handleTimestampViz:', error);
            const container = document.getElementById('ycs-search-result');
            if (container) {
                container.innerHTML =
                    '<div class="ycs-timestamp-chart"><div class="ycs-chart-title">Error generating timestamp chart</div></div>';
            }
            callbacks.updateTotalResultDisplay('Error generating timestamp chart');
        }
    };
}
