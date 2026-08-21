/**
 * The `cubit` ESLint plugin — every NEVER the Bible states as a named rule (C-06, B-05).
 * Each rule has a fixture directory under tests/lint-fixtures/ proving that it fires on
 * the bad file and stays silent on the good one.
 */
import dbSeamOnly from './db-seam-only.mjs';
import formatSeamOnly from './format-seam-only.mjs';
import modelSeamOnly from './model-seam-only.mjs';
import noColourLiteral from './no-colour-literal.mjs';
import noConversionLiteral from './no-conversion-literal.mjs';
import noFloatArithmetic from './no-float-arithmetic.mjs';
import noJsxStringLiteral from './no-jsx-string-literal.mjs';
import noSkipOnly from './no-skip-only.mjs';
import noSuppressions from './no-suppressions.mjs';

export default {
  meta: { name: 'cubit', version: '0.0.0' },
  rules: {
    'db-seam-only': dbSeamOnly,
    'format-seam-only': formatSeamOnly,
    'model-seam-only': modelSeamOnly,
    'no-colour-literal': noColourLiteral,
    'no-conversion-literal': noConversionLiteral,
    'no-float-arithmetic': noFloatArithmetic,
    'no-jsx-string-literal': noJsxStringLiteral,
    'no-skip-only': noSkipOnly,
    'no-suppressions': noSuppressions,
  },
};
