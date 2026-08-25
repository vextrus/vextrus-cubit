// R-UI-001: tokens are CSS variables emitted from one TS source; no colour literal exists outside
// that source. The ban home is an exact allowlist — `src/ui/tokens.ts` and its generated
// `src/ui/tokens.css` — not a pattern. The file's text is what is read, so `#rrggbb`, `0xRRGGBB`,
// a colour built inside a template literal and a colour in a stylesheet are all the same offence
// (Q-01).

/** The only two files a colour literal may exist in (R-UI-001). */
const ALLOWED = ["src/ui/tokens.ts", "src/ui/tokens.css"];

/** CSS's named colours are colour literals too; a stylesheet may not spell one. */
const NAMED = [
  "aqua", "aquamarine", "beige", "black", "blue", "brown", "chartreuse", "chocolate", "coral", "crimson", "cyan", "fuchsia",
  "gold", "gray", "green", "grey", "indigo", "ivory", "khaki", "lavender", "lime", "magenta", "maroon", "navy", "olive",
  "orange", "orchid", "pink", "plum", "purple", "red", "salmon", "sienna", "silver", "tan", "teal", "tomato", "turquoise",
  "violet", "wheat", "white", "yellow",
];

/** @type {{name: string, pattern: RegExp}[]} */
const SHAPES = [
  { name: "a hex colour", pattern: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g },
  { name: "a packed hex colour", pattern: /\b0x[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/g },
  { name: "a colour function", pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\s*\(/g },
];

const NAMED_IN_CSS = new RegExp(`:\\s*(?:${NAMED.join("|")})\\s*(?:;|\\}|!|$)`, "gim");

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "colour literals live only in the token source (R-UI-001)" },
    schema: [],
    messages: {
      colour:
        "{{shape}} — colour literals exist only in src/ui/tokens.ts and its generated src/ui/tokens.css; read the token instead (R-UI-001)",
    },
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, "/");
    if (ALLOWED.some((allowed) => filename.endsWith(allowed))) return {};
    const sourceCode = context.sourceCode;
    const text = sourceCode.getText();
    const shapes = filename.endsWith(".css") ? [...SHAPES, { name: "a named colour", pattern: NAMED_IN_CSS }] : SHAPES;
    return {
      Program: (node) => {
        for (const shape of shapes) {
          shape.pattern.lastIndex = 0;
          let match = shape.pattern.exec(text);
          while (match !== null) {
            context.report({
              node: /** @type {any} */ (node),
              loc: locateAt(text, match.index),
              messageId: "colour",
              data: { shape: shape.name },
            });
            match = shape.pattern.exec(text);
          }
        }
      },
    };
  },
};

/**
 * @param {string} text
 * @param {number} index
 * @returns {{line: number, column: number}}
 */
function locateAt(text, index) {
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  const column = index - (before.lastIndexOf("\n") + 1);
  return { line, column };
}
