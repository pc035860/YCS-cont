import assert from 'node:assert';
import test from 'node:test';

import { buildInnertubeHeaders, type YtcfgData } from '../src/source/utils/innertube/request';

/**
 * Helper: Build a minimal fake Window with cookies so that
 * buildSapSidAuthorizationHeader() produces a real SAPISIDHASH header.
 */
const createFakeWindow = (cookie = 'SAPISID=fake_sapisid_value') =>
    ({
        location: { href: 'https://www.youtube.com/watch?v=abc123', protocol: 'https:' },
        document: { cookie },
        origin: 'https://www.youtube.com'
    }) as unknown as Window & typeof globalThis;

const baseYtcfg: YtcfgData = {
    INNERTUBE_CONTEXT_CLIENT_NAME: '1',
    INNERTUBE_CONTEXT_CLIENT_VERSION: '2.20240101.00.00'
};

test('buildInnertubeHeaders: disableAuth=true skips auth and multi-account headers', () => {
    const headers = buildInnertubeHeaders(
        { ...baseYtcfg, SESSION_INDEX: 1, DELEGATED_SESSION_ID: 'delegated-abc' },
        {},
        createFakeWindow(),
        { disableAuth: true }
    );

    assert.strictEqual(headers.authorization, undefined);
    assert.strictEqual(headers['x-goog-authuser'], undefined);
    assert.strictEqual(headers['x-goog-pageid'], undefined);
});

test('buildInnertubeHeaders: no globalContext → no auth and no multi-account headers', () => {
    const headers = buildInnertubeHeaders({ ...baseYtcfg, SESSION_INDEX: 1 });

    assert.strictEqual(headers.authorization, undefined);
    assert.strictEqual(headers['x-goog-authuser'], undefined);
    assert.strictEqual(headers['x-goog-pageid'], undefined);
});

test('buildInnertubeHeaders: SESSION_INDEX=0 attaches x-goog-authuser: "0"', () => {
    const headers = buildInnertubeHeaders(
        { ...baseYtcfg, SESSION_INDEX: 0 },
        {},
        createFakeWindow()
    );

    assert.ok(headers.authorization?.startsWith('SAPISIDHASH'));
    assert.strictEqual(headers['x-goog-authuser'], '0');
    assert.strictEqual(headers['x-goog-pageid'], undefined);
});

test('buildInnertubeHeaders: SESSION_INDEX=1 attaches x-goog-authuser: "1" (secondary account)', () => {
    const headers = buildInnertubeHeaders(
        { ...baseYtcfg, SESSION_INDEX: 1 },
        {},
        createFakeWindow()
    );

    assert.ok(headers.authorization?.startsWith('SAPISIDHASH'));
    assert.strictEqual(headers['x-goog-authuser'], '1');
});

test('buildInnertubeHeaders: SESSION_INDEX as string "2" is accepted', () => {
    const headers = buildInnertubeHeaders(
        { ...baseYtcfg, SESSION_INDEX: '2' },
        {},
        createFakeWindow()
    );

    assert.strictEqual(headers['x-goog-authuser'], '2');
});

test('buildInnertubeHeaders: DELEGATED_SESSION_ID attaches x-goog-pageid', () => {
    const headers = buildInnertubeHeaders(
        { ...baseYtcfg, SESSION_INDEX: 0, DELEGATED_SESSION_ID: 'delegated-123' },
        {},
        createFakeWindow()
    );

    assert.strictEqual(headers['x-goog-authuser'], '0');
    assert.strictEqual(headers['x-goog-pageid'], 'delegated-123');
});

test('buildInnertubeHeaders: SESSION_INDEX undefined → no x-goog-authuser header', () => {
    const headers = buildInnertubeHeaders(baseYtcfg, {}, createFakeWindow());

    assert.ok(headers.authorization?.startsWith('SAPISIDHASH'));
    assert.strictEqual(headers['x-goog-authuser'], undefined);
    assert.strictEqual(headers['x-goog-pageid'], undefined);
});

test('buildInnertubeHeaders: SESSION_INDEX=null must not produce "null" header', () => {
    const headers = buildInnertubeHeaders(
        { ...baseYtcfg, SESSION_INDEX: null as unknown as undefined },
        {},
        createFakeWindow()
    );

    assert.strictEqual(headers['x-goog-authuser'], undefined);
});

test('buildInnertubeHeaders: preserves base headers alongside multi-account headers', () => {
    const headers = buildInnertubeHeaders(
        { ...baseYtcfg, SESSION_INDEX: 1 },
        {},
        createFakeWindow()
    );

    assert.strictEqual(headers['x-youtube-client-name'], '1');
    assert.strictEqual(headers['x-youtube-client-version'], '2.20240101.00.00');
    assert.strictEqual(headers['content-type'], 'application/json');
    assert.strictEqual(headers['accept'], '*/*');
    assert.strictEqual(headers['x-goog-authuser'], '1');
});

test('buildInnertubeHeaders: empty DELEGATED_SESSION_ID is ignored', () => {
    const headers = buildInnertubeHeaders(
        { ...baseYtcfg, SESSION_INDEX: 0, DELEGATED_SESSION_ID: '' },
        {},
        createFakeWindow()
    );

    assert.strictEqual(headers['x-goog-pageid'], undefined);
});

test('buildInnertubeHeaders: no SAPISID cookie → no auth, no multi-account headers', () => {
    const headers = buildInnertubeHeaders(
        { ...baseYtcfg, SESSION_INDEX: 1 },
        {},
        createFakeWindow('OTHER_COOKIE=value')
    );

    assert.strictEqual(headers.authorization, undefined);
    assert.strictEqual(headers['x-goog-authuser'], undefined);
});
