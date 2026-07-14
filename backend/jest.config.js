/**
 * @fileoverview Jest configuration for DevWatch Backend.
 *
 * Configures Jest for ES Modules (ESM) support with Node.js test environment.
 * The project uses "type": "module" in package.json, so .js files are already
 * treated as ESM — no need to list them in extensionsToTreatAsEsm.
 *
 * Cross-platform compatible: invoked via node_modules/jest-cli/bin/jest.js
 * to avoid relying on bash shebang scripts that fail on Windows PowerShell.
 */

/** @type {import('jest').Config} */
export default {
  // Use Node.js test environment
  testEnvironment: 'node',

  // ESM support — do not transform .js files (Babel not used)
  transform: {},

  // Test file discovery patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js',
    '**/*.spec.js',
  ],

  // Allow running with no test files (Phase 2 — tests come in Phase 3+)
  passWithNoTests: true,

  // Force exit after all tests complete (prevents hanging async handles)
  forceExit: true,

  // Verbose output for CI readability
  verbose: true,

  // Clear mocks between tests to avoid cross-test pollution
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,

  // Coverage configuration (used with --coverage flag)
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',       // Entry point — hard to unit test in isolation
    '!src/utils/banner.js', // stdout-only — integration test candidate
  ],

  coverageDirectory: 'coverage',

  coverageReporters: ['text', 'lcov', 'html'],
};
