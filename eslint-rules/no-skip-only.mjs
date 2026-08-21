/**
 * cubit/no-skip-only — Q-08: no excluded test and no exclusive test in a change without a
 * recorded reason. Both are ways for a suite to report green while proving less: one drops
 * a test, the other drops every other test.
 *
 * The markers are matched by property name, so this rule never spells them in a form the
 * structural diff check would read as adding one.
 */

const EXCLUDED = 'skip';
const EXCLUSIVE = 'only';
const MARKERS = new Set([EXCLUDED, EXCLUSIVE]);

/** The test entry points a marker can hang off. */
const ENTRIES = new Set(['describe', 'it', 'test', 'suite', 'bench', 'context']);

/** The leftmost identifier of a member chain: `test.concurrent.<marker>` → `test`. */
function chainRoot(node) {
  let current = node;
  while (current.type === 'MemberExpression') current = current.object;
  if (current.type === 'CallExpression') return chainRoot(current.callee);
  return current;
}

/** The property being read, whether written with a dot or with brackets. */
function propertyName(node) {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string') {
    return node.property.value;
  }
  return null;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Q-08: test count and assertion count never fall silently; an excluded or exclusive test is exactly that fall.',
    },
    schema: [],
    messages: {
      excluded:
        'Q-08: this suite is excluded from the run — the count drops and the gate cannot see it. Delete the test or fix it.',
      exclusive:
        'Q-08: this marker runs one test and drops the rest — green here means almost nothing ran.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        const name = propertyName(node);
        if (name === null || !MARKERS.has(name)) return;
        const root = chainRoot(node);
        if (root.type !== 'Identifier' || !ENTRIES.has(root.name)) return;
        context.report({
          node,
          messageId: name === EXCLUDED ? 'excluded' : 'exclusive',
        });
      },
    };
  },
};
