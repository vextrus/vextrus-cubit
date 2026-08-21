/**
 * cubit/format-seam-only — L-FMT-01: `src/core/format.ts` is the tree's sole caller of
 * `Intl` (including `Intl.Collator`); `toLocaleString` and `localeCompare` are lint errors;
 * `en-BD` is not a CLDR locale (it falls back to Western grouping) and is banned.
 */
import { isFile } from './paths.mjs';

const SEAM = 'src/core/format.ts';

const LOCALE_METHODS = new Set([
  'toLocaleString',
  'toLocaleDateString',
  'toLocaleTimeString',
  'localeCompare',
]);

const BANNED_LOCALE = ['en', 'BD'].join('-');

/**
 * The names that reach the global object. `globalThis.Intl` is the same `Intl` the clause
 * names; only the spelling is longer.
 */
const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self', 'global']);

/**
 * The name a member expression states, whether written `x.localeCompare` or
 * `x['localeCompare']`. Reading only the dotted form leaves the bracket form as a way round
 * the rule, which is the same hole with two more characters in it (as no-float-arithmetic
 * already reads `Number['parseFloat']`).
 */
function memberName(node) {
  const property = node.property;
  if (!node.computed) return property.type === 'Identifier' ? property.name : null;
  return property.type === 'Literal' && typeof property.value === 'string' ? property.value : null;
}

/** True for `globalThis`, `window`, `self`, `global` — the global object under any name. */
function isGlobalObject(node) {
  return node.type === 'Identifier' && GLOBAL_OBJECTS.has(node.name);
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'L-FMT-01: formatting lives at one seam; Intl, locale-aware string methods and the en-BD tag are banned outside it.',
    },
    schema: [],
    messages: {
      intl: 'L-FMT-01: Intl belongs to {{seam}} — lakh/crore grouping and collation are decided once.',
      method:
        'L-FMT-01: {{name}} formats with the ambient locale — format through {{seam}} instead.',
      locale:
        'L-FMT-01: {{tag}} is not a CLDR locale and falls back to Western grouping; the seam formats Bangla numbering itself.',
    },
  },
  create(context) {
    if (isFile(context, SEAM)) return {};
    return {
      Identifier(node) {
        if (node.name !== 'Intl') return;
        const parent = node.parent;
        // `x.Intl` is not the global — unless x is the global object, where
        // `globalThis.Intl` is exactly it. `{ Intl: … }` is a key, not a reference.
        if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) {
          if (isGlobalObject(parent.object)) {
            context.report({ node, messageId: 'intl', data: { seam: SEAM } });
          }
          return;
        }
        if (parent?.type === 'Property' && parent.key === node && !parent.computed) return;
        context.report({ node, messageId: 'intl', data: { seam: SEAM } });
      },
      MemberExpression(node) {
        const name = memberName(node);
        if (name === null) return;
        // `globalThis['Intl']`: the bracket form of the same reach for the global.
        if (name === 'Intl' && node.computed && isGlobalObject(node.object)) {
          context.report({ node, messageId: 'intl', data: { seam: SEAM } });
          return;
        }
        if (!LOCALE_METHODS.has(name)) return;
        context.report({
          node: node.property,
          messageId: 'method',
          data: { name, seam: SEAM },
        });
      },
      Literal(node) {
        if (node.value !== BANNED_LOCALE) return;
        context.report({ node, messageId: 'locale', data: { tag: BANNED_LOCALE } });
      },
      TemplateElement(node) {
        if (!node.value.cooked?.includes(BANNED_LOCALE)) return;
        context.report({ node, messageId: 'locale', data: { tag: BANNED_LOCALE } });
      },
    };
  },
};
