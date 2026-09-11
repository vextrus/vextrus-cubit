/**
 * The stage S-Coverage is judged over (inc-216-coverage-grid: L-QTY-05, L-QTY-07, R-TO-052, X-3).
 *
 * MECHANICS ONLY — nothing here judges the product. It holds the residue fixture the increment's
 * interfaces spell, the loading of the modules the interfaces name, the mount the jsdom suites
 * render through, and a staged campaign for the suites that drive the two boundary acts over a real
 * store. Every judgement lives in the suites beside it, so this file cannot be edited into agreement
 * with a product that does not satisfy a criterion.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that would read as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one the increment's interfaces, its test
 * contract or the Design Decision publishes.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. Keep it free of judgement so neither lane can hide one here.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement, type FunctionComponent } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect } from "vitest";

/** The browser mechanics both lanes reach through this file: the held-out mount stands outside the
 * checkout, so a bare `@testing-library/react` specifier resolves HERE and nowhere else. */
export { cleanup, createElement, fireEvent, render, screen, waitFor, within };

/* ------------------------------------------------------------------ loading product modules */

/** The checkout this stage runs against — the gate states it; a lane run in place is already in it. */
const REPO_ROOT: string = process.env["BUILDER_REPO_ROOT"]?.trim() || process.cwd();

/** Import a product module by repo-relative path, asserting it exists first. */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/* ------------------------------------------------------------------------- the homes the spec names */

/** The residue's barrel — the roster of the interfaces (`src/core/residue/index.ts`). */
export const RESIDUE_MODULE = "src/core/residue/index.ts";

/** The one file the tree's single `NOT EXISTS` stands in, and the channels it is banned under. */
export const RESIDUE_QUERY_MODULE = "src/core/residue/residue.ts";
export const RESIDUE_ROOT = "src/core/residue";
export const RESIDUE_CHANNELS_ROOT = "src/core/residue/channels";

/** The committed scan AC-1 is proved by (interfaces). */
export const NOT_EXISTS_SCAN_MODULE = "src/core/residue/__tests__/not-exists-scan.ts";

/** The coverage module: the reading, and the presentational workspace the route mounts. */
export const COVERAGE_SERVER_MODULE = "src/modules/takeoff/coverage/server.ts";
export const COVERAGE_WORKSPACE_MODULE = "src/modules/takeoff/coverage/coverage-workspace.tsx";

/** The act law, the act seam and the two act renderings this increment lands (interfaces). */
export const ACTS_MODULE = "src/core/acts/index.ts";
export const ACTS_LAW_MODULE = "src/core/acts/law.ts";

/** The refusal register — the one home of a code's message and remedy. */
export const ERRORS_MODULE = "src/core/errors.ts";

/** The marker a refusal is carried to its caller by (ARCH-03). */
export const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";

/** The canonical order every roster on this screen is read in, and the seven-state matrix. */
export const IDENTITY_MODULE = "src/core/identity/index.ts";
export const SCREEN_STATES_MODULE = "src/ui/screen-states/index.ts";

/* ------------------------------------------------------------ the vocabulary the spec spells */

/** The route the screen answers at, as the screen-states matrix keys it (test contract). */
export const COVERAGE_ROUTE = "/t/[tenant]/p/[project]/takeoff/coverage";

/** The two act types this increment adds, and the permission both move (interfaces, AC-3). */
export const HOLD_OUT_OF_BILL = "HOLD_OUT_OF_BILL";
export const DECLARE_NOT_IN_PROJECT_SCOPE = "DECLARE_NOT_IN_PROJECT_SCOPE";
export const SET_BILL_BOUNDARY = "SET_BILL_BOUNDARY";
export const MEASURE = "MEASURE";

/** The readings and causes the criteria name by hand (interfaces; each also derivable from the law). */
export const QUANTITY_BEARING = "QUANTITY_BEARING";
export const IN_BILL = "IN_BILL";
export const NOT_ESTABLISHED = "NOT_ESTABLISHED";
export const INGESTION_TRUNCATED = "INGESTION_TRUNCATED";
export const NOT_IN_PROJECT_SCOPE = "NOT_IN_PROJECT_SCOPE";
export const NO_BEARER_SIGHTED = "NO_BEARER_SIGHTED";
export const KIND_NOT_YET_SEEDED = "KIND_NOT_YET_SEEDED";
export const NOT_IN_THIS_BILL = "NOT_IN_THIS_BILL";
export const NONE = "NONE";

