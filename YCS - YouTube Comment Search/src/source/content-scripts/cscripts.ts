
import { insertFileScript, insertFileScriptWithLoad, removeInjectionYCS, removeInjections } from '../utils/injections';

(function (): void {

    removeInjectionYCS();

    function initContentScript(): void {

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

            try {


                if ((message?.type === 'YCS_CACHE_STORAGE_GET_SEND') && message?.body) {
                    console.log('GET CACHE FROM IDB', message);

                    window.postMessage({ type: 'YCS_CACHE_STORAGE_GET_RESPONSE', body: message.body }, window.location.origin);
                }

                if (message?.type === 'YCS_AUTOLOAD') {
                    console.log('RESPONSE BG SEND AUTOLOAD. Now postMessage in Window');
                    window.postMessage({ type: 'YCS_AUTOLOAD' }, window.location.origin);
                }
                
            } catch (err) {
                console.error(err);
            }

        });

        window.addEventListener('message', async (e) => {

            try {
                
                if (e.source != window) return;
                if (e.data.type && (e.data.type === 'NUMBER_COMMENTS')) {
                    console.info('1111111111111111111111111111111111111111111111111111111111111111111111111111', e);
                    chrome.runtime.sendMessage(`${chrome.runtime.id}`, { type: 'YCS_SET_BADGE', text: e.data.text.toString() || '' });
                }

                if (e.data?.type === 'GET_OPTIONS') {

                    try {

                        console.log('GET_OPTIONS', e.data);

                        const opts = await chrome.storage.local.get();

                        window.postMessage({ type: 'YCS_OPTIONS', text: opts }, window.location.origin);
                        
                    } catch (err) {
                        console.error(err);
                    }
                    
                }

                if ((e.data?.type === 'YCS_CACHE_STORAGE_SET') && e.data?.body) {

                    chrome.runtime.sendMessage(`${chrome.runtime.id}`, e.data, (res) => {

                        console.log('Response YCS_CACHE_STORAGE SET: ', res);

                    });

                }

                if ((e.data?.type === 'YCS_CACHE_STORAGE_GET') && e.data?.body) {

                    chrome.runtime.sendMessage(`${chrome.runtime.id}`, e.data, (res) => {

                        console.log('Response YCS_CACHE_STORAGE GET: ', res);

                    });

                }



            } catch (err) {
                console.error(err);
            }


        }, false);

        const SCRIPT_SRCS = [
            'web-resources/htmlEntities.js',
            'web-resources/wresources.js'
        ];
        const fullSrcs = SCRIPT_SRCS.map((src) => chrome.runtime.getURL(src));
        removeInjections(fullSrcs);
        (async function (srcs: string[], target: string): Promise<void> {
            for (const src of srcs) {
                await insertFileScriptWithLoad(src, target);
            }
        })(fullSrcs, 'body');

    }

    // document.addEventListener('DOMContentLoaded', initContentScript, false);

    // sessionStorage.setItem('uniqKey123123123', 'asdfasdf45345345!!!!!!!');

    initContentScript();
}());

