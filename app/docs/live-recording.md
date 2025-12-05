# Live Chat Recording

This document describes the live chat recording feature for YouTube live streams, including the polling mechanism, error recovery, and token refresh strategies.

## Overview

The live recording feature allows users to capture chat messages during ongoing YouTube live broadcasts. It uses a serial polling pattern with continuation token reuse and implements robust error recovery to handle token expiration and connection issues.

### Key Components

| File | Purpose |
|------|---------|
| `web-resources/appController.ts` | Recording control, state management, recovery logic |
| `web-resources/state.ts` | `LiveRecordingState` interface and state functions |
| `utils/innertube/chat.ts` | `pollLiveChat()`, `checkIsLiveStream()`, `getLiveBroadcastStartTime()` |
| `utils/libs.ts` | HTTP retry configuration with exponential backoff |
| `content-scripts/style.css` | Recording UI styles (button, timer, warning states) |

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                        User Interface                         │
├───────────────────────────────────────────────────────────────┤
│  Record Button (#ycs-record-chat)                             │
│  ├─ Normal: Green background, "record" text                   │
│  ├─ Recording: Red pulse animation, "stop" text               │
│  └─ Warning: Orange pulse animation (connection issues)       │
│                                                               │
│  Timer Display (#ycs-record-timer)                            │
│  ├─ Normal: HH:MM:SS elapsed time                             │
│  └─ Warning: "Reconnecting..." message                        │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                       State Management                        │
├───────────────────────────────────────────────────────────────┤
│  LiveRecordingState (state.ts:13-29)                          │
│  ├─ isRecording: boolean                                      │
│  ├─ pollTimeoutId: setTimeout handle (serial pattern)         │
│  ├─ timerIntervalId: setInterval handle (1s updates)          │
│  ├─ broadcastStartTime: ISO timestamp from YouTube            │
│  ├─ recordingStartTime: Local timestamp                       │
│  ├─ startUrl, startTitle, startVideoId: Navigation preserved  │
│  ├─ lastContinuation: Token for next poll                     │
│  ├─ lastSaveTime: Throttled cache save tracking               │
│  └─ Error Tracking:                                           │
│     ├─ consecutiveFailures: number                            │
│     ├─ lastSuccessTime: number | null                         │
│     ├─ isInRecoveryMode: boolean                              │
│     └─ recoveryAttempts: number                               │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                        Polling Loop                           │
├───────────────────────────────────────────────────────────────┤
│  scheduleNextPoll() (appController.ts:1763-1787)              │
│  ├─ Check isRecording before polling                          │
│  ├─ Execute pollAndSaveChat()                                 │
│  ├─ Re-check isRecording after poll                           │
│  └─ Schedule next poll with setTimeout (5s interval)          │
│                                                               │
│  pollAndSaveChat() (appController.ts:1544-1757)               │
│  ├─ Verify still on same video page                           │
│  ├─ Call pollLiveChat() with recovery flag                    │
│  ├─ Handle success/failure with recovery logic                │
│  ├─ Auto-stop on stream end                                   │
│  └─ Throttled cache save (every 60s)                          │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                      YouTube API Layer                        │
├───────────────────────────────────────────────────────────────┤
│  pollLiveChat() (chat.ts:588-689)                             │
│  ├─ Token refresh from ytInitialData if forced                │
│  ├─ Fetch via getLiveChat()                                   │
│  ├─ Detect token expiration (HTTP 400/403)                    │
│  └─ Return LiveChatPollResult with status                     │
└───────────────────────────────────────────────────────────────┘
```

## Configuration Constants

Defined in `appController.ts:117-119, 1374, 1677`:

```typescript
const MAX_CONSECUTIVE_FAILURES = 3;   // Trigger recovery after 3 failures
const MAX_RECOVERY_ATTEMPTS = 2;      // Give up after 2 recovery attempts
const RECOVERY_BACKOFF_MS = 5000;     // Wait 5s before retry during recovery
const RECORDING_POLL_INTERVAL = 5000; // 5 seconds between polls
const CACHE_SAVE_INTERVAL_MS = 60000; // 60 seconds between cache saves
```

## Recording Flow

### Starting Recording

`startLiveChatRecording()` at `appController.ts:1792`:

1. Validate video ID exists
2. Check for cached data (resume support)
3. Set chat source to `'live-recording'`
4. Fetch broadcast start time from `playerResponse`
5. Update UI (button styling, timer visibility)
6. Initialize timer interval (1s updates)
7. Set initial recording state
8. Call `scheduleNextPoll()` to start polling loop

### Stopping Recording

`stopLiveChatRecording()` at `appController.ts:1383-1447`:

1. Clear poll timeout and timer interval
2. Abort in-flight requests via `AbortController`
3. Remove warning UI classes
4. Save final chat data to IndexedDB cache
5. Reset recording state completely
6. Create new `AbortController` for future operations

### Serial Polling Pattern

The polling loop uses `setTimeout` recursion instead of `setInterval` to prevent request stacking when polls take longer than the interval.

`scheduleNextPoll()` at `appController.ts:1763-1787`:

```
┌───────────────────────────────────────┐
│ Check isRecording                     │
│ (exit if false)                       │
└─────────────────┬─────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ Execute pollAndSaveChat()             │
│ (may take varying time)               │
└─────────────────┬─────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ Re-check isRecording                  │
│ (exit if false - stopped during poll) │
└─────────────────┬─────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ Schedule next poll with setTimeout    │
│ (5 second delay)                      │
└─────────────────┬─────────────────────┘
                  │
                  └──────► (repeat)
```

## Two-Tier Retry Strategy

The live recording feature uses a layered retry strategy:

### Tier 1: HTTP-Level Retries (fetch-retry)

Configured in `libs.ts:6-30`:

| Attempt Range | Delay |
|---------------|-------|
| 1-20 | 2 seconds |
| 21-50 | 10 seconds |
| 51-100 | 60 seconds |

```typescript
retries: 100,
retryDelay: (attempt) => {
    if (attempt > 50) return 1000 * 60;      // 60s
    else if (attempt > 20) return 1000 * 10; // 10s
    else return 1000 * 2;                     // 2s
},
retryOn: (attempt, error, response) => {
    if (error?.name === 'AbortError') return false;
    // Retry on network errors or 4xx/5xx status codes
    if (error !== null || (response !== null && response.status >= 400)) {
        if (attempt > 100) return false;
        return true;
    }
    return false;
}
```

### Tier 2: Application-Level Recovery (Token Refresh)

Handles token expiration and connection issues at the application level.

**Error Types** (defined in `chat.ts:15-37`):

```typescript
interface LiveChatFetchResult {
    data?: any;
    success: boolean;
    httpStatus: number;
    errorType?: 'http_error' | 'parse_error' | 'network_error';
}

interface LiveChatPollResult {
    continuation: unknown;
    isLiveEnded: boolean;
    success: boolean;
    errorType?: 'http_error' | 'token_stale' | 'network_error' | 'parse_error';
    httpStatus?: number;
}
```

**Token Expiration Detection** (`chat.ts:622-631`):

HTTP 400 or 403 responses typically indicate stale continuation tokens:

```typescript
const isTokenError = fetchResult.httpStatus === 400 || fetchResult.httpStatus === 403;
if (isTokenError) {
    return { errorType: 'token_stale', ... };
}
```

## Recovery Mode Flow

Implemented in `pollAndSaveChat()` at `appController.ts:1544-1757`:

```
┌───────────────────────────────────────────────────────────────┐
│                        Poll Execution                         │
└─────────────────────────────┬─────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│           SUCCESS             │   │           FAILURE             │
├───────────────────────────────┤   ├───────────────────────────────┤
│ • Reset consecutiveFailures=0 │   │ • Increment failure counter   │
│ • Update lastContinuation     │   │ • Check threshold (3 failures)│
│ • Set isInRecoveryMode=false  │   └───────────────┬───────────────┘
│ • Reset recoveryAttempts=0    │                   │
│ • Clear warning UI            │   ┌───────────────┴───────────────┐
└───────────────────────────────┘   │                               │
                                    ▼                               ▼
                      ┌───────────────────────┐   ┌───────────────────────────┐
                      │     < 3 failures      │   │      >= 3 failures        │
                      ├───────────────────────┤   │    (Trigger Recovery)     │
                      │ • Just track count    │   ├───────────────────────────┤
                      │ • Continue polling    │   │ • Check recoveryAttempts  │
                      └───────────────────────┘   └─────────────┬─────────────┘
                                                                │
                                    ┌───────────────────────────┴───────────────┐
                                    │                                           │
                                    ▼                                           ▼
                      ┌───────────────────────────────┐   ┌───────────────────────────────┐
                      │        attempts <= 2          │   │        attempts > 2           │
                      │     (Enter Recovery Mode)     │   │    (Max Attempts Exceeded)    │
                      ├───────────────────────────────┤   ├───────────────────────────────┤
                      │ • Set isInRecoveryMode=true   │   │ • Show toast notification     │
                      │ • Increment recoveryAttempts  │   │ • Final cache save            │
                      │ • Reset consecutiveFailures   │   │ • Auto-stop recording         │
                      │ • Show "Reconnecting..." UI   │   └───────────────────────────────┘
                      │ • Wait 5s backoff             │
                      │ • Force token refresh         │
                      └───────────────────────────────┘
```

### Token Refresh Process

`pollLiveChat()` at `chat.ts:599-617`:

```typescript
if (forceTokenRefresh || !existingContinuation) {
    console.log('[YCS] pollLiveChat: Forcing token refresh from ytInitialData');
    const result = await getCDChat(signal);  // Re-fetch from page data

    if (!result.continuationData) {
        return { errorType: 'token_stale', success: false };
    }
    continuationData = result.continuationData;
}
```

## UI Warning States

### Button States

Defined in `style.css:1519-1529`:

| State | Background Color | Animation |
|-------|-----------------|-----------|
| Normal | Default | None |
| Recording | Red (#c00) | Slow pulse (2s) |
| Warning | Orange (#f39c12) | Fast pulse (0.8s) |

### Warning UI Functions

`updateRecordingWarningUI()` at `appController.ts:1510-1538`:

- Adds/removes `ycs-recording-warning` class on button
- Swaps timer text with "Reconnecting..." message
- Adds `ycs-warning-text` class for orange timer color

`showToast()` at `appController.ts:1465-1504`:

- Creates persistent toast notification
- Message: "Recording stopped: Unable to reconnect. Data has been saved."
- Requires manual dismissal (close button)

## Auto-Stop Conditions

Recording automatically stops when:

1. **Live stream ends**: Detected via `isLiveEnded` flag in `LiveChatPollResult`
2. **User navigates away**: Video ID changes during polling
3. **Max recovery attempts exceeded**: After 2 failed recovery attempts
4. **User clicks stop button**: Manual termination

### Stream End Detection

Stream end is detected in `pollLiveChat()` using continuation type analysis:

- `checkIfLiveEnded()` helper function at `chat.ts:569-579`
- Called within `pollLiveChat()` at `chat.ts:666-675`

```typescript
// Stream ended when no invalidationContinuationData present
const hasInvalidation = continuations?.some(c => c.invalidationContinuationData);
const isLiveEnded = !hasInvalidation;
```

## Data Persistence

### Throttled Cache Saves

To reduce memory pressure from frequent `JSON.stringify` and structured cloning, cache saves are throttled to every 60 seconds (`appController.ts:1675-1700`).

### Critical Save Points

1. **Periodic saves**: Every 60 seconds during normal recording
2. **Before recovery auto-stop**: Final save with all accumulated messages
3. **On catch error auto-stop**: Final cache save before stopping
4. **On manual stop**: Preserves all recorded chat

### Cache Data Structure

```typescript
saveToCache({
    videoId: startVideoId,
    comments: getComments(state),
    commentsChat: JSON.stringify(Array.from(commentsChat.entries())),
    commentsTrVideo: getCommentsTrVideo(state),
    channelId: extractChannelId(),
    chatSource: 'live-recording'
}, cacheMeta);
```

## Resume Support

When starting a recording, the system checks for existing cached data:

```typescript
const existingCommentsChat = getCommentsChat(state);
const hasCachedData = existingCommentsChat.size > 0;

if (hasCachedData) {
    console.log('[YCS] Resuming recording with existing data:', existingCommentsChat.size, 'messages');
} else {
    state = clearCommentsChat(state);
    console.log('[YCS] Starting new recording session');
}
```

## Timing Summary

| Event | Interval |
|-------|----------|
| Poll interval | 5 seconds |
| Timer update | 1 second |
| Cache save | 60 seconds |
| Recovery backoff | 5 seconds |
| HTTP retry (attempts 1-20) | 2 seconds |
| HTTP retry (attempts 21-50) | 10 seconds |
| HTTP retry (attempts 51-100) | 60 seconds |

## Related Documentation

- [Innertube Chat API](./innertube-migration-guide.md) - Chat API integration details
- [SAPISID Authorization](./sap-sid-authorization.md) - Authorization header generation
