# Adaptive Authorization Headers for Comment Requests

## Overview

This document describes the adaptive authorization header mechanism implemented to optimize comment loading performance for public YouTube videos. The system intelligently detects member-only videos and conditionally includes authorization headers only when necessary, significantly reducing request payload size for the majority of public videos.

## Why Adaptive Authorization?

### The Problem

YouTube's SAPISID-based authorization headers (documented in [sap-sid-authorization.md](sap-sid-authorization.md)) provide access to authenticated content but come with a significant cost: **they dramatically increase request payload size**.

For the majority of public videos that don't require authentication, sending these headers on every comment request creates unnecessary overhead that impacts loading performance.

### The Solution

Implement intelligent member-only detection to apply a **conservative strategy**:
- **Skip authorization headers** for public videos (default behavior)
- **Include authorization headers** only when video is confirmed as member-only

This optimization maintains full functionality for member-only content while improving performance for public videos.

## Architecture and Lifecycle

### 1. Member-Only Detection

The system uses YouTube's `ytInitialData` to detect member-only videos through badge analysis.

**Implementation**: `utils/innertube/memberOnly.ts`

```typescript
// Detect member-only status from page data
export function isMemberOnlyFromYtInitialData(ytInitialData: unknown): boolean
```

**Detection Methods**:
- **Priority 1**: Check `videoPrimaryInfoRenderer.badges` on watch page
- **Priority 2**: Deep search for `videoRenderer` objects with member-only badges

**Supported Formats**:
- Modern PBJ format: `{response: {...}, playerResponse: {...}}`
- Legacy object format: `{contents: {...}, currentVideoEndpoint: {...}}`
- Legacy array format: `[{response: {...}}, {playerResponse: {...}}]`

### 2. State Management

Member-only status is stored in `GlobalStore.isMemberOnly` for the current video session.

**Implementation**: `utils/innertube/memberOnly.ts:121-161`

```typescript
// Set status
export function setCurrentVideoMemberOnly(isMemberOnly: boolean): void

// Get status
export function isCurrentVideoMemberOnly(): boolean

// Clear status (when switching videos)
export function clearCurrentVideoMemberOnly(): void
```

**State Initialization** (Three Mechanisms):

1. **Automatic Update** (Primary):
   - When `getInitYtData()` fetches `ytInitialData` via PBJ request (`utils/innertube/core.ts:181`)
   - When `getInitYtDataFromHtml()` parses `ytInitialData` from HTML (`utils/innertube/core.ts:284`)
   - Status is automatically updated via `updateMemberOnlyStatus()` after data retrieval

2. **Lazy Initialization** (On-Demand):
   - `ensureMemberOnlyStatus()` function ensures status is set before comment requests (`utils/innertube/comments/pipeline.ts:1226-1254`)
   - First checks if status is already set (early return if `isMemberOnly !== undefined`)
   - Tries cached `ytData` first via `validateCachedYtData()`
   - Only fetches new data if cache is invalid or missing

3. **Fallback Check** (Request-Time):
   - `getParamsForComments()` checks and updates status if undefined (`utils/innertube/comments/pipeline.ts:1354-1366`)
   - `fetchCommentPage()` ensures status before building request params (`utils/innertube/comments/pipeline.ts:1630-1635`)
   - Uses conservative strategy (no auth header) if `ytInitialData` is unavailable

**State Lifecycle**:

- **Set**: 
  - Automatically when `ytInitialData` is fetched (`getInitYtData()`, `getInitYtDataFromHtml()`)
  - On-demand via `ensureMemberOnlyStatus()` before comment requests
  - Fallback check in request functions if status is still undefined
  
- **Used**: 
  - Before building request headers for comment API calls via `shouldDisableAuth()`
  - Decision logic: `status !== true` → disable auth header (conservative strategy)
  
- **Cleared**: 
  - **Primary**: When user navigates to a different video (`web-resources/appController.ts:283`)
  - **Secondary**: When `validateCachedYtData()` detects videoId mismatch (`utils/innertube/comments/pipeline.ts:1211`)

**State Validation**:

The system prevents state pollution across videos through `validateCachedYtData()`:

- Extracts `videoId` from cached `ytInitialData` using `extractVideoId()`
- Compares with current video ID
- **Clears both cache and `isMemberOnly` status** if mismatch detected
- This ensures status always corresponds to the current video

**State Characteristics**:

- **Single Video Scope**: Status only applies to current video, cleared on navigation
- **Lazy Initialization**: Set only when needed, avoiding unnecessary requests
- **Cache-First**: Prefers cached `ytData` to minimize API calls
- **Validation**: VideoId comparison prevents cross-video state pollution
- **Conservative**: `undefined` status defaults to no authorization header

### 3. Authorization Decision

The decision logic uses a **conservative strategy**: only send authorization when certain the video is member-only.

**Implementation**: `utils/innertube/memberOnly.ts:222-225`

```typescript
export function shouldDisableAuth(): boolean {
    const status = (GlobalStore as any).isMemberOnly;
    return status !== true; // Disable unless explicitly true
}
```

**Decision Logic**:
- `isMemberOnly === true` → Send authorization (member-only confirmed)
- `isMemberOnly === false` → Skip authorization (public video)
- `isMemberOnly === undefined` → Skip authorization (status unknown, use conservative approach)

### 4. Header Construction

The `buildInnertubeHeaders()` function accepts a `disableAuth` option to control authorization header inclusion.

**Implementation**: `utils/innertube/request.ts:43-76`

