/**
 * cubit/no-jsx-string-literals — R-SPINE-060: every user-facing string lives in
 * one typed string table (`src/ui/strings/*`). No string literals in JSX except
 * test ids and codes.
 */

/** A refusal code, a basis name, a status: SCREAMING_SNAKE is machine text, not prose. */
const CODE = /^[A-Z][A-Z0-9_]*$/;

/**
 * Attributes whose value a person reads or hears. Everything else on a JSX tag
 * — `type`, `href`, `className`, `data-testid` — is machine text and stays a
 * literal; these carry prose, and prose belongs to the typed table just as much
 * when it is announced by a screen reader as when it is printed on screen.
 */
const SPOKEN = new Set([
  'alt',
  'label',
  'placeholder',
  'title',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
]);

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'User-facing JSX text comes from the typed string table (R-SPINE-060).' },
    schema: [],
    messages: {
      text: 'Literal JSX text `{{value}}` — move it into a typed table under src/ui/strings/.',
      attribute:
        'Literal `{{name}}="{{value}}"` — a string a person reads or hears belongs in a typed table under src/ui/strings/.',
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

      JSXAttribute(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (name === null || !SPOKEN.has(name)) return;

        const literal =
          node.value?.type === 'Literal'
            ? node.value
            : node.value?.type === 'JSXExpressionContainer' && node.value.expression.type === 'Literal'
              ? node.value.expression
              : null;
        if (literal === null || typeof literal.value !== 'string') return;

        const value = literal.value.trim();
        if (value.length === 0 || CODE.test(value)) return;
        context.report({ node, messageId: 'attribute', data: { name, value } });
      },
    };
  },
};
