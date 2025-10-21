/* eslint-disable @typescript-eslint/no-explicit-any */

import { startWebResources } from './bootstrap';

(function initTrustedTypes(): void {
    try {
        const tt: any = (window as any).trustedTypes;
        if (tt && tt.createPolicy && !tt.defaultPolicy) {
            tt.createPolicy('default', {
                createHTML: (s: string) => s,
                createScriptURL: (s: string) => s,
                createScript: (s: string) => s
            });
        }
    } catch (e) {
        // noop: Trusted Types not available or policy creation failed
    }
})();

startWebResources();
