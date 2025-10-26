import { navigateVideoToTimestamp } from '../../utils/dom';
import type { IntervalData } from '../search/timestampAnalysis';
import { formatTime } from '../search/timestampAnalysis';

/**
 * Render timestamp distribution chart
 */
export function renderTimestampChart(container: HTMLElement, data: IntervalData[], _videoDurationMs: number): void {
    if (data.length === 0) {
        container.innerHTML =
            '<div class="ycs-timestamp-chart"><div class="ycs-chart-title">No timestamps found</div></div>';
        return;
    }

    const maxCount = Math.max(...data.map((d) => d.count));
    const chartTitle = `Timestamp Distribution (${data.reduce((sum, d) => sum + d.count, 0)} timestamps across ${data.length} intervals)`;

    // Build chart HTML
    const chartHTML = `
        <div class="ycs-timestamp-chart">
            <div class="ycs-chart-title">${chartTitle}</div>
            <div class="ycs-chart-container">
                <div class="ycs-chart-bars">
                    ${data
                        .map((interval) => {
                            const heightPercent = maxCount > 0 ? (interval.count / maxCount) * 100 : 0;
                            const timestampsJson = JSON.stringify(interval.timestamps);
                            return `
                            <div class="ycs-chart-bar"
                                 data-start-ms="${interval.startMs}"
                                 data-timestamps='${timestampsJson}'
                                 title="${formatTime(interval.startMs)} → ${formatTime(interval.endMs)} (${interval.count} timestamps)">
                                <div class="ycs-bar-fill" style="height: ${heightPercent}%">
                                    <div class="ycs-bar-label">${interval.count}</div>
                                </div>
                            </div>
                        `;
                        })
                        .join('')}
                </div>
                <div class="ycs-chart-x-axis">
                    ${data
                        .map((interval, index) => {
                            // Dynamically adjust label display frequency based on interval count
                            let labelInterval: number;
                            if (data.length <= 20) {
                                labelInterval = 3;
                            } else if (data.length <= 40) {
                                labelInterval = 5;
                            } else {
                                labelInterval = 7;
                            }

                            if (index % labelInterval === 0 || index === data.length - 1) {
                                return `<span>${formatTime(interval.startMs)}</span>`;
                            }
                            return '';
                        })
                        .join('')}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = chartHTML;

    // Bind click events
    const bars = container.querySelectorAll('.ycs-chart-bar');
    bars.forEach((bar) => {
        bar.addEventListener('click', () => {
            const timestampsStr = bar.getAttribute('data-timestamps');
            if (timestampsStr) {
                try {
                    const timestamps: number[] = JSON.parse(timestampsStr);
                    if (timestamps.length > 0) {
                        // Jump to the first timestamp in this interval
                        const firstTimestamp = timestamps[0];
                        const video = document.getElementsByTagName('video')[0] as HTMLVideoElement;
                        if (video) {
                            // Create a temporary HTML element to satisfy function signature
                            const tempElement = document.createElement('div');
                            tempElement.dataset.offsetvideo = firstTimestamp.toString();
                            tempElement.classList.add('ycs_goto_chat'); // Mark as milliseconds format
                            navigateVideoToTimestamp(tempElement, video);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing timestamps:', error);
                }
            }
        });
    });
}
