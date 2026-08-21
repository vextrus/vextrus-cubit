/**
 * The `cubit` ESLint plugin: every NEVER the Bible states as prose, restated
 * as a rule that fires. B-05 — prose is not enforcement.
 *
 * Each rule has a committed fixture pair under tests/lint-fixtures/<rule>/ and
 * a test that proves the rule reports bad.* and stays silent on good.*.
 */
import noFloatArithmetic from './no-float-arithmetic.mjs';
import formatSeamOnly from './format-seam-only.mjs';
import modelSeamOnly from './model-seam-only.mjs';
import dbSeamOnly from './db-seam-only.mjs';
import noColourLiteral from './no-colour-literal.mjs';
import noJsxStringLiteral from './no-jsx-string-literal.mjs';
import noConversionLiteral from './no-conversion-literal.mjs';
import noSuppressions from './no-suppressions.mjs';
import noSkipOnly from './no-skip-only.mjs';

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: {
    name: 'eslint-plugin-cubit',
    version: '0.0.0',
  },
  rules: {
    'no-float-arithmetic': noFloatArithmetic,
    'format-seam-only': formatSeamOnly,
    'model-seam-only': modelSeamOnly,
    'db-seam-only': dbSeamOnly,
    'no-colour-literal': noColourLiteral,
    'no-jsx-string-literal': noJsxStringLiteral,
    'no-conversion-literal': noConversionLiteral,
    'no-suppressions': noSuppressions,
    'no-skip-only': noSkipOnly,
  },
};

export default plugin;
