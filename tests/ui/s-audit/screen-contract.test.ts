/**
 * Public acceptance for AC-1's screen contract — the claims that are about the tree and its typed
 * tables rather than about a running browser:
 *
 *   - the route exists at the address the contract names, with the files the Decision §1 rules;
 *   - every string the Decision §3 rules is present in the screen's typed string table, verbatim
 *     (C-SPINE-PLATFORM: one table per screen, keyed by id, the compiler refusing a missing key);
 *   - the copy is in the TABLE and not in the markup — no user-facing literal in the JSX;
 *   - no colour literal appears anywhere in the route (R-UI-001: colour arrives through tokens);
 *   - R-UI-050's seven states are declared in the enumerable home the Decision §2 names;
 *   - the screen's test ids are exactly C-05's ten and no eleventh (Decision §7).
 *
 * `.ts`, not `.tsx`: tsconfig includes `tests/**\/*.ts`, so `pnpm verify`'s `tsc` reads the
 * type-level totality assertion below as well as vitest reading the runtime ones (the idiom
 * tests/ui/home/state-matrix.test.ts established).
 *
 * The expected copy is derived from the committed Decision, never transcribed here — see
 * ./support/decision.ts.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { describe, expect, test } from "vitest";
import { DESIGN_DECISION, EXPLORER_MODULE, PAGE_MODULE, REPO_ROOT, ROUTE_DIR, STATES_MODULE, STRINGS_MODULE, TESTID, decisionCopy, productModule, sourceOf, stringsTable } from "./support/decision";
import type { ShellStateCell, ShellStateName } from "../../../src/ui/shell/states";

/** R-UI-050's seven, spelled here so the screen's own row cannot define the law it is graded by. */
const R_UI_050_STATES: readonly ShellStateName[] = ["loading", "empty", "error", "refusal", "partial", "offline", "permissionDenied"];

type AuditStates = Readonly<Record<ShellStateName, ShellStateCell>>;

/* --------------------------------------------------- the compiler's half (type-level totality) */

type Assert<T extends true> = T;

/** Keyed by R-UI-050's seven EXACTLY — `[A] extends [B]` alone passes for a `Record<string, …>`. */
type CellsAreTheStates = Assert<keyof AuditStates extends ShellStateName ? (ShellStateName extends keyof AuditStates ? true : false) : false>;
const cellsAreTheStates: CellsAreTheStates = true;

/* ------------------------------------------------------------------------------------ scanning */

/** Every authored file of the route directory, repo-relative. */
function routeFiles(): string[] {
  const root = join(REPO_ROOT, ROUTE_DIR);
  expect(existsSync(root) && statSync(root).isDirectory(), `${ROUTE_DIR} is missing from the checkout — the route the contract names does not exist yet`).toBe(true);
  const found: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else found.push(`${ROUTE_DIR}/${next}`);
    }
  };
  walk("");
  return found.sort();
}

/** Comments stripped, so a word in prose is never mistaken for a value the screen renders. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/* ------------------------------------------------------------------------------------ the cases */

