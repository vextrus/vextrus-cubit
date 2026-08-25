// The `cubit` plugin: every NEVER the Bible states as a rule, in one namespace, plus the cycle
// rule ARCH-01 demands under the `import-x` namespace the test contract names. Rules live here so
// the flat config at the repo root reads as the law it enforces.
import boundaries from "./rules/boundaries.mjs";
import faultOrRefusal from "./rules/fault-or-refusal.mjs";
import noColourLiteral from "./rules/no-colour-literal.mjs";
import noCycle from "./rules/no-cycle.mjs";
import noDbOutsideSeam from "./rules/no-db-outside-seam.mjs";
import noRawIntl from "./rules/no-raw-intl.mjs";
import noSuppressions from "./rules/no-suppressions.mjs";

export const cubit = {
  meta: { name: "cubit", version: "0.0.0" },
  rules: {
    boundaries,
    "fault-or-refusal": faultOrRefusal,
    "no-colour-literal": noColourLiteral,
    "no-db-outside-seam": noDbOutsideSeam,
    "no-raw-intl": noRawIntl,
    "no-suppressions": noSuppressions,
  },
};

export const importX = {
  meta: { name: "import-x", version: "0.0.0" },
  rules: { "no-cycle": noCycle },
};

// A stylesheet is not JavaScript, and R-UI-001's colour ban has to read one. This parser hands
// ESLint an empty program over the file's text so a text-reading rule can run on `.css` exactly as
// it runs on `.ts` — nothing else in the tree parses CSS today.
export const cssParser = {
  meta: { name: "cubit-css", version: "0.0.0" },
  /**
   * @param {string} text
   * @returns {object}
   */
  parse(text) {
    const lines = text.split("\n");
    return {
      type: "Program",
      body: [],
      sourceType: "script",
      comments: [],
      tokens: [],
      range: [0, text.length],
      loc: {
        start: { line: 1, column: 0 },
        end: { line: lines.length, column: (lines[lines.length - 1] ?? "").length },
      },
    };
  },
};
