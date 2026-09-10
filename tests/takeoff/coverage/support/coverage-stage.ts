/**
 * The stage S-Coverage is judged over (inc-216-coverage-grid: X-3, R-TO-052, L-QTY-05, L-QTY-07).
 *
 * `CoverageWorkspace` is the module component the Design Decision rules (docs/design/s-coverage.md
 * I-170/I-171): its props are exactly `{ view, density, permitted, offline, chrome, doors }` — the
 * same six the register workspace takes — the chrome is the SHIPPED Button, Skeleton, RefusalState
 * and ConsequenceDialog injected by the app layer, and the doors are the procedures the test
 * contract names. This stage binds the same shipped components the route binds, so what a test
 * mounts is what a reader sees.
 *
 * The `view` is the reading, verbatim: the product's own `resolveResidue`, `measurementStatementOf`
 * and `billStatementOf` answers over one `ResidueInput`, beside the input they were computed from.
 * Nothing here re-derives a cause, an order or a collapse — every expectation is DERIVED by the
 * suite that asserts it from these same values (B-19), so a roster or an arm that grows spreads the
 * corpus with no edit to a test.
 *
 * Product modules are loaded by absolute path through `productModule`, so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that would read as a
 * defect in the acceptance. Nothing here reads product source: every name below is one the
 * increment's interfaces, its test contract, its acceptance criteria or the committed Design
 * Decision publishes.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. Keep it free of judgement so neither lane can hide one here.
 *
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`.
 */
import { cleanup, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type FunctionComponent } from "react";
import { expect } from "vitest";
import { productModule } from "../../../server/support/wire";
// jsdom performs no layout; the shipped overlay chrome is given a measurable box by its own stubs,
// installed here rather than written a second time beside them (B-17).
import { installDomStubs } from "../../../ui/primitives-overlay-data/support/render";

export { cleanup, productModule, userEvent, within };

/* ------------------------------------------------------------------ the homes the spec names */

/** The residue as a query — the increment's interfaces name this barrel and these exports. */
export const RESIDUE_MODULE = "src/core/residue/index.ts";

/** The channel readers, whose declared return type is `Sighting[]` and which hold no `absent` (AC-1). */
export const CHANNELS_DIR = "src/core/residue/channels";
export const CHANNEL_MODULES: readonly string[] = [`${CHANNELS_DIR}/register.ts`, `${CHANNELS_DIR}/partition.ts`, `${CHANNELS_DIR}/layout.ts`];

/** The one module the tree's single `NOT EXISTS` stands in (AC-2, L-QTY-05). */
export const RESIDUE_QUERY_MODULE = "src/core/residue/residue.ts";

/** The mountable workspace — the barrel of the coverage module (Decision I-170). */
export const COVERAGE_UI_MODULES: readonly string[] = ["src/modules/takeoff/coverage/index.tsx", "src/modules/takeoff/coverage/index.ts"];

/** The screen's own copy table (Decision I-197: coverage's copy is the coverage module's own). */
export const COVERAGE_COPY_MODULE = "src/modules/takeoff/coverage/copy.ts";

/** The route's declared states (AC-5) and the matrix they are appended to. */
export const COVERAGE_STATES_MODULE = "src/app/(app)/t/[tenant]/p/[project]/takeoff/coverage/states.ts";
export const SCREEN_STATES_MODULE = "src/ui/screen-states/matrix.tsx";
export const COVERAGE_ROUTE_KEY = "/t/[tenant]/p/[project]/takeoff/coverage";

/** The closed refusal taxonomy — the one home of a cause's message and remedy (AC-5, I-191). */
export const ERRORS_MODULE = "src/core/errors.ts";

/** The act law and the total map the two boundary acts join (AC-4, L-ACT-02, L-ACT-03). */
export const ACTS_MODULE = "src/core/acts/index.ts";
export const ACTS_LAW_MODULE = "src/core/acts/law.ts";

/** The shipped chrome, by the barrels that publish it (Decision §0: core Button and Skeleton, the one
 *  RefusalState, the one ConsequenceDialog — never re-implemented here). */
