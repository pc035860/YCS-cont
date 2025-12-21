import { strict as assert } from 'node:assert';
import test from 'node:test';

import { esc, safeUrl, sanitizeHtml, parseFormattedNumber } from '../src/source/utils/formatting';

test('esc converts special characters into HTML entities', () => {
    const raw = '<div>&\'"';
    const encoded = esc(raw);
    assert.equal(encoded, '&lt;div&gt;&amp;&#39;&quot;');
});

test('esc preserves existing HTML entities', () => {
    const raw = 'Fish &amp; Chips &copy; 2024 &#62;';
    const encoded = esc(raw);
    assert.equal(encoded, 'Fish &amp; Chips &copy; 2024 &#62;');
});

test('safeUrl normalizes common URLs and blocks non-http/https schemes', () => {
    assert.equal(safeUrl('https://example.com/path'), 'https://example.com/path');
    assert.equal(safeUrl('/watch?v=123'), 'https://www.youtube.com/watch?v=123');
    assert.equal(safeUrl('www.youtube.com/watch?v=456'), 'https://www.youtube.com/watch?v=456');
    assert.equal(safeUrl('javascript:alert(1)'), '#');
});

test('sanitizeHtml removes dangerous tags and normalizes href/src schemes', () => {
    const raw =
        '<div onclick="alert(1)"><a href="javascript:alert(1)">link</a><img src="/image.png" /></div><script>alert(1)</script>';
    const sanitized = sanitizeHtml(raw);
    assert.equal(
        sanitized,
        '<div><a href="#" rel="noopener noreferrer">link</a><img src="https://www.youtube.com/image.png" /></div>'
    );
});

test('parseFormattedNumber handles common formatting edge cases', () => {
    assert.equal(parseFormattedNumber('').number, 0);
    assert.equal(parseFormattedNumber('Antworten').number, 0);
    assert.equal(parseFormattedNumber('31 Antworten').number, 31);
    assert.equal(parseFormattedNumber('1\u00A0Antwort').number, 1);
    assert.equal(parseFormattedNumber('1.234').number, 1234);
    assert.equal(parseFormattedNumber('1 234').number, 1234);
    assert.equal(parseFormattedNumber('1,234').number, 1234);
    assert.equal(parseFormattedNumber('1.2k').number, 1200);
    assert.equal(parseFormattedNumber('1m').number, 1_000_000);
    assert.equal(parseFormattedNumber('1.5m').number, 1_500_000);
    assert.equal(parseFormattedNumber('1万').number, 10_000);
    assert.equal(parseFormattedNumber('1萬').number, 10_000);
    assert.equal(parseFormattedNumber('1 тыс.').number, 1000);
    assert.equal(parseFormattedNumber('1 хил.').number, 1000);
    assert.equal(parseFormattedNumber('1 tūkst.').number, 1000);
    assert.equal(parseFormattedNumber('1 χιλ.').number, 1000);
    assert.equal(parseFormattedNumber('1 hilj.').number, 1000);
    assert.equal(parseFormattedNumber('1 tis.').number, 1000);
    assert.equal(parseFormattedNumber('1 ming').number, 1000);
    assert.equal(parseFormattedNumber('1 mil').number, 1000);
    assert.equal(parseFormattedNumber('1 rb').number, 1000);
    assert.equal(parseFormattedNumber('1 천').number, 1000);
    assert.equal(parseFormattedNumber('1 만').number, 10_000);
    assert.equal(parseFormattedNumber('1 m').number, 1_000_000);
});
