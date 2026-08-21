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
        // `x.Intl` and `{ Intl: … }` are not the global; `Intl.NumberFormat` is.
        if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) {
          return;
        }
        if (parent?.type === 'Property' && parent.key === node && !parent.computed) return;
        context.report({ node, messageId: 'intl', data: { seam: SEAM } });
      },
      MemberExpression(node) {
        if (node.computed || node.property.type !== 'Identifier') return;
        if (!LOCALE_METHODS.has(node.property.name)) return;
        context.report({
          node: node.property,
          messageId: 'method',
          data: { name: node.property.name, seam: SEAM },
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