export const CHROME_BARRELS: readonly string[] = ["src/ui/primitives/core/index.ts", "src/ui/patterns/refusal-state/index.ts", "src/ui/patterns/consequence-dialog/index.ts"];
export const CHROME_NAMES: readonly string[] = ["Button", "Skeleton", "RefusalState", "ConsequenceDialog"];

/** The doors the workspace is handed, by the names the test contract's `procedures` spell. */
export const DOOR_NAMES: readonly string[] = ["previewHoldOutOfBill", "commitHoldOutOfBill", "previewDeclareNotInProjectScope", "commitDeclareNotInProjectScope"];

/* --------------------------------------------------------------------- the closed vocabulary */

/** The six cause codes AC-5 registers, in the order it names them — the legend's declared order. */
export const CAUSES: readonly string[] = ["NOT_ESTABLISHED", "INGESTION_TRUNCATED", "NOT_IN_PROJECT_SCOPE", "NO_BEARER_SIGHTED", "KIND_NOT_YET_SEEDED", "NOT_IN_THIS_BILL"];

/** The two readings that are not causes: a cell that bears quantity, and a cell that stands in the bill. */
export const QUANTITY_BEARING = "QUANTITY_BEARING";
export const IN_BILL = "IN_BILL";

/** The two act types this increment lands, and the permission both move (AC-4). */
export const HOLD_OUT_OF_BILL = "HOLD_OUT_OF_BILL";
export const DECLARE_NOT_IN_PROJECT_SCOPE = "DECLARE_NOT_IN_PROJECT_SCOPE";
export const SET_BILL_BOUNDARY = "SET_BILL_BOUNDARY";

/** The three channels a class may be sighted through (L-QTY-05), and the inspector's fourth row kind. */
export const SIGHTING_CHANNELS: readonly string[] = ["REGISTER", "PARTITION", "LAYOUT"];
export const DECLARATION_CHANNEL = "DECLARATION";

/* --------------------------------------------------------------------- the fixture identities */

export const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const PROJECT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const CAMPAIGN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const SET_REVISION = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

/** The address the screen answers at, and the parameter one cell widens it by (Decision §7). */
export const CELL_PARAM = "cell";
export const coverageRoute = (tenantId: string = TENANT, projectId: string = PROJECT): string => `/t/${tenantId}/p/${projectId}/takeoff/coverage`;

/* ------------------------------------------------------------------------ the input, as declared */

export type Sighting = {
  class: string;
  levelId: string | null;
  channel: "REGISTER" | "PARTITION" | "LAYOUT";
  drawingId: string;
  layoutName: string;
  sourceKey: string;
};

export type Declaration = {
  class: string;
  kind: string;
  levelId: string;
  cause: "NOT_IN_PROJECT_SCOPE" | "NOT_IN_THIS_BILL";
  actId: string;
  inForce: boolean;
  actResolves: boolean;
};

export type Observation = { class: string; kind: string; levelId: string; rail: string; reason: string };

export type Level = { levelId: string; ordinal: number; label: string };

export type ResidueInput = {
  bears: { class: string; kind: string }[];
  workItems: string[];
  levels: Level[];
  sightings: Sighting[];
  lines: { kind: string; class: string; levelId: string; lineId: string }[];
  declarations: Declaration[];
  truncated: { drawingId: string; layoutName: string }[];
  observations: Observation[];
};

/** A residue row as a suite reads one: an object whose fields the criteria name. */
export type Cell = Record<string, unknown>;

/* ------------------------------------------------------------------------ the fixture's corpus */

export const GF: Level = { levelId: "lvl-gf", ordinal: 0, label: "GF" };
export const L1: Level = { levelId: "lvl-l1", ordinal: 1, label: "L1" };
export const L2: Level = { levelId: "lvl-l2", ordinal: 2, label: "L2" };
export const LEVELS: readonly Level[] = [GF, L1, L2];

/** Two classes the channels sight, and one the catalogue bears a kind for that nothing sighted. */
export const COLUMN = "column";
export const BEAM = "beam";
export const SLAB = "slab";

/** The kinds of the staged catalogue. */
export const CONCRETE = "rcc.concrete";
export const FORMWORK = "rcc.formwork";
export const REBAR = "rcc.rebar";
export const SLAB_CONCRETE = "rcc.slab-concrete";
/** A work item standing in the catalogue that no `bears` row names (KIND_NOT_YET_SEEDED). */
export const WATERPROOFING = "rcc.waterproofing";

