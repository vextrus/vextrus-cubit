/**
 * The stage the M3 draft-BOQ seam is judged over (inc-311a: L-BD-08, AM-14, AM-16, R-TO-053).
 *
 * MECHANICS ONLY — nothing here judges the product. It holds the loading of the modules the
 * increment's interfaces name, the loose shapes those surfaces answer in, the level stack the
 * F-RCC6-BNBC golden's own labels build, and the mount the jsdom suites render the workspace
 * through. Every judgement lives in the suites beside it, so this file cannot be edited into
 * agreement with a product that does not satisfy a criterion.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that would read as
 * a defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so
 * this file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product SOURCE: every name below is one the increment's interfaces, its test
 * contract or docs/design/s-boq.md publishes.
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
export const REPO_ROOT: string = process.env["BUILDER_REPO_ROOT"]?.trim() || process.cwd();

/** An absolute path inside the checkout, for a file named the way the interfaces name it. */
export function inTree(relative: string): string {
  return join(REPO_ROOT, relative);
}

/** Import a product module by repo-relative path, asserting it is in the tree first. */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = inTree(relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/* ----------------------------------------------------------- the modules the interfaces name */

export const TAXONOMY_MODULE = "src/modules/takeoff/boq/taxonomy.ts";
export const RESOLVER_MODULE = "src/modules/takeoff/boq/resolver.ts";
export const NUMBERING_MODULE = "src/modules/takeoff/boq/numbering.ts";
export const EMISSION_MODULE = "src/modules/takeoff/boq/emission.ts";
export const STATES_MODULE = "src/modules/takeoff/boq/states.ts";
export const WORKSPACE_MODULE = "src/modules/takeoff/boq/workspace.tsx";
export const JOB_MODULE = "src/modules/takeoff/boq/job.ts";
export const BOQ_ROUTER_MODULE = "src/server/routers/takeoff-boq.ts";
export const BOQ_KIND_MODULE = "src/core/documents/kinds/boq-draft.ts";
export const BOQ_ERRORS_MODULE = "src/core/errors/boq.ts";
export const QUANTITY_LINES_SCHEMA_MODULE = "src/core/db/schema-quantity-lines.ts";

/** Shipped ground the acceptance reads through, never re-declares. */
export const DOCUMENTS_MODULE = "src/core/documents/index.ts";
export const DOCUMENT_STORE_MODULE = "src/core/documents/store.ts";
export const CATALOGUE_MODULE = "src/core/catalogue/catalogue.ts";
export const CLASSES_MODULE = "src/core/catalogue/classes.ts";
export const KINDS_MODULE = "src/core/catalogue/kinds.ts";
export const IDENTITY_MODULE = "src/core/identity/index.ts";
export const ERRORS_MODULE = "src/core/errors.ts";
export const SCREEN_STATES_MODULE = "src/ui/screen-states/index.ts";
export const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";
export const PRIMITIVES_CORE_MODULE = "src/ui/primitives/core/index.ts";
export const PRIMITIVES_DATA_MODULE = "src/ui/primitives/data/index.ts";
export const REFUSAL_STATE_MODULE = "src/ui/patterns/refusal-state/index.ts";
export const JOB_TIMELINE_MODULE = "src/ui/patterns/job-timeline/index.ts";

/** The matrix key the seven R-UI-050 cells are declared under (test contract). */
export const BOQ_ROUTE = "/t/[tenant]/p/[project]/takeoff/boq";

/* ------------------------------------------------------------------ the vocabulary, by name */

/** One home for the words and the payload shape; this stage adds the loading and the mount to them. */
export * from "./draft-shapes";
import type { PayloadSectionShape, PayloadShape } from "./draft-shapes";

/** The ids this screen publishes, exactly the closed test surface's spellings. */
export const TESTID = Object.freeze({
  screen: "boq-screen",
  grid: "boq-grid",
  bill: "boq-bill",
  line: "boq-line",
  subtotal: "boq-subtotal",
  export: "boq-export",
  answer: "boq-answer",
  empty: "boq-empty",
  revision: "boq-revision",
  taxonomyVersion: "boq-taxonomy-version",
  jobs: "boq-jobs",
  documentLink: "boq-document-link",
  navBoq: "takeoff-nav-boq",
  emptyState: "empty-state",
  errorState: "error-state",
  errorReport: "error-state-report",
  errorRetry: "error-state-retry",
  refusalState: "refusal-state",
  skeleton: "skeleton",
  idChip: "id-chip",
  enumLabel: "enum-label",
  unitBadge: "unit-badge",
  basisChip: "basis-chip",
  coverageChip: "coverage-chip",
  groupRow: "datatable-group-row",
  groupSubtotal: "datatable-group-subtotal",
  header: "datatable-header",
  row: "datatable-row",
} as const);

/* -------------------------------------------------------------------- the shapes, loosely held */

export type LevelShape = { levelId: string; ordinal: number; label: string };
export type PlinthBoundaryShape = { ordinal: number; basis: string; levelId: string | null };
export type BillResolutionShape = {
  bill: string;
  decidedBy: { row: string; key: string };
  reason: string | null;
  location: string | null;
  taxonomyVersion: string;
};

export type TaxonomyModule = {
  BILLS: readonly string[];
  UNCLASSIFIED: string;
  PROVISIONAL_SUM: string;
  LOCATION: string;
  UNCLASSIFIED_REASONS: readonly string[];
  PLINTH_LEVEL_LABELS: readonly string[];
  BILL_TAXONOMY: {
    version: string;
    bills: readonly string[];
    overrides: readonly { class: string; kind?: string; bill: string }[];
    groups: readonly { group: string; bill: string }[];
    divisions: readonly { division: string; bill: string }[];
  };
};

export type ResolverModule = {
  plinthBoundaryOf: (levels: readonly LevelShape[]) => PlinthBoundaryShape;
  resolveBill: (input: { class: string; kind: string; levelOrdinal: number | null }, boundary: PlinthBoundaryShape, taxonomy?: unknown) => BillResolutionShape;
};

export type NumberingModule = { numberItems: (sections: readonly PayloadSectionShape[]) => ReadonlyMap<string, string> };

/** One published line as the reading hands it over (interfaces' `BoqReading`). */
export type ReadingLineShape = {
  lineId: string;
  objectKey: string;
  class: string;
  kind: string;
  levelId: string | null;
  value: string | null;
  unit: string;
  quantityBasis: string;
  selectionBasis: string;
  coverage: string;
};
export type ReadingShape = {
  project: string;
  campaignId: string;
  setRevisionId: string;
  levels: readonly LevelShape[];
  lines: readonly ReadingLineShape[];
  coverageComplete: boolean;
};
export type EmissionModule = { boqDraftPayloadOf: (reading: ReadingShape) => PayloadShape };

export type ViewShape = {
  campaignId: string | null;
  setRevisionId: string | null;
  taxonomyVersion: string;
  coverage: string;
  payload: PayloadShape | null;
  items: ReadonlyMap<string, string>;
};

export type WorkItemShape = { description: string; dimension: string; canonicalUnit: string; documentPrecision: number };

/* --------------------------------------------------------------- the shipped ground, loaded */

export const taxonomyModule = (): Promise<TaxonomyModule> => productModule<TaxonomyModule>(TAXONOMY_MODULE);
export const resolverModule = (): Promise<ResolverModule> => productModule<ResolverModule>(RESOLVER_MODULE);
export const numberingModule = (): Promise<NumberingModule> => productModule<NumberingModule>(NUMBERING_MODULE);
export const emissionModule = (): Promise<EmissionModule> => productModule<EmissionModule>(EMISSION_MODULE);

export async function catalogue(): Promise<Readonly<Record<string, WorkItemShape>>> {
  const module_ = await productModule<{ WORK_ITEM_CATALOGUE: Readonly<Record<string, WorkItemShape>> }>(CATALOGUE_MODULE);
  return module_.WORK_ITEM_CATALOGUE;
}

export async function elementTypes(): Promise<readonly string[]> {
  const module_ = await productModule<{ ELEMENT_TYPES: readonly string[] }>(CLASSES_MODULE);
  return module_.ELEMENT_TYPES;
}

export async function kinds(): Promise<readonly string[]> {
  const module_ = await productModule<{ KINDS: readonly string[] }>(KINDS_MODULE);
  return module_.KINDS;
}

export async function compareCanonical(): Promise<(a: string, b: string) => number> {
  const identity = await productModule<{ compareCanonical: (a: string, b: string) => number }>(IDENTITY_MODULE);
  expect(typeof identity.compareCanonical, `${IDENTITY_MODULE} publishes compareCanonical`).toBe("function");
  return identity.compareCanonical;
}

/** The refusal code a rejection carries, read by the product's own marker — never out of a source. */
export async function codeOf(failure: unknown): Promise<string | null> {
  const { refusalCodeOf } = await productModule<{ refusalCodeOf: (e: unknown) => string | null }>(REFUSAL_MARKER_MODULE);
  const direct = refusalCodeOf(failure);
  if (direct !== null) return direct;
  const cause = (failure as { cause?: unknown } | null)?.cause;
  return cause === undefined ? null : refusalCodeOf(cause);
}

/** What a call answered, or the failure it threw — a rejection is evidence, not an abort. */
export async function rejection(pending: Promise<unknown>): Promise<unknown> {
  try {
    await pending;
    return null;
  } catch (failure) {
    return failure;
  }
}

/* ------------------------------------------------- the golden→product spelling map (AC-1) */

/**
 * F-RCC6-BNBC writes its classes and kinds in the generator's own upper-case words; the product's
 * rosters are `ELEMENT_TYPES` and `KINDS`. The map is DECLARED here, as AC-1 requires, so the suite
 * states what it is comparing rather than guessing at a spelling; a golden word this map does not
 * carry is a row the criterion does not run (`REBAR` until inc-309 puts the kind in `KINDS`, and
 * `WALL`, which is no element class of this product's roster).
 */
export const GOLDEN_CLASS: Readonly<Record<string, string>> = Object.freeze({
  BEAM: "beam",
  BRICK_WALL: "brick_wall",
  COLUMN: "column",
  FOOTING: "footing",
  LINTEL: "lintel",
  PILE: "pile",
  PILE_CAP: "pile_cap",
  SHEAR_WALL: "shear_wall",
  SLAB: "slab",
  STAIR: "stair",
  TIE_BEAM: "tie_beam",
});

export const GOLDEN_KIND: Readonly<Record<string, string>> = Object.freeze({
  RCC_CONCRETE: "rcc.concrete",
  FORMWORK: "rcc.formwork",
  BRICKWORK: "masonry.brickwork",
  BLINDING: "pcc.blinding",
  EXCAVATION: "earthwork.excavation",
  PILE_COUNT: "piling.bored",
  PILE_LENGTH: "piling.boring",
});

/**
 * The levels the golden's own rows stand on, as AC-1 stacks them: `GF` at ordinal 0, the three
 * sub-plinth labels the fixture names below it, and every other label above it in the order the
 * fixture's model records their elevations. Nothing is frozen — a fixture that grows a storey grows
 * the stack with it.
 */
export const SUB_PLINTH_LABELS: readonly string[] = Object.freeze(["PIT", "FDN", "PILE"]);

export function stackOf(labels: readonly string[], elevations: Readonly<Record<string, string>>): LevelShape[] {
  const below = SUB_PLINTH_LABELS.filter((label) => labels.includes(label));
  const above = labels
    .filter((label) => !SUB_PLINTH_LABELS.includes(label))
    .sort((a, b) => Number(elevations[a] ?? 0) - Number(elevations[b] ?? 0) || (a < b ? -1 : a > b ? 1 : 0));
  return [
    ...below.map((label, index) => ({ levelId: `lvl-${label}`, ordinal: -(index + 1), label })),
    ...above.map((label, index) => ({ levelId: `lvl-${label}`, ordinal: index, label })),
  ];
}

/* --------------------------------------------------------------------------------- the mount */

/** Every component the workspace is handed, assembled from the shipped homes the product law names. */
export async function shippedChrome(): Promise<Record<string, unknown>> {
  const core = await productModule<Record<string, unknown>>(PRIMITIVES_CORE_MODULE);
  const data = await productModule<Record<string, unknown>>(PRIMITIVES_DATA_MODULE);
  const refusal = await productModule<Record<string, unknown>>(REFUSAL_STATE_MODULE);
  const jobs = await productModule<Record<string, unknown>>(JOB_TIMELINE_MODULE);
  const chrome: Record<string, unknown> = {
    DataTable: data["DataTable"],
    EmptyState: core["EmptyState"],
    ErrorState: core["ErrorState"],
    RefusalState: refusal["RefusalState"],
    IdChip: core["IdChip"],
    EnumLabel: core["EnumLabel"],
    BasisChip: core["BasisChip"],
    CoverageChip: core["CoverageChip"],
    UnitBadge: core["UnitBadge"],
    Skeleton: core["Skeleton"],
    JobTimeline: jobs["JobTimeline"],
    Tooltip: core["Tooltip"],
    Button: core["Button"],
  };
  for (const [name, component] of Object.entries(chrome)) {
    expect(typeof component, `the shipped chrome publishes ${name} — the workspace is handed the product's own primitives, never a stand-in`).not.toBe("undefined");
  }
  return chrome;
}

/** What the route hands the presentational workspace (interfaces, s-coverage I-170/I-209). */
export type BoqProps = {
  view: ViewShape | null;
  state: string;
  permitted?: boolean;
  offline?: boolean;
  reportId?: string | null;
  tenantId?: string;
  projectId?: string;
  doors?: Record<string, unknown>;
};

/**
 * The props one mount is made with. A Builder whose workspace takes its reading under other names
 * edits THIS function: the suites beside it judge what the mount RENDERS, never how the route hands
 * it over.
 */
export async function propsFor(o: BoqProps): Promise<Record<string, unknown>> {
  return {
    view: o.view,
    state: o.state,
    permitted: o.permitted ?? true,
    offline: o.offline ?? false,
    reportId: o.reportId ?? null,
    tenantId: o.tenantId ?? "11111111-1111-4111-8111-111111111111",
    projectId: o.projectId ?? "22222222-2222-4222-8222-222222222222",
    chrome: await shippedChrome(),
    doors: o.doors ?? { exportDraft: async () => ({ jobId: "job-1", deduplicated: false }), refusalOf: (code: string) => code },
  };
}

export type Mounted = { container: HTMLElement; root: HTMLElement; unmount: () => void };

/** Mount the shipped workspace over one reading, and answer the screen root it rendered. */
export async function mountBoq(o: BoqProps): Promise<Mounted> {
  const module_ = await productModule<Record<string, unknown>>(WORKSPACE_MODULE);
  const Workspace = module_["BoqWorkspace"];
  expect(typeof Workspace, `${WORKSPACE_MODULE} publishes BoqWorkspace, the presentational workspace the route mounts`).toBe("function");
  const { container, unmount } = render(createElement(Workspace as FunctionComponent<Record<string, unknown>>, await propsFor(o)));
  const root = container.querySelector(`[data-testid="${TESTID.screen}"]`);
  expect(root, `the mounted workspace renders ${TESTID.screen}`).not.toBeNull();
  return { container, root: root as HTMLElement, unmount };
}

/* ----------------------------------------------------------------------------- DOM readings */

export function hooks(root: ParentNode, testid: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)];
}

export function hook(root: ParentNode, testid: string): HTMLElement {
  const found = hooks(root, testid);
  expect(found.length, `exactly one ${testid} stands in this subtree, and ${found.length} do`).toBe(1);
  return found[0] as HTMLElement;
}

export function attr(element: Element, name: string): string {
  return element.getAttribute(name) ?? "";
}

export function textOf(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}