```typescript
export function buildInnertubeHeaders(
    ytcfgData: YtcfgData | undefined,
    overrides: BuildInnertubeHeadersOverrides = {},
    globalContext?: Window & typeof globalThis,
    options?: BuildInnertubeHeadersOptions  // { disableAuth?: boolean }
): Record<string, string>
```

**Authorization Logic** (line 60-66):
```typescript
// Generate authorization header if globalContext is provided and disableAuth is not true
if (globalContext && options?.disableAuth !== true) {
    const authHeader = buildSapSidAuthorizationHeader({ context: globalContext });
    if (authHeader) {
        headers.authorization = authHeader;
    }
}
```

### 5. Integration Points

**Comments Pipeline** (`utils/innertube/comments/pipeline.ts`):

All comment-related API calls use adaptive authorization:

- `getDetailsVideoIDV2()` (line 1268)
- `getDetailsCommentsVideoIDV2()` (line 1308)
- `getParamsForComments()` (line 1368)
- `getParamsForReplies()` (line 1400)

**Example** (from `getParamsForComments`):
```typescript
// Update member-only status if not set yet
if ((GlobalStore as any).isMemberOnly === undefined) {
    const ytData: any = (GlobalStore as any).getInitYtData;
    if (ytData) {
        updateMemberOnlyStatus(ytData);
    } else {
        console.log(
            "[YCS] [Comments] No ytInitialData available, will use conservative strategy (don't send Authorization to reduce request size)"
        );
    }
}

const headers = buildInnertubeHeaders(ytcfgData, {}, w, { disableAuth: shouldDisableAuth() });
```

## Why Only Comments?

### Current Scope

Adaptive authorization is **currently applied only to comment requests**, not to chat replay or transcript requests.

**Comment Requests** (using adaptive auth):
- Video details API
- Comment list API
- Reply list API

**Chat Requests** (always send auth):
- Live chat API (`utils/innertube/chat.ts:41`)
- Chat replay API (`utils/innertube/chat.ts:71`)

**Transcript Requests** (always send auth):
- Transcript API (`utils/innertube/transcript.ts:45`)

### Rationale

The decision to apply adaptive authorization **only to comments** is based on request size characteristics and cost-benefit analysis:

1. **Request Size Impact**

Authorization headers increase comment request size by **3-4x**. This is costly for the majority of public videos where authentication is not required.

2. **Detection Reliability**

PBJ request (`ytInitialData` with `pbj=1` parameter) failure rate is near zero, making detection failures extremely rare. The combination of "member-only video + PBJ detection failure" is statistically negligible.

3. **Cost-Benefit Trade-off**

- **Member-only videos** are a small subset of all YouTube videos
- The optimization benefits the vast majority of public videos
- This trade-off prioritizes cost efficiency over handling extremely unlikely edge cases

4. **Chat and Transcript Exclusion**

Chat and transcript requests **always send authorization headers** because their request size remains nearly the same regardless of whether the header is present. The optimization benefit would be minimal compared to comments.

### Future Considerations

Adaptive authorization could potentially be extended to chat and transcript requests in the future, but would require:
- Validation that member-only detection works reliably for these content types
- Testing to ensure no functionality regression for member-only content
- Performance measurement to validate the optimization benefit

## Data Normalization

The system handles multiple `ytInitialData` formats through normalization.

**Implementation**: `utils/innertube/memberOnly.ts:172-192`

```typescript
export function normalizeYtInitialData(ytData: any): any
```

**Normalization Process**:
- **Modern PBJ format** (object): Used as-is
- **Legacy array format**: Merge array elements to preserve both `response` and `playerResponse`
- Invalid input: Returns `null`

## Cache Validation

To prevent stale member-only status across video navigation, the system validates cached `ytInitialData` against the current video ID.

**Implementation**: `utils/innertube/comments/pipeline.ts:1195-1216`

```typescript
function validateCachedYtData(currentVideoId: string): boolean
```

**Validation Logic**:
- Extract video ID from cached `ytInitialData` using `extractVideoId()`
- Compare with current video ID
- Clear cache and member-only status on mismatch
- Keep cache if video ID is missing (to preserve channel ID data)

**State Synchronization**:

When `validateCachedYtData()` detects a videoId mismatch, it performs a **coordinated cleanup**:
1. Clears cached `ytInitialData`: `(GlobalStore as any).getInitYtData = undefined`
2. Clears member-only status: `clearCurrentVideoMemberOnly()`

This ensures both the cached data and the authorization decision state remain synchronized with the current video, preventing authorization headers from being sent for the wrong video.

## Testing

Comprehensive test coverage is provided in `tests/memberOnly.test.ts`.

**Test Cases**:
- Member-only detection via `videoPrimaryInfoRenderer.badges`
- Member-only detection via `videoRenderer` deep search
- PBJ format handling (member-only and public)
- Legacy format handling (member-only and public)
- Edge cases (invalid input, missing video ID)

**Test Fixtures** (`tests/fixtures/`):
- `ytInitialData-member-only-1.json`: Legacy format, member-only via primary info renderer
- `ytInitialData-member-only-2.json`: Legacy format, member-only via video renderer
- `ytInitialData-non-member.json`: Legacy format, public video
- `ytInitialData-pbj-member-only.json`: PBJ format, member-only
- `ytInitialData-pbj-non-member.json`: PBJ format, public video

## Related Documentation

- [SAPISID-Based Authorization](sap-sid-authorization.md) - Detailed authorization header implementation
- [Innertube Comments Integration](innertube-comments-integration.md) - Comment API integration guide
- [API Migration Guide](innertube-migration-guide.md) - API migration guide
- [Chat Replay API Changes](innertube-chat-replay-api-changes.md) - Chat replay API changes
