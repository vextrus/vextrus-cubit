/**
 * R-SPINE-060 — every user-facing string lives in one typed string table
 * (`src/ui/strings.ts` per module) keyed by id. No string literals in JSX
 * except test ids and codes. Not a translation system — a readiness rule.
 *
 * @type {import('eslint').Rule.RuleModule}
 */

/** Attributes that reach a human as text and therefore need a string id. */
const USER_FACING_ATTRIBUTES = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'label',
  'placeholder',
  'title',
]);

/** Codes are not prose: BDT, J-000, RFI-2031, GRN. */
const CODE = /^[A-Z0-9][A-Z0-9._:-]*$/;

/** Punctuation and separators carry no message to translate. */
const PUNCTUATION = /^[\s\p{P}\p{S}]*$/u;

/** @param {string} raw */
function isExempt(raw) {
  const text = raw.trim();
  return text === '' || PUNCTUATION.test(text) || CODE.test(text);
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'forbid user-facing string literals in JSX; use the module string table (R-SPINE-060)',
    },
    schema: [],
    messages: {
      text: 'R-SPINE-060: "{{text}}" is a user-facing string. Key it in the module string table and render strings[id].',
    },
  },
  create(context) {
    /**
     * @param {import('estree').Node} node
     * @param {string} raw
     */
    const check = (node, raw) => {
      if (isExempt(raw)) {
        return;
      }
      const text = raw.trim();
      context.report({
        node,
        messageId: 'text',
        data: { text: text.length > 40 ? `${text.slice(0, 40)}…` : text },
      });
    };

    return {
      // <p>Payment received</p>
      JSXText(node) {
        check(node, node.value);
      },

      // <p>{'Payment received'}</p> and <p>{`Payment received`}</p>
      JSXExpressionContainer(node) {
        const parent = /** @type {{ type: string }} */ (node.parent);
        if (parent.type !== 'JSXElement' && parent.type !== 'JSXFragment') {
          return;
        }
        const expression = node.expression;
        if (expression.type === 'Literal' && typeof expression.value === 'string') {
          check(expression, expression.value);
          return;
        }
        if (expression.type === 'TemplateLiteral' && expression.expressions.length === 0) {
          const [quasi] = expression.quasis;
          if (quasi !== undefined) {
            check(expression, quasi.value.raw);
          }
        }
      },

      // <input placeholder="Amount in taka" data-testid="amount" />
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.value === null) {
          return;
        }
        if (!USER_FACING_ATTRIBUTES.has(node.name.name)) {
          return;
        }
        const value = node.value;
        if (value.type === 'Literal' && typeof value.value === 'string') {
          check(value, value.value);
        }
      },
    };
  },
};
