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
 *   - a cell that claims a state is RENDERED names a module that exists, sits in an admitted home,
 *     and — with what that module imports — really spells the id the cell files under it, in code
 *     rather than in prose; a cell that delegates or calls a state impossible says where, or why, in
 *     words. The declaration is never part of its own haystack: a table that witnessed itself would
 *     pass by having been written, which is the transcription B-19 refuses (arbitration, 2026-09-06).
 *
 * Nothing here fixes the number of rows: a surface added later declares its own row and passes.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT, productModule } from "./support/stage";

const STATES_MODULE = "src/ui/patterns/job-timeline/states.ts";
const CONTRACT_MODULE = "src/ui/screen-states/contract.ts";

/** The two surfaces R-UI-024 gives this pattern: inline where the work started, and the global tray. */
const SURFACES = ["job-timeline", "jobs-tray"] as const;

/**
 * The homes a rendered cell's `by` may name, and the bound of the import walk from it: the pattern,
 * the shell that carries the tray, the one refusal renderer, and the screens. This is NOT a corpus to
 * search — a cell is judged against the module it itself names (arbitration, 2026-09-06).
 */
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

// white-box: AC-1 (R-UI-050, Decision §3) — "a cell claiming an id its own module never spells fails"
// is a property of the declaration against the tree, and an id nothing spells has no runtime
// observable to assert instead: the state it claims to render simply never appears.

/** Every `.ts`/`.tsx` file under a directory, repo-relative. */
function filesUnder(relativeRoot: string): string[] {
  const absolute = join(REPO_ROOT, relativeRoot);
  if (!existsSync(absolute)) return [];
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (path.endsWith(".ts") || path.endsWith(".tsx")) found.push(relative(REPO_ROOT, path));
    }
  };
  walk(absolute);
  return found;
}

/** The files a cell's `by` (or `to`) stands for: itself if it is one, everything under it if a directory. */
function modulesAt(relativePath: string): string[] {
  const absolute = join(REPO_ROOT, relativePath);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isDirectory()) return filesUnder(relativePath);
  return absolute.endsWith(".ts") || absolute.endsWith(".tsx") ? [relative(REPO_ROOT, absolute)] : [];
}

/**
 * The specifiers one module reaches for, read from its raw text — comments are stripped only for the
 * id scan, because a mask that blanks string bodies would blank these specifiers too.
 */
const SPECIFIERS = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*["'`]([^"'`\n]+)["'`]/g;

/** A local specifier as a repo-relative module, or null for a package, a stylesheet or a dead path. */
function resolveLocal(fromModule: string, specifier: string): string | null {
  const alias = specifier.startsWith("@/");
  if (!alias && !specifier.startsWith(".")) return null;
  const base = alias ? join(REPO_ROOT, "src", specifier.slice(2)) : join(dirname(join(REPO_ROOT, fromModule)), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (!candidate.endsWith(".ts") && !candidate.endsWith(".tsx")) continue;
    if (existsSync(candidate) && statSync(candidate).isFile()) return relative(REPO_ROOT, candidate);
  }
  return null;
}

/**
 * What the named module renders with: itself and everything it imports, transitively, bounded to the
 * admitted homes. A shared id table reached through an import is therefore in scope (B-17 makes such
 * a module lawful), while the declaration under judgement never is — a table may not witness itself.
 */
function renderGraphOf(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const queue = entries.filter((module) => module !== STATES_MODULE);
  while (queue.length > 0) {
    const module = queue.shift() as string;
    if (seen.has(module) || module === STATES_MODULE) continue;
    if (!HOOK_ROOTS.some((root) => module.startsWith(root))) continue;
    seen.add(module);
    const raw = readFileSync(join(REPO_ROOT, module), "utf8");
    for (const match of raw.matchAll(SPECIFIERS)) {
      const next = resolveLocal(module, match[1] as string);
      if (next !== null && !seen.has(next)) queue.push(next);
    }
  }
  return [...seen];
}

/**
 * The code of a source, with its comments removed: a hook named in prose is a mention, not a
 * spelling. String and template bodies are kept whole, so a `//` inside one is not a comment.
 */
function codeOf(source: string): string {
  let out = "";
  let at = 0;
  while (at < source.length) {
    const here = source.slice(at, at + 2);
    if (here === "//") {
      const end = source.indexOf("\n", at);
      at = end === -1 ? source.length : end;
      continue;
    }
    if (here === "/*") {
      const end = source.indexOf("*/", at + 2);
      at = end === -1 ? source.length : end + 2;
      continue;
    }
    const quote = source[at] as string;
    if (quote === '"' || quote === "'" || quote === "`") {
      out += quote;
      at += 1;
      while (at < source.length && source[at] !== quote) {
        if (source[at] === "\\") {
          out += source.slice(at, at + 2);
          at += 2;
          continue;
        }
        out += source[at];
        at += 1;
      }
      out += quote;
      at += 1;
      continue;
    }
    out += source[at];
    at += 1;
  }
  return out;
}

/** A hook spelled as the string literal it is, in whichever quote the source used. */
function spells(source: string, testId: string): boolean {
  const escaped = testId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`["'\`]${escaped}["'\`]`).test(source);
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

  test("R-UI-050: a rendered cell names a module that exists and an id that module really spells", async () => {
    const table = await matrix();
    const states = await stateNames();

    for (const row of Object.keys(table)) {
      for (const state of states) {
        const cell = cellFor(table[row] as Readonly<Record<string, Cell>>, state) as Cell;
        expect(typeof cell.declared, `${row}/${state} says nothing about itself`).toBe("string");
        if (cell.declared !== "rendered") continue;

        const by = String(cell.by);
        expect(existsSync(join(REPO_ROOT, by)), `${row}/${state} claims it is rendered by ${by}, which is not in the checkout`).toBe(true);
        expect(
          HOOK_ROOTS.some((root) => by.startsWith(root)),
          `${row}/${state} claims it is rendered by ${by}, which is under none of ${HOOK_ROOTS.join(", ")} — a surface of this pattern is not rendered from there`,
        ).toBe(true);
        if (cell.testId === null || cell.testId === undefined) continue;

        // The cell's own claim is "rendered BY this module": the haystack is that module and what it
        // imports, never the tree at large, and never the table making the claim.
        const named = [...modulesAt(by), ...(cell.to === undefined ? [] : modulesAt(String(cell.to)))];
        const graph = renderGraphOf(named);
        expect(graph.length, `${row}/${state} names ${by}, which holds no source this suite can read`).toBeGreaterThan(0);

        const spelled = graph.some((module) => spells(codeOf(readFileSync(join(REPO_ROOT, module), "utf8")), String(cell.testId)));
        expect(
          spelled,
          `${row}/${state} claims ${String(cell.testId)} is rendered by ${by}, but neither that module nor anything it imports spells it`,
        ).toBe(true);
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
