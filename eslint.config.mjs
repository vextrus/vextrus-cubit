/**
 * The guardrail registry, as a flat config.
 *
 * B-05: every guardrail that matters is mechanical. Each row below is a Bible
 * NEVER bound to a rule at severity "error", with a committed fixture pair
 * under tests/lint-fixtures/<dir>/ proving the rule fires on bad.* and stays
 * silent on good.*.
 *
 * Two audiences share this file:
 *   `eslint .`  — the gate's tree-wide run. It must never see the deliberately
 *                 broken fixtures, so tests/lint-fixtures/** is globally
 *                 ignored.
 *   `eslint --no-ignore tests/lint-fixtures/<dir>/bad.<ext>` — the probe. It
 *                 opts back in, and the per-row blocks below bind each rule to
 *                 its own directory.
 */
import tseslint from 'typescript-eslint';
import cubit from './eslint-rules/index.mjs';

/**
 * fixture directory → rule id. The order is the increment's registry order.
 *
 * @type {ReadonlyArray<{ dir: string, rule: string, files: string[] }>}
 */
const REGISTRY = [
  { dir: 'no-float-arithmetic', rule: 'cubit/no-float-arithmetic', files: ['**/*.ts'] },
  { dir: 'format-seam-only', rule: 'cubit/format-seam-only', files: ['**/*.ts'] },
  { dir: 'model-seam-only', rule: 'cubit/model-seam-only', files: ['**/*.ts'] },
  { dir: 'db-seam-only', rule: 'cubit/db-seam-only', files: ['**/*.ts'] },
  { dir: 'no-colour-literal', rule: 'cubit/no-colour-literal', files: ['**/*.ts'] },
  { dir: 'no-jsx-string-literal', rule: 'cubit/no-jsx-string-literal', files: ['**/*.tsx'] },
  { dir: 'no-conversion-literal', rule: 'cubit/no-conversion-literal', files: ['**/*.ts'] },
  { dir: 'no-suppressions', rule: 'cubit/no-suppressions', files: ['**/*.ts'] },
  { dir: 'no-skip-only', rule: 'cubit/no-skip-only', files: ['**/*.ts'] },
  { dir: 'no-explicit-any', rule: '@typescript-eslint/no-explicit-any', files: ['**/*.ts'] },
];

const TYPESCRIPT = ['**/*.ts', '**/*.tsx'];

/** Shared by every block that has to parse TypeScript. */
const typescriptLanguageOptions = {
  parser: tseslint.parser,
  ecmaVersion: /** @type {const} */ ('latest'),
  sourceType: /** @type {const} */ ('module'),
};

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.next-verify/**',
      '.cubit-scratch/**',
      'coverage/**',
      'dist/**',
      'test-results/**',
      'playwright-report/**',
      'cad/**',
      // The fixtures are broken on purpose. --no-ignore is how the probe and
      // the fixture suite reach them.
      'tests/lint-fixtures/**',
    ],
  },

  {
    // Q-08: a suppression comment cannot switch a guardrail off, so inline
    // configuration is not read at all — anywhere in the tree.
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'off',
    },
  },

  {
    // Q-08 holds for every file the gate lints, product code or toolchain.
    files: ['**/*.js', '**/*.mjs', '**/*.cjs', ...TYPESCRIPT],
    plugins: { cubit },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'cubit/no-suppressions': 'error',
      'cubit/no-skip-only': 'error',
    },
  },

  {
    files: TYPESCRIPT,
    languageOptions: typescriptLanguageOptions,
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  {
    // The seams, pre-wired. Nothing matches these patterns yet; the rules arm
    // themselves the moment a later increment lands src/ or db/ (C-06).
    files: ['src/**/*.ts', 'src/**/*.tsx', 'db/**/*.ts'],
    plugins: { cubit },
    rules: {
      'cubit/no-float-arithmetic': 'error',
      'cubit/format-seam-only': 'error',
      'cubit/model-seam-only': 'error',
      'cubit/no-colour-literal': 'error',
      'cubit/no-conversion-literal': 'error',
    },
  },

  {
    // db/** is the schema, so banning the schema import there would ban the
    // schema from itself; SEAM-TENANT's driver ban is scoped to src/**, where
    // src/core/db.ts exempts itself.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: { cubit },
    rules: {
      'cubit/db-seam-only': 'error',
    },
  },

  {
    files: ['src/**/*.tsx'],
    plugins: { cubit },
    rules: {
      'cubit/no-jsx-string-literal': 'error',
    },
  },

  // One block per registry row: the rule, at severity error, bound to the
  // directory that proves it fires.
  ...REGISTRY.map((row) => ({
    files: row.files.map((pattern) => `tests/lint-fixtures/${row.dir}/${pattern}`),
    languageOptions: typescriptLanguageOptions,
    plugins: { cubit, '@typescript-eslint': tseslint.plugin },
    rules: { [row.rule]: /** @type {const} */ ('error') },
  })),
];
