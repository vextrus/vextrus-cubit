/**
 * cubit/no-locale-methods — L-FMT-01: `src/core/format.ts` is the tree's sole
 * caller of `Intl` (including `Intl.Collator`). `toLocaleString` and
 * `localeCompare` are lint errors everywhere else; a call site asks the format
 * seam and never carries an options bag.
 */

const BANNED_METHODS = new Set([
  'toLocaleString',
  'toLocaleDateString',
  'toLocaleTimeString',
  'toLocaleLowerCase',
  'toLocaleUpperCase',
  'localeCompare',
]);

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Locale-aware methods and Intl belong to src/core/format.ts alone (L-FMT-01).',
    },
    schema: [],
    messages: {
      method:
        '`{{name}}` renders through the platform locale — call src/core/format.ts (SEAM-FORMAT) instead.',
      intl: '`Intl` is reachable only from src/core/format.ts (L-FMT-01).',
    },
  },

  create(context) {
    return {
      MemberExpression(node) {
        if (node.object.type === 'Identifier' && node.object.name === 'Intl') {
          context.report({ node, messageId: 'intl' });
          return;
        }
        if (node.computed || node.property.type !== 'Identifier') return;
        if (!BANNED_METHODS.has(node.property.name)) return;
        context.report({ node, messageId: 'method', data: { name: node.property.name } });
      },

      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'Intl') {
          context.report({ node, messageId: 'intl' });
        }
      },
    };
  },
};
