/**
 * cubit/no-float-arithmetic — B-07: "Decimal at the seam, `numeric` in the database,
 * lakh/crore on every document; floats and Western grouping are lint errors."
 *
 * Fires on a fractional numeric literal and on parseFloat. The conversion canon
 * (src/core/units.ts, L-FRM-06) is the one file whose fractional constants are the law
 * itself; everything else states a quantity, and a quantity is a Decimal or a string.
 */
import { isFile } from './paths.mjs';

const CANON = 'src/core/units.ts';

/** A literal is fractional if it is written with a decimal point or is not an integer. */
function isFractional(node) {
  if (typeof node.value !== 'number') return false;
  const raw = typeof node.raw === 'string' ? node.raw : String(node.value);
  if (/^0[xXoObB]/.test(raw)) return false;
  return raw.includes('.') || !Number.isInteger(node.value);
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'B-07: money and quantity are Decimal at the seam and numeric in the database; a float is a lint error.',
    },
    schema: [],
    messages: {
      fractional:
        'B-07: fractional literal {{raw}} — arithmetic at the seam is decimal.js, and the column is numeric.',
      parseFloat:
        'B-07: {{callee}} produces a binary float — parse the string with Decimal instead.',
    },
  },
  create(context) {
    if (isFile(context, CANON)) return {};
    return {
      Literal(node) {
        if (!isFractional(node)) return;
        context.report({
          node,
          messageId: 'fractional',
          data: { raw: typeof node.raw === 'string' ? node.raw : String(node.value) },
        });
      },
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === 'Identifier' && callee.name === 'parseFloat') {
          context.report({ node, messageId: 'parseFloat', data: { callee: 'parseFloat' } });
          return;
        }
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'parseFloat'
        ) {
          context.report({ node, messageId: 'parseFloat', data: { callee: 'Number.parseFloat' } });
        }
      },
    };
  },
};
