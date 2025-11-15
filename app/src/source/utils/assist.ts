/**
 * Module facade for YCS utility layers.
 *
 * Layer map (→ marks primary dependency direction)
 * ├── common
 * │   ├─ Provides shared primitives: global store, guards, string/number helpers
 * │   └─ Used by: dom, formatting, filters, innertube, sheets
 * ├── dom
 * │   ├─ Browser + extension UI helpers (PiP, IDB cache bridge, badge updates)
 * │   └─ Uses: common
 * ├── formatting
 * │   ├─ Text/number/time formatting and HTML render helpers
 * │   └─ Uses: common
 * ├── filters
 * │   ├─ comments: comment/reply/transcript filtering pipelines → uses common, formatting
 * │   └─ chat: live chat specific filters → uses common, formatting
 * ├── innertube
 * │   ├─ YouTube Innertube API accessors and data normalization pipelines
 * │   └─ Uses: common, formatting, filters
 * └── sheets
 *     ├─ XLS/CSV sheet row builders for export flows
 *     └─ Uses: common, formatting, filters
 *
 * Shared helpers flow from common → {formatting, filters, innertube, dom} → sheets.
 */

export {
    GlobalStore,
    randomString,
    wrapTryCatch,
    deepFindObjKey,
    delayMs,
    getVideoId,
    getCleanUrlVideo,
    isWatchVideo,
    isVideoPage,
    isNumeric,
    getPaginate
} from './common';

export {
    removeClass,
    showLoadComments,
    removeNodeList,
    openComments,
    openCommentsChat,
    openCommentsTrVideo,
    downloadFile,
    markTextComment,
    setCacheToIDB,
    sendGetCacheInIDB,
    sendMsgToBadge,
    getPiP,
    initShowBarFAQ,
    initShowViewMode,
    getRandomComment,
    navigateVideoToTimestamp
} from './dom';

export {
    parseFormattedNumberToInt,
    msToRoundSec,
    msToShareVideo,
    tmUsecToDateTime,
    formatBytes,
    getCommentsHtmlText,
    getCommentsChatHtmlText,
    getCommentsTrVideoHtmlText
} from './formatting';

export {
    filterAuthorComments,
    filterLikesComments,
    filterRepliedComments,
    filterMemberComments,
    filterHeartComments,
    filterVerifiedComments,
    filterLinksComments,
    filterLinksTrpVideoComments,
    filterAllTrpVideoComments,
    filterNewestFirst
} from './filters/comments';

// Aggregate filter facade for gradual migration support.
export { applyFilters, createFilter } from './filters/engine';
export {
    createAuthorFilter,
    createTextFilter,
    createLikesFilter,
    createRepliesFilter,
    createVerifiedFilter,
    createMemberFilter,
    createCreatorHeartFilter,
    createLinksFilter
} from './filters/commentsAgg';

export {
    filterAuthorChat,
    filterMembersChat,
    filterDonatedChat,
    filterVerifiedChatComments,
    filterLinksChatComments,
    filterChatNewestFirst
} from './filters/chat';

export {
    applyChatFilters,
    createChatFilter,
    createChatAuthorFilter,
    createChatMembersFilter,
    createChatDonatedFilter,
    createChatVerifiedFilter,
    createChatLinksFilter
} from './filters/chatAgg';

export {
    getParams,
    getAllCommentsModeV2,
    getTranscriptVideo,
    getTranscriptTracks,
    getParamsForChat,
    getChatComments,
    getInitYtData,
    extractNextContinuation,
    isMemberOnlyFromYtInitialData,
    isCurrentVideoMemberOnly,
    setCurrentVideoMemberOnly,
    clearCurrentVideoMemberOnly,
    normalizeYtInitialData,
    updateMemberOnlyStatus,
    shouldDisableAuth
} from './innertube';

export { EXPORT_FORMAT } from './constants';
export type { ExportFormat } from './constants';

export {
    getSheetDetails,
    getSheetComments,
    getSheetReplies,
    getSheetChatDetails,
    getSheetChatComments,
    getSheetTrVideoDetails,
    getSheetTrVideo
} from './sheets';
