import assert from 'node:assert';
import test from 'node:test';
import { getChatComments } from '../src/source/utils/innertube/chat';
import { setFetchImplementation } from '../src/source/utils/libs';

/**
 * Test: Verify that getChatComments triggers expected pbj=1 requests
 *
 * Background:
 * - getChatComments calls getInitYtData (pbj=1) to get continuation data
 * - getLiveBroadcastStartTime also calls getInitYtData (pbj=1) to get broadcast start time
 *
 * Expected behavior:
 * - Total 2 pbj=1 requests: one for continuation, one for broadcast start time
 *
 * This test verifies by:
 * 1. Mocking fetch to track pbj=1 request count
 * 2. Calling getChatComments
 * 3. Asserting pbj=1 is called exactly twice
 */

test('getChatComments should trigger expected pbj=1 requests', async () => {
    let pbj1CallCount = 0;
    let liveChatCallCount = 0;

    // Mock window object
    (global as any).window = {
        location: {
            href: 'https://www.youtube.com/watch?v=test-video-id'
        },
        ytcfg: {
            data_: {
                INNERTUBE_API_KEY: 'mock-api-key',
                INNERTUBE_CONTEXT: {}
            }
        }
    };

    // Mock fetch to track API calls
    const originalFetch = global.fetch;
    const mockFetch = async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
        const urlStr = url.toString();

        // Track pbj=1 requests (used by getInitYtData)
        if (urlStr.includes('pbj=1')) {
            pbj1CallCount++;

            // Return mock response for pbj=1 request
            // Note: getInitYtData uses text() + JSON.parse() to handle anti-JSON hijacking prefix
            const mockData = {
                response: {
                    contents: {
                        twoColumnWatchNextResults: {
                            conversationBar: {
                                liveChatRenderer: {
                                    continuations: [
                                        {
                                            reloadContinuationData: {
                                                continuation: 'mock-continuation-token'
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            };
            return {
                ok: true,
                status: 200,
                text: async () => JSON.stringify(mockData),
                json: async () => mockData
            } as Response;
        }

        // Track live chat API requests
        if (urlStr.includes('get_live_chat') || urlStr.includes('get_live_chat_replay')) {
            liveChatCallCount++;

            // Return mock empty response (not a live chat)
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    continuationContents: {
                        liveChatContinuation: {
                            actions: []  // Empty actions means not a live chat
                        }
                    }
                })
            } as Response;
        }

        // Default mock response
        return {
            ok: true,
            status: 200,
            json: async () => ({})
        } as Response;
    };

    try {
        // Set up mock fetch
        setFetchImplementation(mockFetch as any);
        global.fetch = mockFetch as any;

        // Mock DOM element
        const mockElement = {
            textContent: '',
            classList: {
                remove: () => {},
                add: () => {}
            }
        } as any;

        // Mock AbortSignal
        const mockSignal = new AbortController().signal;

        // Call getChatComments
        // Note: This will fail on subsequent API calls, but we only care about
        // tracking the initial pbj=1 request count
        try {
            await getChatComments(mockSignal, mockElement);
        } catch (e) {
            // Expected to fail due to incomplete mocking
            // We only need to verify pbj=1 call count
        }

        // Assert: pbj=1 should be called twice (continuation + broadcastStartTime)
        assert.strictEqual(
            pbj1CallCount,
            2,
            `Expected pbj=1 to be called twice, but was called ${pbj1CallCount} times`
        );

        // Assert: live chat API should be called at least once
        assert.ok(
            liveChatCallCount >= 1,
            `Expected live chat API to be called at least once, but was called ${liveChatCallCount} times`
        );

        console.log(`✓ pbj=1 request count: ${pbj1CallCount} (expected: 2)`);
        console.log(`✓ live_chat API call count: ${liveChatCallCount} (expected: >= 1)`);
    } finally {
        // Restore original fetch
        global.fetch = originalFetch;
        setFetchImplementation(originalFetch);

        // Clean up window mock
        delete (global as any).window;
    }
});

test('getChatComments should pass continuation data to getLiveChat', async () => {
    // This test verifies that getLiveChat receives continuation data
    // from getCDChat. Note: getChatComments now calls getInitYtData twice:
    // 1. For continuation data (via getCDChat)
    // 2. For broadcast start time (via getLiveBroadcastStartTime)

    // Mock window object
    (global as any).window = {
        location: {
            href: 'https://www.youtube.com/watch?v=test-video-id'
        },
        ytcfg: {
            data_: {
                INNERTUBE_API_KEY: 'mock-api-key',
                INNERTUBE_CONTEXT: {}
            }
        }
    };

    let pbj1Calls: string[] = [];
    let liveChatRequestBody: any = null;

    const mockFetch = async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
        const urlStr = url.toString();

        if (urlStr.includes('pbj=1')) {
            // Record the call with timestamp to verify no duplicates
            pbj1Calls.push(`pbj=1 at ${Date.now()}`);

            // Note: getInitYtData uses text() + JSON.parse() to handle anti-JSON hijacking prefix
            const mockData = {
                response: {
                    contents: {
                        twoColumnWatchNextResults: {
                            conversationBar: {
                                liveChatRenderer: {
                                    continuations: [
                                        {
                                            reloadContinuationData: {
                                                continuation: 'test-continuation'
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            };
            return {
                ok: true,
                status: 200,
                text: async () => JSON.stringify(mockData),
                json: async () => mockData
            } as Response;
        }

        if (urlStr.includes('get_live_chat')) {
            // Capture the request body to verify continuation token is passed
            if (options?.body) {
                liveChatRequestBody = JSON.parse(options.body as string);
            }

            return {
                ok: true,
                status: 200,
                json: async () => ({
                    continuationContents: {
                        liveChatContinuation: {
                            actions: []
                        }
                    }
                })
            } as Response;
        }

        return {
            ok: true,
            status: 200,
            json: async () => ({})
        } as Response;
    };

    const originalFetch = global.fetch;

    try {
        setFetchImplementation(mockFetch as any);
        global.fetch = mockFetch as any;

        const mockElement = { textContent: '', classList: { remove: () => {}, add: () => {} } } as any;
        const mockSignal = new AbortController().signal;

        try {
            await getChatComments(mockSignal, mockElement);
        } catch (e) {
            // Expected
        }

        // Verify expected number of calls (continuation + broadcastStartTime)
        assert.strictEqual(
            pbj1Calls.length,
            2,
            `pbj=1 should be called exactly twice. Calls: ${pbj1Calls.join(', ')}`
        );

        // Verify continuation token was passed to getLiveChat
        assert.ok(
            liveChatRequestBody,
            'Expected getLiveChat to be called with request body'
        );

        assert.strictEqual(
            liveChatRequestBody.continuation,
            'test-continuation',
            `Expected continuation token to be 'test-continuation', but got '${liveChatRequestBody?.continuation}'`
        );

        console.log(`✓ Verified pbj=1 calls: ${pbj1Calls.join(', ')}`);
        console.log(`✓ Verified continuation token passed: ${liveChatRequestBody.continuation}`);
    } finally {
        global.fetch = originalFetch;
        setFetchImplementation(originalFetch);

        // Clean up window mock
        delete (global as any).window;
    }
});
