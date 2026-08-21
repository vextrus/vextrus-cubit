/**
 * R-UI-001 — no colour literal outside tokens. A hex, rgb, hsl or oklch value
 * typed into a component is a token that escaped the system, and the design
 * gallery can never see it.
 */
import { isSeamFile } from './seam.mjs';

const SEAM = 'src/ui/tokens.ts';

const COLOUR = /(#[0-9a-fA-F]{3,8}\b)|\b(rgba?|hsla?|hwb|oklch|oklab|lch|lab|color-mix)\s*\(/;

/**
 * CSS is not the only way to spell a colour in this stack. pixi.js takes colour
 * as a number — `0xff3366` — and a canvas increment that never types a `#` can
 * still put a token outside the token file, which is the thing R-UI-001 bans.
 *
 * Six hex digits is RRGGBB and eight is RRGGBBAA; two and four are the widths a
 * bitmask or a flag is written in, and firing on those would make the rule
 * about hexadecimal rather than about colour.
 */
const NUMERIC_COLOUR = /^0[xX](?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: `forbid colour literals outside ${SEAM} (R-UI-001)`,
    },
    schema: [],
    messages: {
      colour: `R-UI-001: "{{text}}" is a colour literal. Colour lives in ${SEAM} and reaches components as a token.`,
    },
  },
  create(context) {
    if (isSeamFile(context, SEAM)) {
      return {};
    }

    /**
     * @param {import('eslint').Rule.Node} node
     * @param {string} text
     */
    const check = (node, text) => {
      if (COLOUR.test(text)) {
        context.report({
          node,
          messageId: 'colour',
          data: { text: text.length > 40 ? `${text.slice(0, 40)}…` : text },
        });
      }
    };

    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          check(node, node.value);
          return;
        }
        // 0xff3366: the raw text is the evidence, because the parsed value is
        // just a number and 16724070 is not a colour anybody typed.
        const raw = node.raw;
        if (typeof node.value === 'number' && raw !== undefined && NUMERIC_COLOUR.test(raw)) {
          context.report({ node, messageId: 'colour', data: { text: raw } });
        }
      },
      TemplateElement(node) {
        check(/** @type {import('eslint').Rule.Node} */ (node), node.value.raw);
      },
    };
  },
};

export default rule;
