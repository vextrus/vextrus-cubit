/**
 * R-UI-050's checkable half for the job pattern, which the Design Decision (docs/design/job-timeline.md
 * §3) rules for BOTH of its surfaces: "each screen declares its states in one enumerable place the
 * suite reflects over (B-19), and a missing state is a failing test, never a review note."
 *
 * The enumerable place is `src/ui/patterns/job-timeline/states.ts`; this file is the suite that walks
 * it. It judges the declaration, never the pixels:
 *
 *   - the two surfaces the pattern ships — the inline timeline and the global tray — each declare a
 *     row, and every row present declares all seven of R-UI-050's states (a row of six fails);
 *   - the seven are READ from their one home, `src/ui/screen-states/contract.ts`, never transcribed
 *     here, and a cell may be keyed by the clause's own name or by the shell matrix's key form,
 *     because which register the table uses is the Builder's to choose and neither hides a gap;
 *   - a cell that claims a state is RENDERED names a module that exists and an id that is really
 *     spelled; a cell that delegates or calls a state impossible says where, or why, in words.
 *
 * Nothing here fixes the number of rows: a surface added later declares its own row and passes.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT, productModule } from "./support/stage";

const STATES_MODULE = "src/ui/patterns/job-timeline/states.ts";
const CONTRACT_MODULE = "src/ui/screen-states/contract.ts";

/** The two surfaces R-UI-024 gives this pattern: inline where the work started, and the global tray. */
const SURFACES = ["job-timeline", "jobs-tray"] as const;

/** Where a rendered cell's id may be spelled: the pattern, the shell that carries the tray, the screens. */
const HOOK_ROOTS = ["src/ui/patterns/job-timeline", "src/ui/shell", "src/ui/patterns/refusal-state", "src/app/(app)"];

interface Cell {
  declared?: string;
  by?: string;
  to?: string;
  why?: string;
  testId?: string | null;
}

type Matrix = Readonly<Record<string, Readonly<Record<string, Cell>>>>;

async function matrix(): Promise<Matrix> {
  const bag = await productModule<{ JOB_TIMELINE_STATES?: Matrix }>(STATES_MODULE);
  const table = bag.JOB_TIMELINE_STATES;
  expect(table, `${STATES_MODULE} must export JOB_TIMELINE_STATES — the enumerable place R-UI-050 requires (B-19)`).toBeTypeOf("object");
  return table as Matrix;
}

/** R-UI-050's seven, from the one home that holds them — never a second spelling here (B-17). */
async function stateNames(): Promise<readonly string[]> {
  const bag = await productModule<{ STATE_NAMES?: readonly string[] }>(CONTRACT_MODULE);
  const names = bag.STATE_NAMES;
  expect(Array.isArray(names) && (names ?? []).length > 0, `${CONTRACT_MODULE} must export STATE_NAMES`).toBe(true);
  return names as readonly string[];
}

/** The same name in the matrix's other admitted register: `permission-denied` → `permissionDenied`. */
function keyForm(name: string): string {
  const [head = "", ...rest] = name.split("-");
  return [head, ...rest.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)].join("");
}

/** The cell a row files a state under, in whichever of the two registers it uses. */
function cellFor(row: Readonly<Record<string, Cell>>, state: string): Cell | undefined {
  return row[state] ?? row[keyForm(state)];
}

// white-box: AC-1 (R-UI-050, Decision §3) — "a cell claiming an id no source spells fails" is a
// property of the declaration against the tree, and an id nothing spells has no runtime observable
// to assert instead: the state it claims to render simply never appears.
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

describe("R-UI-050: the job pattern's state matrix is enumerable, and every cell is declared", () => {
  test("R-UI-050: both surfaces declare a row", async () => {
    const table = await matrix();
    for (const surface of SURFACES) {
      expect(
        Object.prototype.hasOwnProperty.call(table, surface),
        `R-UI-050: ${surface} declares no states — the matrix is checkable, not aspirational (B-19)`,
      ).toBe(true);
    }
  });

  test("R-UI-050: every declared row declares all seven states — a row of six fails here", async () => {
    const table = await matrix();
    const states = await stateNames();
    const rows = Object.keys(table);
    expect(rows.length, "the table declares at least the pattern's own surfaces").toBeGreaterThanOrEqual(SURFACES.length);
    for (const row of rows) {
      for (const state of states) {
        expect(cellFor(table[row] as Readonly<Record<string, Cell>>, state), `R-UI-050: ${row} declares no ${state} state`).toBeTypeOf("object");
      }
      expect(Object.keys(table[row] as object).length, `R-UI-050: ${row} declares exactly the seven states of the clause`).toBe(states.length);
    }
  });

  test("R-UI-050: a rendered cell names a module that exists and an id that is really spelled", async () => {
    const table = await matrix();
    const states = await stateNames();
    const sources = HOOK_ROOTS.flatMap((root) => sourcesUnder(root));
    expect(sources.length, "the roots a hook may be spelled under are readable").toBeGreaterThan(0);

    for (const row of Object.keys(table)) {
      for (const state of states) {
        const cell = cellFor(table[row] as Readonly<Record<string, Cell>>, state) as Cell;
        expect(typeof cell.declared, `${row}/${state} says nothing about itself`).toBe("string");
        if (cell.declared !== "rendered") continue;
        expect(existsSync(join(REPO_ROOT, String(cell.by))), `${row}/${state} claims it is rendered by ${String(cell.by)}, which is not in the checkout`).toBe(true);
        if (cell.testId === null || cell.testId === undefined) continue;
        const spelled = sources.some((source) => source.includes(`"${cell.testId}"`));
        expect(spelled, `${row}/${state} names the hook ${String(cell.testId)}, which no source under ${HOOK_ROOTS.join(" or ")} spells`).toBe(true);
      }
    }
  });

  test("R-UI-050: a delegated cell names its owner, and an impossible cell gives its reason", async () => {
    const table = await matrix();
    const states = await stateNames();

    for (const row of Object.keys(table)) {
      for (const state of states) {
        const cell = cellFor(table[row] as Readonly<Record<string, Cell>>, state) as Cell;
        if (cell.declared === "delegated") {
          expect(existsSync(join(REPO_ROOT, String(cell.to))), `${row}/${state} delegates to ${String(cell.to)}, which is not in the checkout`).toBe(true);
          expect((cell.why ?? "").trim().length, `${row}/${state} delegates without saying why`).toBeGreaterThan(0);
        }
        if (cell.declared === "impossible") {
          expect(
            (cell.why ?? "").trim().length,
            `${row}/${state} is called impossible without a reason — that is the review note R-UI-050 forbids`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});
