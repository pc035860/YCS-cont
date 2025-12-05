/**
 * Live Chat Recorder Module
 *
 * Handles live chat recording functionality including:
 * - Start/stop recording
 * - Polling and saving chat messages
 * - Recovery from connection issues
 * - UI state management (timer, warning indicators)
 */

import { extractChannelId, getVideoId } from '../../utils/common';
import { formatRecordingDuration } from '../../utils/formatting';
import {
    pollLiveChat,
    checkIsLiveStream,
    getLiveBroadcastStartTime,
    type LiveChatPollResult
} from '../../utils/innertube';
import type { CommentItem, ChatItem, TranscriptData } from '../../utils/interfaces/i_types';
import { iconReload } from '../../utils/icons';
import { buildCacheMeta } from '../helpers/cacheHelpers';
import { saveToCache, updateBadge } from '../services/cacheService';
import type {
    WebResourcesState,
    getLiveRecording as GetLiveRecordingFn,
    setLiveRecording as SetLiveRecordingFn,
    resetLiveRecording as ResetLiveRecordingFn,
    getCommentsChat as GetCommentsChatFn,
    getComments as GetCommentsFn,
    getCommentsTrVideo as GetCommentsTrVideoFn,
    getController as GetControllerFn,
    getCounts as GetCountsFn,
    setCount as SetCountFn,
    clearCommentsChat as ClearCommentsChatFn,
    setChatSource as SetChatSourceFn,
    resetController as ResetControllerFn
} from '../state';

// ============================================
// Constants
// ============================================

export const RECORDING_POLL_INTERVAL = 5000; // 5 seconds
export const RECORDING_TIMER_INTERVAL = 1000; // 1 second

// Recovery thresholds (prevents silent failures after token expiration)
const MAX_CONSECUTIVE_FAILURES = 3; // Trigger recovery after 3 consecutive failures
const MAX_RECOVERY_ATTEMPTS = 2; // Give up after 2 recovery attempts
const RECOVERY_BACKOFF_MS = 5000; // Wait 5s before retry during recovery
const CACHE_SAVE_INTERVAL_MS = 60000; // 1 minute - throttled cache save

const DEBUG = false;

// ============================================
// Dependency Injection Interfaces
// ============================================

/**
 * State operation functions injected from appController
 */
export interface LiveChatRecorderStateDeps {
    getState: () => WebResourcesState;
    setState: (state: WebResourcesState) => void;
    getLiveRecording: typeof GetLiveRecordingFn;
    setLiveRecording: typeof SetLiveRecordingFn;
    resetLiveRecording: typeof ResetLiveRecordingFn;
    getCommentsChat: typeof GetCommentsChatFn;
    getComments: typeof GetCommentsFn;
    getCommentsTrVideo: typeof GetCommentsTrVideoFn;
    getController: typeof GetControllerFn;
    getCounts: typeof GetCountsFn;
    setCount: typeof SetCountFn;
    clearCommentsChat: typeof ClearCommentsChatFn;
    setChatSource: typeof SetChatSourceFn;
    resetController: typeof ResetControllerFn;
}

/**
 * DOM element references for recording UI
 */
export interface LiveChatRecorderElements {
    elRecordChat: HTMLButtonElement | null;
    elRecordTimer: HTMLElement | null;
}

/**
 * Callback functions for UI updates
 */
export interface LiveChatRecorderCallbacks {
    updateTitleCount: (count: number) => void;
}

/**
 * Combined dependencies for LiveChatRecorder
 */
export interface LiveChatRecorderDeps {
    state: LiveChatRecorderStateDeps;
    elements: LiveChatRecorderElements;
    callbacks: LiveChatRecorderCallbacks;
}

// ============================================
// UI Helper Functions (No State Dependencies)
// ============================================

/**
 * Show a toast notification that requires manual dismissal
 * Used for important messages that need to persist until user acknowledges
 */
