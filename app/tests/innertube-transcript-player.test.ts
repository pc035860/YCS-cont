import assert from 'node:assert';
import test from 'node:test';

import { ANDROID_CLIENT_FALLBACK, WEB_CLIENT_FALLBACK } from '../src/source/utils/innertube/fallbacks';
import { getTranscriptTracks } from '../src/source/utils/innertube/transcript';

test('getTranscriptTracks uses expected ANDROID and WEB fallback clientVersion', async () => {
    const globalAny = globalThis as any;
    const originalWindow = globalAny.window;
    const originalFetch = globalAny.fetch;

    const requestBodies: Record<string, any>[] = [];
    let fetchCount = 0;

    try {
        globalAny.window = {
            location: {
                href: 'https://www.youtube.com/watch?v=video123',
                protocol: 'https:',
                origin: 'https://www.youtube.com'
            },
            navigator: { language: 'en-US' },
            document: { cookie: 'SAPISID=test_sapisid_value' },
            ytcfg: {
                data_: {
                    INNERTUBE_API_KEY: 'test_api_key',
                    INNERTUBE_CONTEXT: {
                        client: {
                            hl: 'en',
                            gl: 'US'
                        }
                    }
                }
            }
        };

        globalAny.fetch = async (_input: string, init?: RequestInit) => {
            const bodyText = typeof init?.body === 'string' ? init.body : '{}';
            requestBodies.push(JSON.parse(bodyText));

            fetchCount += 1;
            if (fetchCount === 1) {
                return {
                    json: async () => ({})
                } as Response;
            }

            return {
                ok: true,
                json: async () => ({
                    captions: {
                        playerCaptionsTracklistRenderer: {
                            captionTracks: [
                                {
                                    languageCode: 'en',
                                    name: { simpleText: 'English' },
                                    baseUrl: 'https://example.com/api/timedtext?fmt=srv3'
                                }
                            ],
                            audioTracks: [],
                            defaultCaptionTrackIndex: 0
                        }
                    }
                })
            } as Response;
        };

        const tracks = await getTranscriptTracks(new AbortController().signal);

        assert.ok(tracks);
        assert.equal(tracks?.length, 1);
        assert.equal(requestBodies.length, 2);
        assert.equal(requestBodies[0]?.context?.client?.clientName, 'ANDROID');
        assert.equal(requestBodies[0]?.context?.client?.clientVersion, ANDROID_CLIENT_FALLBACK.clientVersion);
        assert.equal(requestBodies[1]?.context?.client?.clientName, 'WEB');
        assert.equal(requestBodies[1]?.context?.client?.clientVersion, WEB_CLIENT_FALLBACK.clientVersion);
    } finally {
        if (originalWindow === undefined) {
            delete globalAny.window;
        } else {
            globalAny.window = originalWindow;
        }

        if (originalFetch === undefined) {
            delete globalAny.fetch;
        } else {
            globalAny.fetch = originalFetch;
        }
    }
});
