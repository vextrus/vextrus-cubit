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
