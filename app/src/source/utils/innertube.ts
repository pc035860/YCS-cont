export { getParams, getInitYtData } from './innertube/core';
export {
    getParamsForChat,
    getChatComments,
    checkIsLiveStream,
    getLiveBroadcastStartTime,
    pollLiveChat,
    type LiveChatPollResult
} from './innertube/chat';
export {
    getAllCommentsModeV2,
    extractNextContinuation,
    applyFrameworkUpdatesToComment,
    generateCommentObjectFromFW
} from './innertube/comments';
export { getTranscriptVideo, getTranscriptTracks } from './innertube/transcript';
export { buildSapSidAuthorizationHeader } from './innertube/authHeaders';
export {
    isMemberOnlyFromYtInitialData,
    isCurrentVideoMemberOnly,
    setCurrentVideoMemberOnly,
    clearCurrentVideoMemberOnly,
    normalizeYtInitialData,
    updateMemberOnlyStatus,
    shouldDisableAuth,
    // Age-restricted video support
    isAgeRestrictedFromYtInitialData,
    isCurrentVideoAgeRestricted,
    setCurrentVideoAgeRestricted,
    clearCurrentVideoAgeRestricted,
    updateAgeRestrictedStatus
} from './innertube/memberOnly';

// YouTube Data API v3 (alternative to Innertube)
export {
    getAllCommentsYouTubeApi,
    isQuotaExceeded,
    isInvalidApiKey,
    YouTubeDataApiError
} from './youtubeDataApi/index';
