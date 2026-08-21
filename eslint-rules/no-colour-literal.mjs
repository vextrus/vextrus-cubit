/**
 * cubit/no-colour-literal — R-UI-001: "Tokens are CSS variables emitted from one TS source
 * (`src/ui/tokens.ts`) consumed by Tailwind … no colour literal outside tokens (lint rule
 * with fixture test)."
 *
 * Both themes are defined once. A colour written anywhere else is a colour that no theme
 * switch reaches.
 */
import { isFile } from './paths.mjs';

const TOKENS = 'src/ui/tokens.ts';

// The hex has to stand on its own: `#2447f0` is a colour, the fragment in `/docs#abcdef`
// is not, and a rule that cannot tell them apart is a rule someone turns off.
const HEX = /(?:^|[\s:(,;])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z_-])/;
const FUNCTIONAL = /\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\s*\(/;

function looksLikeColour(text) {
  return HEX.test(text) || FUNCTIONAL.test(text);
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'R-UI-001: colour lives in the Datum tokens, and nowhere else.',
    },
    schema: [],
    messages: {
      colour:
        'R-UI-001: {{text}} is a colour literal — name it in {{tokens}} and consume the CSS variable, so both themes stay defined in one place.',
    },
  },
  create(context) {
    if (isFile(context, TOKENS)) return {};
    const report = (node, text) => {
      context.report({
        node,
        messageId: 'colour',
        data: { text: text.trim().slice(0, 40), tokens: TOKENS },
      });
    };
    return {
      Literal(node) {
        if (typeof node.value !== 'string' || !looksLikeColour(node.value)) return;
        report(node, node.value);
      },
      TemplateElement(node) {
        const text = node.value.cooked ?? '';
        if (!looksLikeColour(text)) return;
        report(node, text);
      },
    };
  },
};
