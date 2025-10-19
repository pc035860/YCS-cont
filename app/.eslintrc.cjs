module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        tsconfigRootDir: __dirname,
        project: './tsconfig.json'
    },
    env: {
        browser: true,
        es6: true,
        webextensions: true
    },
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'prettier' // Must be last to override formatting rules
    ],
    rules: {
        // Allow console statements (needed for extension development and debugging)
        'no-console': 'off',

        // Allow any type (YouTube API has complex and dynamic structures)
        '@typescript-eslint/no-explicit-any': 'off',

        // Warn on var usage (prefer const/let, but don't fail on legacy code)
        'no-var': 'warn',

        // Prefer const over let when possible
        'prefer-const': 'warn',

        // Allow empty functions (common in event handlers and placeholder callbacks)
        '@typescript-eslint/no-empty-function': 'warn',

        // Allow unused vars with underscore prefix (common convention for intentionally unused parameters)
        '@typescript-eslint/no-unused-vars': [
            'warn',
            {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }
        ],

        // Allow require statements (some Chrome extension APIs may need them)
        '@typescript-eslint/no-var-requires': 'warn',

        // Allow non-null assertions (needed for DOM manipulation where we know elements exist)
        '@typescript-eslint/no-non-null-assertion': 'warn'
    },
    ignorePatterns: ['dist/', 'node_modules/', '*.config.js', '.parcelrc', '.eslintrc.cjs']
};
