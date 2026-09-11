// The flat config: every NEVER the Bible states, bound to the paths it governs (C-06, B-18).
// The ban homes are exact allowlists, not patterns — src/core/format.ts for Intl (LAW-FMT),
// src/core/db.ts and the product modules under src/core/db/ for the database seam (SEAM-TENANT,
// never its __tests__), src/ui/tokens.ts and its generated tokens.css for colour (R-UI-001) — with
// one further directory allowlist, the model seam src/core/model/ (L-AI-01) — and each allowlist
// lives inside the rule that grants it.
// The fixture corpus is not linted from here: its files are deliberate payloads, and they are put
// through this same config file by the toolchain suite instead (Q-08).
import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";
import { cssParser, cubit, importX } from "./scripts/eslint/index.mjs";

/**
 * The two component rule sets, downgraded to warnings. Used for the screens and the modules, whose
 * findings belong to the nodes that own those files: they are PRINTED from today, and they are not
 * fatal until those nodes clear them. Derived from the recommended sets plus the two rules this
 * config turns on by name, so a rule added upstream is softened here without an edit.
 */
const SOFTENED = Object.fromEntries(
  [...Object.keys(reactHooks.configs.recommended.rules), ...Object.keys(jsxA11y.flatConfigs.recommended.rules), "jsx-a11y/anchor-is-valid", "jsx-a11y/label-has-associated-control"].map((rule) => [
    rule,
    "warn",
  ]),
);

/** Everything the layered tree is made of. */
const SOURCE = ["src/**/*.ts", "src/**/*.tsx", "db/**/*.ts"];

export default [
  {
    ignores: ["node_modules/**", ".next*/**", "dist/**", "coverage/**", "tests/lint-fixtures/**", "test-results/**", "playwright-report/**"],
  },
  {
    // A directive that turns a rule off cannot be written in this tree, so it cannot be honoured
    // here either (Q-08).
    linterOptions: { noInlineConfig: true },
  },
  {
    files: ["**/*.mjs", "**/*.js"],
    ...js.configs.recommended,
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node } },
  },
  ...tseslint.config({
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-undef": "off",
    },
  }),
  {
    // Q-08 binds every file the tree owns, not only its sources.
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.mjs", "**/*.js"],
    plugins: { cubit },
    rules: { "cubit/no-suppressions": "error" },
  },
  {
    // ARCH-01 and ARCH-03 are about where a file sits in the layered tree, so they are bound to it;
    // both rules read the layer from the path and stay silent outside `src/`.
    files: SOURCE,
    // The `import-x` key is the ruleId the test contract names; the plugin behind it is this tree's
    // own cycle rule (see scripts/eslint/index.mjs), not eslint-plugin-import-x.
    plugins: { cubit, "import-x": importX },
    rules: {
      "cubit/boundaries": "error",
      "cubit/fault-or-refusal": "error",
      "cubit/import-depth": "error",
      "import-x/no-cycle": "error",
    },
  },
  {
    // LAW-FMT, SEAM-TENANT and R-UI-001 are bans on the whole tree, not on one directory of it:
    // "the tree's sole caller of Intl" and "no colour literal exists outside the source" are false
    // the moment a script, a config or a test may spell one. Their allowlists are exact paths
    // inside the rules, so widening the binding cannot widen what is allowed (B-23).
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.mjs", "**/*.js"],
    plugins: { cubit },
    rules: {
      "cubit/no-colour-literal": "error",
      "cubit/no-primitive-token": "error",
      "cubit/no-db-outside-seam": "error",
      "cubit/no-model-outside-seam": "error",
      "cubit/no-raw-intl": "error",
    },
  },
  {
    // Two laws about components that no test of ours states, because the ecosystem states them
    // better: the rules of hooks (a conditional hook is a correctness fault, not a style one) and
    // the a11y ground R-UI-050 stands on. axe catches the second only once a screen renders and a
    // journey walks it; this catches it in the file that made it.
    // Bound to EVERY component the product ships, not only the foundation's. The narrower binding
    // (`src/ui/**/*.tsx`) left 95 component files under src/app and src/modules judged by nothing:
    // a conditional hook in a screen is the same correctness fault it is in a primitive, and the
    // a11y ground R-UI-050 stands on does not stop at the layer boundary. What the narrower binding
    // was really buying was a quiet gate, and it bought it by not looking.
    //
    // The findings outside src/ui are real and they belong to the nodes that own those files, so
    // they are bound as WARNINGS there (the override below) and listed in this increment's handoff.
    // Inside src/ui they are fatal: `pnpm lint` runs a second, zero-warning pass over the foundation
    // (`eslint src/ui --max-warnings 0`). That second pass names four directories it skips —
    // src/ui/patterns, src/ui/primitives/core, src/ui/primitives/data and src/ui/shell — because on
    // 2026-09-12 they are being rebuilt by three other nodes and carry 14 findings of these two
    // shapes between them. The skip is a HANDOFF, not a grade: each finding is listed by file and
    // line in this increment's handoff, and the four `--ignore-pattern` flags come out of the lint
    // script in the same commit that clears the last of them. Nothing is softened inside src/ui —
    // the first pass still prints every one of them.
    files: ["src/**/*.tsx"],
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // A listbox that moves a visual cursor with `aria-activedescendant` keeps DOM focus on the
      // input and its options are deliberately not focusable — the rules below read that correct
      // pattern as the incorrect one. They stay on as warnings rather than off, so the day an
      // option stops being part of an activedescendant listbox the finding is still printed.
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/no-noninteractive-tabindex": "warn",
      // Three effects in this tree reset derived state when their subject changes (a palette that
      // closed, a dialog that reopened). The house idiom for that is the render-time reseed the
      // density control uses, not an effect — a real repair, owed, and not one to make blind in the
      // same commit that moves every colour in the product.
      "react-hooks/set-state-in-effect": "warn",
      // Two further a11y laws the ecosystem states better than we could, and that R-UI-050 owes:
      // an anchor that goes nowhere is a button wearing a link's clothes (and is unreachable by
      // keyboard), and a label with no control is a label a screen reader reads into the void.
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/label-has-associated-control": "error",
    },
  },
  {
    // The screens and the modules are judged by the same two rule sets, and their findings are
    // WARNINGS until the nodes that own those files clear them. Non-fatal is the deliberate half of
    // this change: binding 95 previously-unjudged files at "error" would have turned the gate red
    // for work nobody in this increment may touch, and a gate that is red for somebody else's
    // reason is a gate people learn to read past. The worklist is in the handoff, by file and line.
    files: ["src/app/**/*.tsx", "src/modules/**/*.tsx"],
    // Derived from the two configs' own rule sets, never listed: a hand-kept copy of somebody
    // else's roster is wrong the first time they add a rule, and wrong silently (B-19).
    rules: SOFTENED,
  },
  {
    // AM-09 §4 binds the journeys: a page object and a journey read the product through RETRYING
    // waits only, and `waitForTimeout` is unlawful in the lane. The rule is bound HERE and nowhere
    // else — a one-shot `.count()` in a node suite is a synchronous read of a value that is already
    // final, and there is no page under it that could still be arriving.
    files: ["tests/e2e/**/*.ts"],
    plugins: { cubit },
    rules: { "cubit/no-unretried-read": "error" },
  },
  {
    // R-UI-001's colour ban reaches the stylesheets too — a colour hidden in CSS is still a colour
    // outside the token source.
    files: ["**/*.css"],
    languageOptions: { parser: cssParser },
    plugins: { cubit },
    rules: { "cubit/no-colour-literal": "error", "cubit/no-primitive-token": "error" },
  },
];
