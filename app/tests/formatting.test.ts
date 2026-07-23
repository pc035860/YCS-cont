import { strict as assert } from 'node:assert';
import test from 'node:test';

import { safeUrl, parseFormattedNumber, getCommentsHtmlText } from '../src/source/utils/formatting';
import { formatCommentRuns } from '../src/source/utils/innertube/comments/pipeline';
import { formatChatRuns } from '../src/source/utils/innertube/chat/utils';
import { escapeHtml } from '../src/source/utils/common';

test('safeUrl normalizes common URLs and blocks non-http/https schemes', () => {
    assert.equal(safeUrl('https://example.com/path'), 'https://example.com/path');
    assert.equal(safeUrl('/watch?v=123'), 'https://www.youtube.com/watch?v=123');
    assert.equal(safeUrl('www.youtube.com/watch?v=456'), 'https://www.youtube.com/watch?v=456');
    assert.equal(safeUrl('javascript:alert(1)'), '#');
});

test('XSS check javascript:void', () => {
    const runs = [ { text: "<a href=javascript:alert('XSS')>Click me</a>" } ];
    const formatted = formatCommentRuns(runs, '123');
    const renderFullTextComment = formatted.renderFullText;
    assert.equal(renderFullTextComment, '&lt;a href=javascript:alert(&apos;XSS&apos;)&gt;Click me&lt;/a&gt;');
});

test('XSS check <script> tag', () => {
    const runs = [ { text: "<script>alert('XSS')</script>" } ];
    const formatted = formatCommentRuns(runs, '123');
    const renderFullTextComment = formatted.renderFullText;
    assert.equal(renderFullTextComment, '&lt;script&gt;alert(&apos;XSS&apos;)&lt;/script&gt;');
});

test('formatted timestamp comment', () => {
    const runs = [
        {
            navigationEndpoint: {
                watchEndpoint: {
                    videoId: '123',
                    startTimeSeconds: '30'
                }
            },
            text: "0:30"
        }
    ];
    const formatted = formatCommentRuns(runs, '123');
    const renderFullTextComment = formatted.renderFullText;
    assert.equal(renderFullTextComment, '<a class="ycs-cpointer ycs-goto-comment-time" href="https://www.youtube.com/watch?v=123&t=30s" data-offsetvideo="30" data-video-id="123">0:30</a>',);
});

