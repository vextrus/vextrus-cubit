/**
 * R-SPINE-060 — every user-facing string lives in one typed string table
 * (`src/ui/strings.ts` per module) keyed by id. No string literals in JSX
 * except test ids and codes. Not a translation system — a readiness rule.
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

/**
 * Codes are not prose: BDT, GRN, J-000, RFI-2031, VAT-2031:04.
 *
 * "Upper case" alone is not the test. `SUBMIT`, `PENDING`, `OVERDUE` are prose
 * that happens to be shouted, and a design increment writes them by the dozen;
 * exempting them would hand R-SPINE-060 a hole the string table never learns
 * about. Length is not the test either: `SAVE`, `DONE`, `PAID`, `OPEN`, `EDIT`,
 * `NEXT`, `BACK`, `YES` and `OK` are the button captions a design increment
 * writes by the dozen, and they are shorter than the words above.
 *
 * So a code carries a digit or a separator — the shape of an identifier — or it
 * is one of the domain's own abbreviations, named below.
 */
const CODE = /^[A-Z0-9][A-Z0-9._:-]*$/;

/**
 * The letters-only codes this tree renders as themselves. The list is not a
 * budget and not a vocabulary to complete: anything absent from it is keyed in
 * the module string table, which is R-SPINE-060's default answer anyway. It is
 * here so that adding a bare shouted word to the exempt set is a reviewed line
 * in a toolchain-tagged increment rather than a side effect of its length.
 */
const ALPHABETIC_CODES = new Set(['BDT', 'BOQ', 'CAD', 'GRN', 'MT', 'NOC', 'PO', 'RFI', 'VAT']);

/** Punctuation and separators carry no message to translate. */
const PUNCTUATION = /^[\s\p{P}\p{S}]*$/u;

/** @param {string} text */
function isCode(text) {
  if (!CODE.test(text)) {
    return false;
  }
  return /[0-9._:-]/.test(text) || ALPHABETIC_CODES.has(text);
}

/**
 * JSX is not ESTree, so ESLint's published node types do not describe it. These
 * are the three nodes this rule reads, in the shape the TypeScript-ESLint
 * parser hands them over.
 *
 * @typedef {{ type: string, name?: string }} JsxIdentifier
 * @typedef {{ type: 'JSXText', value: string }} JsxText
 * @typedef {{
 *   type: 'JSXExpressionContainer',
 *   parent: { type: string },
 *   expression: import('eslint').Rule.Node,
 * }} JsxExpressionContainer
 * An attribute's value is a plain literal (`placeholder="x"`), a container
 * holding an expression (`placeholder={x}`), an element, or nothing at all.
 *
 * @typedef {{
 *   type: 'JSXAttribute',
 *   name: JsxIdentifier,
 *   value: import('eslint').Rule.Node | JsxExpressionContainer | null,
 * }} JsxAttribute
 */

/**
 * Reporting on a JSX node is reporting on a node; only the published types stop
 * short. One cast, in one place, rather than an untyped visitor each time.
 *
 * @param {object} node
 * @returns {import('eslint').Rule.Node}
 */
const asNode = (node) => /** @type {import('eslint').Rule.Node} */ (/** @type {unknown} */ (node));

/** @param {string} raw */
function isExempt(raw) {
  const text = raw.trim();
  return text === '' || PUNCTUATION.test(text) || isCode(text);
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
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
     * @param {import('eslint').Rule.Node} node
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

    /**
     * The two spellings a braced string can take: `{'text'}` and `{`text`}`.
     * A template with an interpolation is composition, not a literal, and the
     * pieces it is composed of are reported where they are written.
     *
     * @param {import('eslint').Rule.Node} expression
     */
    const checkExpression = (expression) => {
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
    };

    // ESLint's RuleListener is indexed by ESTree node names, and JSX has none
    // of them; the visitors below are typed for the reader and the compiler,
    // and handed over as the listener ESLint expects.
    const visitors = {
      // <p>Payment received</p>
      /** @param {JsxText} node */
      JSXText(node) {
        check(asNode(node), node.value);
      },

      // <p>{'Payment received'}</p> and <p>{`Payment received`}</p>
      /** @param {JsxExpressionContainer} node */
      JSXExpressionContainer(node) {
        const parent = node.parent;
        if (parent.type !== 'JSXElement' && parent.type !== 'JSXFragment') {
          // An attribute's container is read by the JSXAttribute visitor, which
          // knows whether the attribute reaches a human; every other parent is
          // not a rendered position.
          return;
        }
        checkExpression(node.expression);
      },

      // <input placeholder="Amount in taka" data-testid="amount" />
      /** @param {JsxAttribute} node */
      JSXAttribute(node) {
        const name = node.name;
        if (name.type !== 'JSXIdentifier' || name.name === undefined || node.value === null) {
          return;
        }
        if (!USER_FACING_ATTRIBUTES.has(name.name)) {
          return;
        }
        const value = node.value;
        if (value.type === 'Literal' && typeof value.value === 'string') {
          check(value, value.value);
          return;
        }
        // placeholder={'Amount in taka'} and title={`Total due`} are the same
        // string reaching the same human; the braces are what a formatter or a
        // half-finished edit leaves behind, not a different intent.
        if (value.type === 'JSXExpressionContainer') {
          checkExpression(value.expression);
        }
      },
    };
    return /** @type {import('eslint').Rule.RuleListener} */ (
      /** @type {unknown} */ (visitors)
    );
  },
};

export default rule;
