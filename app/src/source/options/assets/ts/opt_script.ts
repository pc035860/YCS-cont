import { options } from '../../../config/options';
import { formatBytes, isNumeric } from '../../../utils/assist';
import { idb } from '../../../utils/libs';

import { IStorageEstimate } from '../../../utils/interfaces/i_types';

const STORE_CACHE_YCS = 'STORE_CACHE_YCS';

window.onload = async (): Promise<void> => {
    try {
        const setRenderAutoloadOpt = (param: boolean): void => {
            if (typeof param !== 'boolean') return;

            (document.getElementById('y_opts_autoload') as HTMLInputElement).checked = param;
        };

        const optSetAutoload = async (opt: HTMLInputElement): Promise<void> => {
            try {
                // const opts = JSON.parse(localStorage.getItem('ycs_options') as string);
                // opts.autoload = opt.checked;

                await chrome.storage.local.set({
                    autoload: opt.checked
                });

                // const jsonOpts = JSON.stringify(opts);

                // localStorage.setItem('ycs_options', jsonOpts);
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderHighlightTextOpt = (param: boolean): void => {
            if (typeof param !== 'boolean') return;

            (document.getElementById('y_opts_highlight') as HTMLInputElement).checked = param;
            const group = document.getElementById('ycs-highlight-group');
            group?.classList.toggle('ycs_group--enabled', param);
        };

        const optSetHighlightText = async (opt: HTMLInputElement): Promise<void> => {
            try {
                // const opts = JSON.parse(localStorage.getItem('ycs_options') as string);
                // opts.highlightText = opt.checked;

                await chrome.storage.local.set({
                    highlightText: opt.checked
                });

                // update UI state immediately
                setRenderHighlightTextOpt(opt.checked);

                // const jsonOpts = JSON.stringify(opts);
                // localStorage.setItem('ycs_options', jsonOpts);
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderHighlightExact = (param: boolean): void => {
            if (typeof param !== 'boolean') return;

            (document.getElementById('y_opts_highlight_exact') as HTMLInputElement).checked = param;
        };

        const optSetHighlightExact = async (opt: HTMLInputElement): Promise<void> => {
            try {
                await chrome.storage.local.set({
                    highlightExact: opt.checked
                });
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderCacheOpt = (param: boolean): void => {
            if (typeof param !== 'boolean') return;

            (document.getElementById('y_opts_cache') as HTMLInputElement).checked = param;
        };

        const setRenderHiddenByDefault = (param: boolean): void => {
            if (typeof param !== 'boolean') return;

            (document.getElementById('y_opts_hidden_by_default') as HTMLInputElement).checked = param;
        };

        const optSetCache = async (opt: HTMLInputElement): Promise<void> => {
            try {
                // const opts = JSON.parse(localStorage.getItem('ycs_options') as string);
                // opts.cache = opt.checked;

                await chrome.storage.local.set({
                    cache: opt.checked
                });

                // const jsonOpts = JSON.stringify(opts);

                // localStorage.setItem('ycs_options', jsonOpts);
            } catch (err) {
                console.error(err);
            }
        };

        const optSetHiddenByDefault = async (opt: HTMLInputElement): Promise<void> => {
            try {
                await chrome.storage.local.set({
                    hiddenByDefault: opt.checked
                });
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderAutoClearCacheOpt = (param: number): void => {
            if (!param) return;

            (document.getElementById('y_opts_cache_quota') as HTMLInputElement).value = param.toString();
        };

        const optSetAutoClearCache = async (e: Event): Promise<void> => {
            try {
                if (isNumeric((e.target as HTMLInputElement).value)) {
                    // const opts = JSON.parse(localStorage.getItem('ycs_options') as string);
                    // opts.autoClear = (e.target as HTMLInputElement).value;

                    await chrome.storage.local.set({
                        autoClear: (e.target as HTMLInputElement).value
                    });

                    // const jsonOpts = JSON.stringify(opts);

                    // localStorage.setItem('ycs_options', jsonOpts);
                }
            } catch (err) {
                console.error(err);
            }
        };

        const showUsageMemory = async (): Promise<void> => {
            try {
                const db = await idb;

                const memory = (await navigator.storage.estimate()) as IStorageEstimate;

                const elTotalCache = document.getElementById('ycs_total_cache') as HTMLElement;
                const elUsedCache = document.getElementById('ycs_used_cache') as HTMLElement;
                const elBrowserAvStorage = document.getElementById('ycs_browser_av_storage') as HTMLElement;
                const elQuotaAvStorage = document.getElementById('ycs_quota_av_storage') as HTMLElement;

                elTotalCache.textContent = (await db.count(STORE_CACHE_YCS)) + '';

                elUsedCache.textContent = formatBytes(
                    (memory?.usageDetails?.indexedDB || memory.usage) as number
                ) as string;

                elBrowserAvStorage.textContent =
                    (((memory.usage as number) / (memory.quota as number)) * 100).toFixed(2) + '%';

                elQuotaAvStorage.textContent = formatBytes(memory.quota as number) as string;
            } catch (err) {
                console.error(err);
            }
        };

        const btnClearAllCache = async (): Promise<void> => {
            try {
                const db = await idb;

                await db.clear(STORE_CACHE_YCS);

                await showUsageMemory();
            } catch (err) {
                console.error(err);
            }
        };

        const optsStorage = await chrome.storage.local.get();
        // console.log('optsStorage: ', optsStorage);

        await chrome.storage.local.set({
            ...options,
            ...optsStorage
        });

        const storageOpts = await chrome.storage.local.get();
        // console.log('storageOpts: ', storageOpts);

        if (storageOpts) {
            for (const key of Object.keys(storageOpts)) {
                switch (key) {
                    case 'autoload':
                        setRenderAutoloadOpt(storageOpts[key]);
                        break;

                    case 'highlightText':
                        console.log('setHighlightTextOpt: ', storageOpts[key]);
                        setRenderHighlightTextOpt(storageOpts[key]);
                        break;

                    case 'highlightExact':
                        setRenderHighlightExact(storageOpts[key]);
                        break;

                    case 'cache':
                        setRenderCacheOpt(storageOpts[key]);
                        break;

                    case 'autoClear':
                        setRenderAutoClearCacheOpt(storageOpts[key]);
                        break;

                    case 'hiddenByDefault':
                        setRenderHiddenByDefault(storageOpts[key]);
                        break;

                    default:
                        break;
                }
            }
        }

        const elAutoload = document.getElementsByClassName('ycs_inner_wrap')[0];
        elAutoload?.addEventListener('click', async (e: Event) => {
            console.log('Event options: ', e);

            switch ((e.target as HTMLInputElement).id) {
                case 'y_opts_autoload':
                    optSetAutoload(e.target as HTMLInputElement);
                    break;

                case 'y_opts_highlight':
                    optSetHighlightText(e.target as HTMLInputElement);
                    break;

                case 'y_opts_highlight_exact':
                    optSetHighlightExact(e.target as HTMLInputElement);
                    break;

                case 'y_opts_cache':
                    optSetCache(e.target as HTMLInputElement);
                    break;

                case 'ycs_opts_btn_cache':
                    (e.target as HTMLButtonElement).disabled = true;

                    await btnClearAllCache();

                    (e.target as HTMLButtonElement).disabled = false;

                    break;

                case 'y_opts_hidden_by_default':
                    optSetHiddenByDefault(e.target as HTMLInputElement);
                    break;

                default:
                    break;
            }
        });

        const elCacheQuota = document.getElementById('y_opts_cache_quota') as HTMLInputElement;
        elCacheQuota?.addEventListener('input', optSetAutoClearCache);

        const elPageCache = document.getElementById('ycs_opts_btn_export_page') as HTMLElement;
        elPageCache.onclick = () => {
            try {
                chrome.tabs.create({ url: chrome.runtime.getURL('./options/export.html') });
            } catch (err) {
                console.error(err);
            }
        };

        await showUsageMemory();
    } catch (err) {
        console.error(err);
    }
};
