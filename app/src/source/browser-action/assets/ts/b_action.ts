import { idb } from '../../../utils/libs';
import { formatBytes } from '../../../utils/assist';
import { IStorageEstimate } from '../../../utils/interfaces/i_types';

const STORE_CACHE_YCS = 'STORE_CACHE_YCS';

window.onload = async (): Promise<void> => {
    try {
        const getCurrentUrl = async () => {
            return await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        };

        const getShortUrl = (url: string): string | void => {
            try {
                if (typeof url !== 'string') return;

                const u = new URL(url);
                const uParams = u.pathname.split('/');
                const videoId = uParams[uParams.indexOf('shorts') + 1];

                const videoIdUrl = `https://www.youtube.com/watch?v=${videoId}`;

                console.log('getVideoIdShort: ', videoIdUrl);

                return videoIdUrl;
            } catch (e) {
                console.error(e);
            }
        };

        const checkShorts = (url: string): boolean | void => {
            try {
                if (typeof url !== 'string') return;

                const u = new URL(url);
                const uParams = u.pathname.split('/');

                const shorts = uParams.indexOf('shorts');

                console.log('SHORTS: ', shorts);
                console.log('WINDOW HREF: ', window.location.href);

                if (shorts === -1) {
                    return false;
                } else if (shorts >= 0) {
                    return true;
                }
            } catch (e) {
                console.error(e);
            }
        };

        const elBtnClearCache = document.getElementById('ycs_opts_btn_cache');
        const elBtnOptions = document.getElementById('ycs_opts_btn_opts_page');
        const elBtnExportCache = document.getElementById('ycs_opts_btn_export_cache_page');

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

        elBtnClearCache?.addEventListener('click', async () => {
            await btnClearAllCache();
        });

        elBtnOptions?.addEventListener('click', () => {
            try {
                chrome.runtime.openOptionsPage();
            } catch (err) {
                console.error(err);
            }
        });

        elBtnExportCache?.addEventListener('click', () => {
            try {
                chrome.tabs.create({ url: chrome.runtime.getURL('./options/export.html') });
            } catch (err) {
                console.error(err);
            }
        });

        showUsageMemory();

        try {
            const url = await getCurrentUrl();

            console.log('CURRENT TAB URL: ', url);

            if (checkShorts(url[0].url || '')) {
                const elBtnsBlock = document.getElementById('ycs_btn_opt_block') as HTMLElement;

                elBtnsBlock.insertAdjacentHTML(
                    'afterbegin',
                    '<button class="ycs_opts_btn" type="button" id="ycs_open_shorts" name="Open YouTube shorts for search." title="Open YouTube shorts for search.">Open YT short</button>'
                );

                const elBtnOpenShorts = document.getElementById('ycs_open_shorts') as HTMLElement;

                elBtnOpenShorts.onclick = () => {
                    try {
                        const videoIdUrl = getShortUrl(url[0].url || '') || '';

                        chrome.tabs.update({ url: videoIdUrl });
                    } catch (e) {
                        console.error(e);
                    }
                };
            }
        } catch (e) {
            console.error(e);
        }
    } catch (err) {
        console.error(err);
    }
};