describe("AC-1 — S-Audit stands at its address, with the files its Design Decision rules", () => {
  test("AC-1: the route directory holds the page, the explorer, its strings and its states", () => {
    for (const relative of [PAGE_MODULE, EXPLORER_MODULE, STRINGS_MODULE, STATES_MODULE]) {
      expect(existsSync(join(REPO_ROOT, relative)), `${relative} is missing — ${DESIGN_DECISION} §1 rules it as a file of this route`).toBe(true);
    }
  });

  test("AC-1: every string the Decision rules is in the screen's typed string table, verbatim", async () => {
    const ruled = decisionCopy();
    const table = await stringsTable();
    for (const [key, wording] of Object.entries(ruled)) {
      expect(Object.hasOwn(table, key), `${STRINGS_MODULE} must hold ${key} — ${DESIGN_DECISION} §3 rules it (C-SPINE-PLATFORM)`).toBe(true);
      expect((table[key] ?? "").replace(/\s+/g, " ").trim(), `${key} must read exactly as ${DESIGN_DECISION} §3 spells it`).toBe(wording);
    }
  });

  test("AC-1: the copy lives in the table and not in the markup — no user-facing literal in the JSX", () => {
    const ruled = Object.values(decisionCopy()).filter((wording) => wording.length > 12 && !wording.includes("{"));
    expect(ruled.length, "the Decision rules sentences long enough to be recognised in markup").toBeGreaterThan(0);

    for (const relative of routeFiles().filter((file) => file.endsWith(".tsx"))) {
      const source = code(sourceOf(relative));
      for (const wording of ruled) {
        expect(source.includes(wording), `${relative} spells "${wording.slice(0, 48)}…" inline — every user-facing string comes from ${STRINGS_MODULE} by key (C-SPINE-PLATFORM)`).toBe(false);
      }
    }
  });

  test("AC-1: no colour literal appears in the route — colour arrives only through tokens", () => {
    // A pattern, never a colour: hex triples/quads and the CSS colour functions R-UI-001 forbids
    // authoring by hand. The route's px literals are a closed set the Decision §5 allows and are
    // deliberately not judged here.
    const literal = /#[0-9a-fA-F]{3,8}(?![0-9A-Za-z_-])|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\s*\(/;
    for (const relative of routeFiles().filter((file) => /\.(tsx?|css)$/.test(file))) {
      const found = literal.exec(code(sourceOf(relative)));
      expect(found?.[0] ?? null, `${relative} authors a colour value directly — every light/dark difference arrives through token values (R-UI-001, ${DESIGN_DECISION} §6)`).toBeNull();
    }
  });

  test("AC-1: the screen's test ids are C-05's ten and no eleventh", () => {
    const contract = new Set<string>(Object.values(TESTID));
    const used = new Set<string>();
    for (const relative of routeFiles().filter((file) => /\.tsx?$/.test(file))) {
      for (const match of code(sourceOf(relative)).matchAll(/data-testid\s*=\s*["'{]?\s*["']?(audit-[a-z0-9-]+)/g)) used.add(match[1] ?? "");
    }
    for (const id of contract) {
      expect(used.has(id), `[data-testid="${id}"] is in the increment's closed test-hook contract and appears nowhere in ${ROUTE_DIR}`).toBe(true);
    }
    for (const id of used) {
      expect(contract.has(id), `${ROUTE_DIR} adds the hook "${id}" — ${DESIGN_DECISION} §7 closes this screen's ids at the contract's ten ("No others are added")`).toBe(true);
    }
  });
});

describe("AC-1 — R-UI-050's seven states are declared where a suite can walk them", () => {
  async function row(): Promise<AuditStates> {
    const module = await productModule<{ AUDIT_STATES?: AuditStates }>(STATES_MODULE);
    const declared = module.AUDIT_STATES;
    expect(declared, `${STATES_MODULE} must export AUDIT_STATES — the enumerable home ${DESIGN_DECISION} §2 names for this screen's matrix`).toBeTypeOf("object");
    return declared as AuditStates;
  }

  test("AC-1: the row declares R-UI-050's seven states and no eighth of its own", async () => {
    expect(Object.keys(await row()).sort(), "the matrix is R-UI-050's states exactly").toEqual([...R_UI_050_STATES].sort());
    expect(cellsAreTheStates, "and the compiler agrees, so a missing cell is a build error rather than a runtime surprise").toBe(true);
  });

  test("AC-1: every cell is a claim with evidence — a module that exists, or a reason in words", async () => {
    const declared = await row();
    for (const state of R_UI_050_STATES) {
      const cell = declared[state];
      if (cell.declared === "rendered") {
        expect(existsSync(join(REPO_ROOT, normalize(cell.by))), `the ${state} cell says it is rendered by ${cell.by}, which is not in the checkout`).toBe(true);
        expect(dirname(normalize(cell.by)).startsWith(normalize(ROUTE_DIR)), `the ${state} cell claims to render it HERE, so the module it names belongs to this route`).toBe(true);
      } else if (cell.declared === "delegated") {
        expect(existsSync(join(REPO_ROOT, normalize(cell.to))), `the ${state} cell delegates to ${cell.to}, which is not in the checkout`).toBe(true);
        expect(cell.why.trim().length, `the ${state} cell must say why it delegates`).toBeGreaterThan(20);
      } else {
        expect(cell.why.trim().length, `the ${state} cell calls the state impossible, which is a claim that owes a reason`).toBeGreaterThan(20);
      }
    }
  });

  test("AC-1: the empty state is rendered on this screen and reads at the hook the contract names", async () => {
    const empty = (await row())["empty"];
    expect(empty.declared, `a fresh project has no acts, so ${DESIGN_DECISION} §2 renders the empty state here rather than delegating it`).toBe("rendered");
    if (empty.declared !== "rendered") return;
    expect(empty.testId, `the empty cell reads at [data-testid=${TESTID.empty}] — the hook the test contract names`).toBe(TESTID.empty);
  });
});
