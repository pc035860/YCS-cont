import { strict as assert } from 'node:assert';
import test from 'node:test';

import { formatSrtTimestamp, buildSrtContent } from '../src/source/utils/formatting';

// --- formatSrtTimestamp tests ---

test('formatSrtTimestamp returns 00:00:00,000 for 0ms', () => {
    assert.equal(formatSrtTimestamp(0), '00:00:00,000');
});

test('formatSrtTimestamp formats exact seconds correctly', () => {
    assert.equal(formatSrtTimestamp(5000), '00:00:05,000');
});

test('formatSrtTimestamp formats milliseconds correctly', () => {
    assert.equal(formatSrtTimestamp(1500), '00:00:01,500');
});

test('formatSrtTimestamp formats minutes and seconds', () => {
    assert.equal(formatSrtTimestamp(65300), '00:01:05,300');
});

test('formatSrtTimestamp formats hours correctly', () => {
    assert.equal(formatSrtTimestamp(3661500), '01:01:01,500');
});

test('formatSrtTimestamp pads hours to 2 digits', () => {
    assert.equal(formatSrtTimestamp(36000000), '10:00:00,000');
});

test('formatSrtTimestamp clamps negative values to 00:00:00,000', () => {
    assert.equal(formatSrtTimestamp(-1000), '00:00:00,000');
});

test('formatSrtTimestamp returns 00:00:00,000 for NaN', () => {
    assert.equal(formatSrtTimestamp(NaN), '00:00:00,000');
});

test('formatSrtTimestamp returns 00:00:00,000 for Infinity', () => {
    assert.equal(formatSrtTimestamp(Infinity), '00:00:00,000');
});

test('formatSrtTimestamp floors fractional ms to avoid millis=1000', () => {
    // 1999.6 → Math.round(999.6) would be 1000, but Math.floor(1999.6)=1999 → millis=999
    assert.equal(formatSrtTimestamp(1999.6), '00:00:01,999');
});

// --- buildSrtContent tests ---

function makeItem(startOffsetMs: number, durationMs: number, message: string) {
    return { startOffsetMs, durationMs, message };
}

test('buildSrtContent generates correct SRT format with two entries', () => {
    const items = [
        makeItem(0, 2500, 'Hello world'),
        makeItem(2500, 3000, 'Second line')
    ];

    const expected = [
        '1',
        '00:00:00,000 --> 00:00:02,500',
        'Hello world',
        '',
        '2',
        '00:00:02,500 --> 00:00:05,500',
        'Second line',
        '' // trailing newline
    ].join('\n');

    assert.equal(buildSrtContent(items), expected);
});

test('buildSrtContent returns empty string for empty array', () => {
    assert.equal(buildSrtContent([]), '');
});

test('buildSrtContent includes entries with empty message text', () => {
    const items = [
        makeItem(0, 1000, ''),
        makeItem(1000, 1000, 'After empty')
    ];

    const result = buildSrtContent(items);
    assert.ok(result.startsWith('1\n00:00:00,000 --> 00:00:01,000\n'));
    assert.ok(result.includes('2\n00:00:01,000 --> 00:00:02,000\nAfter empty'));
});

test('buildSrtContent calculates end time as startOffsetMs + durationMs', () => {
    const items = [makeItem(60000, 5500, 'At 1 minute')];

    const result = buildSrtContent(items);
    assert.ok(result.includes('00:01:00,000 --> 00:01:05,500'));
});

test('buildSrtContent single entry has trailing newline', () => {
    const items = [makeItem(0, 1000, 'Only one')];

    const result = buildSrtContent(items);
    assert.equal(result, '1\n00:00:00,000 --> 00:00:01,000\nOnly one\n');
});

test('buildSrtContent passes message through as-is (decode is done at source)', () => {
    // buildSrtContent expects already-decoded text from export-core
    const items = [makeItem(0, 2000, "Every time you explain your team's")];

    const result = buildSrtContent(items);
    assert.ok(result.includes("Every time you explain your team's"));
});