test('formatted link comment', () => {
    const runs = [
        {
            navigationEndpoint: {
                urlEndpoint: {
                    url: 'https://github.com/pc035860/YCS-cont'
                }
            },
            text: "https://github.com/pc035860/YCS-cont" // Links on youtube should be the same as the url
        }
    ];
    const formatted = formatCommentRuns(runs, '123');
    const renderFullTextComment = formatted.renderFullText;
    assert.equal(renderFullTextComment, '<a class="ycs-cpointer ycs-comment-link" href="https://github.com/pc035860/YCS-cont" target="_blank">https://github.com/pc035860/YCS-cont</a>');
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

// ============================================================================
// formatChatRuns XSS Security Tests
// ============================================================================

test('formatChatRuns: XSS - script tag in text should be encoded', () => {
    const runs = [{ text: "<script>alert('XSS')</script>" }];
    const result = formatChatRuns(runs);
    // html-entities encodes single quotes as &apos;
    assert.equal(result.richText, "&lt;script&gt;alert(&apos;XSS&apos;)&lt;/script&gt;");
});

test('formatChatRuns: XSS - HTML injection in text should be encoded', () => {
    const runs = [{ text: '<img onerror="alert(1)" src="x">' }];
    const result = formatChatRuns(runs);
    assert.equal(result.richText, '&lt;img onerror=&quot;alert(1)&quot; src=&quot;x&quot;&gt;');
});

test('formatChatRuns: XSS - javascript: URL in navigationEndpoint should be blocked', () => {
    const runs = [
        {
            text: 'Click me',
            navigationEndpoint: {
                urlEndpoint: {
                    url: "javascript:alert('XSS')"
                }
            }
        }
    ];
    const result = formatChatRuns(runs);
    // safeUrl should convert javascript: to #
    assert.ok(result.richText.includes('href="#"'), 'javascript: URL should be converted to #');
    assert.ok(result.richText.includes('>Click me</a>'), 'Link text should be preserved');
});

test('formatChatRuns: XSS - data: URL in navigationEndpoint should be blocked', () => {
    const runs = [
        {
            text: 'Click me',
            navigationEndpoint: {
                urlEndpoint: {
                    url: 'data:text/html,<script>alert(1)</script>'
                }
            }
        }
    ];
    const result = formatChatRuns(runs);
    assert.ok(result.richText.includes('href="#"'), 'data: URL should be converted to #');
});

test('formatChatRuns: XSS - text in timestamp link should be encoded', () => {
    const runs = [
        {
            text: '<script>alert(1)</script>',
            navigationEndpoint: {
                watchEndpoint: {
                    videoId: 'abc123',
                    startTimeSeconds: 30
                }
            }
        }
    ];
    const result = formatChatRuns(runs);
    assert.ok(result.richText.includes('&lt;script&gt;'), 'Script tag in timestamp link text should be encoded');
    assert.ok(result.richText.includes('data-offsetvideo="30"'), 'Timestamp data attribute should be preserved');
});

test('formatChatRuns: XSS - emoji alt text should be encoded', () => {
    const runs = [
        {
            emoji: {
                shortcuts: ['<script>alert(1)</script>'],
                image: {
                    thumbnails: [{ url: 'https://example.com/emoji.png' }],
                    accessibility: { accessibilityData: { label: 'emoji' } }
                }
            }
        }
    ];
    const result = formatChatRuns(runs);
    assert.ok(result.richText.includes('alt="&lt;script&gt;'), 'Emoji alt should be encoded');
    assert.ok(result.richText.includes('title="&lt;script&gt;'), 'Emoji title should be encoded');
});

test('formatChatRuns: valid https URL should be preserved', () => {
    const runs = [
        {
            text: 'Visit my site',
            navigationEndpoint: {
                urlEndpoint: {
                    url: 'https://example.com/page'
                }
            }
        }
    ];
    const result = formatChatRuns(runs);
    assert.ok(result.richText.includes('href="https://example.com/page"'), 'Valid https URL should be preserved');
});

test('formatChatRuns: relative YouTube URL should be normalized', () => {
    const runs = [
        {
            text: 'Watch this',
            navigationEndpoint: {
                browseEndpoint: {
                    canonicalBaseUrl: '/channel/UC123'
                }
            }
        }
    ];
    const result = formatChatRuns(runs);
    assert.ok(
        result.richText.includes('href="https://www.youtube.com/channel/UC123"'),
        'Relative URL should be normalized to absolute'
    );
});

// ============================================================================
// formatCommentRuns XSS Security Tests (additional)
// ============================================================================

test('formatCommentRuns: XSS - javascript: URL in navigationEndpoint should be blocked', () => {
    const runs = [
        {
            text: 'Click me',
            navigationEndpoint: {
                urlEndpoint: {
                    url: "javascript:alert('XSS')"
                }
            }
        }
    ];
    const result = formatCommentRuns(runs, 'video123');
    assert.ok(result.renderFullText.includes('href="#"'), 'javascript: URL should be converted to #');
});

test('formatCommentRuns: XSS - text in external link should be encoded', () => {
    const runs = [
        {
            text: '<img src=x onerror=alert(1)>',
            navigationEndpoint: {
                urlEndpoint: {
                    url: 'https://example.com'
                }
            }
        }
    ];
    const result = formatCommentRuns(runs, 'video123');
    assert.ok(result.renderFullText.includes('&lt;img'), 'HTML in link text should be encoded');
    assert.ok(!result.renderFullText.includes('<img src=x'), 'Raw HTML should not appear');
});

test('formatCommentRuns: XSS - emoji alt text should be encoded', () => {
    const runs = [
        {
            emoji: {
                shortcuts: ['"onclick="alert(1)"'],
                image: {
                    thumbnails: [{ url: 'https://example.com/emoji.png' }]
                }
            }
        }
    ];
    const result = formatCommentRuns(runs, 'video123');
    assert.ok(result.renderFullText.includes('alt="&quot;onclick'), 'Emoji alt should be encoded');
});

// ============================================================================
// safeUrl Security Tests
// ============================================================================

test('safeUrl: blocks various dangerous protocols', () => {
    assert.equal(safeUrl('javascript:alert(1)'), '#');
    assert.equal(safeUrl('JAVASCRIPT:alert(1)'), '#');
    assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), '#');
    assert.equal(safeUrl('vbscript:msgbox(1)'), '#');
    assert.equal(safeUrl('file:///etc/passwd'), '#');
    assert.equal(safeUrl('about:blank'), '#');
});

