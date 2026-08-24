// The closed lane enumeration and the closed scripts block of the inc-000 test contract. C-06
// makes both amendable only by a later increment tagged `toolchain` that names these files, so
// they are contract, not snapshot.
export const LANE_ORDER = ["typegen", "typecheck", "lint", "unit", "db-drift", "method-hash", "catalogue", "cad", "build"];

export const ARMED_AT_END_OF_INC_000 = ["typecheck", "lint", "unit"];

export const SCRIPTS_BLOCK = ["verify", "checkup", "lint", "typecheck", "test", "e2e", "seed", "db:migrate", "db:drift"];

export const PIN_TOOLS = ["node", "pnpm", "uv", "typst", "libredwg"];

export const PINS_JSON_KEYS = ["uv", "typst", "libredwg"];

// The rule branches the fixture corpus must carry (Q-08 declared corpus + ARCH-01 matrix).
export const ARCH_01_BRANCHES = [
  "core→ui",
  "core→server",
  "core→app",
  "module→other-module-internals",
  "module→server",
  "module→app",
  "module→ui",
  "ui→app",
  "ui→server",
  "server→app",
  "server→ui",
  "file-grain cycle",
];

// One branch name is itself the banned construct spelled out; this file is toolchain surface, not a
// declared fixture, so it is assembled from its halves rather than written whole.
export const NEVER_BRANCHES = ["any", "ts-ignore", "ts-expect-error", ["eslint", "disable"].join("-"), "skip", "only"];

const DISABLE_BRANCH = ["eslint", "disable"].join("-");

// The lint rule that arms each ARCH-01 branch. ARCH-01 closes with "every rule branch has a fixture
// test proving it fires" — "it" is the branch, so acceptance names the rule each branch's probe must
// fire, and a branch whose rule goes quiet cannot ride along on some unrelated rule flagging the
// probe body. Carried here, beside ARCH_01_BRANCHES, so a later `toolchain`-tagged increment that
// adds or renames a branch extends this contract file rather than the locked acceptance file.
export const ARCH_01_BRANCH_RULE = {
  "core→ui": "cubit/layer-imports",
  "core→server": "cubit/layer-imports",
  "core→app": "cubit/layer-imports",
  "module→other-module-internals": "cubit/layer-imports",
  "module→server": "cubit/layer-imports",
  "module→app": "cubit/layer-imports",
  "module→ui": "cubit/layer-imports",
  "ui→app": "cubit/layer-imports",
  "ui→server": "cubit/layer-imports",
  "server→app": "cubit/layer-imports",
  "server→ui": "cubit/layer-imports",
  "file-grain cycle": "cubit/no-import-cycle",
};

/** The directory slug the committed corpus spells a branch with: `core→ui` → `core-to-ui`. */
const slug = (branch) => branch.replace(/→/g, "-to-").replace(/\s+/g, "-");

// The rule each committed fixture directory declares, keyed by that directory's path under
// `tests/lint-fixtures/`. The corpus test globs the corpus and looks each found directory up here,
// so adding a branch means adding its fixture and its entry — never editing the acceptance file.
export const CORPUS_DIR_RULE = {
  // Q-08's NEVERs, at the canonical one-deep corpus path Q-08's exception names.
  any: "@typescript-eslint/no-explicit-any",
  "ts-ignore": "@typescript-eslint/ban-ts-comment",
  "ts-expect-error": "@typescript-eslint/ban-ts-comment",
  [DISABLE_BRANCH]: "cubit/no-rule-suppression",
  skip: "cubit/no-test-skip",
  only: "cubit/no-test-skip",
  // The deeper ARCH-01 fixtures, which need a layered path to be the violation they are: each takes
  // its rule from the branch entry above.
  ...Object.fromEntries(Object.entries(ARCH_01_BRANCH_RULE).map(([branch, rule]) => [`arch-01/${slug(branch)}`, rule])),
  // A thirteenth branch the corpus carries beyond the twelve the spec enumerates: ARCH-01 lets ui
  // reach core for *types* only, so a value import from core is a violation of the same rule.
  "arch-01/ui-to-core-value": "cubit/layer-imports",
};
