import assert from 'node:assert';
import test from 'node:test';
import { getChatComments } from '../src/source/utils/innertube/chat';
import { setFetchImplementation } from '../src/source/utils/libs';

/**
 * Test: Verify that getChatComments does not trigger duplicate pbj=1 requests
 *
 * Background:
 * - Previously, clicking Chat Replay button would trigger 2 pbj=1 requests
 * - Root cause: getChatComments called getCDChat twice:
 *   1. Directly at line 186
 *   2. Inside getLiveChat at line 153
 *
 * Fix:
 * - Modified getLiveChat to accept continuationData as parameter
 * - Removed duplicate getCDChat call inside getLiveChat
 *
 * This test verifies the fix by:
 * 1. Mocking fetch to track pbj=1 request count
 * 2. Calling getChatComments
 * 3. Asserting pbj=1 is only called once
 */

test('getChatComments should only trigger pbj=1 request once', async () => {
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
            return {
                ok: true,
                status: 200,
                json: async () => ({
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
                })
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

        // Assert: pbj=1 should only be called ONCE
        assert.strictEqual(
            pbj1CallCount,
            1,
            `Expected pbj=1 to be called once, but was called ${pbj1CallCount} times`
        );

        // Assert: live chat API should be called at least once
        assert.ok(
            liveChatCallCount >= 1,
            `Expected live chat API to be called at least once, but was called ${liveChatCallCount} times`
        );

        console.log(`✓ pbj=1 request count: ${pbj1CallCount} (expected: 1)`);
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
    // This is an indirect test to verify that getLiveChat receives
    // continuation data from the first getCDChat call, rather than
    // making its own getCDChat call

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

            return {
                ok: true,
                status: 200,
                json: async () => ({
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
                })
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

        // Verify no duplicate calls
        assert.strictEqual(
            pbj1Calls.length,
            1,
            `pbj=1 should be called exactly once. Calls: ${pbj1Calls.join(', ')}`
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

        console.log(`✓ Verified single pbj=1 call: ${pbj1Calls[0]}`);
        console.log(`✓ Verified continuation token passed: ${liveChatRequestBody.continuation}`);
    } finally {
        global.fetch = originalFetch;
        setFetchImplementation(originalFetch);

        // Clean up window mock
        delete (global as any).window;
    }
});
