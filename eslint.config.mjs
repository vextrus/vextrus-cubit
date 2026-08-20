import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import cubit from './eslint-rules/index.mjs';

/**
 * V-VERIFY's eslint stage: boundary rules, the NEVERs, the token/colour rule and
 * the string-table rule (C-06, AC-04).
 *
 * `tests/lint-fixtures/**` is a *global* ignore, so `eslint .` never reports the
 * deliberately-bad files and verify stays green — but the cubit rules are still
 * *configured* for those paths, so `lint-rules.spec.ts` can opt back in with
 * `{ ignore: false }` and prove each rule fires on disk.
 */

const NODE_GLOBALS = {
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  structuredClone: 'readonly',
  crypto: 'readonly',
  AbortController: 'readonly',
  Response: 'readonly',
  Request: 'readonly',
  Headers: 'readonly',
};

const FIXTURES = 'tests/lint-fixtures/**/*.{ts,tsx}';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      // every distDir: `.next`, and the cold ones verify and e2e build into
      '.next*/**',
      '.scratch/**',
      'test-results/**',
      'playwright-report/**',
      'db/migrations/**',
      'next-env.d.ts',
      // deliberately-bad code: excluded from the tree-wide run, still configured below
      'tests/lint-fixtures/**',
    ],
  },

  // --- plain JavaScript tooling (scripts, configs) --------------------------
  {
    files: ['**/*.mjs'],
    ...js.configs.recommended,
    languageOptions: { globals: NODE_GLOBALS, ecmaVersion: 2023, sourceType: 'module' },
  },

  // --- TypeScript -----------------------------------------------------------
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: NODE_GLOBALS,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },

  // --- the NEVERs (AC-04) ---------------------------------------------------
  { plugins: { cubit } },

  // L-FMT-01: Intl and the locale methods belong to the format seam alone.
  {
    files: ['src/**/*.{ts,tsx}', 'db/**/*.ts', 'tests/**/*.{ts,tsx}', 'scripts/**/*.mjs', FIXTURES],
    ignores: ['src/core/format.ts'],
    rules: { 'cubit/no-locale-methods': 'error' },
  },

  // Decimal at the seam: no non-integer literals, no parseFloat.
  {
    files: ['src/core/**/*.ts', 'src/modules/**/*.ts', 'src/server/**/*.ts', 'db/schema/**/*.ts', FIXTURES],
    rules: { 'cubit/no-float-arithmetic': 'error' },
  },

  // R-UI-001: tokens.ts is the only colour literal in the tree.
  {
    files: ['src/**/*.{ts,tsx}', FIXTURES],
    ignores: ['src/ui/tokens.ts'],
    rules: { 'cubit/no-colour-literals': 'error' },
  },

  // R-SPINE-060: strings come from the typed table.
  {
    files: ['src/**/*.tsx', 'tests/lint-fixtures/**/*.tsx'],
    rules: { 'cubit/no-jsx-string-literals': 'error' },
  },

  // SEAM-TENANT: forTenant / runAsSystem are the only database handles.
  {
    files: ['src/**/*.{ts,tsx}', 'db/__tests__/**/*.ts', FIXTURES],
    ignores: ['src/core/db.ts'],
    rules: { 'cubit/db-seam-only': 'error' },
  },

  // AS-A1: modules are composed at their declared surface.
  {
    files: ['src/**/*.{ts,tsx}', FIXTURES],
    rules: { 'cubit/module-boundaries': 'error' },
  },

  // --- narrow relaxations ---------------------------------------------------
  {
    // the acceptance suite reaches for `any` when it probes tRPC/drizzle internals
    files: ['tests/**/*.{ts,tsx}', 'db/__tests__/**/*.ts', 'src/**/__tests__/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
