import { deepFindObjKey, getCleanUrlVideo, wrapTryCatch } from '../common';
import { buildInnertubeBody, buildInnertubeHeaders } from './request';
import { getInitYtData, getInnertubeApiKey, getPageCfgData, type InnertubeRequestParams } from './core';

async function findInitYParams(initData: [object]): Promise<string | undefined> {
    try {
        if (initData) {
            let param;
            for (const obj of initData) {
                const findObj = deepFindObjKey(obj, 'serializedShareEntity')[0];
                if (findObj) {
                    [, param] = (Object as any).entries(findObj)[0];
                }

                if (param) break;
            }
            return param;
        }
    } catch (e) {
        console.error(e);
        return undefined;
    }

    return undefined;
}

async function getParamsForTranscript(
    globalContext: Window & typeof globalThis,
    param: string,
    signal?: AbortSignal
): Promise<InnertubeRequestParams | undefined> {
    try {
        const ytcfgData = await getPageCfgData(globalContext, signal);
        const cleanUrl = getCleanUrlVideo(globalContext.location.href) ?? globalContext.location.href;

        if (!ytcfgData) {
            return undefined;
        }

        return {
            headers: buildInnertubeHeaders(ytcfgData, {
                'x-youtube-client-version': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_VERSION || ''
            }),
            referrer: cleanUrl,
            referrerPolicy: 'origin-when-cross-origin',
            body: JSON.stringify(
                buildInnertubeBody({
                    ytcfgData,
                    params: param,
                    clientFallback: {}
                })
            ),
            method: 'POST',
            mode: 'cors',
            credentials: 'include'
        };
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

function getTranscriptPot(): string | undefined {
    try {
        const visited = new WeakSet<object>();
        const urls: string[] = [];

        const walk = (obj: unknown): void => {
            if (!obj || typeof obj !== 'object') return;
            if (visited.has(obj as object)) return;
            visited.add(obj as object);
            for (const key in obj as any) {
                if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
                try {
                    const value: any = (obj as any)[key];
                    if (typeof value === 'string' && value.includes('pot=')) {
                        urls.push(value);
                    } else if (value && typeof value === 'object') {
                        walk(value);
                    }
                } catch {
                    continue;
                }
            }
        };

        walk(window as any);
        if (urls.length === 0) return undefined;
        const buf = new URL(urls[0]).searchParams.get('pot');
        return buf ? encodeURIComponent(buf) : undefined;
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

async function getTranscriptBaseUrl(globalContext: Window, signal: AbortSignal): Promise<string> {
    const baseUrl = getCleanUrlVideo(globalContext.location.href) as string;
    const htmlResp = await fetch(baseUrl, {
        method: 'GET',
        mode: 'no-cors' as RequestMode,
        credentials: 'include',
        signal,
        cache: 'no-store'
    } as RequestInit);
    const html = await htmlResp.text();
    const splitted = html.split('"captions":');
    if (splitted.length <= 1) throw new Error('Fail to load video html');
    const captions = JSON.parse(
        splitted[1].split(',"videoDetails')[0].replace('\n', '')
    ).playerCaptionsTracklistRenderer;
    const tracks: any[] = (captions.captionTracks || []) as any[];
    const generatedTracks = tracks.filter(({ kind }: any) => kind === 'asr');
    const englishTracks = generatedTracks.filter(({ languageCode }: any) => languageCode === 'en');
    const chosen = (englishTracks[0] || generatedTracks[0] || tracks[0]) as any;
    const base = chosen?.baseUrl as string;
    return base;
}

function buildTranscriptFromTimedText(xmlText: string): object | undefined {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'application/xml');
        const nodes = Array.from(doc.getElementsByTagName('text')) as Element[];
        const entries: any[] = nodes.map((n) => ({
            start: parseFloat(n.getAttribute('start') || '0'),
            duration: parseFloat(n.getAttribute('dur') || '0'),
            text: n.textContent || ''
        }));
        const cueGroups = entries.map(({ text, start }) => ({
            transcriptCueGroupRenderer: {
                formattedStartOffset: { simpleText: toFormatted(start) },
                cues: [{ transcriptCueRenderer: { startOffsetMs: start * 1000, cue: { simpleText: text } } }]
            }
        }));
        return {
            actions: [
                {
                    updateEngagementPanelAction: {
                        content: {
                            transcriptRenderer: {
                                body: {
                                    transcriptBodyRenderer: { cueGroups }
                                }
                            }
                        }
                    }
                }
            ]
        };
    } catch (e) {
        console.error(e);
        try {
            const entries: any[] = [];
            const regex = /<text start="([0-9.]+)" dur="([0-9.]+)">([\s\S]*?)<\/text>/g;
            let m: RegExpExecArray | null;
            while ((m = regex.exec(xmlText))) {
                const start = parseFloat(m[1]);
                const text = m[3].replace(/<\/?\w+[^>]*>/g, '');
                entries.push({ start, text });
            }
            const cueGroups = entries.map(({ text, start }) => ({
                transcriptCueGroupRenderer: {
                    formattedStartOffset: { simpleText: toFormatted(start) },
                    cues: [{ transcriptCueRenderer: { startOffsetMs: start * 1000, cue: { simpleText: text } } }]
                }
            }));
            return {
                actions: [
                    {
                        updateEngagementPanelAction: {
                            content: {
                                transcriptRenderer: {
                                    body: { transcriptBodyRenderer: { cueGroups } }
                                }
                            }
                        }
                    }
                ]
            };
        } catch {
            return undefined;
        }
    }
}

function toFormatted(sec: number): string {
    try {
        let left = sec;
        const h = Math.floor(left / 3600);
        left -= h * 3600;
        const m = Math.floor(left / 60);
        left -= m * 60;
        const s = Math.floor(left);

        let output = `${s}`.padStart(2, '0');

        if (m || h) {
            let seg: string;

            if (!m) {
                seg = '00';
            } else {
                if (h) {
                    seg = `${m}`.padStart(2, '0');
                } else {
                    seg = m.toString();
                }
            }

            output = `${seg}:${output}`;
        }

        if (h) {
            output = `${h}:${output}`;
        }

        if (!m && !h) {
            output = `0:${output}`;
        }

        return output;
    } catch {
        return '0:00';
    }
}

export async function getTranscriptVideo(signal: AbortSignal): Promise<object | undefined> {
    try {
        const initData = await getInitYtData(getCleanUrlVideo(window.location.href) as any, signal);

        try {
            if (initData) {
                const ytInitParam = await findInitYParams(initData);
                if (ytInitParam) {
                    const params = await getParamsForTranscript(window, ytInitParam, signal);
                    console.log('PARAMS for TRANSCRIPT', params);
                    const resp = await fetch(
                        `https://www.youtube.com/youtubei/v1/get_transcript?key=${getInnertubeApiKey()}`,
                        { ...params, signal, cache: 'no-store' }
                    );
                    const json = await resp.json();
                    const ok = wrapTryCatch(
                        () =>
                            json.actions[0].updateEngagementPanelAction.content.transcriptRenderer.body
                                .transcriptBodyRenderer.cueGroups.length > 0
                    );
                    if (ok) return json;
                }
            }
        } catch (e) {
            console.error('youtubei get_transcript attempt failed', e);
        }

        try {
            const base = await getTranscriptBaseUrl(window, signal);
            if (base) {
                const viaTimedText = await fetch(base, {
                    method: 'GET',
                    mode: 'no-cors' as RequestMode,
                    credentials: 'include',
                    signal,
                    cache: 'no-store'
                } as RequestInit);
                const text = await viaTimedText.text();
                const built = buildTranscriptFromTimedText(text);
                const ok = wrapTryCatch(
                    () =>
                        (built as any).actions[0].updateEngagementPanelAction.content.transcriptRenderer.body
                            .transcriptBodyRenderer.cueGroups.length > 0
                );
                if (ok) return built;
            }
        } catch (e) {
            console.error('direct timedtext fallback failed', e);
        }

        try {
            const pot = getTranscriptPot();
            if (pot) {
                const base = await getTranscriptBaseUrl(window, signal);
                const viaTimedText = await fetch(`${base}&potc=1&pot=${pot}&c=WEB`, {
                    method: 'GET',
                    mode: 'no-cors' as RequestMode,
                    credentials: 'include',
                    signal,
                    cache: 'no-store'
                } as RequestInit);
                const text = await viaTimedText.text();
                return buildTranscriptFromTimedText(text);
            }
        } catch (e) {
            console.error('timedtext with pot failed', e);
        }
    } catch (e) {
        console.error(e);
        return undefined;
    }

    return undefined;
}
