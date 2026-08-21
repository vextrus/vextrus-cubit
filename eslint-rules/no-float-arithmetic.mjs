/**
 * B-07 — Decimal at the seam, `numeric` in the database. A binary float can
 * never hold a taka amount, so a fractional numeric literal (or a parseFloat
 * that manufactures one) is an error wherever money and quantities live.
 *
 * Integers are untouched: counts, indexes and millisecond budgets are honest.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'forbid fractional number literals and parseFloat; money and quantities are Decimal (B-07)',
    },
    schema: [],
    messages: {
      fractional:
        'B-07: {{raw}} is a binary float. Use Decimal (a string constructor) or an integer of the smallest unit.',
      parseFloat: 'B-07: {{callee}} produces a binary float. Parse into a Decimal instead.',
    },
  },
  create(context) {
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
