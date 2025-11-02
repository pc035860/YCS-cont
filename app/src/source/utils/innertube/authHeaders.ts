import SHA1 from 'crypto-js/sha1.js';

export interface AuthorizationExtra {
    key: string;
    value: string;
}

export interface BuildSapSidAuthorizationHeaderOptions {
    extras?: AuthorizationExtra[];
    now?: () => number;
    context?: Window & typeof globalThis;
    hrefOverride?: string;
}

const HTTPS_LIKE_SCHEMES = new Set(['https:', 'chrome-extension:', 'chrome-untrusted:', 'moz-extension:']);
const ALLOWED_ORIGIN_SCHEMES = new Set([
    'http',
    'https',
    'chrome-extension',
    'moz-extension',
    'file',
    'android-app',
    'chrome-search',
    'chrome-untrusted',
    'chrome',
    'app',
    'devtools'
]);

/**
 * Builds the YouTube SAPISID-based Authorization header, mirroring the behaviour observed in
 * `live_chat_polymer.js` while keeping function and variable names human readable.
 */
export function buildSapSidAuthorizationHeader(options: BuildSapSidAuthorizationHeaderOptions = {}): string | null {
    const context = options.context ?? (typeof window !== 'undefined' ? window : undefined);
    if (!context) {
        return null;
    }

    const href = options.hrefOverride ?? context.location?.href;
    if (!href) {
        return null;
    }

    const origin = normaliseOrigin(href, context);
    if (!origin) {
        return null;
    }

    const isHttpsLike = HTTPS_LIKE_SCHEMES.has(originScheme(origin));
    const now = options.now ?? (() => Date.now());
    const extras = options.extras;

    const tokens: string[] = [];
    const baseSecret = resolveSidCandidate(
        context,
        isHttpsLike ? ['__SAPISID'] : ['__APISID'],
        isHttpsLike ? ['SAPISID', '__Secure-3PAPISID'] : ['APISID']
    );

    if (baseSecret) {
        const headerName = isHttpsLike ? 'SAPISIDHASH' : 'APISIDHASH';
        const token = buildToken(headerName, baseSecret, origin, extras, now);
        if (token) {
            tokens.push(token);
        }
    }

    if (isHttpsLike) {
        const onePSid = resolveSidCandidate(context, ['__1PSAPISID'], ['__Secure-1PAPISID']);
        if (onePSid) {
            const token = buildToken('SAPISID1PHASH', onePSid, origin, extras, now);
            if (token) {
                tokens.push(token);
            }
        }

        const threePSid = resolveSidCandidate(context, ['__3PSAPISID'], ['__Secure-3PAPISID']);
        if (threePSid) {
            const token = buildToken('SAPISID3PHASH', threePSid, origin, extras, now);
            if (token) {
                tokens.push(token);
            }
        }
    }

    return tokens.length ? tokens.join(' ') : null;
}

function originScheme(origin: string): string {
    const separatorIndex = origin.indexOf(':');
    return separatorIndex === -1 ? '' : `${origin.substring(0, separatorIndex + 1)}`;
}

function normaliseOrigin(url: string, context: Window & typeof globalThis): string | null {
    if (!url) {
        return null;
    }

    if (/^about:(?:blank|srcdoc)$/i.test(url)) {
        return context.origin || null;
    }

    let candidate = url;
    if (candidate.startsWith('blob:')) {
        candidate = candidate.substring(5);
    }

    const hashIndex = candidate.indexOf('#');
    if (hashIndex !== -1) {
        candidate = candidate.substring(0, hashIndex);
    }

    const queryIndex = candidate.indexOf('?');
    if (queryIndex !== -1) {
        candidate = candidate.substring(0, queryIndex);
    }

    candidate = candidate.toLowerCase();

    if (candidate.startsWith('//')) {
        const protocol =
            context.location?.protocol ?? (typeof window !== 'undefined' ? window.location.protocol : 'https:');
        candidate = `${protocol}${candidate}`;
    }

    if (!/^[\w-]*:\/\//.test(candidate)) {
        const fallback = context.location?.href;
        if (!fallback) {
            return null;
        }
        candidate = fallback.toLowerCase();
    }

    const schemeEndIndex = candidate.indexOf('://');
    if (schemeEndIndex === -1) {
        return null;
    }
    const scheme = candidate.substring(0, schemeEndIndex);

    if (!ALLOWED_ORIGIN_SCHEMES.has(scheme)) {
        return null;
    }

    let authority = candidate.substring(schemeEndIndex + 3);
    const slashIndex = authority.indexOf('/');
    if (slashIndex !== -1) {
        authority = authority.substring(0, slashIndex);
    }

    let host = authority;
    let portSuffix = '';

    const colonIndex = authority.indexOf(':');
    if (colonIndex !== -1) {
        host = authority.substring(0, colonIndex);
        const port = authority.substring(colonIndex + 1);
        if (!((scheme === 'http' && port === '80') || (scheme === 'https' && port === '443'))) {
            portSuffix = `:${port}`;
        }
    }

    return `${scheme}://${host}${portSuffix}`;
}

function resolveSidCandidate(
    context: Window & typeof globalThis,
    windowProperties: string[],
    cookieNames: string[]
): string | undefined {
    const contextAny = context as unknown as Record<string, unknown>;

    for (const property of windowProperties) {
        const value = contextAny?.[property];
        if (typeof value === 'string' && value) {
            return value;
        }
    }

    const doc = context.document;
    if (!doc || typeof doc.cookie !== 'string' || doc.cookie.length === 0) {
        return undefined;
    }

    for (const cookieName of cookieNames) {
        const cookieValue = readCookie(doc.cookie, cookieName);
        if (cookieValue !== undefined) {
            return cookieValue;
        }
    }

    return undefined;
}

function readCookie(cookieHeader: string, name: string): string | undefined {
    const segments = cookieHeader.split(';');
    for (const rawSegment of segments) {
        const segment = rawSegment.trim();
        if (!segment.length) {
            continue;
        }
        if (segment.startsWith(`${name}=`)) {
            return segment.substring(name.length + 1);
        }
        if (segment === name) {
            return '';
        }
    }
    return undefined;
}

function buildToken(
    headerName: string,
    secret: string,
    origin: string,
    extras: AuthorizationExtra[] | undefined,
    now: () => number
): string | null {
    if (!secret) {
        return null;
    }

    const usableExtras = Array.isArray(extras)
        ? extras.filter((item): item is AuthorizationExtra => Boolean(item && item.key && item.value))
        : [];

    const timestamp = Math.floor(now() / 1000);
    const valuePart = usableExtras.length ? usableExtras.map((item) => item.value).join(':') : '';

    const payloadParts = usableExtras.length
        ? [valuePart, String(timestamp), secret, origin]
        : [String(timestamp), secret, origin];

    const digest = sha1Hex(payloadParts.join(' '));
    const keySuffix = usableExtras.map((item) => item.key).join('');
    let tokenBody = `${timestamp}_${digest}`;

    if (keySuffix) {
        tokenBody += `_${keySuffix}`;
    }

    return `${headerName} ${tokenBody}`;
}

function sha1Hex(input: string): string {
    return SHA1(input).toString();
}
