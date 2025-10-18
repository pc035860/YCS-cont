import { options } from './config/options';
import { IStorageEstimate } from './utils/interfaces/i_types';
import { idb } from './utils/libs';

const STORE_CACHE_YCS = 'STORE_CACHE_YCS';

chrome.runtime.onInstalled.addListener(async () => {
    const optsStorage = await chrome.storage.local.get();

    await chrome.storage.local.set({
        ...options,
        ...optsStorage
    });

    chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
        for (const tab of tabs) {
            if (tab.id) {
                try {
                    console.log('BG tab.id: ', tab.id);

                    chrome.scripting.insertCSS({
                        target: { tabId: tab.id },
                        files: ['content-scripts/style.css']
                    });

                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content-scripts/cscripts.js']
                    });
                } catch (err) {
                    console.error(err);
                }
            }
        }
    });
});

chrome.runtime.onMessage.addListener(async (message, sender) => {
    if (message?.type === 'YCS_SET_BADGE') {
        console.info('BG YCS_SET_BADGE:', message);
        chrome.action.setBadgeText({ text: message?.text?.toString(), tabId: sender.tab?.id });
        chrome.action.setBadgeBackgroundColor({ color: '#2f3640' });
    }

    if (message?.type === 'YCS_CACHE_STORAGE_GET') {
        // console.log('YCS_CACHE_STORAGE_GET BG RESPONSE [MESSAGE]: ', message);

        if (message?.body && message.body.videoId) {
            // console.log('111111111 message:', message);

            const db = await idb;
            const cache = await db.get(STORE_CACHE_YCS, message.body.videoId);

            if (sender?.tab?.id) {
                if (cache) {
                    // console.log('sender TAB, cache:', sender?.tab?.id, cache);
                    chrome.tabs.sendMessage(sender.tab?.id as number, {
                        type: 'YCS_CACHE_STORAGE_GET_SEND',
                        body: cache.body
                    });
                } else {
                    const opts = await chrome.storage.local.get('autoload');

                    if (opts.autoload) {
                        // console.log('sender TAB NO CACHE! sendMessage AUTOLOAD');
                        chrome.tabs.sendMessage(sender.tab?.id as number, { type: 'YCS_AUTOLOAD' });
                    }
                }
            }
        }
    }

    if (message?.type === 'YCS_CACHE_STORAGE_SET') {
        // console.log('YCS_CACHE_STORAGE_SET BG RESPONSE [MESSAGE]: ', message);

        if (message?.body && message.body.videoId) {
            const opts = (await chrome.storage.local.get(['cache', 'autoClear'])) as {
                cache: string;
                autoClear: number;
            };

            if (!opts?.cache) return;

            const quotaBytes = opts.autoClear * 1000000 || 200 * 1000000;

            const infoUseStorage = (await navigator.storage.estimate()) as IStorageEstimate;

            const db = await idb;

            if ((infoUseStorage.usage as number) < quotaBytes) {
                await db.put(STORE_CACHE_YCS, message, message.body.videoId);
            } else if ((infoUseStorage.usage as number) >= quotaBytes) {
                await db.clear(STORE_CACHE_YCS);
                await db.put(STORE_CACHE_YCS, message, message.body.videoId);
            }
        }
    }
});
