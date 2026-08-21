/**
 * ESLint 10, flat config — "boundary rules and every NEVER, each with a fixture test"
 * (C-06, B-05).
 *
 * Three kinds of block:
 *   1. the tree-wide Q-08 block — suppressions, excluded/exclusive tests, explicit any;
 *   2. the seam blocks, pre-wired for src/** and db/** so the boundary rules arm the
 *      moment product code lands, with no config change in a later increment;
 *   3. one block per guardrail-registry row, binding that row's rule to its fixture
 *      directory. The fixture tree is globally ignored so `eslint .` never sees files that
 *      are broken on purpose; `--no-ignore` re-includes them and these blocks bind.
 */
import tseslint from 'typescript-eslint';
import cubit from './eslint-rules/index.mjs';

/** The guardrail registry: fixture directory → rule id. The registry test reads the same rows. */
export const REGISTRY = [
  { dir: 'no-float-arithmetic', ruleId: 'cubit/no-float-arithmetic' },
  { dir: 'format-seam-only', ruleId: 'cubit/format-seam-only' },
  { dir: 'model-seam-only', ruleId: 'cubit/model-seam-only' },
  { dir: 'db-seam-only', ruleId: 'cubit/db-seam-only' },
  { dir: 'no-colour-literal', ruleId: 'cubit/no-colour-literal' },
  { dir: 'no-jsx-string-literal', ruleId: 'cubit/no-jsx-string-literal' },
  { dir: 'no-conversion-literal', ruleId: 'cubit/no-conversion-literal' },
  { dir: 'no-suppressions', ruleId: 'cubit/no-suppressions' },
  { dir: 'no-skip-only', ruleId: 'cubit/no-skip-only' },
  { dir: 'no-explicit-any', ruleId: '@typescript-eslint/no-explicit-any' },
  // inc-004: the same rule, proved on the shapes a *component* takes — a Tailwind arbitrary
  // value in className and a functional colour in an inline style (R-UI-001).
  { dir: 'tokens', ruleId: 'cubit/no-colour-literal' },
];

const typescriptLanguageOptions = {
  parser: tseslint.parser,
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
};

const plugins = { cubit, '@typescript-eslint': tseslint.plugin };

/** Q-08 holds everywhere; the seam rules hold where the seam is. */
const Q08_RULES = {
  '@typescript-eslint/no-explicit-any': 'error',
  'cubit/no-suppressions': 'error',
  'cubit/no-skip-only': 'error',
};

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.next-verify/**',
      '.scratch/**',
      'dist/**',
      'out/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'cad/**',
      // Broken on purpose: these files exist to make a rule fire, one file at a time.
      'tests/lint-fixtures/*/**',
    ],
  },

  // Q-08 mechanically, not as a wish: inline configuration cannot turn a rule off at all.
  // Without this, a blanket suppression at the top of a file silences every rule in it —
  // including the rule that reports suppressions, which would report on its own comment
  // and then be suppressed by it.
  {
    linterOptions: { noInlineConfig: true },
  },

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: typescriptLanguageOptions,
    plugins,
    rules: Q08_RULES,
  },

  // The toolchain's own JavaScript — scripts, configs and the rules themselves. Every
  // extension ESLint lints by default is bound, not just the one the tree happens to use
  // today: a single .js codemod or .cjs plugin config is otherwise a hole in Q-08's
  // mechanical surface, where a suppression passes `eslint .` unreported.
  {
    files: ['**/*.mjs', '**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { cubit },
    rules: {
      'cubit/no-suppressions': 'error',
      'cubit/no-skip-only': 'error',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs' },
    plugins: { cubit },
    rules: {
      'cubit/no-suppressions': 'error',
      'cubit/no-skip-only': 'error',
    },
  },

  // Seam block. src/** is the product; db/** is the schema, which is why the driver rule
  // is bound separately below — db/schema must import drizzle to define itself.
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'db/**/*.ts'],
    languageOptions: typescriptLanguageOptions,
    plugins,
    rules: {
      'cubit/no-float-arithmetic': 'error',
      'cubit/format-seam-only': 'error',
      'cubit/model-seam-only': 'error',
      'cubit/no-colour-literal': 'error',
      'cubit/no-conversion-literal': 'error',
      'cubit/no-jsx-string-literal': 'error',
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: typescriptLanguageOptions,
    plugins,
    rules: { 'cubit/db-seam-only': 'error' },
  },

  // One block per registry row (B-05: the fixture proves the rule fires).
  ...REGISTRY.map((row) => ({
    files: [`tests/lint-fixtures/${row.dir}/**/*.ts`, `tests/lint-fixtures/${row.dir}/**/*.tsx`],
    languageOptions: typescriptLanguageOptions,
    plugins,
    rules: { [row.ruleId]: 'error' },
  })),
];
