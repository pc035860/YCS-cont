declare module 'node:assert' {
    export const strict: {
        equal(actual: unknown, expected: unknown, message?: string): void;
    };
}

declare module 'node:test' {
    type TestFn = (description: string, callback: () => void | Promise<void>) => void;
    const test: TestFn;
    export default test;
}
