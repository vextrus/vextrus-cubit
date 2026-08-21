/**
 * R-UI-001 — no colour literal outside tokens. A hex, rgb, hsl or oklch value
 * typed into a component is a token that escaped the system, and the design
 * gallery can never see it.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const SEAM = 'src/ui/tokens.ts';

const COLOUR = /(#[0-9a-fA-F]{3,8}\b)|\b(rgba?|hsla?|hwb|oklch|oklab|lch|lab|color-mix)\s*\(/;

export default {
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
    const filename = context.filename.replaceAll('\\', '/');
    if (filename.endsWith(SEAM)) {
      return {};
    }

    /**
     * @param {import('estree').Node} node
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
        }
      },
      TemplateElement(node) {
        check(/** @type {import('estree').Node} */ (node), node.value.raw);
      },
    };
  },
};
