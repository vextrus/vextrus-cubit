// The `cubit` plugin: every NEVER the Bible states as a rule, in one namespace, plus the cycle
// rule ARCH-01 demands under the `import-x` namespace the test contract names. Rules live here so
// the flat config at the repo root reads as the law it enforces.
import boundaries from "./rules/boundaries.mjs";
import faultOrRefusal from "./rules/fault-or-refusal.mjs";
import noColourLiteral from "./rules/no-colour-literal.mjs";
import noCycle from "./rules/no-cycle.mjs";
import noDbOutsideSeam from "./rules/no-db-outside-seam.mjs";
import noModelOutsideSeam from "./rules/no-model-outside-seam.mjs";
import noRawIntl from "./rules/no-raw-intl.mjs";
import noSuppressions from "./rules/no-suppressions.mjs";

export const cubit = {
  meta: { name: "cubit", version: "0.0.0" },
  rules: {
    boundaries,
    "fault-or-refusal": faultOrRefusal,
    "no-colour-literal": noColourLiteral,
    "no-db-outside-seam": noDbOutsideSeam,
    "no-model-outside-seam": noModelOutsideSeam,
    "no-raw-intl": noRawIntl,
    "no-suppressions": noSuppressions,
  },
};

// The test contract's closed rule-id set names `import-x/no-cycle`, so the flat config mounts this
// plugin under the key `import-x` and that ruleId is what the messages carry. The implementation is
// this tree's own, not eslint-plugin-import-x: that package is not resolvable from the offline
// store this session installs from, and no package.json may claim a dependency the lockfile cannot
// hold. Its meta.name says so plainly rather than wearing the third-party plugin's identity — the
// toolchain never lies about what is running (B-23). Recorded as an objection in the increment's
// handoff; when the package becomes installable, this rule's one home is what it replaces.
export const importX = {
  meta: { name: "cubit-cycle", version: "0.0.0" },
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
