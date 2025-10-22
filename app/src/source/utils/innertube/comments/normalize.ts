import objectScan from 'object-scan';

import type { CommentRun, NormalizedCommentRenderer } from '../../interfaces/i_assist';
import { wrapTryCatch } from '../../common';

type CommentViewModel = Record<string, unknown>;
type CommentElement = Record<string, unknown>;
type RunCandidate = CommentElement[];

const PREFERRED_RUN_PATHS = [
    '**.commentContentViewModel.content',
    '**.attributedText.content',
    '**.content.content',
    '**.content',
    '**.commentContentViewModel.content.runs',
    '**.attributedText.runs',
    '**.content.runs',
    '**.content.content.runs',
    '**.textContent.runs',
    '**.body.runs',
    '**.commentText.runs',
    '**.contentText.runs',
    '**.runs'
] as const;

const preferredRunScanner = objectScan(PREFERRED_RUN_PATHS as readonly string[], { joined: true, rtn: 'value' });
const anyValueScanner = objectScan(['**.*'], { rtn: 'value' });
const textValueScanner = objectScan(['**.simpleText', '**.text', '**.content'], { joined: true, rtn: 'value' });

function isRecord(value: unknown): value is CommentElement {
    return typeof value === 'object' && value !== null;
}

function isRunElementArray(value: unknown): value is RunCandidate {
    return Array.isArray(value) && value.some(isRecord);
}

function isPotentialRunElement(value: unknown): boolean {
    if (!isRecord(value)) {
        return false;
    }

    const element = value as Record<string, any>;

    return (
        typeof element.text === 'string' ||
        typeof element.simpleText === 'string' ||
        typeof element.textRun?.content === 'string' ||
        typeof element.textRun?.text === 'string' ||
        typeof element.content === 'string' ||
        typeof element.string === 'string' ||
        typeof element.value === 'string' ||
        element.emoji != null ||
        element.emojiRun?.emoji != null ||
        element.attachment != null ||
        element.image != null ||
        element.inlineObject != null ||
        element.navigationEndpoint != null
    );
}

function safeString(getter: () => unknown): string | undefined {
    const value = wrapTryCatch(getter);
    return typeof value === 'string' ? value : undefined;
}

function safeValue<T>(getter: () => T): T | undefined {
    return wrapTryCatch(getter);
}

function extractNestedSegments(element: CommentElement): CommentElement[] {
    const candidates = [
        safeValue(() => (element.attributedText as any)?.content),
        safeValue(() => (element.content as any)?.content),
        safeValue(() => element.content)
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate.filter(isRecord) as CommentElement[];
        }
    }

    return [];
}

function extractTextFallbacks(viewModel: CommentViewModel): CommentRun[] {
    const textValues = textValueScanner(viewModel) as unknown[];
    const runs: CommentRun[] = [];

    for (const value of textValues) {
        if (typeof value === 'string' && value.trim().length > 0) {
            runs.push({ text: value });
        }
    }

    return runs;
}

function getCommentViewModel(source: unknown): CommentViewModel | undefined {
    const fromThread = safeValue(() => (source as any).commentThreadRenderer?.commentViewModel);
    const direct = safeValue(() => (source as any).commentViewModel);
    const viewModel = (fromThread ?? direct) as CommentViewModel | undefined;

    return viewModel && isRecord(viewModel) ? viewModel : undefined;
}

/**
 * 搜尋並回傳所有可能的 runs 候選陣列。
 */
export function scanForRuns(viewModel: CommentViewModel): RunCandidate[] {
    const preferredMatches = (preferredRunScanner(viewModel) as unknown[]).filter(isRunElementArray) as RunCandidate[];
    if (preferredMatches.length > 0) {
        return preferredMatches;
    }

    const fallbackMatches = anyValueScanner(viewModel) as unknown[];
    const fallbackArray = fallbackMatches.find(
        (value) => isRunElementArray(value) && value.some(isPotentialRunElement)
    );

    return fallbackArray && isRunElementArray(fallbackArray) ? [fallbackArray] : [];
}

/**
 * 由 ViewModel 擷取最符合預期的 runs 候選陣列。
 */
export function extractRunCandidates(viewModel: CommentViewModel): CommentElement[] {
    const candidates = scanForRuns(viewModel);
    const preferred = candidates.find((candidate) => candidate.some(isPotentialRunElement));

    return preferred ? preferred.filter(isRecord) : [];
}

/**
 * 將單一元素映射為 commentRenderer 的 run 片段。
 */
export function mapElementToRun(element: CommentElement): CommentRun | undefined {
    const directText = safeString(() => (element as any).text ?? (element as any).simpleText);
    if (directText) {
        return {
            text: directText,
            navigationEndpoint: safeValue(() => (element as any).navigationEndpoint)
        };
    }

    const textRunContent = safeString(() => (element as any).textRun?.content ?? (element as any).textRun?.text);
    if (textRunContent) {
        return {
            text: textRunContent,
            navigationEndpoint: safeValue(() => (element as any).textRun?.navigationEndpoint)
        };
    }

    const nestedText = safeString(() => (element as any).content ?? (element as any).string ?? (element as any).value);
    if (nestedText) {
        return { text: nestedText };
    }

    const emoji = safeValue(() => (element as any).emoji ?? (element as any).emojiRun?.emoji);
    if (emoji) {
        return { emoji } as CommentRun;
    }

    const attachment = safeValue(
        () => (element as any).attachment ?? (element as any).image ?? (element as any).inlineObject
    );
    if (attachment) {
        return { attachment } as CommentRun;
    }

    return undefined;
}

/**
 * 遞迴蒐集元素及其巢狀內容轉換而成的 runs。
 */
export function collectRuns(elements: CommentElement[]): CommentRun[] {
    return elements.reduce<CommentRun[]>((accumulator, element) => {
        const mapped = mapElementToRun(element);
        if (mapped) {
            accumulator.push(mapped);
        }

        const nested = extractNestedSegments(element);
        if (nested.length > 0) {
            accumulator.push(...collectRuns(nested));
        }

        return accumulator;
    }, []);
}

/**
 * 將任意物件（含 commentThreadRenderer）正規化為 commentRenderer 結構。
 */
export function normalizeCommentViewModel(source: unknown): NormalizedCommentRenderer | undefined {
    const viewModel = getCommentViewModel(source);
    if (!viewModel) {
        return undefined;
    }

    const runElements = extractRunCandidates(viewModel);
    let runs = collectRuns(runElements);

    if (runs.length === 0) {
        runs = extractTextFallbacks(viewModel);
    }

    return {
        commentRenderer: {
            contentText: {
                runs
            }
        }
    };
}
