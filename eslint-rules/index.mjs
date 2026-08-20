/**
 * The `cubit` ESLint plugin — every NEVER in the Bible is a rule here, and
 * every rule has a bad/good fixture pair under `tests/lint-fixtures/<rule>/`
 * that the contract test lints on disk (C-06, AC-04). Local, never published.
 */
import noFloatArithmetic from './no-float-arithmetic.mjs';
import noLocaleMethods from './no-locale-methods.mjs';
import noColourLiterals from './no-colour-literals.mjs';
import noJsxStringLiterals from './no-jsx-string-literals.mjs';
import dbSeamOnly from './db-seam-only.mjs';
import moduleBoundaries from './module-boundaries.mjs';

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: { name: 'eslint-plugin-cubit', version: '0.0.0' },
  rules: {
    'no-float-arithmetic': noFloatArithmetic,
    'no-locale-methods': noLocaleMethods,
    'no-colour-literals': noColourLiterals,
    'no-jsx-string-literals': noJsxStringLiterals,
    'db-seam-only': dbSeamOnly,
    'module-boundaries': moduleBoundaries,
  },
};

export default plugin;
