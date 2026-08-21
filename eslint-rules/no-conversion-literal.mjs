/**
 * cubit/no-conversion-literal — L-FRM-06: "Exact constants only: 0.028316846592 m³/cft ·
 * 0.3048 m/ft · 0.09290304 m²/sft · 1000 kg/MT · 0.45359237 kg/lb; a conversion literal
 * outside the canon is a lint failure."
 *
 * The canon is src/core/units.ts. A second copy of a factor is a rounding difference
 * waiting to be argued about on a certificate.
 */
import { isFile } from './paths.mjs';

const CANON = 'src/core/units.ts';

/** The four exact decimals, reported wherever they appear outside the canon. */
const EXACT = new Map([
  [0.028316846592, 'm³/cft'],
  [0.3048, 'm/ft'],
  [0.09290304, 'm²/sft'],
  [0.45359237, 'kg/lb'],
]);

/**
 * kg/MT is the integer 1000, which is also a timeout, a page size and a thousand other
 * honest numbers. It reads as a conversion only where it multiplies or divides.
 */
const MT = 1000;

function isScalingOperand(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (parent.type === 'BinaryExpression' && (parent.operator === '*' || parent.operator === '/')) {
    return true;
  }
  return (
    parent.type === 'AssignmentExpression' && (parent.operator === '*=' || parent.operator === '/=')
  );
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'L-FRM-06: unit conversion factors live in one canon, exactly once.',
    },
    schema: [],
    messages: {
      factor:
        'L-FRM-06: {{raw}} is the exact {{unit}} factor — import it from {{canon}} so every quantity converts the same way.',
    },
  },
  create(context) {
    if (isFile(context, CANON)) return {};
    return {
      Literal(node) {
        if (typeof node.value !== 'number') return;
        const raw = typeof node.raw === 'string' ? node.raw : String(node.value);
        const unit = EXACT.get(node.value);
        if (unit !== undefined) {
          context.report({ node, messageId: 'factor', data: { raw, unit, canon: CANON } });
          return;
        }
        if (node.value === MT && isScalingOperand(node)) {
          context.report({ node, messageId: 'factor', data: { raw, unit: 'kg/MT', canon: CANON } });
        }
      },
    };
  },
};
