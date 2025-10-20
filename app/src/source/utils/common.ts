import { decode } from 'html-entities';

const GlobalStore = ((): any => {
    const store = {};

    return (): any => store;
})();

function randomString(len: number): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const charactersLength = characters.length;
    for (let i = 0; i < len; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function isNumeric(digit: string | number): boolean {
    if (typeof digit != 'string' && typeof digit != 'number') return false;

    return !isNaN(digit as any) && !isNaN(parseFloat(digit as any));
}

function oIsEmpty(obj: object): boolean {
    return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
}

function getObj(obj: any, path: string | [], def: any): any {
    function stringToPath(p: string | []): [] {
        if (typeof p !== 'string') return p as [];

        const result: any = [];

        p.split('.').forEach(function (v) {
            v.split(/\[([^}]+)\]/g).forEach(function (key) {
                if (key.length > 0) {
                    result.push(key);
                }
            });
        });

        return result;
    }

    try {
        const paths = stringToPath(path);

        let resultObj = obj;

        for (let i = 0; i < paths.length; i++) {
            if (!resultObj[paths[i]]) return def;

            resultObj = resultObj[paths[i]];
        }

        return resultObj;
    } catch (err) {
        console.error(err);
        return def;
    }
}

function wrapTryCatch<T>(fn: () => T): T | undefined {
    try {
        return fn();
    } catch (e) {
        return undefined;
    }
}

function escapeHtml(input: unknown): string {
    try {
        const s = String(input ?? '');
        const encodedAmpersands = s.replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]+;)/g, '&amp;');

        return encodedAmpersands
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    } catch {
        return '';
    }
}

function decodeHtml(input: unknown): string {
    try {
        const s = String(input ?? '');
        return decode(s);
    } catch {
        return '';
    }
}

function deepFindObjKey(obj: object, key: string): Array<any> {
    const matches: any[] = [];

    try {
        const iterate = function iterate(object: any, path?: unknown): void {
            let match: any, item;

            const newPath = function (add: unknown): string | unknown {
                return path ? (path as string) + '.' + add : add;
            };

            if (Object.prototype.hasOwnProperty.call(object, key)) {
                match = {};

                match[newPath(key) as string] = object[key];

                matches.push(match);
            }

            for (item in object) {
                if (Object.prototype.hasOwnProperty.call(object, item) && typeof (object as any)[item] === 'object') {
                    iterate(object[item], newPath(item));
                }
            }
        };

        iterate(obj);
    } catch (err) {
        console.error(err);
        return [];
    }

    return matches;
}

function getVideoId(url: string): string | undefined {
    try {
        if (typeof url !== 'string') return;

        const parsedUrl = new URL(url);

        const vParam = parsedUrl.searchParams.get('v');
        if (vParam) return vParam;

        const host = parsedUrl.hostname;
        const pathname = parsedUrl.pathname || '';
        const segments = pathname.split('/').filter(Boolean);
        if ((host === 'www.youtube.com' || host.endsWith('youtube.com')) && segments[0] === 'live' && segments[1]) {
            return segments[1];
        }

        if (host === 'youtu.be' && segments[0]) {
            return segments[0];
        }

        return;
    } catch (e) {
        console.error(e);
        return;
    }
}

function getCleanUrlVideo(url: string): string | undefined {
    try {
        if (typeof url !== 'string') return;

        const videoId = getVideoId(url);
        if (!videoId) return;

        const cleanUrl = new URL('https://www.youtube.com/watch');
        cleanUrl.searchParams.set('v', videoId);
        return cleanUrl.href;
    } catch (e) {
        console.error(e);
        return;
    }
}

function isWatchVideo(): boolean {
    return window.location.href.includes('/watch?') || window.location.href.includes('/live/');
}

function isVideoPage(): boolean {
    const href = window.location.href;
    return href.includes('/watch?') || href.includes('/live/');
}

function getPaginate(
    totalItems: number,
    currentPage = 1,
    pageSize = 10,
    maxPages = 10
): {
    totalItems: number;
    currentPage: number;
    pageSize: number;
    totalPages: number;
    startPage: number;
    endPage: number;
    startIndex: number;
    endIndex: number;
    pages: number[];
} {
    const totalPages = Math.ceil(totalItems / pageSize);

    if (currentPage < 1) {
        currentPage = 1;
    } else if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    let startPage: number, endPage: number;
    if (totalPages <= maxPages) {
        startPage = 1;
        endPage = totalPages;
    } else {
        const maxPagesBeforeCurrentPage = Math.floor(maxPages / 2);
        const maxPagesAfterCurrentPage = Math.ceil(maxPages / 2) - 1;
        if (currentPage <= maxPagesBeforeCurrentPage) {
            startPage = 1;
            endPage = maxPages;
        } else if (currentPage + maxPagesAfterCurrentPage >= totalPages) {
            startPage = totalPages - maxPages + 1;
            endPage = totalPages;
        } else {
            startPage = currentPage - maxPagesBeforeCurrentPage;
            endPage = currentPage + maxPagesAfterCurrentPage;
        }
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize - 1, totalItems - 1);

    const pages = Array.from(Array(endPage + 1 - startPage).keys()).map((i) => startPage + i);

    return {
        totalItems: totalItems,
        currentPage: currentPage,
        pageSize: pageSize,
        totalPages: totalPages,
        startPage: startPage,
        endPage: endPage,
        startIndex: startIndex,
        endIndex: endIndex,
        pages: pages
    };
}

async function delayMs(ms: number): Promise<void> {
    return await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Converts YouTube's 32-bit RGBA integer color to CSS rgba() string
 * Format: 0xRRGGBBAA (Red, Green, Blue, Alpha in hex)
 *
 * @param color - 32-bit unsigned integer representing RGBA color
 * @returns CSS rgba() string, e.g., "rgba(255,229,0,0.694)"
 *
 * @example
 * convertColorToRgba(4293296689) // returns "rgba(255,229,0,0.694)"
 * convertColorToRgba(4294967295) // returns "rgba(255,255,255,1.000)"
 */
function convertColorToRgba(color: number): string {
    const r = (color & 0xff0000) >>> 16; // Red channel
    const g = (color & 0x00ff00) >>> 8; // Green channel
    const b = color & 0x0000ff; // Blue channel
    const a = (color & 0xff000000) >>> 24; // Alpha channel

    // Validate that all components are in valid range (0-255)
    const components = [r, g, b, a];
    if (!components.every((c) => c === (c & 0xff))) {
        throw new Error(`Invalid color value: ${color} (components: ${components.join(',')})`);
    }

    // Convert alpha from 0-255 to 0-1 range with 3 decimal places
    const alphaDecimal = (a / 255).toFixed(3);

    return `rgba(${r},${g},${b},${alphaDecimal})`;
}

export {
    GlobalStore,
    randomString,
    getRandomInt,
    isNumeric,
    oIsEmpty,
    getObj,
    wrapTryCatch,
    escapeHtml,
    decodeHtml,
    deepFindObjKey,
    delayMs,
    getVideoId,
    getCleanUrlVideo,
    isWatchVideo,
    isVideoPage,
    getPaginate,
    convertColorToRgba
};