export function showToast(message: string): void {
    // Remove existing toast if any
    const existingToast = document.getElementById('ycs-toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'ycs-toast';
    toast.className = 'ycs-toast ycs-toast-warning';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    // Create message text
    const messageSpan = document.createElement('span');
    messageSpan.className = 'ycs-toast-message';
    messageSpan.textContent = message;

    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ycs-toast-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', () => {
        toast.classList.remove('ycs-toast-show');
        setTimeout(() => toast.remove(), 300); // Wait for fade-out animation
    });

    toast.appendChild(messageSpan);
    toast.appendChild(closeBtn);

    // Insert into body (not YCS container, so it persists across UI changes)
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('ycs-toast-show');
    });
}

/**
 * Update recording warning UI state
 * Shows/hides warning when recording encounters connection issues
 */
export function updateRecordingWarningUI(show: boolean, message?: string): void {
    const elRecordChat = document.getElementById('ycs-record-chat') as HTMLButtonElement | null;
    const elRecordTimer = document.getElementById('ycs-record-timer');

    if (show) {
        // Add warning class (orange pulsing instead of red)
        elRecordChat?.classList.add('ycs-recording-warning');

        // Update timer text to show warning message
        if (elRecordTimer && message) {
            elRecordTimer.setAttribute('data-original-text', elRecordTimer.textContent || '');
            elRecordTimer.textContent = message;
            elRecordTimer.classList.add('ycs-warning-text');
        }
    } else {
        // Remove warning class
        elRecordChat?.classList.remove('ycs-recording-warning');

        // Restore timer text
        if (elRecordTimer) {
            const originalText = elRecordTimer.getAttribute('data-original-text');
            if (originalText) {
                elRecordTimer.textContent = originalText;
                elRecordTimer.removeAttribute('data-original-text');
            }
            elRecordTimer.classList.remove('ycs-warning-text');
        }
    }
}

// ============================================
// LiveChatRecorder Class
// ============================================

/**
 * LiveChatRecorder manages all live chat recording functionality
 * Uses dependency injection for state management and UI callbacks
 */
export class LiveChatRecorder {
    private deps: LiveChatRecorderDeps;

    constructor(deps: LiveChatRecorderDeps) {
        this.deps = deps;
    }

    // ----------------------------------------
    // Private Helpers
    // ----------------------------------------

    private get state(): WebResourcesState {
        return this.deps.state.getState();
    }

    private set state(newState: WebResourcesState) {
        this.deps.state.setState(newState);
    }

    private get elements(): LiveChatRecorderElements {
        return this.deps.elements;
    }

    /**
     * Update recording timer display
     */
    private updateRecordingTimer(): void {
        const liveRecording = this.deps.state.getLiveRecording(this.state);

        if (liveRecording.recordingStartTime && this.elements.elRecordTimer) {
            const duration = formatRecordingDuration(liveRecording.recordingStartTime);
            this.elements.elRecordTimer.textContent = duration;
        }
    }

    /**
     * Build cache data object for saving
     */
    private buildCacheData(
        videoId: string,
        commentsChat: Map<number, ChatItem>
    ): {
        videoId: string;
        comments: CommentItem[];
        commentsChat: string;
        commentsTrVideo: TranscriptData | undefined;
        channelId: string | undefined;
        chatSource: 'live-recording';
    } {
        return {
            videoId,
            comments: this.deps.state.getComments(this.state),
            commentsChat: JSON.stringify(Array.from(commentsChat.entries())),
            commentsTrVideo: this.deps.state.getCommentsTrVideo(this.state),
            channelId: extractChannelId(),
            chatSource: 'live-recording'
        };
    }

    // ----------------------------------------
    // Public Methods
    // ----------------------------------------

