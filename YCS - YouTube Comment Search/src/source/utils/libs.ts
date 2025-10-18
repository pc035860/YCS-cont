import Fetch from 'fetch-retry';
import { openDB } from 'idb';

const fetchR = Fetch(fetch, {
    retries: 100,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    retryDelay: (attempt: number, error: Error, response: unknown) => {
        if (error?.name === 'AbortError') return false;

        if (attempt > 50) {
            return 1000 * 60;
        } else if (attempt > 20) {
            return 1000 * 10;
        } else {
            return 1000 * 2;
        }
        // return Math.pow(2, attempt) * 1000; // 1000, 2000, 4000
    },

    retryOn: (attempt: number, error: Error, response: Response) => {
        if (error?.name === 'AbortError') return false;

        // retry on any network error, or 4xx or 5xx status codes
        if (error !== null || response.status >= 400) {
            //   console.log(`retrying, attempt number ${attempt + 1}`);
            if (attempt > 100) return false;
            return true;
        }
    }
});

const IDB_YCS = 'IDB_YCS';
const STORE_CACHE_YCS = 'STORE_CACHE_YCS';

const idb = openDB(IDB_YCS, 1, {
    upgrade(db) {
        db.createObjectStore(STORE_CACHE_YCS);
    }
});

export { fetchR, idb };
