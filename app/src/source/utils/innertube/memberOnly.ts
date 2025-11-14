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
