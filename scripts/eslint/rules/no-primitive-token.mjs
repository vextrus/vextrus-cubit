// Design Direction 00 §4: after the semantic alias layer exists, a component consumes aliases and
// density tokens — never the graphite scale or the beam ramp directly. The reason is not tidiness:
// an alias is where a *meaning* is decided once ("the hairline seam", "the disabled floor"), so a
// theme, a density or a contrast repair has one place to land. A raw `var(--graphite-600)` spends
// a value without saying what it meant, and the next reader cannot tell a caption from a border.
//
// The ban home is an exact allowlist — the token source and its generated stylesheet — as
// R-UI-001's colour ban is. The canvas, basis, element, act and success/warn/danger/info palettes
// are NOT banned: those names already say what they mean, which is the whole test this rule
// applies.

/** The only two files a primitive token may be spelled in (Design Direction 00 §4 rule 3). */
const ALLOWED = [
  "src/ui/tokens.ts",
  "src/ui/tokens.css",
  // The token source's own acceptance: it quotes R-UI-001's values to hold the source to them, and
  // a law's test that may not spell the law has stopped testing it.
  "src/ui/tokens.test.ts",
];

/** The two primitive scales: a position on a ramp, with no meaning of its own. */
const PRIMITIVE = /var\(\s*(--(?:graphite|beam)-[0-9]+)\s*[,)]/g;

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "components consume semantic aliases, not the primitive ramps (Design Direction 00 §4)" },
    schema: [],
    messages: {
      primitive:
        "{{token}} is a position on a ramp, not a meaning — read a semantic alias (--surface-*, --ink-*, --line-*, --accent-*, --state-*) or a density token instead; the ramps are spelled only in src/ui/tokens.ts and its generated src/ui/tokens.css (Design Direction 00 §4)",
    },
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, "/");
    if (ALLOWED.some((allowed) => filename.endsWith(allowed))) return {};
    const text = context.sourceCode.getText();
    return {
      Program: (node) => {
        PRIMITIVE.lastIndex = 0;
        let match = PRIMITIVE.exec(text);
        while (match !== null) {
          const before = text.slice(0, match.index);
          context.report({
            node,
            loc: { line: before.split("\n").length, column: match.index - (before.lastIndexOf("\n") + 1) },
            messageId: "primitive",
            data: { token: match[1] },
          });
          match = PRIMITIVE.exec(text);
        }
      },
    };
  },
};
