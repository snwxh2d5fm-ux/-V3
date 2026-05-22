import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettier,
  {
    ignores: [
      'node_modules/',
      'cloudfunctions/*/node_modules/',
      'miniprogram_npm/',
      'dist/',
      'admin-dashboard/',
    ],
  },
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        wx: 'readonly',
        getApp: 'readonly',
        getCurrentPages: 'readonly',
        Page: 'readonly',
        App: 'readonly',
        Component: 'readonly',
        Behavior: 'readonly',
        requirePlugin: 'readonly',
        __wxConfig: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Promise: 'readonly',
        Buffer: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-debugger': 'warn',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
