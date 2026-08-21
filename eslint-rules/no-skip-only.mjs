/**
 * Q-08 — no `.skip`/`.only` in a change without a recorded reason. A skipped
 * test still counts in the roster and proves nothing; a lone `.only` quietly
 * deletes every other test in the file.
 */
const RUNNERS = new Set(['describe', 'it', 'test', 'suite', 'bench', 'context']);

const FORBIDDEN = new Set(['skip', 'only']);

/**
 * The root identifier of `test.concurrent.only` is `test`.
 *
 * @param {import('eslint').Rule.Node} node
 * @returns {string | null}
 */
function rootName(node) {
  let current = node;
  while (current.type === 'MemberExpression') {
    current = /** @type {import('eslint').Rule.Node} */ (current.object);
  }
  return current.type === 'Identifier' ? current.name : null;
}

/**
 * The marker a member expression names, for `it.only` and `it['only']` alike.
 * Bracket notation is ordinary JavaScript — dynamic keys, minifier output — so
 * a rule that only reads the dot form states a ban it does not enforce.
 *
 * @param {import('eslint').Rule.Node & { type: 'MemberExpression' }} node
 * @returns {string | null}
 */
function markerName(node) {
  if (node.computed) {
    return node.property.type === 'Literal' && typeof node.property.value === 'string'
      ? node.property.value
      : null;
  }
  return node.property.type === 'Identifier' ? node.property.name : null;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
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
        const marker = markerName(node);
        if (marker === null || !FORBIDDEN.has(marker)) {
          return;
        }
        const root = rootName(/** @type {import('eslint').Rule.Node} */ (node.object));
        if (root === null || !RUNNERS.has(root)) {
          return;
        }
        context.report({
          node,
          messageId: 'skipOnly',
          data: { root, modifier: marker },
        });
      },
    };
  },
};

export default rule;
