/**
 * @fileoverview ESLint v9 Flat Config for DevWatch Backend.
 *
 * Uses the new flat config format required by ESLint >= 9.0.0.
 * Configures ESM Node.js environment with recommended rules
 * and project-specific overrides for production-quality code.
 */

import js from '@eslint/js';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // ── Global Ignores ──────────────────────────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      'logs/**',
      'coverage/**',
      'dist/**',
      'build/**',
      '*.config.js',       // Ignore self and other root configs
      'jest.config.js',    // Jest config ignored from linting
    ],
  },

  // ── Base Config (JS Recommended) ────────────────────────────────────────────
  js.configs.recommended,

  // ── Project-Wide Rules ──────────────────────────────────────────────────────
  {
    files: ['src/**/*.js'],

    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },

    rules: {
      // ── Errors ──────────────────────────────────────────────────────────────
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',       // Ignore _next, _res, etc.
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-return-await': 'error',
      'no-throw-literal': 'error',
      'no-promise-executor-return': 'error',

      // ── Code Quality ─────────────────────────────────────────────────────────
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'dot-notation': 'error',
      'no-else-return': 'error',
      'no-useless-return': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'prefer-destructuring': ['warn', { object: true, array: false }],
      'no-param-reassign': ['error', { props: false }],

      // ── Async / Promises ──────────────────────────────────────────────────────
      'no-async-promise-executor': 'error',
      'require-await': 'warn',

      // ── Node.js ───────────────────────────────────────────────────────────────
      'no-process-exit': 'off',          // We use process.exit intentionally in server bootstrap

      // ── Style (non-formatting — Prettier handles whitespace) ──────────────────
      'spaced-comment': ['warn', 'always'],
      'capitalized-comments': 'off',     // JSDoc comments vary
    },
  },
];
