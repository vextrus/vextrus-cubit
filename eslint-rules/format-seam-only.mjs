/**
 * L-FMT-01 — `src/core/format.ts` is the tree's sole caller of `Intl`
 * (including `Intl.Collator`). `toLocaleString` and `localeCompare` are lint
 * errors everywhere else, and `en-BD` is not a CLDR locale at all: it falls
 * back to Western grouping, which is exactly the bug lakh/crore exists to
 * prevent.
 */
import { isSeamFile } from './seam.mjs';

const SEAM = 'src/core/format.ts';

const LOCALE_METHODS = new Set([
  'toLocaleString',
  'toLocaleDateString',
  'toLocaleTimeString',
  'localeCompare',
]);

/**
 * The objects that hold the global `Intl`. `globalThis.Intl.NumberFormat(…)` is
 * the same seam violation as `Intl.NumberFormat(…)` and reads as ordinary code,
 * so the member form is not an escape hatch.
 */
const GLOBAL_HOLDERS = new Set(['globalThis', 'window', 'self', 'global']);

/**
 * The property a member expression reads, for `a.b` and for `a['b']` alike.
 * Bracket notation is ordinary JavaScript, not evasion, and a guardrail that
 * only understands the dot is a guardrail with a documented way around it.
 *
 * @param {import('eslint').Rule.Node & { type: 'MemberExpression' }} node
 * @returns {string | null}
 */
function propertyName(node) {
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
    const isSeam = isSeamFile(context, SEAM);

    return {
      Identifier(node) {
        if (node.name !== 'Intl' || isSeam) {
          return;
        }
        // A member's property and an object literal's key are somebody else's
        // `Intl`, not the global one. `globalThis.Intl` is reported by the
        // MemberExpression visitor below, which can tell the two apart.
        const parent = node.parent;
        if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) {
          return;
        }
        if (parent.type === 'Property' && parent.key === node && !parent.computed) {
          return;
        }
        context.report({ node, messageId: 'intl' });
      },

      MemberExpression(node) {
        if (isSeam) {
          return;
        }
        const name = propertyName(node);
        if (name === null) {
          return;
        }
        if (LOCALE_METHODS.has(name)) {
          context.report({ node: node.property, messageId: 'method', data: { name } });
          return;
        }
        if (
          name === 'Intl' &&
          node.object.type === 'Identifier' &&
          GLOBAL_HOLDERS.has(node.object.name)
        ) {
          context.report({ node: node.property, messageId: 'intl' });
        }
      },

      Literal(node) {
        if (typeof node.value === 'string' && node.value.toLowerCase() === 'en-bd') {
          context.report({ node, messageId: 'enBD' });
        }
      },
    };
  },
};

export default rule;