/** The sheet the columns were read on, and the beam sheet that was read only in part. */
export const WHOLE_SHEET = { drawingId: "dwg-s101", layoutName: "S-101 Plan" };
export const PART_READ_SHEET = { drawingId: "dwg-s102", layoutName: "S-102 Plan" };

/** The act ids the two staged declarations cite. */
export const HELD_ACT = "act-hold-1";
export const SCOPE_ACT = "act-scope-1";
export const BEATEN_ACT = "act-scope-2";

export function sighting(klass: string, level: Level, channel: Sighting["channel"] = "REGISTER", sheet: { drawingId: string; layoutName: string } = WHOLE_SHEET): Sighting {
  return { class: klass, levelId: level.levelId, channel, drawingId: sheet.drawingId, layoutName: sheet.layoutName, sourceKey: `${sheet.layoutName}:${klass}:${level.label}:${channel}` };
}

/**
 * The residue the screen is mounted over. Every cause of the closed set stands somewhere in it, and
 * no two cells of a kind read alike:
 *
 * - `column` is sighted on GF, L1 and L2 through two channels; `beam` on GF alone, on a sheet that
 *   was read only in part; `slab` is borne but sighted by nothing.
 * - `rcc.concrete` on `column`, GF bears a published line — and a beaten DECLARE_NOT_IN_PROJECT_SCOPE
 *   over the same cell, which the lines contradict (I-192).
 * - `rcc.formwork` on `column`, GF is held out of this bill; L1 and L2 are a contiguous unmeasured run.
 * - `rcc.rebar` on `column`, L1 is declared out of the project scope.
 * - `rcc.slab-concrete` is borne only by `slab`; `rcc.waterproofing` by nothing.
 */
export function residueFixture(over: Partial<ResidueInput> = {}): ResidueInput {
  return {
    bears: [
      { class: COLUMN, kind: CONCRETE },
      { class: COLUMN, kind: FORMWORK },
      { class: COLUMN, kind: REBAR },
      { class: BEAM, kind: CONCRETE },
      { class: SLAB, kind: SLAB_CONCRETE },
    ],
    workItems: [CONCRETE, FORMWORK, REBAR, SLAB_CONCRETE, WATERPROOFING],
    levels: [...LEVELS],
    sightings: [
      sighting(COLUMN, GF, "REGISTER"),
      sighting(COLUMN, GF, "PARTITION"),
      sighting(COLUMN, L1, "REGISTER"),
      sighting(COLUMN, L2, "LAYOUT"),
      sighting(BEAM, GF, "REGISTER", PART_READ_SHEET),
    ],
    lines: [{ kind: CONCRETE, class: COLUMN, levelId: GF.levelId, lineId: "line-1" }],
    declarations: [
      { class: COLUMN, kind: FORMWORK, levelId: GF.levelId, cause: "NOT_IN_THIS_BILL", actId: HELD_ACT, inForce: true, actResolves: true },
      { class: COLUMN, kind: REBAR, levelId: L1.levelId, cause: "NOT_IN_PROJECT_SCOPE", actId: SCOPE_ACT, inForce: true, actResolves: true },
      { class: COLUMN, kind: CONCRETE, levelId: GF.levelId, cause: "NOT_IN_PROJECT_SCOPE", actId: BEATEN_ACT, inForce: true, actResolves: true },
    ],
    truncated: [PART_READ_SHEET],
    observations: [
      { class: COLUMN, kind: FORMWORK, levelId: L1.levelId, rail: "columns", reason: "No formwork basis was offered for this column on this level." },
      { class: BEAM, kind: CONCRETE, levelId: GF.levelId, rail: "beams", reason: "The section this beam takes was not read." },
    ],
    ...over,
  };
}

/* ----------------------------------------------------------------------------- the product's own */

type ResidueModule = {
  resolveResidue?: (input: ResidueInput) => unknown;
  measurementStatementOf?: (input: unknown) => unknown;
  billStatementOf?: (input: unknown) => unknown;
};

