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

/**
 * The name a member call states, whether it is written `Number.parseFloat(x)` or
 * `Number['parseFloat'](x)`. Reading only the dotted form leaves the bracket form as a way
 * round the rule, which is the same hole with two more characters in it.
 */
function memberName(callee) {
  if (callee.type !== 'MemberExpression') return null;
  const property = callee.property;
  if (!callee.computed) return property.type === 'Identifier' ? property.name : null;
  return property.type === 'Literal' && typeof property.value === 'string' ? property.value : null;
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
        if (memberName(callee) === 'parseFloat') {
          context.report({
            node,
            messageId: 'parseFloat',
            data: { callee: context.sourceCode.getText(callee).slice(0, 40) },
          });
        }
      },
    };
  },
};
