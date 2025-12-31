import objectScan from 'object-scan';
import { GlobalStore } from '../common';

/**
 * Checks if a badge array contains a members-only badge
 */
function hasMembersOnlyBadge(badges: any[] | undefined): boolean {
    if (!Array.isArray(badges)) {
        return false;
    }

    return badges.some((badge) => {
        return badge?.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_MEMBERS_ONLY';
    });
}

/**
 * Deep search for videoRenderer objects in the data structure
 */
function findVideoRenderers(obj: any, currentVideoId: string, result: any[] = []): any[] {
    if (!obj || typeof obj !== 'object') {
        return result;
    }

    if (obj.videoRenderer && obj.videoRenderer.videoId === currentVideoId) {
        result.push(obj.videoRenderer);
    }

    if (Array.isArray(obj)) {
        for (const item of obj) {
            findVideoRenderers(item, currentVideoId, result);
        }
    } else {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                findVideoRenderers(obj[key], currentVideoId, result);
            }
        }
    }

    return result;
}

/**
 * Determines if the current video is members-only based on ytInitialData
 *
 * @param ytInitialData - The ytInitialData object from YouTube page
 * @returns true if the video is members-only, false otherwise
 */
export function isMemberOnlyFromYtInitialData(ytInitialData: unknown): boolean {
    try {
        if (!ytInitialData || typeof ytInitialData !== 'object') {
            console.log('[YCS] [MemberOnly] isMemberOnlyFromYtInitialData: invalid input (not object)');
            return false;
        }

        const data = ytInitialData as any;

        // Check if this is PBJ format (has both response and playerResponse at top level)
        const isPbjFormat = data?.response && data?.playerResponse;
        console.log(`[YCS] [MemberOnly] isMemberOnlyFromYtInitialData: format=${isPbjFormat ? 'PBJ' : 'legacy'}`);

        let targetData = data;
        if (isPbjFormat) {
            // PBJ format: actual ytInitialData is in response property
            targetData = data.response;
        }

        // Get current video ID
        // For PBJ format, videoId might be in response.currentVideoEndpoint or data.currentVideoEndpoint
        const currentVideoId =
            targetData?.currentVideoEndpoint?.watchEndpoint?.videoId ||
            data?.currentVideoEndpoint?.watchEndpoint?.videoId;
        if (!currentVideoId) {
            console.log('[YCS] [MemberOnly] isMemberOnlyFromYtInitialData: no currentVideoId found');
            return false;
        }

        console.log(`[YCS] [MemberOnly] isMemberOnlyFromYtInitialData: checking videoId=${currentVideoId}`);

        // Priority 1: Check videoPrimaryInfoRenderer badges (watch page)
        // For PBJ format: response.contents.twoColumnWatchNextResults...
        // For legacy format: contents.twoColumnWatchNextResults...
        const primaryInfoRenderer =
            targetData?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer;

        if (primaryInfoRenderer?.badges) {
            const hasBadge = hasMembersOnlyBadge(primaryInfoRenderer.badges);
            console.log(
                `[YCS] [MemberOnly] isMemberOnlyFromYtInitialData: videoPrimaryInfoRenderer.badges check=${hasBadge}`
            );
            if (hasBadge) {
                console.log(
                    `[YCS] [MemberOnly] isMemberOnlyFromYtInitialData: ✓ MEMBERS-ONLY (via videoPrimaryInfoRenderer)`
                );
                return true;
            }
        } else {
            console.log('[YCS] [MemberOnly] isMemberOnlyFromYtInitialData: videoPrimaryInfoRenderer.badges not found');
        }

        // Priority 2: Deep search for videoRenderer with matching videoId
        // Search in targetData (response for PBJ, or data itself for legacy)
        const videoRenderers = findVideoRenderers(targetData, currentVideoId);
        for (const videoRenderer of videoRenderers) {
            if (hasMembersOnlyBadge(videoRenderer.badges)) {
                console.log(`[YCS] [MemberOnly] isMemberOnlyFromYtInitialData: ✓ MEMBERS-ONLY (via videoRenderer)`);
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('[YCS] [MemberOnly] Failed to parse members-only status from ytInitialData:', error);
        return false;
    }
}

/**
 * Determines if a community post is members-only based on ytInitialData
 * Checks for sponsorsOnlyBadge in backstagePostRenderer
 *
 * @param ytInitialData - The ytInitialData object from YouTube post page
 * @returns true if the post is members-only, false otherwise
 */
export function isPostMemberOnlyFromYtInitialData(ytInitialData: unknown): boolean {
    try {
        if (!ytInitialData || typeof ytInitialData !== 'object') {
            console.log('[YCS] [MemberOnly] isPostMemberOnlyFromYtInitialData: invalid input (not object)');
            return false;
        }

        // Use objectScan to find sponsorsOnlyBadge in backstagePostRenderer
        // Path: **.backstagePostRenderer.sponsorsOnlyBadge
        const sponsorsOnlyBadge = objectScan(['**.backstagePostRenderer.sponsorsOnlyBadge'], {
            rtn: 'value',
            abort: true
        })(ytInitialData);

        if (sponsorsOnlyBadge) {
            console.log(
                '[YCS] [MemberOnly] isPostMemberOnlyFromYtInitialData: ✓ MEMBERS-ONLY (sponsorsOnlyBadge found)'
            );
            return true;
        }

        console.log('[YCS] [MemberOnly] isPostMemberOnlyFromYtInitialData: not members-only (no sponsorsOnlyBadge)');
        return false;
    } catch (error) {
        console.error('[YCS] [MemberOnly] Failed to parse post members-only status from ytInitialData:', error);
        return false;
    }
}

/**
 * Sets the current video's members-only status in GlobalStore
 */
export function setCurrentVideoMemberOnly(isMemberOnly: boolean): void {
    try {
        (GlobalStore as any).isMemberOnly = isMemberOnly;
        console.log(
            `[YCS] [MemberOnly] setCurrentVideoMemberOnly: ${isMemberOnly ? 'true (MEMBERS-ONLY)' : 'false (NOT members-only)'}`
        );
    } catch (error) {
        console.error('[YCS] [MemberOnly] Failed to set current video members-only status:', error);
    }
}

/**
 * Gets the current video's members-only status from GlobalStore
 *
 * NOTE: This uses "last loaded" semantics, not per-video tracking.
 * Status is only cleared when videoId mismatch is detected during validation.
 *
 * @returns true if current video is members-only, false otherwise
 */
export function isCurrentVideoMemberOnly(): boolean {
    try {
        const status = (GlobalStore as any).isMemberOnly;
        const result = status === true;
        console.log(`[YCS] [MemberOnly] isCurrentVideoMemberOnly: ${result} (GlobalStore.isMemberOnly=${status})`);
        return result;
    } catch (error) {
        console.error('[YCS] [MemberOnly] Failed to get current video members-only status:', error);
        return false;
    }
}

/**
 * Clears the current video's members-only status from GlobalStore
 */
export function clearCurrentVideoMemberOnly(): void {
    try {
        delete (GlobalStore as any).isMemberOnly;
    } catch (error) {
        console.error('[YCS] Failed to clear current video members-only status:', error);
    }
}

// ============================================================================
// Age-Restricted Video Detection
// ============================================================================

/**
 * Determines if the current video is age-restricted based on ytInitialData
 *
 * Age restriction is detected via:
 * 1. playerResponse.playabilityStatus.status === 'LOGIN_REQUIRED'
 * 2. playerResponse.playabilityStatus.reason containing age-related keywords
 *
 * @param ytInitialData - The ytInitialData object from YouTube page
 * @returns true if the video is age-restricted, false otherwise
 */
export function isAgeRestrictedFromYtInitialData(ytInitialData: unknown): boolean {
    try {
        if (!ytInitialData || typeof ytInitialData !== 'object') {
            return false;
        }

        const normalized = normalizeYtInitialData(ytInitialData);
        if (!normalized) {
            return false;
        }

        // Check playerResponse.playabilityStatus.status
        const playabilityStatus = objectScan(['**.playerResponse.playabilityStatus.status'], {
            rtn: 'value',
            abort: true
        })(normalized);

        if (playabilityStatus === 'LOGIN_REQUIRED') {
            console.log('[YCS] [AgeRestricted] ✓ AGE-RESTRICTED (LOGIN_REQUIRED status)');
            return true;
        }

        // Check for age gate reason
        const reason = objectScan(['**.playerResponse.playabilityStatus.reason'], {
            rtn: 'value',
            abort: true
        })(normalized) as string | undefined;

        if (reason && typeof reason === 'string') {
            const lowerReason = reason.toLowerCase();
            if (lowerReason.includes('age') || lowerReason.includes('confirm your age')) {
                console.log('[YCS] [AgeRestricted] ✓ AGE-RESTRICTED (age gate reason found)');
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('[YCS] [AgeRestricted] Failed to parse age-restricted status from ytInitialData:', error);
        return false;
    }
}

/**
 * Sets the current video's age-restricted status in GlobalStore
 */
export function setCurrentVideoAgeRestricted(isAgeRestricted: boolean): void {
    try {
        (GlobalStore as any).isAgeRestricted = isAgeRestricted;
        console.log(
            `[YCS] [AgeRestricted] setCurrentVideoAgeRestricted: ${isAgeRestricted ? 'true (AGE-RESTRICTED)' : 'false (NOT age-restricted)'}`
        );
    } catch (error) {
        console.error('[YCS] [AgeRestricted] Failed to set current video age-restricted status:', error);
    }
}

/**
 * Gets the current video's age-restricted status from GlobalStore
 *
 * @returns true if current video is age-restricted, false otherwise
 */
export function isCurrentVideoAgeRestricted(): boolean {
    try {
        const status = (GlobalStore as any).isAgeRestricted;
        return status === true;
    } catch (error) {
        console.error('[YCS] [AgeRestricted] Failed to get current video age-restricted status:', error);
        return false;
    }
}

/**
 * Clears the current video's age-restricted status from GlobalStore
 */
export function clearCurrentVideoAgeRestricted(): void {
    try {
        delete (GlobalStore as any).isAgeRestricted;
    } catch (error) {
        console.error('[YCS] [AgeRestricted] Failed to clear current video age-restricted status:', error);
    }
}

/**
 * Normalizes ytInitialData to handle both modern PBJ and legacy formats
 *
 * Modern PBJ format (object): {response: {...}, playerResponse: {...}, ...}
 * Legacy format (array): [{response: {...}}, {playerResponse: {...}}] - rarely seen, kept for compatibility
 *
 * @param ytData - Raw ytInitialData (primarily object, array for legacy compatibility)
 * @returns Normalized data object, or null if invalid
 */
export function normalizeYtInitialData(ytData: any): any {
    if (!ytData) {
        return null;
    }

    if (Array.isArray(ytData)) {
        // Legacy array format: merge all elements to preserve both response and playerResponse
        const merged: any = {};
        for (const item of ytData) {
            if (item && typeof item === 'object') {
                Object.assign(merged, item);
            }
        }
        // Return merged object if it has response or contents, otherwise return original
        if (merged.response || merged.contents) {
            return merged;
        }
    }

    return ytData;
}

/**
 * Updates member-only status from ytInitialData
 * Handles both modern PBJ and legacy formats automatically
 * Note: Prefer using updateAccessRestrictionStatus() which updates both statuses together
 *
 * @param ytData - Raw ytInitialData from API responses (supports):
 *   - Modern PBJ format (object): `{response: {...}, playerResponse: {...}, ...}` (primary)
 *   - Legacy array format: `[{response: {...}}, {playerResponse: {...}}]` (rarely seen)
 *   - Legacy object format: `{contents: {...}, currentVideoEndpoint: {...}}`
 *   - `null` or `undefined`: safe to pass, will set status to false
 *
 *   NOTE: Does NOT support direct `window.ytInitialData` input.
 *   Use `getInitYtData()` or `getInitYtDataFromHtml()` to obtain proper format.
 *
 * @returns The determined member-only status
 */
export function updateMemberOnlyStatus(ytData: any): boolean {
    const normalizedData = normalizeYtInitialData(ytData);
    const isMemberOnly = isMemberOnlyFromYtInitialData(normalizedData);
    setCurrentVideoMemberOnly(isMemberOnly);
    return isMemberOnly;
}

/**
 * Updates age-restricted status from ytInitialData
 * Note: Prefer using updateAccessRestrictionStatus() which updates both statuses together
 *
 * @param ytData - Raw ytInitialData from API responses
 * @returns The determined age-restricted status
 */
export function updateAgeRestrictedStatus(ytData: any): boolean {
    const isAgeRestricted = isAgeRestrictedFromYtInitialData(ytData);
    setCurrentVideoAgeRestricted(isAgeRestricted);
    return isAgeRestricted;
}

/**
 * Combined access restriction status result
 */
export interface AccessRestrictionStatus {
    isMemberOnly: boolean;
    isAgeRestricted: boolean;
}

/**
 * Updates both member-only and age-restricted status from ytInitialData
 * This is the preferred way to update access restriction status as it ensures
 * both statuses are always updated together.
 *
 * @param ytData - Raw ytInitialData from API responses (supports PBJ, legacy array, and object formats)
 * @returns Object containing both isMemberOnly and isAgeRestricted status
 */
export function updateAccessRestrictionStatus(ytData: any): AccessRestrictionStatus {
    return {
        isMemberOnly: updateMemberOnlyStatus(ytData),
        isAgeRestricted: updateAgeRestrictedStatus(ytData)
    };
}

/**
 * Determines whether to disable Authorization header
 * Conservative strategy: only send auth if CERTAIN it's members-only or age-restricted
 *
 * @returns true if auth should be disabled, false if auth should be sent
 */
export function shouldDisableAuth(): boolean {
    const memberOnly = (GlobalStore as any).isMemberOnly;
    const ageRestricted = (GlobalStore as any).isAgeRestricted;

    // Send auth for member-only OR age-restricted videos
    return memberOnly !== true && ageRestricted !== true;
}