export async function residueModule(): Promise<ResidueModule> {
  return productModule<ResidueModule>(RESIDUE_MODULE);
}

/** One export of the residue barrel, asserted to be a function before it is called. */
export async function residueExport(name: string): Promise<(...args: unknown[]) => unknown> {
  const module = (await residueModule()) as Record<string, unknown>;
  expect(typeof module[name], `${RESIDUE_MODULE} publishes \`${name}\` (the increment's interfaces)`).toBe("function");
  return module[name] as (...args: unknown[]) => unknown;
}

/** The residue's rows, however the resolver packages them. */
export function rowsOf(answer: unknown, where: string): Cell[] {
  if (Array.isArray(answer)) return answer as Cell[];
  const cells = (answer as { cells?: unknown } | null)?.cells;
  expect(Array.isArray(cells), `${where} answers rows — neither a list nor a \`cells\` list came back`).toBe(true);
  return cells as Cell[];
}

export async function resolveResidue(input: ResidueInput): Promise<Cell[]> {
  return rowsOf((await residueExport("resolveResidue"))(input), "resolveResidue");
}

/**
 * One statement, as its own function yields it. The resolver's input is what the certificate is
 * computed from; a statement that would rather be handed the resolved cells is handed those instead,
 * which is mechanics, not a judgement — the ORDER and the CONTENT are what the criteria grade.
 */
export async function statementOf(name: string, input: ResidueInput): Promise<Cell[]> {
  const yieldRows = await residueExport(name);
  let answer: unknown;
  try {
    answer = yieldRows(input);
  } catch {
    answer = yieldRows(await resolveResidue(input));
  }
  if (!Array.isArray(answer) && !Array.isArray((answer as { rows?: unknown } | null)?.rows)) {
    answer = yieldRows(await resolveResidue(input));
  }
  if (Array.isArray(answer)) return answer as Cell[];
  const rows = (answer as { rows?: unknown } | null)?.rows;
  expect(Array.isArray(rows), `${name} answers the statement's rows`).toBe(true);
  return rows as Cell[];
}

/* ------------------------------------------------------------------------------- the view */

/** What the workspace is mounted over: the reading, verbatim, beside the input it was read from. */
export interface CoverageViewLike {
  campaignId: string;
  setRevisionId: string;
  /** The `ResidueInput` the three answers below were computed from — the cells' own evidence. */
  input: ResidueInput;
  /** `resolveResidue`'s answer, verbatim. */
  cells: Cell[];
  /** `measurementStatementOf`'s answer, verbatim. */
  measurement: Cell[];
  /** `billStatementOf`'s answer, verbatim. */
  bill: Cell[];
}

export async function coverageView(input: ResidueInput = residueFixture()): Promise<CoverageViewLike> {
  const [cells, measurement, bill] = await Promise.all([resolveResidue(input), statementOf("measurementStatementOf", input), statementOf("billStatementOf", input)]);
  return { campaignId: CAMPAIGN, setRevisionId: SET_REVISION, input, cells, measurement, bill };
}

/* ------------------------------------------------------------------------------- the loaders */

type Mountable = (props: Record<string, unknown>) => unknown;

/** The workspace itself, by the export the Design Decision names (I-170). */
export async function coverageWorkspace(): Promise<Mountable> {
  let held: Record<string, unknown> | null = null;
  let last: unknown = null;
  for (const barrel of COVERAGE_UI_MODULES) {
    try {
      held = await productModule<Record<string, unknown>>(barrel);
      break;
    } catch (failure) {
      last = failure;
    }
  }
  expect(held, `one of ${COVERAGE_UI_MODULES.join(" or ")} is the coverage module's barrel — ${String((last as Error | null)?.message ?? "")}`).not.toBeNull();
  expect(typeof (held as Record<string, unknown>)["CoverageWorkspace"], "the coverage module publishes `CoverageWorkspace` (docs/design/s-coverage.md I-170)").toBe("function");
  return (held as Record<string, unknown>)["CoverageWorkspace"] as Mountable;
}