/** The grains and channels. */
export const CELL = "CELL";
export const KIND = "KIND";
export const REGISTER = "REGISTER";
export const DECLARATION = "DECLARATION";

/** The codes the acts refuse by name (interfaces). */
export const ACT_CHANGES_NOTHING = "ACT_CHANGES_NOTHING";
export const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";
export const CELL_NOT_IN_RESIDUE = "CELL_NOT_IN_RESIDUE";

/** The store the declarations stand in, and its two named constraints. */
export const SCOPE_DECLARATIONS_TABLE = "scope_declarations";
export const ACTS_TABLE = "acts";

/** Every test id this screen carries, exactly as the closed test contract spells it (C-05). */
export const TESTID = Object.freeze({
  screen: "coverage-screen",
  answer: "coverage-answer",
  empty: "coverage-empty",
  retry: "coverage-retry",
  grid: "coverage-grid",
  kindRow: "coverage-kind-row",
  cell: "coverage-cell",
  glyph: "coverage-cell-glyph",
  legend: "coverage-legend",
  legendEntry: "coverage-legend-entry",
  inspector: "coverage-inspector",
  inspectorCause: "coverage-inspector-cause",
  inspectorRemedy: "coverage-inspector-remedy",
  inspectorSighting: "coverage-inspector-sighting",
  inspectorObservation: "coverage-inspector-observation",
  holdOut: "coverage-hold-out",
  declareOutOfScope: "coverage-declare-out-of-scope",
  certificate: "coverage-certificate-preview",
  statement: "coverage-statement",
  statementRow: "coverage-statement-row",
  statementNone: "coverage-statement-none",
  refusalState: "refusal-state",
  dialog: "consequence-dialog",
  dialogConfirm: "consequence-confirm",
} as const);

/**
 * How a screen-states name is spelled on `coverage-screen[data-state]` (interfaces' hook registry:
 * `loading|empty|error|refusal|partial|offline|denied|ready`). Every matrix name is its own spelling
 * but the denial, which the screen reads as `denied`.
 */
export const SCREEN_STATE_OF: Readonly<Record<string, string>> = Object.freeze({
  loading: "loading",
  empty: "empty",
  error: "error",
  refusal: "refusal",
  partial: "partial",
  offline: "offline",
  "permission-denied": "denied",
});

/* -------------------------------------------------------------------- the shapes, loosely held */

export type SightingShape = { class: string; levelId: string | null; channel: string; drawingId: string; layoutName: string; sourceKey: string };
export type LevelShape = { levelId: string; ordinal: number; label: string };
export type LineShape = { kind: string; class: string; levelId: string; lineId: string };
export type DeclarationShape = { class: string; kind: string; levelId: string; cause: string; actId: string; inForce: boolean; actResolves: boolean };
export type ObservationShape = { class: string; kind: string; levelId: string | null; rail: string; reason: string };
export type TruncatedShape = { drawingId: string; layoutName: string };
export type BearsShape = { class: string; kind: string };

export type ResidueInputShape = {
  bears: BearsShape[];
  workItems: string[];
  levels: LevelShape[];
  sightings: SightingShape[];
  lines: LineShape[];
  declarations: DeclarationShape[];
  truncated: TruncatedShape[];
  observations: ObservationShape[];
};

export type ResidueCellShape = {
  kind: string;
  class: string | null;
  levelId: string | null;
  levelLabel: string;
  levelOrdinal: number | null;
  grain: string;
  measurement: string;
  bill: string;
  contradicted: boolean;
  lineIds: string[];
  sightings: SightingShape[];
  observations: ObservationShape[];
  measurementActId: string | null;
  billActId: string | null;
};

export type StatementRowShape = { kind: string; class: string | null; levelId: string | null; levelLabel: string; levels: string; grain: string; cause: string };

export type CoverageViewShape = {
  tenantId: string;
  projectId: string;
  campaignId: string | null;
  setRevisionId: string | null;
  input: ResidueInputShape;
  cells: ResidueCellShape[];
  measurement: StatementRowShape[];
  bill: StatementRowShape[];
};

