const options = {
    autoload: true,
    highlightText: true,
    highlightExact: false,
    cache: true,
    autoClear: 200,
    hiddenByDefault: false,
    sidebarByDefault: false,
    sortTimestamp: false,
    autoExpandReplyContext: false,
    hiddenByDefaultShorts: false,
    enableShortsSupport: true,
    transcriptLanguage: '',
    maxComments: 500000,
    youtubeApiKey: '', // Empty = no Data API; Filled = key available for Instant and/or full load
    youtubeApiEnabled: true, // Enable Data API for full comment load (requires API key; independent of Instant)
    youtubeApiInstantSearch: true, // Instant searchTerms before load (requires API key; independent of Enable)
    filterButtons: [
        { id: 'ycs_btn_timestamps', enabled: true },
        { id: 'ycs_btn_timestamp_viz', enabled: true },
        { id: 'ycs_btn_author', enabled: true },
        { id: 'ycs_btn_heart', enabled: true },
        { id: 'ycs_btn_verified', enabled: true },
        { id: 'ycs_btn_links', enabled: true },
        { id: 'ycs_btn_likes', enabled: true },
        { id: 'ycs_btn_replied_comments', enabled: true },
        { id: 'ycs_btn_members', enabled: true },
        { id: 'ycs_btn_donated', enabled: true },
        { id: 'ycs_btn_sort_first', enabled: true },
        { id: 'ycs_btn_random', enabled: true },
        { id: 'ycs_btn_quick_chat', enabled: false },
        { id: 'ycs_btn_quick_transcript', enabled: false }
    ]
};

export { options };
