/**
 * cubit/no-jsx-string-literal — R-SPINE-060: "Every user-facing string lives in one typed
 * string table (`src/ui/strings.ts` per module) keyed by id with English values; the
 * compiler refuses a missing key; no string literals in JSX except test ids and codes."
 *
 * "Codes" are the machine's own vocabulary — LANE_NOT_YET_BUILT, PIN_STALE, R-UI-001 —
 * which are rendered verbatim on purpose and are not copy. A short upper-case word like
 * SAVE or OK is copy shouting: it is a label a designer wrote, it belongs in the table.
 */

/** A reason code (PIN_STALE) or a requirement id (R-SPINE-060). Never a bare word. */
const CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
const ID = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/;

/**
 * R-SPINE-060 says "no string literals in JSX", so the rule reads that way round: an
 * attribute string is copy unless the attribute is structural. Most copy reaches the UI as
 * a prop on a component (`<Toast message="Saved" />`), and a whitelist of the handful of
 * HTML attributes that happen to be read by a person lets every one of those through.
 * `data-*` is a test id; the aria attributes listed here take ids and tokens, not words.
 */
const STRUCTURAL_ATTRIBUTES = new Set([
  'accept',
  'action',
  'align',
  'aria-activedescendant',
  'aria-atomic',
  'aria-controls',
  'aria-current',
  'aria-describedby',
  'aria-expanded',
  'aria-haspopup',
  'aria-hidden',
  'aria-labelledby',
  'aria-live',
  'aria-orientation',
  'aria-owns',
  'aria-relevant',
  'as',
  'autoCapitalize',
  'autoComplete',
  'charSet',
  'class',
  'className',
  'clipPath',
  'cols',
  'crossOrigin',
  'd',
  'dir',
  'download',
  'encType',
  'fill',
  'fillRule',
  'form',
  'height',
  'href',
  'htmlFor',
  'id',
  'inputMode',
  'key',
  'lang',
  'loading',
  'method',
  'name',
  'orientation',
  'points',
  'preserveAspectRatio',
  'rel',
  'role',
  'rows',
  'side',
  'sizes',
  'slot',
  'span',
  'src',
  'srcSet',
  'stroke',
  'strokeLinecap',
  'strokeLinejoin',
  'strokeWidth',
  'style',
  'target',
  'tone',
  'transform',
  'type',
  'variant',
  'viewBox',
  'width',
  'xlink:href',
  'xmlns',
]);

/** A structural attribute names a shape, a target or a test id — never a word to read. */
function isStructural(name) {
  return name.startsWith('data-') || STRUCTURAL_ATTRIBUTES.has(name);
}

function isCode(text) {
  const trimmed = text.trim();
  return CODE.test(trimmed) || ID.test(trimmed);
}

/** Whitespace and bare punctuation (·, —, /) carry no words to translate. */
function isCopy(text) {
  return /[\p{L}\p{N}]/u.test(text) && !isCode(text);
}

function attributeName(node) {
  return node.name.type === 'JSXIdentifier'
    ? node.name.name
    : `${node.name.namespace.name}:${node.name.name.name}`;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'R-SPINE-060: user-facing strings live in the typed string table; JSX carries keys, test ids and codes.',
    },
    schema: [],
    messages: {
      copy: 'R-SPINE-060: "{{text}}" is copy in JSX — key it in the module string table so the compiler can refuse a missing key.',
    },
  },
  create(context) {
    const report = (node, text) => {
      context.report({
        node,
        messageId: 'copy',
        data: { text: text.trim().replace(/\s+/g, ' ').slice(0, 40) },
      });
    };
    const checkChild = (node) => {
      if (node.type === 'Literal' && typeof node.value === 'string' && isCopy(node.value)) {
        report(node, node.value);
        return;
      }
      if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
        const text = node.quasis[0]?.value.cooked ?? '';
        if (isCopy(text)) report(node, text);
      }
    };
    return {
      JSXText(node) {
        if (isCopy(node.value)) report(node, node.value);
      },
      JSXExpressionContainer(node) {
        if (node.parent?.type !== 'JSXElement' && node.parent?.type !== 'JSXFragment') return;
        checkChild(node.expression);
      },
      JSXAttribute(node) {
        if (!node.value || isStructural(attributeName(node))) return;
        if (node.value.type === 'Literal') {
          if (typeof node.value.value === 'string' && isCopy(node.value.value)) {
            report(node.value, node.value.value);
          }
          return;
        }
        if (node.value.type === 'JSXExpressionContainer') checkChild(node.value.expression);
      },
    };
  },
};
