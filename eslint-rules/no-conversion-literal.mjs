/**
 * L-FRM-06 — the unit canon is exact and it lives in one file. A conversion
 * constant typed at a call site is a second copy of the canon that nobody will
 * ever update, so it is an error outside `src/core/units.ts`.
 */
import { isSeamFile } from './seam.mjs';

const SEAM = 'src/core/units.ts';

/** The exact constants L-FRM-06 names. */
const CANON = new Map([
  [0.028316846592, 'm³/cft'],
  [0.3048, 'm/ft'],
  [0.09290304, 'm²/sft'],
  [0.45359237, 'kg/lb'],
]);

/** kg/MT is an integer, so it only reads as a conversion when it converts. */
const KG_PER_MT = 1000;

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: `forbid unit-conversion constants outside ${SEAM} (L-FRM-06)`,
    },
    schema: [],
    messages: {
      canon: `L-FRM-06: {{raw}} is the {{unit}} conversion. It lives in ${SEAM} and nowhere else.`,
    },
  },
  create(context) {
    if (isSeamFile(context, SEAM)) {
      return {};
    }

    return {
      Literal(node) {
        if (typeof node.value !== 'number') {
          return;
        }
        const unit = CANON.get(node.value);
        if (unit !== undefined) {
          context.report({
            node,
            messageId: 'canon',
            data: { raw: String(node.raw ?? node.value), unit },
          });
          return;
        }
        if (node.value !== KG_PER_MT) {
          return;
        }
        const parent = /** @type {{ type: string, operator?: string }} */ (node.parent);
        if (parent.type === 'BinaryExpression' && (parent.operator === '*' || parent.operator === '/')) {
          context.report({
            node,
            messageId: 'canon',
            data: { raw: String(node.raw ?? node.value), unit: 'kg/MT' },
          });
        }
      },
    };
  },
};

export default rule;
