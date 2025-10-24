import { isVideoPage } from '../utils/common';
import { initApp, retryApp } from './appController';

const DEBUG = false;
const META_SELECTOR = '#meta.style-scope.ytd-watch-flexy';

let hasStarted = false;
let mutationObserver: MutationObserver | null = null;
let isRetryingApp = false;
let lastRetryTime = 0;
let pendingVerificationTimer: number | null = null;
const RETRY_THROTTLE_MS = 1000;

const metaElementExists = (): Element | null => {
    return document.querySelector(META_SELECTOR);
};

/**
 * Throttled version of retryApp with state protection
 * Prevents multiple simultaneous retries and rate-limits execution
 */
const throttledRetryApp = (): void => {
    const now = Date.now();

    // Throttle check: maximum once per second
    if (now - lastRetryTime < RETRY_THROTTLE_MS) {
        if (DEBUG) {
            console.log('YCS: throttledRetryApp skipped - within throttle window');
        }
        return;
    }

    // State check: prevent concurrent execution
    if (isRetryingApp) {
        if (DEBUG) {
            console.log('YCS: throttledRetryApp skipped - already retrying');
        }
        return;
    }

    // Check if .ycs-app actually disappeared
    if (document.querySelector('.ycs-app')) {
        if (DEBUG) {
            console.log('YCS: throttledRetryApp skipped - UI still exists');
        }
        return;
    }

    isRetryingApp = true;
    lastRetryTime = now;

    const didRetry = retryApp();

    if (DEBUG && didRetry) {
        console.log('YCS: UI recovered via throttled retry');
    }

    // Reset state with delay to avoid immediate re-trigger
    setTimeout(() => {
        isRetryingApp = false;
    }, 500);
};

/**
 * Setup MutationObserver to detect when .ycs-app is removed from DOM
 * This handles cases where YouTube re-renders #meta without URL change
 */
const setupDOMObserver = (): void => {
    // Clean up existing observer
    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
    }

    // Find observation target (priority order)
    const observeTarget =
        document.querySelector('ytd-watch-flexy') || // Top-level container
        document.querySelector('#columns') || // Main content area
        document.querySelector('#primary'); // Fallback container

    if (!observeTarget) {
        if (DEBUG) {
            console.warn('YCS: No suitable DOM observer target found');
        }
        return;
    }

    mutationObserver = new MutationObserver((mutations) => {
        // Check if .ycs-app was removed
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                for (const node of mutation.removedNodes) {
                    if (
                        node instanceof Element &&
                        (node.classList.contains('ycs-app') || node.querySelector('.ycs-app'))
                    ) {
                        if (DEBUG) {
                            console.log('YCS: Detected .ycs-app removal, scheduling verification check');
                        }

                        // Skip if verification timer is already pending
                        if (pendingVerificationTimer !== null) {
                            if (DEBUG) {
                                console.log('YCS: Verification check already scheduled, skipping duplicate');
                            }
                            return;
                        }

                        // Delay check to avoid false positives during normal app() re-rendering
                        // If app() is doing removeNodeList() + renderLoadComments(), the UI will
                        // be restored before this timeout fires
                        pendingVerificationTimer = window.setTimeout(() => {
                            pendingVerificationTimer = null;

                            if (!document.querySelector('.ycs-app')) {
                                if (DEBUG) {
                                    console.log('YCS: Confirmed .ycs-app still missing, triggering recovery');
                                }
                                throttledRetryApp();
                            } else {
                                if (DEBUG) {
                                    console.log('YCS: .ycs-app was restored by normal flow, recovery not needed');
                                }
                            }
                        }, 300); // Wait 300ms to confirm UI is truly missing

                        return;
                    }
                }
            }
        }
    });

    // Start observing
    mutationObserver.observe(observeTarget, {
        childList: true,
        subtree: true
    });

    if (DEBUG) {
        console.log('YCS: DOM observer started on', observeTarget.tagName);
    }
};

export function startWebResources(): void {
    if (hasStarted) {
        return;
    }

    hasStarted = true;

    let isInitAppCalled = false;

    const ensureAppInitialized = (source: string): void => {
        if (!isVideoPage() || !metaElementExists()) {
            return;
        }

        if (!isInitAppCalled) {
            console.log(`YCS: Initializing app via ${source}`);
            isInitAppCalled = true;
            initApp();
            // Setup observer after successful initialization
            // This ensures observer is attached even when initialized via event listeners
            setupDOMObserver();
        }
    };

    const handleNavigateFinish = (): void => {
        if (DEBUG) {
            console.log('YCS: yt-navigate-finish detected');
            console.log('isInitAppCalled: ', isInitAppCalled);
            console.log('isVideoPage: ', isVideoPage());
            console.log('document.querySelector(#meta.style-scope.ytd-watch-flexy): ', metaElementExists());
        }

        ensureAppInitialized('yt-navigate-finish');
    };

    const handlePopState = (): void => {
        if (DEBUG) {
            console.log('YCS: popstate detected');
            console.log('isInitAppCalled: ', isInitAppCalled);
            console.log('isVideoPage: ', isVideoPage());
            console.log('document.querySelector(#meta.style-scope.ytd-watch-flexy): ', metaElementExists());
        }

        setTimeout(() => {
            ensureAppInitialized('popstate');
        }, 100);
    };

    window.addEventListener('yt-navigate-finish', handleNavigateFinish);
    window.addEventListener('popstate', handlePopState);

    // Start DOM observer to detect .ycs-app removal
    setupDOMObserver();

    // Polling fallback mechanism (runs continuously at lower frequency)
    // No need to store interval ID - runs for entire extension lifecycle
    setInterval(() => {
        if (!isVideoPage() || !metaElementExists()) {
            return;
        }

        if (!document.querySelector('.ycs-app')) {
            if (!isInitAppCalled) {
                console.log('YCS: Initializing app via polling fallback');
                isInitAppCalled = true;
                initApp();
                // Re-setup observer after first successful initialization
                setupDOMObserver();
                return;
            }

            // Use throttled retry to prevent excessive retries
            throttledRetryApp();
        }
    }, 2000); // Reduced frequency to 2s since MutationObserver handles most cases
}
