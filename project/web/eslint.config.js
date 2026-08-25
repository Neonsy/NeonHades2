import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    {
        ignores: ['.astro/**', '.local/**', 'dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'],
    },
    {
        linterOptions: {
            reportUnusedDisableDirectives: 'error',
            reportUnusedInlineConfigs: 'error',
        },
    },
    js.configs.recommended,
    ...tseslint.configs.strict,
    ...tseslint.configs.stylistic,
    ...astro.configs.recommended,
    ...astro.configs['jsx-a11y-recommended'],
    {
        files: ['**/*.{js,mjs,ts,astro}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.es2025,
                ...globals.node,
            },
        },
        rules: {
            curly: ['error', 'all'],
            eqeqeq: ['error', 'always'],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-duplicate-imports': 'error',
            'object-shorthand': ['error', 'always'],
            'prefer-template': 'error',
        },
    },
    {
        files: ['**/*.{ts,astro}'],
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
            '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports',
                    fixStyle: 'inline-type-imports',
                },
            ],
            '@typescript-eslint/no-import-type-side-effects': 'error',
        },
    },
    {
        files: ['**/*.astro'],
        languageOptions: {
            parserOptions: {
                parser: tseslint.parser,
            },
        },
    },
    eslintConfigPrettier,
]);
