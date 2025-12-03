# YouTube Data API Messaging Architecture

This document describes the messaging architecture introduced to support YouTube Data API v3 integration in the `feat/youtube-data-api-support` branch.

## Overview

The YouTube Data API integration requires a new messaging layer between the web page and background service worker. This is necessary because:

1. **Security**: API keys must be stored securely in the background and never exposed to the web page context
2. **MV3 Constraints**: Web page code cannot directly access `chrome.storage` or make authenticated API requests
3. **Message Size Limits**: Chrome has a ~50-64 MB limit on `chrome.runtime.sendMessage()` payloads, requiring chunked transfer for large comment datasets

## Three-Layer Communication Model

```
YouTube.com Page (Web Resources)
├── appController.ts
│   └── requestYouTubeApiComments()
│   └── window.postMessage() ↕️
│
├── Content Script (cscripts.ts)
│   └── Message relay bridge
│   └── window.addEventListener('message') ↔ chrome.runtime.sendMessage() ↕️
│
└── Background Service Worker (background.ts)
    └── fetchAllCommentsBackground()
    └── YouTube Data API v3 requests
    └── API key storage (chrome.storage.local)
```

## Message Types

### Request Messages (Web Page → Background)

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `YCS_YT_API_COMMENTS_START` | Web → BG | Start fetching comments for a video |
| `YCS_YT_API_COMMENTS_ABORT` | Web → BG | Cancel an in-progress fetch request |

### Response Messages (Background → Web Page)

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `YCS_YT_API_COMMENTS_PROGRESS` | BG → Web | Progress update with current comment count |
| `YCS_YT_API_COMMENTS_CHUNK` | BG → Web | Chunked comment data (handles large payloads) |
| `YCS_YT_API_COMMENTS_COMPLETE` | BG → Web | Backward compatibility for small payloads |
| `YCS_YT_API_COMMENTS_ERROR` | BG → Web | Error response with optional partial results |

## Message Flow

### Normal Flow (Success)

```
Web Page                    Content Script              Background
    |                            |                          |
    |-- START ------------------>|                          |
    |                            |-- START ---------------->|
    |                            |                          |-- API Request
    |                            |                          |<- Response
    |                            |<-- PROGRESS -------------|
    |<-- PROGRESS ---------------|                          |
    |                            |                          |-- More requests...
    |                            |<-- CHUNK (0/3) ---------|
    |<-- CHUNK (0/3) ------------|                          |
    |                            |<-- CHUNK (1/3) ---------|
    |<-- CHUNK (1/3) ------------|                          |
    |                            |<-- CHUNK (2/3, last) ---|
    |<-- CHUNK (2/3, last) ------|                          |
    |                            |                          |
```

### Abort Flow

```
Web Page                    Content Script              Background
    |                            |                          |
    |-- ABORT ------------------>|                          |
    |                            |-- ABORT ---------------->|
    |                            |                          |-- controller.abort()
    |                            |<-- CHUNK (partial) -----|
    |<-- CHUNK (partial) --------|                          |
    |                            |                          |
```

## Message Payloads

### YCS_YT_API_COMMENTS_START

```typescript
{
    type: 'YCS_YT_API_COMMENTS_START',
    body: {
        videoId: string,    // YouTube video ID (11 characters)
        requestId: string   // UUID for tracking this request
    }
}
```

### YCS_YT_API_COMMENTS_ABORT

```typescript
{
    type: 'YCS_YT_API_COMMENTS_ABORT',
    body: {
        requestId: string   // UUID of the request to abort
    }
}
```

### YCS_YT_API_COMMENTS_PROGRESS

```typescript
{
    type: 'YCS_YT_API_COMMENTS_PROGRESS',
    body: {
        requestId: string,
        totalCount: number,  // Current number of comments fetched
        quotaUsed: number    // API quota units consumed
    }
}
```

### YCS_YT_API_COMMENTS_CHUNK

```typescript
{
    type: 'YCS_YT_API_COMMENTS_CHUNK',
    body: {
        requestId: string,
        comments: CommentItem[],  // Chunk of comments (max 20,000 per chunk)
        chunkIndex: number,       // 0-based index
        totalChunks: number,
        isLastChunk: boolean,
        // Only present in last chunk:
        quotaUsed?: number,
        incomplete?: boolean,      // true if some replies failed to fetch
        replyFetchErrors?: number, // Count of failed reply fetches
        // Present if error occurred:
        error?: { type: string, message: string, code?: number },
        isError?: boolean
    }
}
```

### YCS_YT_API_COMMENTS_ERROR

```typescript
{
    type: 'YCS_YT_API_COMMENTS_ERROR',
    body: {
        requestId: string,
        error: {
            type: string,     // 'quotaExceeded' | 'invalidApiKey' | 'unsupported' | 'apiError' | 'aborted' | 'unknown'
            message: string,
            code?: number     // HTTP status code if applicable
        },
        partialComments?: CommentItem[]  // Partial results if available
    }
}
```

