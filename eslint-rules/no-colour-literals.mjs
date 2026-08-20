/**
 * cubit/no-colour-literals — R-UI-001: tokens are the sole colour source. Every
 * colour reaches a component as a CSS variable emitted from `src/ui/tokens.ts`;
 * `src/ui/tokens.ts` and `globals.css` are the only places a literal lives.
 */

const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FUNCTIONAL = /\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\s*\(/;

function isColour(text) {
  return HEX.test(text.trim()) || FUNCTIONAL.test(text);
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Colour literals live only in the token source (R-UI-001).' },
    schema: [],
    messages: {
      colour:
        'Colour literal `{{value}}` — read the emitted CSS variable (var(--…)) from src/ui/tokens.ts.',
    },
  },

  create(context) {
    const report = (node, value) => {
      context.report({ node, messageId: 'colour', data: { value } });
    };

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        if (!isColour(node.value)) return;
        report(node, node.value);
      },

      TemplateElement(node) {
        const text = node.value.cooked ?? node.value.raw;
        if (typeof text !== 'string' || !isColour(text)) return;
        report(node, text.trim());
      },
    };
  },
};