    /**
     * Stop live chat recording
     */
    async stop(): Promise<void> {
        const liveRecording = this.deps.state.getLiveRecording(this.state);

        // Clear poll timeout (serial pattern uses setTimeout, not setInterval)
        if (liveRecording.pollTimeoutId !== null) {
            clearTimeout(liveRecording.pollTimeoutId);
        }

        // Clear timer interval
        if (liveRecording.timerIntervalId !== null) {
            clearInterval(liveRecording.timerIntervalId);
        }

        // Abort in-flight requests to prevent them from continuing after stop
        this.deps.state.getController(this.state).abort();

        // Update UI - also clear warning states
        if (this.elements.elRecordChat) {
            this.elements.elRecordChat.classList.remove('ycs-recording');
            this.elements.elRecordChat.classList.remove('ycs-recording-warning');
            this.elements.elRecordChat.textContent = 'record';
        }

        if (this.elements.elRecordTimer) {
            this.elements.elRecordTimer.style.display = 'none';
            this.elements.elRecordTimer.classList.remove('ycs-warning-text');
            this.elements.elRecordTimer.removeAttribute('data-original-text');
        }

        // Save final data to cache using the original video context (preserved on start)
        const commentsChat = this.deps.state.getCommentsChat(this.state);
        const startVideoId = liveRecording.startVideoId;
        const cacheMeta = buildCacheMeta({
            url: liveRecording.startUrl ?? undefined,
            title: liveRecording.startTitle ?? undefined
        });

        if (commentsChat.size > 0 && startVideoId) {
            saveToCache(this.buildCacheData(startVideoId, commentsChat), cacheMeta);
        }

        // Update badge
        const counts = this.deps.state.getCounts(this.state);
        const totalCount = counts.comments + counts.commentsChat + counts.commentsTrVideo;
        updateBadge('NUMBER_COMMENTS', totalCount);
        this.deps.callbacks.updateTitleCount(totalCount);

        // Reset recording state
        this.state = this.deps.state.resetLiveRecording(this.state);

        // Create new AbortController for future operations
        this.state = this.deps.state.resetController(this.state);

        console.log('[YCS] Live chat recording stopped. Total messages:', commentsChat.size);
    }