/** The shipped renderers the app layer injects, loaded from the barrels that publish them. */
export async function chrome(): Promise<Record<string, unknown>> {
  const held: Record<string, unknown> = {};
  for (const barrel of CHROME_BARRELS) {
    const module = await productModule<Record<string, unknown>>(barrel);
    for (const [name, value] of Object.entries(module)) held[name] ??= value;
  }
  const bound: Record<string, unknown> = {};
  for (const name of CHROME_NAMES) {
    expect(typeof held[name], `the shipped \`${name}\` is published by one of ${CHROME_BARRELS.join(", ")} — the workspace is handed it, never a copy (B-17, I-170)`).toBe("function");
    bound[name] = held[name];
  }
  return bound;
}

export interface RefusalEntryShape {
  code: string;
  message: string;
  remedy: string;
  severity: string;
  surface: string;
}

/** The register, read from its one home so nothing here re-spells a cause's words (ARCH-02, B-17). */
export async function refusalRegister(): Promise<Readonly<Record<string, RefusalEntryShape | undefined>>> {
  const errors = await productModule<{ REFUSALS: Readonly<Record<string, RefusalEntryShape | undefined>> }>(ERRORS_MODULE);
  return errors.REFUSALS;
}

/** One registered entry, asserted registered before its words are used as an expectation. */
export async function registered(code: string): Promise<RefusalEntryShape> {
  const register = await refusalRegister();
  const entry = register[code];
  expect(entry, `${code} is registered in REFUSALS with a message and a remedy (AC-5, Decision §3.1)`).toBeTruthy();
  return entry as RefusalEntryShape;
}

/* --------------------------------------------------------------------------------- the doors */

export interface DoorCall {
  door: string;
  argument: unknown;
}

export interface StagedDoors {
  calls: DoorCall[];
  doors: Record<string, unknown>;
}

/** What a preview answers (L-ACT-02): a Consequence over one subject, and the digest of it. */
export function aConsequence(actType: string, subjectId: string): { consequence: Record<string, unknown>; consequenceDigest: string } {
  return {
    consequence: { actType, tenantId: TENANT, projectId: PROJECT, rendering: "SUBJECTS", subjects: [{ subjectId, before: [IN_BILL], after: ["NOT_IN_THIS_BILL"] }] },
    consequenceDigest: `digest-${actType}`,
  };
}

/** The four doors the workspace is handed, each recording what it was called with. */
export async function stagedDoors(rejecting: Readonly<Record<string, string>> = {}): Promise<StagedDoors> {
  const register = await refusalRegister();
  const calls: DoorCall[] = [];
  const doors: Record<string, unknown> = { refusalOf: (code: string) => register[code] };
  for (const name of DOOR_NAMES) {
    doors[name] = async (argument: unknown): Promise<unknown> => {
      calls.push({ door: name, argument });
      const code = rejecting[name];
      if (code !== undefined) throw Object.assign(new Error(code), { refusalCode: code });
      if (name.startsWith("preview")) return aConsequence(name === "previewHoldOutOfBill" ? HOLD_OUT_OF_BILL : DECLARE_NOT_IN_PROJECT_SCOPE, "subject-1");
      return { actId: "act-1" };
    };
  }
  return { calls, doors };
}

/* --------------------------------------------------------------------------------- the mount */

export interface MountOptions {
  density?: string;
  permitted?: boolean;
  offline?: boolean;
  doors?: Record<string, unknown>;
}

/** Mount the workspace over one view and hand back the screen root the test contract names. */
export async function mountCoverage(view: CoverageViewLike, over: MountOptions = {}): Promise<HTMLElement> {
  installDomStubs();
  const component = await coverageWorkspace();
  const bound = await chrome();
  const doors = over.doors ?? (await stagedDoors()).doors;
  const props = {
    view,
    density: over.density ?? "comfortable",
    permitted: over.permitted ?? true,
    offline: over.offline ?? false,
    chrome: bound,
    doors,
  };
  const { container } = render(createElement(component as unknown as FunctionComponent<typeof props>, props));
  const root = container.querySelector('[data-testid="coverage-screen"]');
  expect(root, "CoverageWorkspace renders the screen root `coverage-screen` (test contract)").not.toBeNull();
  return root as HTMLElement;
}

/* ------------------------------------------------------------------------------ reading a mount */