export type ResidueScopeShape = { tenantId: string; projectId: string; campaignId?: string };
export type ResidueShape = { tenantId: string; projectId: string; campaign: { campaignId: string; setRevisionId: string } | null; input: ResidueInputShape; cells: ResidueCellShape[] };

/** The residue's barrel, seen through the surface the acceptance reads (interfaces' roster). */
export type ResidueSeam = {
  resolveResidue: (input: ResidueInputShape) => ResidueCellShape[];
  residueOf: (scope: ResidueScopeShape) => Promise<ResidueShape>;
  measurementStatementOf: (cells: readonly ResidueCellShape[]) => StatementRowShape[];
  billStatementOf: (cells: readonly ResidueCellShape[]) => StatementRowShape[];
  cellRef: (cell: { kind: string; class: string | null; levelId: string | null }) => string;
  parseCellRef: (raw: string) => { kind: string; class: string | null; levelId: string | null } | null;
  registerSightings: unknown;
  partitionSightings: unknown;
  layoutSightings: unknown;
  QUANTITY_BEARING: string;
  IN_BILL: string;
  MEASUREMENT_CAUSES: readonly string[];
  BILL_CAUSES: readonly string[];
  RESIDUE_CAUSES: readonly string[];
  CELL_GRAINS: readonly string[];
  SIGHTING_CHANNELS: readonly string[];
  AXIS_IDLE_READINGS: readonly string[];
};

export function residueSeam(): Promise<ResidueSeam> {
  return productModule<ResidueSeam>(RESIDUE_MODULE);
}

/** A registered refusal, as the register holds it and as every surface reads it. */
export type RefusalEntryShape = { code: string; message: string; remedy: string; severity: string; surface: string };

export async function refusalRegister(): Promise<Readonly<Record<string, RefusalEntryShape | undefined>>> {
  const errors = await productModule<{ REFUSALS: Readonly<Record<string, RefusalEntryShape | undefined>> }>(ERRORS_MODULE);
  return errors.REFUSALS;
}

/**
 * The refusal code a failure carries, whether it arrived bare or wrapped by a transport — read out
 * of the thrown value by the product's own marker, never out of anybody's source. The name says so:
 * `codeOf` elsewhere in the suite reads a FILE, and this one reads a rejection.
 */
export async function refusalCodeCarriedBy(failure: unknown): Promise<string | null> {
  const { refusalCodeOf } = await productModule<{ refusalCodeOf: (e: unknown) => string | null }>(REFUSAL_MARKER_MODULE);
  const direct = refusalCodeOf(failure);
  if (direct !== null) return direct;
  const cause = (failure as { cause?: unknown } | null)?.cause;
  return cause === undefined ? null : refusalCodeOf(cause);
}

/** The name the held-out lane loads this stage's rejection reader under; one home, two spellings. */
export const codeOf = refusalCodeCarriedBy;

/** What a call answered, or the failure it threw — a rejection is evidence, not an abort. */
export async function rejection(pending: Promise<unknown>): Promise<unknown> {
  try {
    await pending;
    return null;
  } catch (failure) {
    return failure;
  }
}

/** The canonical order every roster on this screen is read in (shipped, `@/core/identity`). */
export async function compareCanonical(): Promise<(a: string, b: string) => number> {
  const identity = await productModule<{ compareCanonical: (a: string, b: string) => number }>(IDENTITY_MODULE);
  expect(typeof identity.compareCanonical, `${IDENTITY_MODULE} publishes compareCanonical`).toBe("function");
  return identity.compareCanonical;
}

/* ------------------------------------------------------------------------ the residue fixture */

/** The three levels of the fixture's stack, by ordinal (interfaces). */
export const GF: LevelShape = Object.freeze({ levelId: "lvl-gf", ordinal: 0, label: "GF" });
export const L1: LevelShape = Object.freeze({ levelId: "lvl-l1", ordinal: 1, label: "L1" });
export const L2: LevelShape = Object.freeze({ levelId: "lvl-l2", ordinal: 2, label: "L2" });

/** The sheet every sighting of the fixture stands on. */
export const SHEET: TruncatedShape = Object.freeze({ drawingId: "dwg-s101", layoutName: "S-101 Plan" });

/** One REGISTER sighting of a class on a level, read at its own key. */
export function sighting(klass: string, levelId: string | null, channel: string = REGISTER): SightingShape {
  return { class: klass, levelId, channel, drawingId: SHEET.drawingId, layoutName: SHEET.layoutName, sourceKey: `${SHEET.drawingId}:${klass}:${levelId ?? ""}` };
}

