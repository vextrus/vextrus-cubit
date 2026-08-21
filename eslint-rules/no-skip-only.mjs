/**
 * Q-08 — no `.skip`/`.only` in a change without a recorded reason. A skipped
 * test still counts in the roster and proves nothing; a lone `.only` quietly
 * deletes every other test in the file.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const RUNNERS = new Set(['describe', 'it', 'test', 'suite', 'bench', 'context']);

const FORBIDDEN = new Set(['skip', 'only']);

/**
 * The root identifier of `test.concurrent.only` is `test`.
 *
 * @param {import('estree').Node} node
 * @returns {string | null}
 */
function rootName(node) {
  let current = node;
  while (current.type === 'MemberExpression') {
    current = current.object;
  }
  return current.type === 'Identifier' ? current.name : null;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'forbid .skip and .only on test and describe blocks (Q-08)',
    },
    schema: [],
    messages: {
      skipOnly:
        'Q-08: {{root}}.{{modifier}} changes what the gate measures. Remove it, or record the reason in the increment spec.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (node.computed || node.property.type !== 'Identifier') {
          return;
        }
        if (!FORBIDDEN.has(node.property.name)) {
          return;
        }
        const root = rootName(node.object);
        if (root === null || !RUNNERS.has(root)) {
          return;
        }
        context.report({
          node,
          messageId: 'skipOnly',
          data: { root, modifier: node.property.name },
        });
      },
    };
  },
};