/** Every element carrying a contract test id, in document order. */
export function all(root: ParentNode, testId: string): HTMLElement[] {
  return [...root.querySelectorAll(`[data-testid="${testId}"]`)] as HTMLElement[];
}

/** The one element carrying a contract test id — asserted to be exactly one. */
export function one(root: ParentNode, testId: string): HTMLElement {
  const found = all(root, testId);
  expect(found.length, `the screen renders exactly one \`${testId}\``).toBe(1);
  return found[0] as HTMLElement;
}

/** An element's text, whitespace-collapsed, as a reader reads it. */
export function text(node: Element | null): string {
  return (node?.textContent ?? "").replace(/\s+/gu, " ").trim();
}

/**
 * One hook of an element, read under the first of the names it may be spelled.
 *
 * The acceptance criteria and the committed Design Decision spell three of this screen's hooks
 * differently — `data-code` / `data-cause` on the inspector's cause, `data-axis` / `data-statement`
 * on a statement block, `data-levels` / `data-level` on a statement row. Both spellings state the
 * SAME fact, and no criterion turns on which word carries it, so a suite reads whichever the screen
 * wears and grades the fact. Named here once, in public, so no hidden assertion turns on a spelling
 * the Builder could not have read (B-12).
 */
export function hook(node: Element, ...names: readonly string[]): string | null {
  for (const name of names) {
    const held = node.getAttribute(name);
    if (held !== null) return held;
  }
  return null;
}

/** A cell's own three coordinates and two readings, as the grid wears them (AC-5). */
export function cellHooks(node: Element): { kind: string | null; class: string | null; level: string | null; measurement: string | null; bill: string | null; contradicted: string | null } {
  return {
    kind: node.getAttribute("data-kind"),
    class: node.getAttribute("data-class"),
    level: node.getAttribute("data-level"),
    measurement: node.getAttribute("data-measurement"),
    bill: node.getAttribute("data-bill"),
    contradicted: node.getAttribute("data-contradicted"),
  };
}

/** A row's level id, whether it spells it `levelId` or `level`. */
export function levelIdOf(row: Cell): unknown {
  return row["levelId"] ?? row["level"];
}

/** The one residue row for a cell of the borne grid. */
export function rowAt(cells: readonly Cell[], kind: string, klass: string, levelId: string): Cell {
  const found = cells.filter((cell) => cell["kind"] === kind && cell["class"] === klass && levelIdOf(cell) === levelId);
  expect(found.length, `the residue holds exactly one row for ${kind} on ${klass}, ${levelId}`).toBe(1);
  return found[0] as Cell;
}

/** The rendered cell for one residue row, found by the three coordinates it carries (AC-5). */
export function cellFor(root: ParentNode, row: Cell): HTMLElement {
  const found = all(root, "coverage-cell").filter((node) => {
    const at = cellHooks(node);
    return at.kind === row["kind"] && at.class === ((row["class"] ?? "") as string) && at.level === ((levelIdOf(row) ?? "") as string);
  });
  expect(found.length, `the grid renders exactly one cell for ${JSON.stringify({ kind: row["kind"], class: row["class"], level: levelIdOf(row) })}`).toBe(1);
  return found[0] as HTMLElement;
}

/** The sightings of one cell, derived from the input rather than from the row that reports them. */
export function sightingsOf(input: ResidueInput, klass: string | null, levelId: string | null): Sighting[] {
  if (klass === null) return [];
  return input.sightings.filter((seen) => seen.class === klass && seen.levelId === levelId);
}

/** The rail observations of one cell, derived from the input. */
export function observationsOf(input: ResidueInput, kind: string, klass: string | null, levelId: string | null): Observation[] {
  if (klass === null) return [];
  return input.observations.filter((seen) => seen.class === klass && seen.kind === kind && seen.levelId === levelId);
}

/** The in-force declarations over one cell whose act resolves, derived from the input. */
export function declarationsOf(input: ResidueInput, kind: string, klass: string | null, levelId: string | null): Declaration[] {
  if (klass === null) return [];
  return input.declarations.filter((row) => row.class === klass && row.kind === kind && row.levelId === levelId && row.inForce && row.actResolves);
}
