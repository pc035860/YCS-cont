import { insertFileScriptWithLoad, removeInjectionYCS, removeInjections } from '../utils/injections';

const DEBUG = false;

(function (): void {
    removeInjectionYCS();

    function initContentScript(): void {
        // Whitelist of allowed runtime message types
        const ALLOWED_RUNTIME_MESSAGE_TYPES = new Set<string>([
            'YCS_CACHE_STORAGE_GET_SEND',
            'YCS_AUTOLOAD',
            'YCS_YT_API_COMMENTS_PROGRESS',
            'YCS_YT_API_COMMENTS_COMPLETE',
            'YCS_YT_API_COMMENTS_ERROR',
            'YCS_YT_API_COMMENTS_CHUNK',
            'YCS_YT_API_SEARCH_RESULT',
            'YCS_YT_API_SEARCH_ERROR'
        ]);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            try {
                if (typeof message !== 'object' || message === null) return;
                const type = (message as any).type;
                if (typeof type !== 'string') return;
                if (!ALLOWED_RUNTIME_MESSAGE_TYPES.has(type)) {
                    if (DEBUG) console.warn('[YCS] Unknown runtime message type:', type);
                    return;
                }

                if (type === 'YCS_CACHE_STORAGE_GET_SEND' && (message as any)?.body) {
                    if (DEBUG) console.log('[YCS] GET CACHE FROM IDB', message);

                    window.postMessage(
                        { type: 'YCS_CACHE_STORAGE_GET_RESPONSE', body: (message as any).body },
                        window.location.origin
                    );
                }

                if (type === 'YCS_AUTOLOAD') {
                    if (DEBUG) console.log('[YCS] RESPONSE BG SEND AUTOLOAD. Now postMessage in Window');
                    window.postMessage({ type: 'YCS_AUTOLOAD' }, window.location.origin);
                }

                // Forward YouTube API responses to web page
                if (
                    type === 'YCS_YT_API_COMMENTS_PROGRESS' ||
                    type === 'YCS_YT_API_COMMENTS_COMPLETE' ||
                    type === 'YCS_YT_API_COMMENTS_ERROR' ||
                    type === 'YCS_YT_API_COMMENTS_CHUNK' ||
                    type === 'YCS_YT_API_SEARCH_RESULT' ||
                    type === 'YCS_YT_API_SEARCH_ERROR'
                ) {
                    if (DEBUG) console.log('[YCS] Forwarding YouTube API response:', type);
                    window.postMessage(message, window.location.origin);
                }
            } catch (err) {
                console.error(err);
            }
        });

        // Whitelist of allowed window.postMessage types
        const ALLOWED_WEB_MESSAGE_TYPES = new Set<string>([
            'NUMBER_COMMENTS',
            'GET_OPTIONS',
            'YCS_CACHE_STORAGE_SET',
            'YCS_CACHE_STORAGE_GET',
            'YCS_YT_API_COMMENTS_START',
            'YCS_YT_API_COMMENTS_ABORT',
            'YCS_YT_API_SEARCH_START',
            'YCS_YT_API_SEARCH_ABORT'
        ]);

        const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
        function isValidVideoId(id: unknown): id is string {
            return typeof id === 'string' && VIDEO_ID_REGEX.test(id);
        }
        const POST_ID_REGEX = /^[a-zA-Z0-9_-]{11,36}$/;
        function isValidPostId(id: unknown): id is string {
            return typeof id === 'string' && POST_ID_REGEX.test(id);
        }
        function truncateString(value: unknown, maxLength: number): string {
            const str = String(value ?? '');
            return str.slice(0, maxLength);
        }

        window.addEventListener(
            'message',
            async (e) => {
                try {
                    if (e.source !== window) return;
                    if (e.origin !== window.location.origin) return;

                    if (typeof e.data !== 'object' || e.data === null) return;
                    const msg: any = e.data;
                    if (typeof msg.type !== 'string') return;
                    if (!ALLOWED_WEB_MESSAGE_TYPES.has(msg.type)) {
                        if (DEBUG) console.warn('[YCS] Unknown message type:', msg.type);
                        return;
                    }

                    if (msg.type === 'NUMBER_COMMENTS') {
                        chrome.runtime.sendMessage(`${chrome.runtime.id}`, {
                            type: 'YCS_SET_BADGE',
                            text: truncateString(msg.text, 100)
                        });
                    }

                    if (msg.type === 'GET_OPTIONS') {
                        try {
                            if (DEBUG) console.log('[YCS] GET_OPTIONS', msg);

                            const opts = await chrome.storage.local.get();

                            // Security: Filter out sensitive data, only expose hasYoutubeApiKey flag
                            const { youtubeApiKey, ...safeOpts } = opts;
                            const sanitizedOpts = {
                                ...safeOpts,
                                hasYoutubeApiKey: !!(youtubeApiKey as string)?.trim(),
                                youtubeApiInstantSearch: safeOpts.youtubeApiInstantSearch !== false
                            };

                            window.postMessage({ type: 'YCS_OPTIONS', text: sanitizedOpts }, window.location.origin);
                        } catch (err) {
                            console.error(err);
                        }
                    }

                    if (msg.type === 'YCS_CACHE_STORAGE_SET' && msg?.body) {
                        if (!isValidVideoId(msg.body?.videoId) && !isValidPostId(msg.body?.postId)) {
                            if (DEBUG) console.warn('[YCS] Invalid video ID format');
                            return;
                        }
                        chrome.runtime.sendMessage(`${chrome.runtime.id}`, msg, (res) => {
                            if (DEBUG) console.log('[YCS] Response YCS_CACHE_STORAGE SET:', res);
                        });
                    }

                    if (msg.type === 'YCS_CACHE_STORAGE_GET' && msg?.body) {
                        if (!isValidVideoId(msg.body?.videoId) && !isValidPostId(msg.body?.postId)) {
                            if (DEBUG) console.warn('[YCS] Invalid video or post ID format');
                            return;
                        }
                        chrome.runtime.sendMessage(`${chrome.runtime.id}`, msg, (res) => {
                            if (DEBUG) console.log('[YCS] Response YCS_CACHE_STORAGE GET:', res);
                        });
                    }

                    // Forward YouTube API requests to background
                    if (msg.type === 'YCS_YT_API_COMMENTS_START' && msg?.body) {
                        if (!isValidVideoId(msg.body?.videoId)) {
                            if (DEBUG) console.warn('[YCS] Invalid video ID format for YouTube API');
                            return;
                        }
                        if (DEBUG) console.log('[YCS] Forwarding YouTube API START:', msg);
                        chrome.runtime.sendMessage(`${chrome.runtime.id}`, msg);
                    }

                    if (msg.type === 'YCS_YT_API_COMMENTS_ABORT' && msg?.body) {
                        if (DEBUG) console.log('[YCS] Forwarding YouTube API ABORT:', msg);
                        chrome.runtime.sendMessage(`${chrome.runtime.id}`, msg);
                    }

                    if (msg.type === 'YCS_YT_API_SEARCH_START' && msg?.body) {
                        if (!isValidVideoId(msg.body?.videoId)) {
                            if (DEBUG) console.warn('[YCS] Invalid video ID format for YouTube API search');
                            return;
                        }
                        if (DEBUG) console.log('[YCS] Forwarding YouTube API SEARCH START:', msg);
                        chrome.runtime.sendMessage(`${chrome.runtime.id}`, msg);
                    }

                    if (msg.type === 'YCS_YT_API_SEARCH_ABORT' && msg?.body) {
                        if (DEBUG) console.log('[YCS] Forwarding YouTube API SEARCH ABORT:', msg);
                        chrome.runtime.sendMessage(`${chrome.runtime.id}`, msg);
                    }
                } catch (err) {
                    console.error(err);
                }
            },
            false
        );

        const SCRIPT_SRCS = ['web-resources/wresources.js'];
        const fullSrcs = SCRIPT_SRCS.map((src) => chrome.runtime.getURL(src));
        removeInjections(fullSrcs);
        (async function (srcs: string[], target: string): Promise<void> {
            for (const src of srcs) {
                await insertFileScriptWithLoad(src, target);
            }
        })(fullSrcs, 'body');
    }

    // document.addEventListener('DOMContentLoaded', initContentScript, false);

    // sessionStorage.setItem('uniqKey123123123', 'asdfasdf45345345!!!!!!!');

    initContentScript();
})();
