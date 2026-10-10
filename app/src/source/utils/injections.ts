function insertFileScript(pathFile: string, selector: string): void {
    try {
        const node: HTMLElement | null = document.querySelector(selector);
        const script = document.createElement('script');

        script.setAttribute('type', 'text/javascript');
        script.setAttribute('src', pathFile);

        node?.appendChild(script);
    } catch (e) {
        console.error('Error. Unable to inject script.', e);
        throw e;
    }
}

async function insertFileScriptWithLoad(pathFile: string, selector: string): Promise<void> {
    return await new Promise((resolve) => {
        try {
            const node: HTMLElement | null = document.querySelector(selector);
            if (!node) return resolve();
            const script = document.createElement('script');
            const cleanup = (): void => {
                script.removeEventListener('load', onLoad);
                script.removeEventListener('error', onError);
            };
            const onLoad = (): void => {
                cleanup();
                resolve();
            };
            const onError = (): void => {
                cleanup();
                resolve();
            };
            // Fallback: resolve even if neither load/error fires (rare), after 1500ms
            const t = setTimeout(() => {
                cleanup();
                resolve();
            }, 1500);
            const clearAll = (): void => {
                try {
                    clearTimeout(t);
                } catch {
                    /* noop */
                }
            };
            script.addEventListener('load', () => {
                clearAll();
                onLoad();
            });
            script.addEventListener('error', () => {
                clearAll();
                onError();
            });
            script.setAttribute('type', 'text/javascript');
            script.setAttribute('src', pathFile);
            node.appendChild(script);
        } catch (e) {
            console.error('Error. Unable to inject script.', e);
            resolve();
        }
    });
}

function removeInjectionYCS(): void {
    // Use getURL rather than a hardcoded chrome-extension:// prefix so this also matches
    // Firefox (moz-extension://) and Safari (safari-web-extension://) URLs.
    const scripts = document.querySelectorAll(`script[src="${chrome.runtime.getURL('web-resources/wresources.js')}"]`);
    for (const script of scripts) {
        script.remove();
    }
}

function removeInjections(srcs: string[]): void {
    try {
        for (const src of srcs) {
            const scripts = document.querySelectorAll(`script[src="${src}"]`);
            for (const script of scripts) {
                script.remove();
            }
        }
    } catch (e) {
        console.error('Error removing injected scripts', e);
    }
}

export { insertFileScript, insertFileScriptWithLoad, removeInjectionYCS, removeInjections };
