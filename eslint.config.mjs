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
    // Bound to the foundation the whole product is built from. The screens and the modules carry
    // 31 further findings of the same two shapes; they belong to the nodes that own those files and
    // are listed in this increment's handoff rather than fixed from here, where a blind repair of a
    // viewer ref would be a change to a screen nobody in this node is testing.
    files: ["src/ui/**/*.tsx"],
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
    },
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