    /**
     * Poll and save chat messages with recovery logic
     * Handles token expiration and network errors gracefully
     */
    async pollAndSave(startVideoId: string | null): Promise<void> {
        // Verify still on the same video page (stop if left video page or navigated to different video)
        const currentVideoId = getVideoId(window.location.href);
        if (!currentVideoId || currentVideoId !== startVideoId) {
            console.log('[YCS] Left video page during recording, stopping...');
            await this.stop();
            return;
        }

        const controller = this.deps.state.getController(this.state);
        const commentsChat = this.deps.state.getCommentsChat(this.state);
        const liveRecording = this.deps.state.getLiveRecording(this.state);

        try {
            // Determine if we should force token refresh (recovery mode)
            const shouldForceRefresh = liveRecording.isInRecoveryMode;

            const pollResult: LiveChatPollResult = await pollLiveChat(
                controller.signal,
                commentsChat,
                (newCount, totalCount) => {
                    // Update counter display
                    const elLoadChat = document.getElementById('ycs_cmnts_chat');
                    if (elLoadChat) {
                        elLoadChat.textContent = totalCount.toString();
                    }

                    // Update state count
                    this.state = this.deps.state.setCount(this.state, 'commentsChat', totalCount);

                    if (DEBUG && newCount > 0) {
                        console.log(`[YCS] Recording: +${newCount} new messages, total: ${totalCount}`);
                    }
                },
                liveRecording.broadcastStartTime ?? undefined,
                liveRecording.lastContinuation ?? undefined,
                shouldForceRefresh
            );

            // Handle poll result based on success status
            if (pollResult.success) {
                // Success: reset failure tracking and update continuation
                this.state = this.deps.state.setLiveRecording(this.state, {
                    lastContinuation: pollResult.continuation,
                    consecutiveFailures: 0,
                    lastSuccessTime: Date.now(),
                    isInRecoveryMode: false,
                    recoveryAttempts: 0
                });

                // Clear warning UI if previously shown
                updateRecordingWarningUI(false);
            } else {
                // Failure: increment counter and potentially trigger recovery
                const newFailureCount = liveRecording.consecutiveFailures + 1;
                console.warn(
                    `[YCS] Poll failed (${newFailureCount}/${MAX_CONSECUTIVE_FAILURES}):`,
                    pollResult.errorType,
                    pollResult.httpStatus
                );

                if (newFailureCount >= MAX_CONSECUTIVE_FAILURES) {
                    // Check if we've exceeded max recovery attempts
                    const newRecoveryAttempts = liveRecording.recoveryAttempts + 1;

                    if (newRecoveryAttempts > MAX_RECOVERY_ATTEMPTS) {
                        console.error('[YCS] Max recovery attempts reached - stopping recording');
                        showToast('Recording stopped: Unable to reconnect. Data has been saved.');

                        // Final save before stopping (update lastSaveTime to prevent duplicate saves)
                        if (commentsChat.size > 0 && startVideoId) {
                            const cacheMeta = buildCacheMeta({
                                url: liveRecording.startUrl ?? undefined,
                                title: liveRecording.startTitle ?? undefined
                            });
                            saveToCache(this.buildCacheData(startVideoId, commentsChat), cacheMeta);
                            this.state = this.deps.state.setLiveRecording(this.state, { lastSaveTime: Date.now() });
                            console.log('[YCS] Final cache save before stop:', commentsChat.size, 'messages');
                        }

                        await this.stop();
                        return;
                    }

                    // Enter recovery mode
                    console.log(
                        `[YCS] Entering recovery mode (attempt ${newRecoveryAttempts}/${MAX_RECOVERY_ATTEMPTS})`
                    );
                    this.state = this.deps.state.setLiveRecording(this.state, {
                        consecutiveFailures: 0,
                        isInRecoveryMode: true,
                        recoveryAttempts: newRecoveryAttempts
                    });

                    // Show warning to user
                    updateRecordingWarningUI(true, 'Reconnecting...');

                    // Add backoff delay before next retry
                    await new Promise((resolve) => setTimeout(resolve, RECOVERY_BACKOFF_MS));
                } else {
                    // Just increment failure count, not yet in recovery
                    this.state = this.deps.state.setLiveRecording(this.state, {
                        consecutiveFailures: newFailureCount
                    });
                }
            }

            // Check abort to stop processing
            if (controller.signal.aborted) {
                if (DEBUG) {
                    console.log('[YCS] pollAndSaveChat aborted');
                }
                return;
            }

            // Auto-stop when live stream ends (detected by isLiveEnded flag)
            if (pollResult.isLiveEnded) {
                console.log('[YCS] Live stream ended, auto-stopping recording...');
                await this.stop();
                return;
            }

            // Throttled cache save: every 1 minute instead of every poll
            // This reduces memory pressure from frequent JSON.stringify + postMessage structured clone
            const lastSaveTime = liveRecording.lastSaveTime ?? 0;
            const now = Date.now();

            if (commentsChat.size > 0 && startVideoId && now - lastSaveTime >= CACHE_SAVE_INTERVAL_MS) {
                const cacheMeta = buildCacheMeta({
                    url: liveRecording.startUrl ?? undefined,
                    title: liveRecording.startTitle ?? undefined
                });

                saveToCache(this.buildCacheData(startVideoId, commentsChat), cacheMeta);
                this.state = this.deps.state.setLiveRecording(this.state, { lastSaveTime: now });
                console.log('[YCS] Periodic cache save:', commentsChat.size, 'messages');
            }
        } catch (e) {
            // Unexpected error - apply same recovery logic as poll failures
            console.error('[YCS] pollAndSaveChat unexpected error:', e);

            const newFailureCount = liveRecording.consecutiveFailures + 1;

            if (newFailureCount >= MAX_CONSECUTIVE_FAILURES) {
                const newRecoveryAttempts = liveRecording.recoveryAttempts + 1;

                if (newRecoveryAttempts > MAX_RECOVERY_ATTEMPTS) {
                    console.error('[YCS] Max recovery attempts reached (catch) - stopping recording');
                    showToast('Recording stopped: Unable to reconnect. Data has been saved.');

                    // Final save before stopping (update lastSaveTime to prevent duplicate saves)
                    const commentsChat = this.deps.state.getCommentsChat(this.state);
                    if (commentsChat.size > 0 && startVideoId) {
                        const cacheMeta = buildCacheMeta({
                            url: liveRecording.startUrl ?? undefined,
                            title: liveRecording.startTitle ?? undefined
                        });
                        saveToCache(this.buildCacheData(startVideoId, commentsChat), cacheMeta);
                        this.state = this.deps.state.setLiveRecording(this.state, { lastSaveTime: Date.now() });
                        console.log('[YCS] Final cache save before stop (catch):', commentsChat.size, 'messages');
                    }

                    await this.stop();
                    return;
                }

                // Enter recovery mode
                console.log(
                    `[YCS] Entering recovery mode from catch (attempt ${newRecoveryAttempts}/${MAX_RECOVERY_ATTEMPTS})`
                );
                this.state = this.deps.state.setLiveRecording(this.state, {
                    consecutiveFailures: 0,
                    isInRecoveryMode: true,
                    recoveryAttempts: newRecoveryAttempts
                });

                updateRecordingWarningUI(true, 'Reconnecting...');
                await new Promise((resolve) => setTimeout(resolve, RECOVERY_BACKOFF_MS));
            } else {
                this.state = this.deps.state.setLiveRecording(this.state, {
                    consecutiveFailures: newFailureCount
                });
            }
        }
    }

