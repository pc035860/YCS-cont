const options = {
    autoload: true,
    highlightText: true,
    highlightExact: false,
    cache: true,
    autoClear: 200,
    hiddenByDefault: false,
    hiddenByDefaultShorts: false,
    enableShortsSupport: true,
    transcriptLanguage: '',
    youtubeApiKey: '', // Empty = use Innertube (default); Filled = use YouTube Data API
    youtubeApiEnabled: true, // Enable YouTube Data API (requires API key to take effect)
    filterButtons: [
        { id: 'ycs_btn_comments', enabled: true },
        { id: 'ycs_btn_quick_chat', enabled: true },
        { id: 'ycs_btn_quick_transcript', enabled: true },
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
        { id: 'ycs_btn_random', enabled: true },
        { id: 'ycs_btn_origin', enabled: true }
    ]
};

export { options };
