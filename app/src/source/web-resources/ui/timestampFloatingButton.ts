import { formatTime } from '../search/timestampAnalysis';

/**
 * Show or update floating back button for timestamp chart
 */
export function showFloatingButton(container: HTMLElement, startMs: number, endMs: number, count: number): void {
    // Check if button already exists
    let button = container.querySelector('.ycs-floating-back-button') as HTMLElement;

    if (button) {
        // Update existing button text
        const textElement = button.querySelector('.ycs-floating-button-text');
        if (textElement) {
            textElement.textContent = `${formatTime(startMs)} - ${formatTime(endMs)} (${count} timestamps)`;
        }
    } else {
        // Create new button
        button = document.createElement('button');
        button.className = 'ycs-floating-back-button';
        button.title = 'Back to chart';

        // Create button content
        button.innerHTML = `
            <span class="ycs-floating-button-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 19V5M5 12L12 5L19 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </span>
            <span class="ycs-floating-button-text">${formatTime(startMs)} - ${formatTime(endMs)} (${count} timestamps)</span>
        `;

        // Bind click event
        button.addEventListener('click', () => {
            // Find the chart container and scroll to it
            const chartContainer = document.getElementById('ycs-timestamp-chart-container');
            if (chartContainer) {
                const containerRect = container.getBoundingClientRect();
                const chartRect = chartContainer.getBoundingClientRect();
                const scrollTop = container.scrollTop + (chartRect.top - containerRect.top);
                container.scrollTop = scrollTop;
            } else {
                // Fallback: scroll to top
                container.scrollTop = 0;
            }
        });

        // Append to results container instead of main container
        const resultsContainer = document.getElementById('ycs-timestamp-interval-results');
        if (resultsContainer) {
            resultsContainer.appendChild(button);
        } else {
            // Fallback: append to main container
            container.appendChild(button);
        }
    }
}

/**
 * Hide floating back button
 */
export function hideFloatingButton(container: HTMLElement): void {
    // Look for button in results container first
    const resultsContainer = document.getElementById('ycs-timestamp-interval-results');
    const button =
        resultsContainer?.querySelector('.ycs-floating-back-button') ||
        container.querySelector('.ycs-floating-back-button');
    if (button) {
        button.remove();
    }
}