    /**
     * Schedule next poll using setTimeout (serial pattern)
     * Prevents request stacking when polls take longer than interval
     */
    async scheduleNextPoll(startVideoId: string): Promise<void> {
        const liveRecording = this.deps.state.getLiveRecording(this.state);

        // Check if still recording before polling
        if (!liveRecording.isRecording) {
            return;
        }

        // Execute poll
        await this.pollAndSave(startVideoId);

        // Re-check after poll (recording may have stopped during poll)
        const currentRecording = this.deps.state.getLiveRecording(this.state);
        if (!currentRecording.isRecording) {
            return;
        }

        // Schedule next poll
        const timeoutId = setTimeout(() => {
            this.scheduleNextPoll(startVideoId);
        }, RECORDING_POLL_INTERVAL);

        // Update timeout ID in state
        this.state = this.deps.state.setLiveRecording(this.state, { pollTimeoutId: timeoutId });
    }

    /**
     * Start live chat recording
     */
    async start(): Promise<void> {
        const { elRecordChat, elRecordTimer } = this.elements;

        if (!elRecordChat) return;

        const startVideoId = getVideoId(window.location.href);
        if (!startVideoId) {
            console.warn('[YCS] Cannot start recording: no video ID');
            return;
        }

        // Disable button during initialization
        elRecordChat.disabled = true;
        elRecordChat.textContent = 'loading...';

        try {
            // Check if we have cached chat data to resume recording
            const existingCommentsChat = this.deps.state.getCommentsChat(this.state);
            const hasCachedData = existingCommentsChat.size > 0;

            if (hasCachedData) {
                console.log('[YCS] Resuming recording with existing data:', existingCommentsChat.size, 'messages');
            } else {
                // Clear chat data only if no cached data exists
                this.state = this.deps.state.clearCommentsChat(this.state);
                console.log('[YCS] Starting new recording session');
            }

            // Mark chat source as live-recording
            this.state = this.deps.state.setChatSource(this.state, 'live-recording');

            // Get broadcast start time
            const controller = this.deps.state.getController(this.state);
            const broadcastStartTime = await getLiveBroadcastStartTime(controller.signal);

            if (!broadcastStartTime) {
                console.warn('[YCS] Could not get broadcast start time, relative timestamps will be unavailable');
            }

            // Update UI (but keep button disabled until isRecording is set)
            elRecordChat.classList.add('ycs-recording');
            elRecordChat.textContent = 'stop';

            if (elRecordTimer) {
                elRecordTimer.style.display = 'inline';
                elRecordTimer.textContent = '00:00:00';
            }

            // Update status icon
            const elStatusChat = document.getElementById('ycs_status_chat');
            const elLoadChat = document.getElementById('ycs_cmnts_chat');
            if (elStatusChat) {
                elStatusChat.innerHTML = iconReload();
            }
            if (elLoadChat) {
                // Show current count if resuming, otherwise 0
                elLoadChat.textContent = hasCachedData ? existingCommentsChat.size.toString() : '0';
            }

            const recordingStartTime = Date.now();

            // Start timer interval (pure UI update, doesn't need serial pattern)
            const timerIntervalId = setInterval(() => {
                this.updateRecordingTimer();
            }, RECORDING_TIMER_INTERVAL);

            // Update state (pollTimeoutId starts as null, updated by scheduleNextPoll)
            this.state = this.deps.state.setLiveRecording(this.state, {
                isRecording: true,
                pollTimeoutId: null,
                timerIntervalId,
                broadcastStartTime,
                recordingStartTime,
                startUrl: window.location.href,
                startTitle: document.title,
                startVideoId,
                lastContinuation: null,
                lastSaveTime: null
            });

            // Re-enable button AFTER isRecording is set to prevent double-click race condition
            elRecordChat.disabled = false;

            console.log('[YCS] Live chat recording started. Broadcast start time:', broadcastStartTime);

            // Start serial polling (first poll runs immediately, then schedules next)
            this.scheduleNextPoll(startVideoId);
        } catch (e) {
            console.error('[YCS] startLiveChatRecording error:', e);
            // Restore button and UI state on error
            elRecordChat.disabled = false;
            elRecordChat.textContent = 'record';
            elRecordChat.classList.remove('ycs-recording');
            if (elRecordTimer) {
                elRecordTimer.style.display = 'none';
            }
        }
    }

