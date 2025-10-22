declare module 'object-scan' {
    interface ObjectScanOptions {
        joined?: boolean;
        rtn?: string;
        filterFn?: (key: string[], value: unknown, data: unknown) => boolean | void;
        useArraySelector?: boolean;
        abort?: boolean;
        reverse?: boolean;
        breakFn?: (matched: { key: string[]; value: unknown; parents: unknown[]; isMatch: boolean }) => void;
        [key: string]: unknown;
    }

    type ObjectScanResult<T> = (input: unknown) => T;

    function objectScan<T = unknown>(
        patterns: readonly string[] | string[],
        options?: ObjectScanOptions
    ): ObjectScanResult<T>;

    export = objectScan;
}
