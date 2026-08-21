/**
 * B-07 — Decimal at the seam, `numeric` in the database. A binary float can
 * never hold a taka amount, so a fractional numeric literal (or a parseFloat
 * that manufactures one) is an error wherever money and quantities live.
 *
 * Integers are untouched: counts, indexes and millisecond budgets are honest.
 *
 * One file is exempt, and it is the same file `cubit/no-conversion-literal`
 * exempts: L-FRM-06 says the unit canon — 0.3048, 0.028316846592, 0.09290304,
 * 0.45359237 — lives in `src/core/units.ts` as exact constants and nowhere
 * else. A rule that forbade fractional literals there too would forbid the one
 * place the Bible requires them, and the first increment to write the canon
 * would fail the gate on its own seam.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const SEAM = 'src/core/units.ts';

export default {
  meta: {
    type: 'problem',
    docs: {
      description: `forbid fractional number literals and parseFloat outside ${SEAM}; money and quantities are Decimal (B-07)`,
    },
    schema: [],
    messages: {
      fractional:
        'B-07: {{raw}} is a binary float. Use Decimal (a string constructor) or an integer of the smallest unit.',
      parseFloat: 'B-07: {{callee}} produces a binary float. Parse into a Decimal instead.',
    },
  },
  create(context) {
    // The unit canon's own file, exactly as no-conversion-literal reads it.
    if (context.filename.replaceAll('\\', '/').endsWith(SEAM)) {
      return {};
    }

    /** @param {string} name */
    const isParseFloat = (name) => name === 'parseFloat';

    return {
      Literal(node) {
        if (typeof node.value !== 'number') {
          return;
        }
        // 1.0 and 2e3 are integers however they are spelled; 0.1 is not.
        if (Number.isInteger(node.value)) {
          return;
        }
        context.report({
          node,
          messageId: 'fractional',
          data: { raw: String(node.raw ?? node.value) },
        });
      },

      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === 'Identifier' && isParseFloat(callee.name)) {
          context.report({ node, messageId: 'parseFloat', data: { callee: 'parseFloat' } });
          return;
        }
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Number' &&
          callee.property.type === 'Identifier' &&
          isParseFloat(callee.property.name)
        ) {
          context.report({ node, messageId: 'parseFloat', data: { callee: 'Number.parseFloat' } });
        }
      },
    };
  },
};