## Chunked Transfer Mechanism

Chrome's `chrome.runtime.sendMessage()` has a message size limit of approximately 50-64 MB. For videos with hundreds of thousands of comments, this limit can be exceeded.

### Implementation

**Chunk Size**: 20,000 comments per chunk (defined as `CHUNK_SIZE` in `background.ts:63`)

**Chunking Logic** (`background.ts:68`):

```typescript
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}
```

**Reassembly Logic** (`appController.ts:195`):

```typescript
// Chunk accumulation
const receivedChunks: CommentItem[][] = [];

// On receiving chunk
receivedChunks[chunkIndex] = comments;

if (isLastChunk) {
    const allComments: CommentItem[] = [];
    for (const chunk of receivedChunks) {
        if (chunk) allComments.push(...chunk);
    }
    // Use allComments...
}
```

### Metadata Handling

- Metadata (quotaUsed, incomplete, error) is only included in the **last chunk**
- This ensures the web page receives complete status information after all data is received
- Implementation: `background.ts:128-133`

## Security Design

### API Key Isolation

The API key is stored exclusively in the background service worker and **never exposed to the web page**:

1. **Storage**: API key is stored in `chrome.storage.local` under `youtubeApiKey`
2. **Flag Exposure**: Only a boolean `hasYoutubeApiKey` flag is sent to the web page
3. **Request Handling**: All YouTube Data API requests are made from the background service worker

**Content Script Filtering** (`cscripts.ts:106-111`):

```typescript
// Security: Filter out sensitive data, only expose hasYoutubeApiKey flag
const { youtubeApiKey, ...safeOpts } = opts;
const sanitizedOpts = {
    ...safeOpts,
    hasYoutubeApiKey: !!(youtubeApiKey as string)?.trim()
};
```

### Request Validation

- Video IDs are validated against regex pattern before processing
- Request IDs are UUIDs generated by `crypto.randomUUID()`
- Message origin is verified: `e.origin !== window.location.origin`

## Error Handling

### Error Types

| Type | Description | User Action |
|------|-------------|-------------|
| `quotaExceeded` | Daily API quota (10,000 units) exhausted | Wait until tomorrow or use different API key |
| `invalidApiKey` | API key is invalid or not configured | Check API key in settings |
| `unsupported` | Comments disabled or video not found | None (graceful skip) |
| `apiError` | Other YouTube API errors | Check console for details |
| `aborted` | User cancelled via STOP button | None (intentional) |
| `unknown` | Unexpected errors | Check console for details |

### Partial Results

When errors occur mid-fetch, partial results are preserved and returned:

1. Background sends partial comments in the error response
2. Web page displays appropriate status icon (warning/error/stop/info)
3. User can still search within the partial results

**Implementation**: `background.ts:288-297` (error handling with partial results)

## Abort Handling

### User-Initiated Abort

When user clicks STOP button:

1. Web page sends `YCS_YT_API_COMMENTS_ABORT` message
2. Background calls `controller.abort()` on the AbortController
3. All in-flight fetch requests are cancelled
4. Partial results (if any) are sent back via `YCS_YT_API_COMMENTS_CHUNK`

### Tab Close Handling

When user closes the tab or navigates away:

1. `chrome.tabs.onRemoved` listener triggers
2. All requests associated with that tab are aborted
3. Resources are cleaned up

**Implementation**: `background.ts:445-453`

### Timeout Safety

Web page has a 3-second timeout after sending abort:

```typescript
// Safety timeout: if background doesn't respond within 3 seconds, reject
abortTimeoutId = setTimeout(() => {
    window.removeEventListener('message', handleMessage);
    reject(new DOMException('Aborted', 'AbortError'));
}, 3000);
```

## Active Request Tracking

Background maintains a map of active requests for abort handling:

```typescript
interface ActiveRequest {
    controller: AbortController;
    tabId: number;
}
const activeYouTubeApiRequests = new Map<string, ActiveRequest>();
```

- Keyed by `requestId` (UUID)
- Stores AbortController for cancellation
- Stores tabId for tab-close cleanup
- Automatically cleaned up on completion or abort

## Related Files

| File | Purpose |
|------|---------|
| `background.ts:1-300` | Background service worker with YouTube API handling |
| `cscripts.ts:7-175` | Content script message relay |
| `appController.ts:118-260` | Web page request handling and chunk reassembly |
| `i_types.ts:311-412` | TypeScript interfaces for YouTube Data API |
| `youtubeDataApi/client.ts` | YouTube Data API client |
| `youtubeDataApi/transform.ts` | Response transformation to CommentItem |
