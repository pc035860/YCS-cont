import { strict as assert } from 'node:assert';
import test from 'node:test';

import { esc, safeUrl, sanitizeHtml } from '../src/source/utils/formatting';

test('esc 會正確轉換特殊字元為 HTML 實體', () => {
    const raw = "<div>&'\"";
    const encoded = esc(raw);
    assert.equal(encoded, '&lt;div&gt;&amp;&apos;&quot;');
});

test('safeUrl 會標準化常見網址並阻擋非 http/https 協議', () => {
    assert.equal(safeUrl('https://example.com/path'), 'https://example.com/path');
    assert.equal(safeUrl('/watch?v=123'), 'https://www.youtube.com/watch?v=123');
    assert.equal(safeUrl('www.youtube.com/watch?v=456'), 'https://www.youtube.com/watch?v=456');
    assert.equal(safeUrl('javascript:alert(1)'), '#');
});

test('sanitizeHtml 會移除危險標籤並固定 href/src 協議', () => {
    const raw = '<div onclick="alert(1)"><a href="javascript:alert(1)">連結</a><img src="/image.png" /></div><script>alert(1)</script>';
    const sanitized = sanitizeHtml(raw);
    assert.equal(
        sanitized,
        '<div><a href="#" rel="noopener noreferrer">連結</a><img src="https://www.youtube.com/image.png" /></div>'
    );
});
