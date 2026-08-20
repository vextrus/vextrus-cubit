/**
 * cubit/no-jsx-string-literals — R-SPINE-060: every user-facing string lives in
 * one typed string table (`src/ui/strings/*`). No string literals in JSX except
 * test ids and codes.
 */

/** A refusal code, a basis name, a status: SCREAMING_SNAKE is machine text, not prose. */
const CODE = /^[A-Z][A-Z0-9_]*$/;

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'User-facing JSX text comes from the typed string table (R-SPINE-060).' },
    schema: [],
    messages: {
      text: 'Literal JSX text `{{value}}` — move it into a typed table under src/ui/strings/.',
    },
  },

  create(context) {
    return {
      JSXText(node) {
        const value = node.value.trim();
        if (value.length === 0) return;
        if (CODE.test(value)) return;
        context.report({ node, messageId: 'text', data: { value } });
      },
    };
  },
};
