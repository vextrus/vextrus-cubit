/**
 * L-FMT-01 — `src/core/format.ts` is the tree's sole caller of `Intl`
 * (including `Intl.Collator`). `toLocaleString` and `localeCompare` are lint
 * errors everywhere else, and `en-BD` is not a CLDR locale at all: it falls
 * back to Western grouping, which is exactly the bug lakh/crore exists to
 * prevent.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const SEAM = 'src/core/format.ts';

const LOCALE_METHODS = new Set([
  'toLocaleString',
  'toLocaleDateString',
  'toLocaleTimeString',
  'localeCompare',
]);

export default {
  meta: {
    type: 'problem',
    docs: {
      description: `forbid Intl, toLocale* and localeCompare outside ${SEAM} (L-FMT-01)`,
    },
    schema: [],
    messages: {
      intl: `L-FMT-01: Intl belongs to ${SEAM}. Call the format seam instead.`,
      method: `L-FMT-01: {{name}} belongs to ${SEAM}. Call the format seam instead.`,
      enBD: 'L-FMT-01: "en-BD" is not a CLDR locale — it falls back to Western grouping. Banned.',
    },
  },
  create(context) {
    const filename = context.filename.replaceAll('\\', '/');
    const isSeam = filename.endsWith(SEAM);

    return {
      Identifier(node) {
        if (node.name !== 'Intl' || isSeam) {
          return;
        }
        // Only the global object, not a property or a local binding's key.
        const parent = /** @type {{ type: string, property?: unknown }} */ (node.parent);
        if (parent.type === 'MemberExpression' && parent.property === node) {
          return;
        }
        context.report({ node, messageId: 'intl' });
      },

      MemberExpression(node) {
        if (isSeam || node.property.type !== 'Identifier') {
          return;
        }
        if (!LOCALE_METHODS.has(node.property.name)) {
          return;
        }
        context.report({ node: node.property, messageId: 'method', data: { name: node.property.name } });
      },

      Literal(node) {
        if (typeof node.value === 'string' && node.value.toLowerCase() === 'en-bd') {
          context.report({ node, messageId: 'enBD' });
        }
      },
    };
  },
};
