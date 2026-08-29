/**
 * R-UI-050 for the grown Projects home, as the committed Design Decision rules it:
 *
 *   I-38 — "The grown screen's seven cells are declared in
 *   `src/app/(app)/t/[tenant]/home/states.ts`, export `HOME_STATES`, in the shell matrix's cell
 *   shape; `tests/ui/home/state-matrix.test.ts` walks it."
 *
 * This is that walker, in the idiom `tests/ui/shell/state-matrix.test.ts` already established for
 * the shell's own matrix — one row instead of a table, and the same four judgements, deliberately
 * not the pixels of any state:
 *
 *   - the row declares R-UI-050's seven states and no eighth of its own;
 *   - a cell that claims a state is RENDERED names a module that exists in the checkout and a hook
 *     that module really spells, itself or through what it imports — a hook spelled by some other
 *     screen is not this cell's evidence, and a claim nothing backs is the review note this clause
 *     abolishes;
 *   - a cell that DELEGATES names a module that exists, and says why;
 *   - a cell that calls a state IMPOSSIBLE says why in words.
 *
 * `.ts`, not `.tsx`: tsconfig includes `tests/**\/*.ts`, so `pnpm verify`'s `tsc` reads the
 * type-level totality assertion below as well as vitest reading the runtime ones.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT, productModule } from "../../server/support/wire";
import type { ShellStateCell, ShellStateName } from "../../../src/ui/shell/states";

const STATES_MODULE = "src/app/(app)/t/[tenant]/home/states.ts";

/** R-UI-050's seven, spelled here so the row cannot define the law it is graded against. */
const R_UI_050_STATES: readonly ShellStateName[] = ["loading", "empty", "error", "refusal", "partial", "offline", "permissionDenied"];

/** How far a hook may be spelled from the module a cell names: the module, and what it imports. */
const IMPORT_SPECIFIER = /from\s+"(\.[^"]*)"/g;

/** The extensions a relative specifier may resolve through, in the order Node and Vite try them. */
const RESOLUTIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

type HomeStates = Readonly<Record<ShellStateName, ShellStateCell>>;

/* ------------------------------------------------- the compiler's half (B-19, type totality) */

type Assert<T extends true> = T;

/**
 * The row is keyed by R-UI-050's seven states EXACTLY — neither a missing cell nor an extra one.
 * Both directions are asked for: `[A] extends [B]` alone passes for a `Record<string, …>`.
 */
type CellsAreTheStates = Assert<keyof HomeStates extends ShellStateName ? (ShellStateName extends keyof HomeStates ? true : false) : false>;

const cellsAreTheStates: CellsAreTheStates = true;

/* ------------------------------------------------------------------------------- the walkers */

async function row(): Promise<HomeStates> {
  const module = await productModule<{ HOME_STATES?: HomeStates }>(STATES_MODULE);
  const declared = module.HOME_STATES;
  expect(declared, `${STATES_MODULE} must export HOME_STATES — the enumerable place R-UI-050 requires for this screen (I-38)`).toBeTypeOf("object");
  return declared as HomeStates;
}

/** Where a relative specifier lands in the checkout, or null when nothing of the tree answers it. */
function resolved(fromModule: string, specifier: string): string | null {
  const base = normalize(join(dirname(fromModule), specifier));
  for (const suffix of RESOLUTIONS) {
    const candidate = `${base}${suffix}`;
    if ((candidate.endsWith(".ts") || candidate.endsWith(".tsx")) && existsSync(join(REPO_ROOT, candidate))) return candidate;
  }
  return null;
}

/**
 * The module a cell names, and every module reachable from it through the tree's own imports —
 * which is the reach a claim "this screen renders that hook" actually has. A hook spelled by some
 * unrelated screen is not this cell's evidence: `by` is the module the cell puts its name to, so it
 * is the module the search starts from, and a barrel it imports through is one more hop, not a
 * licence to read the whole app.
 */
function sourcesReachableFrom(module: string): string[] {
  const seen = new Set<string>();
  const sources: string[] = [];
  const walk = (relative: string): void => {
    if (seen.has(relative)) return;
    seen.add(relative);
    const absolute = join(REPO_ROOT, relative);
    if (!existsSync(absolute)) return;
    const source = readFileSync(absolute, "utf8");
    sources.push(source);
    for (const [, specifier] of source.matchAll(IMPORT_SPECIFIER)) {
      const next = specifier === undefined ? null : resolved(relative, specifier);
      if (next !== null) walk(next);
    }
  };
  walk(module);
  return sources;
}

/* --------------------------------------------------------------------------------- the suite */

describe("R-UI-050: S-Home declares its seven states where a suite can walk them (I-38)", () => {
  test("R-UI-050: the row declares exactly R-UI-050's seven states", async () => {
    const declared = await row();
    for (const state of R_UI_050_STATES) {
      expect(
        Object.prototype.hasOwnProperty.call(declared, state),
        `R-UI-050: HOME_STATES declares no ${state} state — the matrix is checkable, not aspirational (B-19)`,
      ).toBe(true);
    }
    expect(Object.keys(declared).sort(), "the screen declares exactly the seven states, no eighth of its own").toStrictEqual([...R_UI_050_STATES].sort());
  });

  test("R-UI-050: a rendered cell names a module that exists and a hook that is really spelled", async () => {
    const declared = await row();
    for (const state of R_UI_050_STATES) {
      const cell = declared[state];
      if (cell.declared !== "rendered") continue;
      expect(existsSync(join(REPO_ROOT, cell.by)), `the ${state} cell claims it is rendered by ${cell.by}, which is not in the checkout`).toBe(true);
      if (cell.testId === null) continue;
      const spelled = sourcesReachableFrom(cell.by).some((source) => source.includes(`"${cell.testId}"`));
      expect(spelled, `the ${state} cell names the hook ${cell.testId}, which ${cell.by} neither spells nor reaches through its own imports`).toBe(true);
    }
  });

  test("R-UI-050: a delegated cell names its owner, and an impossible cell gives its reason", async () => {
    const declared = await row();
    for (const state of R_UI_050_STATES) {
      const cell = declared[state];
      if (cell.declared === "delegated") {
        expect(existsSync(join(REPO_ROOT, cell.to)), `the ${state} cell delegates to ${cell.to}, which is not in the checkout`).toBe(true);
        expect(cell.why.trim().length, `the ${state} cell delegates without saying why`).toBeGreaterThan(0);
      }
      if (cell.declared === "impossible") {
        expect(cell.why.trim().length, `the ${state} cell is called impossible without a reason — that is the review note R-UI-050 forbids`).toBeGreaterThan(0);
      }
    }
  });

  test("R-UI-050: every cell says one of the three things, and never nothing", async () => {
    const declared = await row();
    for (const state of R_UI_050_STATES) {
      expect(
        ["rendered", "delegated", "impossible"],
        `the ${state} cell must say rendered, delegated or impossible — silence is never lawful`,
      ).toContain(declared[state].declared);
    }
  });

  test("R-UI-050: the type-level totality assertion is the one tsc reads", () => {
    expect(cellsAreTheStates).toBe(true);
  });
});