/**
 * THE RESIDUE FIXTURE, exactly as the increment's interfaces stage it: a column sighted on all three
 * levels, one published line and one contradicted declaration on the ground floor, a hold on the
 * bill axis, a declaration out of scope on L1, a borne kind no sighted class bears and a work item
 * no class bears at all.
 *
 * Every literal here is one the interfaces publish, so a Builder reading only the spec builds the
 * same residue.
 */
export function residueFixture(): ResidueInputShape {
  return {
    bears: [
      { class: "column", kind: "rcc.concrete" },
      { class: "column", kind: "rcc.formwork" },
      { class: "column", kind: "rcc.rebar" },
      { class: "slab", kind: "rcc.slab-concrete" },
    ],
    workItems: ["rcc.concrete", "rcc.formwork", "rcc.rebar", "rcc.slab-concrete", "rcc.waterproofing"],
    levels: [{ ...GF }, { ...L1 }, { ...L2 }],
    sightings: [sighting("column", GF.levelId), sighting("column", L1.levelId), sighting("column", L2.levelId)],
    lines: [
      { kind: "rcc.concrete", class: "column", levelId: GF.levelId, lineId: "line-1" },
      { kind: "rcc.rebar", class: "column", levelId: GF.levelId, lineId: "line-2" },
    ],
    declarations: [
      { class: "column", kind: "rcc.formwork", levelId: GF.levelId, cause: NOT_IN_THIS_BILL, actId: "act-hold-1", inForce: true, actResolves: true },
      { class: "column", kind: "rcc.rebar", levelId: L1.levelId, cause: NOT_IN_PROJECT_SCOPE, actId: "act-scope-1", inForce: true, actResolves: true },
      { class: "column", kind: "rcc.rebar", levelId: GF.levelId, cause: NOT_IN_PROJECT_SCOPE, actId: "act-scope-2", inForce: true, actResolves: true },
    ],
    truncated: [],
    observations: [{ class: "column", kind: "rcc.concrete", levelId: L1.levelId, rail: "column-concrete", reason: "NO_SECTION_MAPPED" }],
  };
}

/** The workspace's own reading over one residue input — the cells and the two statements, as the
 * module's server composes them from `@/core/residue` and nothing else (interfaces). */
export async function coverageViewFixture(input: ResidueInputShape = residueFixture()): Promise<CoverageViewShape> {
  const residue = await residueSeam();
  const cells = residue.resolveResidue(input);
  return {
    tenantId: "11111111-1111-4111-8111-111111111111",
    projectId: "22222222-2222-4222-8222-222222222222",
    campaignId: "33333333-3333-4333-8333-333333333333",
    setRevisionId: "44444444-4444-4444-8444-444444444444",
    input,
    cells,
    measurement: residue.measurementStatementOf(cells),
    bill: residue.billStatementOf(cells),
  };
}

/* --------------------------------------------------------------------------------- the mount */

/** What the route hands the presentational workspace (Design Decision §1, I-170/I-193). */
export type CoverageProps = { view: CoverageViewShape; cell?: string | null; state?: string | null };

/**
 * The props one mount is made with. A Builder whose workspace takes its reading under other names
 * edits THIS function: the suites beside it judge what the mount RENDERS, never how the route hands
 * it over.
 */
export function propsFor(o: CoverageProps): Record<string, unknown> {
  return { view: o.view, cell: o.cell ?? null, state: o.state ?? null };
}

export type Mounted = { container: HTMLElement; root: HTMLElement; unmount: () => void };

/** Mount the shipped workspace over one reading, and answer the screen root it rendered. */
export async function mountCoverage(o: CoverageProps): Promise<Mounted> {
  const module_ = await productModule<Record<string, unknown>>(COVERAGE_WORKSPACE_MODULE);
  const Workspace = module_["CoverageWorkspace"];
  expect(typeof Workspace, `${COVERAGE_WORKSPACE_MODULE} publishes CoverageWorkspace, the presentational workspace the route mounts`).toBe("function");
  const { container, unmount } = render(createElement(Workspace as FunctionComponent<Record<string, unknown>>, propsFor(o)));
  const root = container.querySelector(`[data-testid="${TESTID.screen}"]`);
  expect(root, `the mounted workspace renders ${TESTID.screen}`).not.toBeNull();
  return { container, root: root as HTMLElement, unmount };
}

