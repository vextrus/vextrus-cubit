/**
 * cubit/no-float-arithmetic — money and quantity never ride binary floating
 * point (Decimal at the seam).
 *
 * Deliberately narrow: a non-integer numeric literal and `parseFloat` are the
 * two ways a float enters the tree. Integer counting arithmetic stays legal, so
 * `Math.ceil(rows / perPage) + 1` is not a finding.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Non-integer numeric literals and parseFloat: use decimal.js at the seam.',
    },
    schema: [],
    messages: {
      literal:
        'Non-integer numeric literal {{value}} — carry the value as a string and use decimal.js.',
      parseFloat: '{{name}} parses a binary float — use `new Decimal(text)` instead.',
    },
  },

  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== 'number') return;
        if (Number.isInteger(node.value)) return;
        context.report({ node, messageId: 'literal', data: { value: String(node.value) } });
      },

      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === 'Identifier' && callee.name === 'parseFloat') {
          context.report({ node, messageId: 'parseFloat', data: { name: 'parseFloat' } });
          return;
        }
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Number' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'parseFloat'
        ) {
          context.report({ node, messageId: 'parseFloat', data: { name: 'Number.parseFloat' } });
        }
      },
    };
  },
};