    /**
     * Check if current video is live and show/hide record button
     * Load and record buttons are mutually exclusive
     */
    async updateButtonVisibility(): Promise<void> {
        const { elRecordChat } = this.elements;

        if (!elRecordChat) return;

        const elLoadChat = document.getElementById('ycs-load-chat');
        if (!elLoadChat) return;

        try {
            const controller = this.deps.state.getController(this.state);
            const isLive = await checkIsLiveStream(controller.signal);

            if (isLive) {
                // Show record button, hide load button (mutually exclusive)
                elRecordChat.style.display = 'inline-block';
                elLoadChat.style.display = 'none';
                console.log('[YCS] Live stream detected, showing Record button');
            } else {
                // Show load button, hide record button (mutually exclusive)
                elRecordChat.style.display = 'none';
                elLoadChat.style.display = 'inline-block';
                console.log('[YCS] Not a live stream, showing Load button');
            }
        } catch (e) {
            console.error('[YCS] updateRecordButtonVisibility error:', e);
            // Default to load button on error
            elRecordChat.style.display = 'none';
            elLoadChat.style.display = 'inline-block';
        }
    }

    /**
     * Toggle recording state (start or stop)
     */
    async toggle(): Promise<void> {
        const liveRecording = this.deps.state.getLiveRecording(this.state);

        if (liveRecording.isRecording) {
            await this.stop();
        } else {
            await this.start();
        }
    }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create and initialize a LiveChatRecorder instance
 * Sets up click handler and checks live stream status
 */
export function createLiveChatRecorder(deps: LiveChatRecorderDeps): LiveChatRecorder {
    const recorder = new LiveChatRecorder(deps);

    // Set up click handler
    if (deps.elements.elRecordChat) {
        deps.elements.elRecordChat.addEventListener('click', async () => {
            await recorder.toggle();
        });
    }

    // Auto-check live stream on page load
    recorder.updateButtonVisibility();

    return recorder;
}