/** Every element of a subtree carrying one test id, in DOM order. */
export function hooks(root: ParentNode, testid: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)];
}

/** The one element of a subtree carrying a test id, asserted to be one. */
export function hook(root: ParentNode, testid: string): HTMLElement {
  const found = hooks(root, testid);
  expect(found.length, `exactly one ${testid} stands in this subtree, and ${found.length} do`).toBe(1);
  return found[0] as HTMLElement;
}

/** One attribute of an element, as a string ("" when it carries none). */
export function attr(element: Element, name: string): string {
  return element.getAttribute(name) ?? "";
}

/** The text a person reads, whitespace-collapsed. */
export function textOf(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * THE AXIS RULE, as the interfaces settle it for every reader of a cell's code: a cell is read on
 * its bill axis when that axis has moved, and on its measurement axis otherwise.
 */
export function codeUnderAxis(cell: { measurement: string; bill: string }): string {
  return cell.bill !== IN_BILL ? cell.bill : cell.measurement;
}

/** The act shown beside that code: the bill's when the bill axis is read, else the measurement's. */
export function actUnderAxis(cell: { measurement: string; bill: string; measurementActId: string | null; billActId: string | null }): string {
  return (cell.bill !== IN_BILL ? cell.billActId : cell.measurementActId) ?? "";
}

/* ------------------------------------------------------------------------ a staged campaign */

/** A pinned campaign with one class sighted on a real level of the project's stack. */
export type StagedCoverage = {
  tenantId: string;
  projectId: string;
  campaignId: string;
  setRevisionId: string;
  scope: { tenantId: string; projectId: string; campaignId: string };
  /** The person who pinned the set — the project's principal, who holds every permission. */
  person: { userId: string; tenantId: string; email: string };
  actor: { tenantId: string; userId: string; actorKind: string };
  /** The level the staged sighting stands on, as the project's own stack holds it. */
  levelId: string;
  levelLabel: string;
  /** The class the staged sighting registered under. */
  class: string;
};

type RailsStage = {
  stageCampaign: (label: string, options: { methods?: readonly { ruleId: string; version: number }[]; objects?: number }) => Promise<Record<string, unknown>>;
  storeRows: (table: string, tenantId: string) => Record<string, unknown>[];
  field: (row: Record<string, unknown>, camel: string, snake: string) => unknown;
  closeStage: () => Promise<void>;
  COLUMN_C1: Record<string, unknown>;
  COLUMN_CLASS: string;
  RCC_CONCRETE: string;
  COLUMN_CONCRETE_PAIR: { ruleId: string; version: number };
};

type RegisterUiStage = {
  registerSeam: () => Promise<{ registerSighting: (scope: { tenantId: string; projectId: string; setRevisionId: string }, sighting: Record<string, unknown>) => Promise<Record<string, unknown>> }>;
  actorOf: (person: { userId: string; tenantId: string; email: string }) => { tenantId: string; userId: string; actorKind: string };
  stagePerson: (label: string) => Promise<{ person: { userId: string; tenantId: string; email: string }; projectId: string }>;
};

/** Where a person is put on a workspace and given a role — the roster and the role ledger the act
 * seam really reads (L-ACT-03), never a loosened guard. */
type SheetsStage = {
  grantRole: (tenantId: string, projectId: string, userId: string, role: string) => void;
  joinWorkspace: (tenantId: string, userId: string, role?: string) => void;
};

const railsStage = (): Promise<RailsStage> => import("../../rails/support/column-rail-stage") as unknown as Promise<RailsStage>;
const registerUiStage = (): Promise<RegisterUiStage> => import("../../register-ui/support/register-ui-stage") as unknown as Promise<RegisterUiStage>;
const sheetsStage = (): Promise<SheetsStage> => import("../../support/sheets-stage") as unknown as Promise<SheetsStage>;

/**
 * A campaign whose pinned revision has one column sighted on the project's ground floor — the
 * smallest staging a residue holds a CELL-grain cell for.
 *
 * Everything is the product's own: the shipped doors pin the set (which opens the campaign) and the
 * register's own door records the sighting. The level is the one the project's stack really holds,
 * so the sighting stands on a level the residue can read rather than on a surrogate.
 */
export async function stageCoverageCampaign(label: string = "coverage"): Promise<StagedCoverage> {
  const rails = await railsStage();
  const registerUi = await registerUiStage();
  const staged = await rails.stageCampaign(label, { methods: [rails.COLUMN_CONCRETE_PAIR], objects: 0 });
  const tenantId = String(staged["tenantId"]);
  const projectId = String(staged["projectId"]);

  const levels = rails.storeRows("levels", tenantId);
  expect(levels.length, `the staged project ${label} holds the level its sighting stands on`).toBeGreaterThan(0);
  const level = levels[0] as Record<string, unknown>;
  const levelId = String(rails.field(level, "levelId", "level_id"));
  const levelLabel = String(rails.field(level, "label", "label"));

  const register = await registerUi.registerSeam();
  const scope = staged["registerScope"] as { tenantId: string; projectId: string; setRevisionId: string };
  const answer = await register.registerSighting(scope, {
    ...rails.COLUMN_C1,
    elementType: rails.COLUMN_CLASS,
    label: `${label}-C1`,
    mark: "C1",
    level: { levelId },
  });
  expect(rails.field(answer, "registered", "registered"), `the staged column registered on ${levelLabel}: ${JSON.stringify(answer)}`).toBe(true);

  const person = staged["person"] as { userId: string; tenantId: string; email: string };
  return {
    tenantId,
    projectId,
    campaignId: String(staged["campaignId"]),
    setRevisionId: String(staged["setRevisionId"]),
    scope: { tenantId, projectId, campaignId: String(staged["campaignId"]) },
    person,
    actor: registerUi.actorOf(person),
    levelId,
    levelLabel,
    class: rails.COLUMN_CLASS,
  };
}

/** A second person on the staged project, holding one role and nothing else. */
export async function stageActorHolding(staged: StagedCoverage, role: string, label: string = "other"): Promise<{ tenantId: string; userId: string; actorKind: string }> {
  const registerUi = await registerUiStage();
  const sheets = await sheetsStage();
  const { person } = await registerUi.stagePerson(`${label}-${staged.projectId.slice(0, 8)}`);
  sheets.joinWorkspace(staged.tenantId, person.userId);
  sheets.grantRole(staged.tenantId, staged.projectId, person.userId, role);
  return registerUi.actorOf({ ...person, tenantId: staged.tenantId });
}

/** Every row of one table in one workspace — the acceptance's own audit read. */
export async function rowsOf(table: string, tenantId: string): Promise<Record<string, unknown>[]> {
  const rails = await railsStage();
  return rails.storeRows(table, tenantId);
}

/** One row's field, however the store spells its columns. */
export async function fieldOf(row: Record<string, unknown>, camel: string, snake: string): Promise<unknown> {
  const rails = await railsStage();
  return rails.field(row, camel, snake);
}

/** Take away whatever the staging provisioned. */
export async function closeCoverageStage(): Promise<void> {
  const rails = await railsStage();
  await rails.closeStage();
}

/* ------------------------------------------------------------------------ the acts, as input */

/** One boundary act over one cell, as the door is given one (interfaces: `BoundaryInput`). */
export function boundary(type: string, o: { projectId: string; campaignId: string; class: string; kind: string; levelId: string }): Record<string, unknown> {
  return { type, projectId: o.projectId, campaignId: o.campaignId, class: o.class, kind: o.kind, levelId: o.levelId };
}

/** The act seam, as the acceptance drives it (shipped, L-ACT-02). */
export type ActsSeam = {
  preview: (actor: unknown, input: unknown) => Promise<Record<string, unknown>>;
  commit: (actor: unknown, input: unknown, digest: string) => Promise<Record<string, unknown>>;
  consequenceDigest: (consequence: unknown) => string;
};

export function actsSeam(): Promise<ActsSeam> {
  return productModule<ActsSeam>(ACTS_MODULE);
}

/** The subjects one Consequence names. */
export function subjectsOf(consequence: Record<string, unknown>): { subjectId: string }[] {
  const subjects = consequence["subjects"];
  expect(Array.isArray(subjects), `the Consequence names its subjects: ${JSON.stringify(consequence)}`).toBe(true);
  return (subjects as Record<string, unknown>[]).map((subject) => ({ subjectId: String(subject["subjectId"]) }));
}