test('safeUrl: allows safe protocols', () => {
    assert.equal(safeUrl('https://example.com'), 'https://example.com');
    assert.equal(safeUrl('http://example.com'), 'http://example.com');
    assert.equal(safeUrl('HTTPS://EXAMPLE.COM'), 'HTTPS://EXAMPLE.COM');
});

// ============================================================================
// Image src URL XSS Tests
// ============================================================================

test('formatCommentRuns: javascript: URL in emoji image should be blocked', () => {
    const runs = [
        {
            emoji: {
                shortcuts: ['emoji'],
                image: {
                    thumbnails: [{ url: 'javascript:alert(1)' }]
                }
            }
        }
    ];
    const result = formatCommentRuns(runs, 'video123');
    assert.ok(result.renderFullText.includes('src="#"'), 'javascript: URL should be replaced with #');
    assert.ok(!result.renderFullText.includes('javascript:'), 'javascript: should not appear in output');
});

test('formatCommentRuns: data: URL in emoji image should be blocked', () => {
    const runs = [
        {
            emoji: {
                shortcuts: ['emoji'],
                image: {
                    thumbnails: [{ url: 'data:text/html,<script>alert(1)</script>' }]
                }
            }
        }
    ];
    const result = formatCommentRuns(runs, 'video123');
    assert.ok(result.renderFullText.includes('src="#"'), 'data: URL should be replaced with #');
    assert.ok(!result.renderFullText.includes('data:'), 'data: should not appear in output');
});

test('formatChatRuns: javascript: URL in emoji image should be blocked', () => {
    const runs = [
        {
            emoji: {
                shortcuts: ['emoji'],
                image: {
                    thumbnails: [{ url: 'javascript:alert(1)' }],
                    accessibility: { accessibilityData: { label: 'emoji' } }
                }
            }
        }
    ];
    const result = formatChatRuns(runs);
    assert.ok(result.richText.includes('src="#"'), 'javascript: URL should be replaced with #');
    assert.ok(!result.richText.includes('javascript:'), 'javascript: should not appear in output');
});

test('formatChatRuns: valid https URL in emoji image should be allowed', () => {
    const runs = [
        {
            emoji: {
                shortcuts: ['emoji'],
                image: {
                    thumbnails: [{ url: 'https://yt3.ggpht.com/emoji.png' }],
                    accessibility: { accessibilityData: { label: 'emoji' } }
                }
            }
        }
    ];
    const result = formatChatRuns(runs);
    assert.ok(result.richText.includes('src="https://yt3.ggpht.com/emoji.png"'), 'Valid https URL should be preserved');
});

// ============================================================================
// Double-encoding Prevention Tests
// ============================================================================

test('escapeHtml: pre-encoded HTML entities should not be double-encoded', () => {
    // Already encoded ampersand should stay as &amp; not become &amp;amp;
    assert.equal(escapeHtml('&amp;'), '&amp;');
    assert.equal(escapeHtml('&lt;'), '&lt;');
    assert.equal(escapeHtml('&gt;'), '&gt;');
    assert.equal(escapeHtml('&quot;'), '&quot;');
});

test('escapeHtml: numeric HTML entities should be preserved', () => {
    // Numeric entities like &#39; should not be double-encoded
    assert.equal(escapeHtml('&#39;'), '&#39;');
    assert.equal(escapeHtml('&#x27;'), '&#x27;');
    assert.equal(escapeHtml('&#60;'), '&#60;');
});

test('escapeHtml: named HTML entities should be preserved', () => {
    // Named entities like &copy; should not become &amp;copy;
    assert.equal(escapeHtml('&copy;'), '&copy;');
    assert.equal(escapeHtml('&nbsp;'), '&nbsp;');
    assert.equal(escapeHtml('&reg;'), '&reg;');
});

test('escapeHtml: mixed content with entities and raw characters', () => {
    // Mix of already-encoded and raw characters
    assert.equal(escapeHtml('Hello &amp; World'), 'Hello &amp; World');
    assert.equal(escapeHtml('Test &lt;script&gt; tag'), 'Test &lt;script&gt; tag');
    // Raw & should be encoded, but &amp; should stay
    assert.equal(escapeHtml('A & B &amp; C'), 'A &amp; B &amp; C');
});

