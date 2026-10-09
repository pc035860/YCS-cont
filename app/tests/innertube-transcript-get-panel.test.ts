import assert from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    buildGetPanelTranscriptParams,
    getTranscriptVideo,
    parseGetPanelTranscript
} from '../src/source/utils/innertube/transcript';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Trimmed from a real jt508VjX2H8 get_panel response: 3 chapter sections, plus a chapter-title
// item inside section 2's contents and one segment without onTap (start parsed from timestamp).
const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'get-panel-transcript-trimmed.json'), 'utf-8'));

function cueGroupsOf(data: any): any[] {
    return data.actions[0].updateEngagementPanelAction.content.transcriptRenderer.body.transcriptBodyRenderer.cueGroups;
}

test('buildGetPanelTranscriptParams encodes field 149 { 1: videoId, 3: 1 }', () => {
    assert.equal(buildGetPanelTranscriptParams('en0GuyhieQk'), 'qgkPCgtlbjBHdXloaWVRaxgB');
});

test('parseGetPanelTranscript flattens all chapter sections and skips chapter titles', () => {
    const cueGroups = cueGroupsOf(parseGetPanelTranscript(fixture));

    assert.equal(cueGroups.length, 7);
    const starts = cueGroups.map((g) => g.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.startOffsetMs);
    assert.deepEqual(starts, [0, 119000, 123000, 131000, 4435000, 4440000, 4653000]);

    const first = cueGroups[0].transcriptCueGroupRenderer;
    assert.equal(first.formattedStartOffset.simpleText, '0:00');
    assert.ok(first.cues[0].transcriptCueRenderer.cue.simpleText.startsWith('An argument that'));

    const last = cueGroups.at(-1).transcriptCueGroupRenderer;
    assert.equal(last.formattedStartOffset.simpleText, '1:17:33');
    assert.ok(last.cues[0].transcriptCueRenderer.cue.simpleText.startsWith('And when [music] you do'));
});

test('parseGetPanelTranscript derives durations from the next start and video length', () => {
    const withoutLength = cueGroupsOf(parseGetPanelTranscript(fixture));
    const durations = withoutLength.map((g) => g.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.durationMs);
    assert.deepEqual(durations, [119000, 4000, 8000, 4304000, 5000, 213000, 0]);

    const withLength = cueGroupsOf(parseGetPanelTranscript(fixture, 4700));
    assert.equal(withLength.at(-1).transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.durationMs, 47000);
});

test('parseGetPanelTranscript returns undefined when the response has no content', () => {
    assert.equal(parseGetPanelTranscript({ responseContext: {}, trackingParams: 'x' }), undefined);
    assert.equal(parseGetPanelTranscript(undefined), undefined);
});

test('getTranscriptVideo falls back to get_panel when the player exposes no caption tracks', async () => {
    const globalAny = globalThis as any;
    const originalWindow = globalAny.window;
    const originalDocument = globalAny.document;
    const originalFetch = globalAny.fetch;
    const calls: { url: string; body: any }[] = [];

    try {
        globalAny.window = {
            location: { href: 'https://www.youtube.com/watch?v=jt508VjX2H8', protocol: 'https:' },
            navigator: { language: 'en-US' },
            document: { cookie: '' },
            ytcfg: { data_: { INNERTUBE_API_KEY: 'k', INNERTUBE_CONTEXT_CLIENT_VERSION: '2.test', HL: 'zh-TW' } }
        };
        const player = {
            getVideoData: () => ({ video_id: 'jt508VjX2H8' }),
            querySelector: () => ({ duration: 4700 })
        };
        globalAny.document = { getElementById: () => player, querySelector: () => ({ duration: 9999 }) };
        globalAny.fetch = async (url: string, init?: RequestInit) => {
            calls.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
            if (url.includes('/get_panel')) return { ok: true, json: async () => fixture } as Response;
            return { ok: true, json: async () => ({}) } as Response;
        };

        const data = await getTranscriptVideo(new AbortController().signal, { languageCode: 'ja' });

        assert.ok(!calls.some((c) => c.url.includes('get_transcript') || c.url.includes('timedtext')));
        const panelCall = calls.find((c) => c.url.includes('/youtubei/v1/get_panel'));
        assert.ok(panelCall);
        assert.equal(panelCall.body.panelId, 'PAmodern_transcript_view');
        assert.equal(panelCall.body.params, buildGetPanelTranscriptParams('jt508VjX2H8'));
        assert.deepEqual(panelCall.body.context.client, {
            clientName: 'WEB',
            clientVersion: '2.test',
            hl: 'ja',
            gl: 'US'
        });

        const cueGroups = cueGroupsOf(data);
        assert.equal(cueGroups.length, 7);
        // Last cue duration uses the matching player's own <video>, not the first one in the document
        assert.equal(cueGroups.at(-1).transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.durationMs, 47000);
    } finally {
        globalAny.window = originalWindow;
        globalAny.document = originalDocument;
        globalAny.fetch = originalFetch;
        if (originalWindow === undefined) delete globalAny.window;
        if (originalDocument === undefined) delete globalAny.document;
        if (originalFetch === undefined) delete globalAny.fetch;
    }
});
