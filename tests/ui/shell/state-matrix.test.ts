/**
 * R-UI-050, the checkable half: "each screen declares its states in one enumerable place the suite
 * reflects over (B-19), and a missing state is a failing test, never a review note."
 *
 * The enumerable place is `src/ui/shell/states.ts`; this file is the suite that reflects over it.
 * It judges four things, and deliberately not the pixels of any state:
 *
 *   - every shipped shell screen is in the table, and every one of R-UI-050's seven states is in
 *     every screen — a screen that forgets `offline` fails here rather than being noticed by eye;
 *   - the table's screens are exactly the shell's areas, both ways, so a fourth area cannot ship
 *     without declaring its matrix and a stale row cannot linger;
 *   - a cell that claims a state is RENDERED names a module that exists in the checkout, and the
 *     hook it names is really spelled in `src/` — a claim nothing backs is the review note this
 *     clause exists to abolish;
 *   - a cell that delegates or calls a state impossible says where, or why, in words.
 *
 * `.ts`, not `.tsx`: tsconfig includes `tests/**\/*.ts`, so `pnpm verify`'s `tsc` reads the
 * type-level totality assertions below as well as vitest reading the runtime ones.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT, productModule } from "../../server/support/wire";
import type { ShellArea } from "../../../src/ui/shell/routes";
import type { ShellStateCell, ShellStateMatrix, ShellStateName } from "../../../src/ui/shell/states";

const STATES_MODULE = "src/ui/shell/states.ts";

/** R-UI-050's seven, spelled here so the table cannot define the law it is graded against. */
const R_UI_050_STATES: readonly ShellStateName[] = ["loading", "empty", "error", "refusal", "partial", "offline", "permissionDenied"];

/** The areas the shell ships (R-UI-030's rail entries), likewise spelled rather than derived. */
const SHELL_AREAS: readonly ShellArea[] = ["projects", "books", "settings"];

/** Where a rendered cell's testid may be spelled: the shell's components and the workspace routes. */
const HOOK_ROOTS = ["src/ui/shell", "src/app/(app)"];

/* ------------------------------------------------- the compiler's half (B-19, type totality) */

type Assert<T extends true> = T;

/** The matrix is keyed by the shell's areas EXACTLY — neither a missing row nor an extra one. */
type RowsAreTheAreas = Assert<keyof ShellStateMatrix extends ShellArea ? (ShellArea extends keyof ShellStateMatrix ? true : false) : false>;

/** …and each row is keyed by the seven states exactly. */
type CellsAreTheStates = Assert<
  keyof ShellStateMatrix[ShellArea] extends ShellStateName ? (ShellStateName extends keyof ShellStateMatrix[ShellArea] ? true : false) : false
>;

const rowsAreTheAreas: RowsAreTheAreas = true;
const cellsAreTheStates: CellsAreTheStates = true;

/* ------------------------------------------------------------------------------- the walkers */

async function matrix(): Promise<ShellStateMatrix> {
  const module = await productModule<{ SHELL_STATES?: ShellStateMatrix }>(STATES_MODULE);
  const table = module.SHELL_STATES;
  expect(table, `${STATES_MODULE} must export SHELL_STATES — the enumerable place R-UI-050 requires (B-19)`).toBeTypeOf("object");
  return table as ShellStateMatrix;
}

/** Every `.ts`/`.tsx` source under a root, read once, so a hook can be looked for across it. */
function sourcesUnder(relativeRoot: string): string[] {
  const absolute = join(REPO_ROOT, relativeRoot);
  if (!existsSync(absolute)) return [];
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (path.endsWith(".ts") || path.endsWith(".tsx")) found.push(readFileSync(path, "utf8"));
    }
  };
  walk(absolute);
  return found;
}

const HOOK_SOURCES: string[] = HOOK_ROOTS.flatMap((root) => sourcesUnder(root));

/* --------------------------------------------------------------------------------- the suite */

describe("R-UI-050: the shell's state matrix is enumerable, and every cell is declared", () => {
  test("R-UI-050: the table's screens are exactly the shell's shipped areas", async () => {
    const table = await matrix();
    expect(Object.keys(table).sort(), "SHELL_STATES declares one row per shipped shell screen — no more, no fewer").toStrictEqual([...SHELL_AREAS].sort());
  });

  test("R-UI-050: every screen declares all seven states — a missing state fails here", async () => {
    const table = await matrix();
    for (const area of SHELL_AREAS) {
      const row = table[area] as Readonly<Record<string, ShellStateCell>>;
      for (const state of R_UI_050_STATES) {
        expect(
          Object.prototype.hasOwnProperty.call(row, state),
          `R-UI-050: the ${area} screen declares no ${state} state — the matrix is checkable, not aspirational (B-19)`,
        ).toBe(true);
      }
      expect(Object.keys(row).sort(), `the ${area} screen declares exactly R-UI-050's seven states`).toStrictEqual([...R_UI_050_STATES].sort());
    }
  });

  test("R-UI-050: a rendered cell names a module that exists and a hook that is really spelled", async () => {
    const table = await matrix();
    for (const area of SHELL_AREAS) {
      for (const state of R_UI_050_STATES) {
        const cell = table[area][state];
        if (cell.declared !== "rendered") continue;
        expect(existsSync(join(REPO_ROOT, cell.by)), `${area}/${state} claims it is rendered by ${cell.by}, which is not in the checkout`).toBe(true);
        if (cell.testId === null) continue;
        const spelled = HOOK_SOURCES.some((source) => source.includes(`"${cell.testId}"`));
        expect(spelled, `${area}/${state} names the hook ${cell.testId}, which no source under ${HOOK_ROOTS.join(" or ")} spells`).toBe(true);
      }
    }
  });

  test("R-UI-050: a delegated cell names its owner, and an impossible cell gives its reason", async () => {
    const table = await matrix();
    for (const area of SHELL_AREAS) {
      for (const state of R_UI_050_STATES) {
        const cell = table[area][state];
        if (cell.declared === "delegated") {
          expect(existsSync(join(REPO_ROOT, cell.to)), `${area}/${state} delegates to ${cell.to}, which is not in the checkout`).toBe(true);
          expect(cell.why.trim().length, `${area}/${state} delegates without saying why`).toBeGreaterThan(0);
        }
        if (cell.declared === "impossible") {
          expect(cell.why.trim().length, `${area}/${state} is called impossible without a reason — that is the review note R-UI-050 forbids`).toBeGreaterThan(0);
        }
      }
    }
  });

  test("R-UI-050: the type-level totality assertions are the ones tsc reads", () => {
    expect([rowsAreTheAreas, cellsAreTheStates]).toStrictEqual([true, true]);
  });
});
