import { strict as assert } from 'node:assert';
import test from 'node:test';

import { esc, safeUrl, sanitizeHtml } from '../src/source/utils/formatting';

test('esc converts special characters into HTML entities', () => {
    const raw = "<div>&'\"";
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
    const raw = '<div onclick="alert(1)"><a href="javascript:alert(1)">link</a><img src="/image.png" /></div><script>alert(1)</script>';
    const sanitized = sanitizeHtml(raw);
    assert.equal(
        sanitized,
        '<div><a href="#" rel="noopener noreferrer">link</a><img src="https://www.youtube.com/image.png" /></div>'
    );
});
