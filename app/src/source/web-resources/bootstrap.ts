import { isVideoPage, isShortsPage } from '../utils/common';
import { initApp, retryApp, getPageMetaElement } from './appController';

const DEBUG = false;
let hasStarted = false;
let mutationObserver: MutationObserver | null = null;
let isRetryingApp = false;
let lastRetryTime = 0;
let pendingVerificationTimer: number | null = null;

// Shorts support state (module-level for access by throttledRetryApp)
let shortsSupportChecked = false;
let shortsSupportEnabled = true; // Default to true

/**
 * Update Shorts support state from external modules (e.g., appController)
 * This is needed to prevent retry loops when Shorts support is disabled at runtime
 */
export const setShortsSupport = (enabled: boolean): void => {
    shortsSupportChecked = true;
    shortsSupportEnabled = enabled;
};

// Timing constants
const RETRY_THROTTLE_MS = 1000;
const VERIFICATION_DELAY_MS = 300; // Wait for normal re-renders to complete
const RETRY_STATE_RESET_DELAY_MS = 500; // Prevent immediate re-trigger
const POPSTATE_INIT_DELAY_MS = 100; // Wait for YouTube SPA DOM update after popstate
const POLLING_INTERVAL_MS = 2000; // Fallback polling interval (reduced since MutationObserver handles most cases)

/**
 * Throttled version of retryApp with state protection
 * Prevents multiple simultaneous retries and rate-limits execution
 */
const throttledRetryApp = (): void => {
    const now = Date.now();

    // Skip retry if Shorts support is disabled on Shorts pages
    if (isShortsPage() && shortsSupportChecked && !shortsSupportEnabled) {
        if (DEBUG) {
            console.log('YCS: throttledRetryApp skipped - Shorts support disabled');
        }
        return;
    }

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
    }, RETRY_STATE_RESET_DELAY_MS);
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

    // Clean up pending verification timer to prevent orphaned timers
    if (pendingVerificationTimer !== null) {
        clearTimeout(pendingVerificationTimer);
        pendingVerificationTimer = null;
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
                        }, VERIFICATION_DELAY_MS); // Wait for normal re-renders to complete

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

    const checkShortsSupport = (): Promise<boolean> => {
        return new Promise((resolve) => {
            if (!isShortsPage()) {
                resolve(true);
                return;
            }

            if (shortsSupportChecked) {
                resolve(shortsSupportEnabled);
                return;
            }

            // Send GET_OPTIONS message and wait for response
            const timeout = setTimeout(() => {
                // Timeout: default to enabled
                shortsSupportChecked = true;
                shortsSupportEnabled = true;
                resolve(true);
            }, 1000);

            const messageHandler = (e: MessageEvent): void => {
                if (e.origin !== window.location.origin) return;
                if (e.data?.type !== 'YCS_OPTIONS' || !e.data?.text) return;

                window.removeEventListener('message', messageHandler);
                clearTimeout(timeout);

                const opts = e.data.text as { enableShortsSupport?: boolean };
                shortsSupportChecked = true;
                shortsSupportEnabled = opts.enableShortsSupport !== false; // Default to true if undefined
                resolve(shortsSupportEnabled);
            };

            window.addEventListener('message', messageHandler);
            window.postMessage({ type: 'GET_OPTIONS' }, window.location.origin);
        });
    };

    const ensureAppInitialized = async (source: string): Promise<void> => {
        if (!isVideoPage() || !getPageMetaElement()) {
            return;
        }

        // Check enableShortsSupport for Shorts pages
        if (isShortsPage()) {
            const enabled = await checkShortsSupport();
            if (!enabled) {
                console.log('YCS: YouTube Shorts support is disabled, skipping initialization');
                return;
            }
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
            console.log('document.querySelector(#meta.style-scope.ytd-watch-flexy): ', getPageMetaElement());
        }

        // Reset shorts support check on navigation
        shortsSupportChecked = false;
        shortsSupportEnabled = true;

        ensureAppInitialized('yt-navigate-finish');
    };

    const handlePopState = (): void => {
        if (DEBUG) {
            console.log('YCS: popstate detected');
            console.log('isInitAppCalled: ', isInitAppCalled);
            console.log('isVideoPage: ', isVideoPage());
            console.log('document.querySelector(#meta.style-scope.ytd-watch-flexy): ', getPageMetaElement());
        }

        // Reset shorts support check on navigation
        shortsSupportChecked = false;
        shortsSupportEnabled = true;

        setTimeout(() => {
            ensureAppInitialized('popstate');
        }, POPSTATE_INIT_DELAY_MS);
    };

    window.addEventListener('yt-navigate-finish', handleNavigateFinish);
    window.addEventListener('popstate', handlePopState);

    // Start DOM observer to detect .ycs-app removal
    setupDOMObserver();

    // Polling fallback mechanism (runs continuously at lower frequency)
    // No need to store interval ID - runs for entire extension lifecycle
    setInterval(() => {
        if (!isVideoPage() || !getPageMetaElement()) {
            return;
        }

        if (!document.querySelector('.ycs-app')) {
            if (!isInitAppCalled) {
                // Check enableShortsSupport for Shorts pages before initializing
                if (isShortsPage()) {
                    checkShortsSupport().then((enabled) => {
                        if (!enabled) {
                            console.log('YCS: YouTube Shorts support is disabled, skipping initialization');
                            return;
                        }
                        console.log('YCS: Initializing app via polling fallback');
                        isInitAppCalled = true;
                        initApp();
                        // Re-setup observer after first successful initialization
                        setupDOMObserver();
                    });
                } else {
                    console.log('YCS: Initializing app via polling fallback');
                    isInitAppCalled = true;
                    initApp();
                    // Re-setup observer after first successful initialization
                    setupDOMObserver();
                }
                return;
            }

            // Use throttled retry to prevent excessive retries
            throttledRetryApp();
        }
    }, POLLING_INTERVAL_MS);
}
