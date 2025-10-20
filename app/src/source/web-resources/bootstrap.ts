import { isVideoPage } from '../utils/common';
import { initApp, retryApp } from './appController';

const DEBUG = false;
const META_SELECTOR = '#meta.style-scope.ytd-watch-flexy';

let hasStarted = false;

const metaElementExists = (): Element | null => {
    return document.querySelector(META_SELECTOR);
};

export function startWebResources(): void {
    if (hasStarted) {
        return;
    }

    hasStarted = true;

    let isInitAppCalled = false;

    const ensureAppInitialized = (source: string): void => {
        if (!isVideoPage() || !metaElementExists()) {
            return;
        }

        if (!isInitAppCalled) {
            console.log(`YCS: Initializing app via ${source}`);
            isInitAppCalled = true;
            initApp();
        }
    };

    const handleNavigateFinish = (): void => {
        if (DEBUG) {
            console.log('YCS: yt-navigate-finish detected');
            console.log('isInitAppCalled: ', isInitAppCalled);
            console.log('isVideoPage: ', isVideoPage());
            console.log('document.querySelector(#meta.style-scope.ytd-watch-flexy): ', metaElementExists());
        }

        ensureAppInitialized('yt-navigate-finish');
    };

    const handlePopState = (): void => {
        if (DEBUG) {
            console.log('YCS: popstate detected');
            console.log('isInitAppCalled: ', isInitAppCalled);
            console.log('isVideoPage: ', isVideoPage());
            console.log('document.querySelector(#meta.style-scope.ytd-watch-flexy): ', metaElementExists());
        }

        setTimeout(() => {
            ensureAppInitialized('popstate');
        }, 100);
    };

    window.addEventListener('yt-navigate-finish', handleNavigateFinish);
    window.addEventListener('popstate', handlePopState);

    const intervalCheckLoadDOM = setInterval(() => {
        if (!isVideoPage() || !metaElementExists()) {
            return;
        }

        if (!document.querySelector('.ycs-app')) {
            if (!isInitAppCalled) {
                console.log('YCS: Initializing app via polling fallback');
                isInitAppCalled = true;
                initApp();
                return;
            }

            const didRetry = retryApp();

            if (DEBUG && !didRetry) {
                console.log('YCS: retryApp skipped - no app() reference available yet');
            }
        } else {
            console.log('YCS: UI successfully created, stopping polling');
            clearInterval(intervalCheckLoadDOM);
        }
    }, 1000);
}