test('escapeHtml: raw special characters should be encoded', () => {
    // Raw characters that need encoding
    assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
    assert.equal(escapeHtml('"quoted"'), '&quot;quoted&quot;');
    assert.equal(escapeHtml("it's"), 'it&#39;s');
});

test('getCommentsHtmlText: Data API comment (simpleText only, absolute authorEndpoint URL) renders time + non-glued URL', () => {
    // Simulates Data API transform output — publishedTimeText has only `simpleText`
    // (no `runs`), authorEndpoint carries an absolute channel URL.
    const comments = [
        {
            typeComment: 'C',
            commentRenderer: {
                commentId: 'c1',
                authorText: { simpleText: 'DataApiUser' },
                authorEndpoint: {
                    commandMetadata: {
                        webCommandMetadata: { url: 'http://www.youtube.com/channel/UCabc' }
                    }
                },
                publishedTimeText: { simpleText: '3 days ago' },
                contentText: { fullText: 'hi from data api' },
                likeCount: 0
            }
        }
    ];
    const html = getCommentsHtmlText(comments)?.html as string;
    assert.equal(typeof html, 'string', 'getCommentsHtmlText returns { html }');
    // Author channel URL: absolute -> passthrough, NOT prefixed with youtube.com
    assert.ok(html.includes('http://www.youtube.com/channel/UCabc'), 'should include absolute channel URL');
    assert.ok(!html.includes('youtube.comhttp://'), 'must not glue youtube.com in front of absolute URL');
    // Published time falls back to simpleText
    assert.ok(html.includes('3 days ago'), 'should include simpleText published time');
    // Nav URL is absent on Data API renderers — the whole line must be skipped,
    // not left as an orphan bare `youtube.com` row.
    assert.ok(!/\nyoutube\.com\s*\n/.test(html), 'must not emit orphan `youtube.com` line when nav URL is empty');
});

test('getCommentsHtmlText: full-scan comment keeps published-navigation line when URL is present', () => {
    // Regression guard for the orphan-nav-line fix: when navigationEndpoint exists,
    // the nav row must still be rendered (not accidentally suppressed).
    const comments = [
        {
            typeComment: 'C',
            commentRenderer: {
                commentId: 'c3',
                authorText: { simpleText: 'FullScan2' },
                authorEndpoint: {
                    commandMetadata: { webCommandMetadata: { url: '/@fs2' } }
                },
                publishedTimeText: {
                    runs: [
                        {
                            text: '1 hour ago',
                            navigationEndpoint: {
                                commandMetadata: { webCommandMetadata: { url: '/watch?v=abc&lc=c3' } }
                            }
                        }
                    ]
                },
                contentText: { fullText: 'body' },
                likeCount: 0
            }
        }
    ];
    const html = getCommentsHtmlText(comments)?.html as string;
    assert.ok(html.includes('youtube.com/watch?v=abc&lc=c3'), 'nav URL line still present when URL exists');
});

test('getCommentsHtmlText: full-scan comment (runs + relative authorEndpoint URL) keeps legacy behaviour', () => {
    const comments = [
        {
            typeComment: 'C',
            commentRenderer: {
                commentId: 'c2',
                authorText: { simpleText: 'FullScanUser' },
                authorEndpoint: {
                    commandMetadata: {
                        webCommandMetadata: { url: '/@fullscan' }
                    }
                },
                publishedTimeText: {
                    runs: [
                        {
                            text: '5 minutes ago',
                            navigationEndpoint: {
                                commandMetadata: { webCommandMetadata: { url: '/watch?v=vid&lc=c2' } }
                            }
                        }
                    ]
                },
                contentText: { fullText: 'legacy path' },
                likeCount: 1
            }
        }
    ];
    const html = getCommentsHtmlText(comments)?.html as string;
    assert.ok(html.includes('youtube.com/@fullscan'), 'legacy relative path is prefixed');
    assert.ok(html.includes('youtube.com/watch?v=vid&lc=c2'), 'legacy nav URL is prefixed');
    assert.ok(html.includes('5 minutes ago'), 'runs[0].text preferred when present');
});
