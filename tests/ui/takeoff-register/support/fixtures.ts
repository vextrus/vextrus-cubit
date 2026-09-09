/**
 * The stage S-Takeoff's register workspace is judged over (inc-214-register-workspace).
 *
 * `RegisterWorkspace` is the module component the Design Decision rules (docs/design/s-takeoff.md
 * I-170): its props are exactly `{ view, density, permitted, offline, chrome, doors }`, the chrome
 * is the SHIPPED Tree, DataTable, RefusalState, OfferedGroups, ConsequenceDialog, JobTimeline,
 * Skeleton, BasisChip and CoverageChip injected by the app layer, and the doors are the procedures
 * the test contract names. This stage binds the same shipped components the route binds, so what a
 * test mounts is what a reader sees.
 *
 * Product modules are loaded by absolute path through `productModule`, so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that would read as a
 * defect in the acceptance.
 *
 * Nothing here reads product source. Every name below is one the increment's interfaces, its test
 * contract or the committed Design Decision publishes.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. The fixtures are declared once, here, and every expectation is
 * DERIVED from them by the suite that asserts it (B-19); keep it free of judgement so neither lane
 * can hide one in it.
 *
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`.
 */
import { cleanup, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type FunctionComponent } from "react";
import { expect } from "vitest";
import { productModule } from "../../../server/support/wire";

// Re-exported so a suite that loads this stage by absolute path — the held-out set does — reaches
// the same mount, the same cleanup and the same driver without resolving a package of its own.
export { cleanup, productModule, userEvent, within };

/* ------------------------------------------------------------------ the homes the spec names */

/** The mountable workspace (goal: `src/modules/takeoff/register-ui`). */
export const REGISTER_UI_MODULE = "src/modules/takeoff/register-ui";

/** The screen's copy, keyed `takeoff_register_…` (Decision §3, test contract). */
export const TAKEOFF_STRINGS_MODULE = "src/ui/strings/takeoff.ts";

/** The one string barrel every screen's copy is spread into, and the `{slot}` filler beside it. */
export const STRINGS_MODULE = "src/ui/strings/index.ts";

/** The closed refusal taxonomy — the one home of a code's message and remedy (R-UI-020). */
export const ERRORS_MODULE = "src/core/errors.ts";

/** The kinds a quantity line may be published under, read off the catalogue rather than transcribed. */
export const KINDS_MODULE = "src/core/catalogue/kinds.ts";

/** The shipped chrome, by the barrels that publish it (I-170, B-17: never re-implemented here). */
export const CHROME_BARRELS: readonly string[] = [
  "src/ui/primitives/data/index.ts",
  "src/ui/primitives/core/index.ts",
  "src/ui/patterns/refusal-state/index.ts",
  "src/ui/patterns/offered-group/index.ts",
  "src/ui/patterns/consequence-dialog/index.ts",
  "src/ui/patterns/job-timeline/index.ts",
];

/** The nine renderers the workspace is handed (Decision I-170). */
export const CHROME_NAMES: readonly string[] = ["Tree", "DataTable", "RefusalState", "OfferedGroups", "ConsequenceDialog", "JobTimeline", "Skeleton", "BasisChip", "CoverageChip"];

/* --------------------------------------------------------------------- the fixture identities */

/** The workspace, project, campaign and pinned revision every mount stands in (B-19: one identity). */
export const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const PROJECT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const CAMPAIGN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const SET_REVISION = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const DRAWING = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const INGEST = "ffffffff-ffff-4fff-8fff-ffffffffffff";

/** The addresses this screen links, spelled as the test contract spells them. */
export const drawingsRoute = (tenantId: string = TENANT, projectId: string = PROJECT): string => `/t/${tenantId}/p/${projectId}/drawings`;
export const setsRoute = (tenantId: string = TENANT, projectId: string = PROJECT): string => `/t/${tenantId}/p/${projectId}/drawings/sets`;

/** The discipline, level and class the staged corpus stands on (AC-2). */
export const DISCIPLINE = "STRUCTURAL";
export const LEVEL_GF = "GF";
export const LEVEL_1F = "1F";
export const CLASS_COLUMN = "column";
export const CLASS_BEAM = "beam";

/** The two refusal codes this screen shows; both are already registered (scope: no new codes). */
export const INTERPRETED_UNCORROBORATED = "INTERPRETED_UNCORROBORATED";
export const DUPLICATE_IDENTITY = "DUPLICATE_IDENTITY";

/** The code a preview rejects a reading that is no number with (interfaces, AC-4). */
export const READING_NOT_NUMERIC = "READING_NOT_NUMERIC";

/** The code the Measure door answers a project with no campaign with (AC-8). */
export const CAMPAIGN_NOT_FOUND = "CAMPAIGN_NOT_FOUND";

/** The rosters a line's own columns are drawn from (src/core/offers/law.ts). */
export const MEASURED = "MEASURED";
export const INTERPRETED = "INTERPRETED";
export const COMPLETE = "COMPLETE";
export const PARTIAL_DECLARED = "PARTIAL_DECLARED";
export const VECTOR = "VECTOR";

/* ------------------------------------------------------------- what the screen is handed, typed */

/** A component of the product, as this stage mounts one. */
export type Mountable = (props: Record<string, unknown>) => unknown;

/** One reading of one attribute, as the view answers one (`competing`, `overruled`). */
export interface ViewReading {
  observationId: string;
  valueAsWritten: string;
  unitAsWritten: string;
  basis: string;
  precedence: number;
  sourceKey: string;
}

/** One attribute of an object, as the view answers one (test contract). */
export interface ViewAttribute {
  attribute: string;
  standing: string;
  canonicalValue?: string | null;
  canonicalUnit?: string | null;
  competing: ViewReading[];
  overruled: ViewReading[];
}

/** One register object, as the view answers one (test contract). */
export interface ViewObject {
  objectKey: string;
  discipline: string;
  level: string;
  class: string;
  mark: string;
  basis: string;
  role: string;
  corroboration: string;
  sourceKey: string;
  attributes: ViewAttribute[];
}

/** What one variable of a formula was read as — the `bindings` a published line carries. */
export interface ViewBinding {
  value: string;
  unit: string;
  basis: string;
  source: string;
  canonical: { value: string; unit: string };
}

/** One quantity line, as the view answers one (test contract). */
export interface ViewLine {
  lineId: string;
  objectKey: string;
  kind: string;
  class: string;
  level: string;
  value: string | null;
  unit: string;
  formula: string;
  variables: Record<string, ViewBinding>;
  quantityBasis: string;
  selectionBasis: string;
  coverage: string;
  calibrationKeys: string[];
  engine: string;
  sourceKey: string;
  repudiated: boolean;
}

/** One sighting that produced no line: a queue item or a refused sighting (test contract). */
export interface ViewRefusal {
  code: string;
  objectKey: string;
  kind: string | null;
}

/** One offered level stack, keyed on the fact judged (R-UI-023, test contract). */
export interface ViewLevelStack {
  key: { kind: "PROPOSED_LEVEL_STACK"; drawingId: string; ingestId: string };
  label: string;
  count: number;
  levels: { label: string; ordinal: number }[];
}

/** `RegisterView` (test contract) — the whole reading, in one prop. */
export interface RegisterViewLike {
  tenantId: string;
  projectId: string;
  campaign: { campaignId: string; setRevisionId: string } | null;
  objects: ViewObject[];
  lines: ViewLine[];
  refusals: ViewRefusal[];
  levelStacks: ViewLevelStack[];
}

/* --------------------------------------------------------------------- the fixtures, declared once */

/** The object key one mark stands under — opaque to this screen, and carried whole (I-26). */
export function objectKeyOf(mark: string, level: string = LEVEL_GF): string {
  return `PLAN|S-101:t:12|${mark}|${level}`;
}

/** The source key one object was read at — cited as text here; the Trace is inc-215's. */
export function sourceKeyOf(mark: string): string {
  return `S-101:t:${mark}`;
}

/** One attribute of an object, with no reading recorded against it unless the caller states some. */
export function anAttribute(over: Partial<ViewAttribute> = {}): ViewAttribute {
  return { attribute: "size", standing: "NONE", canonicalValue: null, canonicalUnit: null, competing: [], overruled: [], ...over };
}

/** One reading of an attribute, as a person or a transcription recorded it. */
export function aReading(over: Partial<ViewReading> = {}): ViewReading {
  return { observationId: `obs-${over.precedence ?? 0}-${over.valueAsWritten ?? "300"}`, valueAsWritten: "300", unitAsWritten: "mm", basis: "TRANSCRIBED", precedence: 0, sourceKey: sourceKeyOf("C1"), ...over };
}

/** One register object of the staged campaign. */
export function anObject(over: Partial<ViewObject> = {}): ViewObject {
  const mark = over.mark ?? "C1";
  const level = over.level ?? LEVEL_GF;
  return {
    objectKey: objectKeyOf(mark, level),
    discipline: DISCIPLINE,
    level,
    class: CLASS_COLUMN,
    mark,
    basis: MEASURED,
    role: MEASURED,
    corroboration: "NONE",
    sourceKey: sourceKeyOf(mark),
    attributes: [anAttribute()],
    ...over,
  };
}

/**
 * What one variable of a line's formula was read as. The as-written reading and the canonical one
 * agree on purpose: what the variables cell states is then the one pair `name=value unit` whichever
 * of the two a renderer reads, so the criterion measures the RENDERING and never a conversion.
 */
export function aBinding(value: string, unit: string, basis: string = MEASURED): ViewBinding {
  return { value, unit, basis, source: "S-101:e:41", canonical: { value, unit } };
}

/** One published quantity line of the staged campaign. */
export function aLine(over: Partial<ViewLine> = {}): ViewLine {
  const mark = "C1";
  return {
    lineId: `line-${mark}`,
    objectKey: objectKeyOf(mark),
    kind: "rcc.concrete",
    class: CLASS_COLUMN,
    level: LEVEL_GF,
    value: "0.27",
    unit: "m3",
    formula: "length × breadth × height",
    variables: { length: aBinding("0.3", "m"), breadth: aBinding("0.3", "m"), height: aBinding("3", "m") },
    quantityBasis: MEASURED,
    selectionBasis: MEASURED,
    coverage: COMPLETE,
    calibrationKeys: ["S-101:PLAN:scale"],
    engine: VECTOR,
    sourceKey: sourceKeyOf(mark),
    repudiated: false,
    ...over,
  };
}

/** The whole view, with every region answering and any region the caller wants otherwise. */
export function aView(over: Partial<RegisterViewLike> = {}): RegisterViewLike {
  return {
    tenantId: TENANT,
    projectId: PROJECT,
    campaign: { campaignId: CAMPAIGN, setRevisionId: SET_REVISION },
    objects: [],
    lines: [],
    refusals: [],
    levelStacks: [],
    ...over,
  };
}

/**
 * AC-2's corpus: three STRUCTURAL `column` objects marked C1, C2 and C3 on level `GF`, each with one
 * `rcc.concrete` line of quantityBasis MEASURED, engine VECTOR and coverage COMPLETE.
 */
export const REGISTER_MARKS: readonly string[] = ["C1", "C2", "C3"];

export function registerFixture(): RegisterViewLike {
  const objects = REGISTER_MARKS.map((mark) => anObject({ mark }));
  const lines = REGISTER_MARKS.map((mark, at) =>
    aLine({
      lineId: `line-${mark}`,
      objectKey: objectKeyOf(mark),
      sourceKey: sourceKeyOf(mark),
      value: `0.2${at + 5}`,
      calibrationKeys: ["S-101:PLAN:scale", `S-101:${mark}:probe`],
    }),
  );
  return aView({ objects, lines });
}

/**
 * AC-3's corpus: `n` lines spread over two classes, two levels, two bases and two coverages, each
 * line standing on an object of the same class and level — so a filter narrows the table to a set a
 * criterion can recompute from this fixture rather than transcribe (B-19).
 *
 * The kinds are the catalogue's own roster: a kind added later spreads this fixture over it too.
 */
export function linesFixture(n: number, kinds: readonly string[] = ["rcc.concrete"]): RegisterViewLike {
  const classes = [CLASS_COLUMN, CLASS_BEAM];
  const levels = [LEVEL_GF, LEVEL_1F];
  const bases = [MEASURED, INTERPRETED];
  const coverages = [COMPLETE, PARTIAL_DECLARED];

  const objects: ViewObject[] = [];
  for (const cls of classes) {
    for (const level of levels) {
      const mark = `${cls === CLASS_COLUMN ? "C" : "B"}-${level}`;
      objects.push(anObject({ mark, level, class: cls, objectKey: objectKeyOf(mark, level) }));
    }
  }

  const lines: ViewLine[] = Array.from({ length: n }, (_, at) => {
    const cls = classes[at % classes.length] as string;
    const level = levels[Math.floor(at / classes.length) % levels.length] as string;
    const basis = bases[Math.floor(at / (classes.length * levels.length)) % bases.length] as string;
    const coverage = coverages[Math.floor(at / (classes.length * levels.length * bases.length)) % coverages.length] as string;
    const mark = `${cls === CLASS_COLUMN ? "C" : "B"}-${level}`;
    return aLine({
      lineId: `line-${at}`,
      objectKey: objectKeyOf(mark, level),
      kind: kinds[at % kinds.length] as string,
      class: cls,
      level,
      quantityBasis: basis,
      selectionBasis: basis,
      coverage,
      // L-QTY-02, honoured by the fixture: a row kept with no quantity carries none, never a zero.
      value: coverage === COMPLETE ? `0.${(at % 89) + 10}` : null,
      sourceKey: sourceKeyOf(mark),
    });
  });

  return aView({ objects, lines });
}

/**
 * AC-4's corpus: one queue item of cause INTERPRETED_UNCORROBORATED and one refused sighting of
 * refusal DUPLICATE_IDENTITY, beside two published lines — the partial cell, rendered and not hidden.
 */
export function refusalsFixture(): RegisterViewLike {
  const marks = ["C1", "C2"];
  const objects = [...marks, "C4", "C5"].map((mark) => anObject({ mark }));
  const lines = marks.map((mark) => aLine({ lineId: `line-${mark}`, objectKey: objectKeyOf(mark), sourceKey: sourceKeyOf(mark) }));
  const refusals: ViewRefusal[] = [
    { code: INTERPRETED_UNCORROBORATED, objectKey: objectKeyOf("C4"), kind: "rcc.concrete" },
    { code: DUPLICATE_IDENTITY, objectKey: objectKeyOf("C5"), kind: null },
  ];
  return aView({ objects, lines, refusals });
}

/** AC-8's corpus: one offered level stack of three levels, keyed on the drawing it was read from. */
export function levelStackFixture(levels: number = 3): RegisterViewLike {
  const view = registerFixture();
  return {
    ...view,
    levelStacks: [
      {
        key: { kind: "PROPOSED_LEVEL_STACK", drawingId: DRAWING, ingestId: INGEST },
        label: "S-101",
        count: levels,
        levels: Array.from({ length: levels }, (_, at) => ({ label: at === 0 ? LEVEL_GF : `${at}F`, ordinal: at })),
      },
    ],
  };
}

/* -------------------------------------------------------------------------------- the loaders */

/** The workspace itself, by the export the increment's interfaces name. */
export async function registerWorkspace(): Promise<Mountable> {
  const module = await productModule<Record<string, unknown>>(REGISTER_UI_MODULE);
  expect(typeof module["RegisterWorkspace"], `${REGISTER_UI_MODULE} publishes \`RegisterWorkspace\` (goal, Decision I-170)`).toBe("function");
  return module["RegisterWorkspace"] as Mountable;
}

/** The nine shipped renderers the app layer injects, loaded from the barrels that publish them. */
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

/**
 * The screen's copy, found by the keys the Design Decision §3 fixes rather than by the export's
 * name — a table is a table whatever it is called.
 */
export async function takeoffStrings(): Promise<Record<string, string>> {
  const module = await productModule<Record<string, unknown>>(TAKEOFF_STRINGS_MODULE);
  for (const value of Object.values(module)) {
    if (value !== null && typeof value === "object" && "takeoff_register_lines_count" in (value as Record<string, unknown>)) {
      return value as Record<string, string>;
    }
  }
  throw new Error(`${TAKEOFF_STRINGS_MODULE} publishes no table carrying the keys the Design Decision §3 fixes (takeoff_register_…)`);
}

/** One key of that table, asserted present before it is used as an expectation. */
export function copy(table: Record<string, string>, key: string): string {
  const said = table[key];
  expect(typeof said, `the screen's string table states \`${key}\` (docs/design/s-takeoff.md §3)`).toBe("string");
  return said as string;
}

/** The one barrel every module's copy is spread into, and the `{slot}` filler beside it (B-17). */
export interface StringsSeam {
  strings: Record<string, string>;
  fill: (template: string, values: Readonly<Record<string, string>>) => string;
}

export async function stringsSeam(): Promise<StringsSeam> {
  const module = await productModule<Record<string, unknown>>(STRINGS_MODULE);
  expect(typeof module["fill"], `${STRINGS_MODULE} publishes \`fill\` — the one home of the slot filler a template is closed with`).toBe("function");
  expect(module["strings"], `${STRINGS_MODULE} publishes \`strings\` — the one barrel a screen's copy is read from`).toBeTypeOf("object");
  return module as unknown as StringsSeam;
}

export interface RefusalEntryShape {
  code: string;
  message: string;
  remedy: string;
  severity: string;
  surface: string;
}

/** The register, read from its one home so nothing here re-spells a code's words (ARCH-02, B-17). */
export async function refusalRegister(): Promise<Readonly<Record<string, RefusalEntryShape | undefined>>> {
  const errors = await productModule<{ REFUSALS: Readonly<Record<string, RefusalEntryShape | undefined>> }>(ERRORS_MODULE);
  return errors.REFUSALS;
}

/** Every registered code, so "no code is spelled outside a refusal-state" is asked of all of them. */
export async function refusalCodes(): Promise<string[]> {
  const register = await refusalRegister();
  return Object.values(register).flatMap((entry) => (entry === undefined ? [] : [entry.code]));
}

/** The kinds a line may be published under, read off the catalogue (B-19: never transcribed). */
export async function kinds(): Promise<string[]> {
  const module = await productModule<{ KINDS?: readonly string[] }>(KINDS_MODULE);
  expect(Array.isArray(module.KINDS), `${KINDS_MODULE} publishes \`KINDS\` — the closed roster a line's kind is drawn from`).toBe(true);
  return [...(module.KINDS as readonly string[])];
}

/* --------------------------------------------------------------------------------- the doors */

/** One call at a door, as this stage records it. */
export interface DoorCall {
  door: string;
  argument: unknown;
}

/** What a preview answers (L-ACT-02): the Consequence and the digest of it. */
export function aConsequence(actType: string, subjects: { subjectId: string; before: string[]; after: string[] }[]): { consequence: Record<string, unknown>; consequenceDigest: string } {
  return {
    consequence: { actType, tenantId: TENANT, projectId: PROJECT, rendering: "SUBJECTS", subjects },
    consequenceDigest: `digest-${actType}-${subjects.length}`,
  };
}

/** A door that answers, and one that rejects with a registered code — both recorded by name. */
export interface StagedDoors {
  calls: DoorCall[];
  doors: Record<string, unknown>;
}

/**
 * The doors the workspace is handed (I-170: "the six procedures plus `refusalOf`"), each recording
 * what it was called with. A door named in `rejecting` throws a rejection carrying that registered
 * code, which is how a preview's own refusal reaches the screen.
 */
export async function stagedDoors(rejecting: Readonly<Record<string, string>> = {}): Promise<StagedDoors> {
  const register = await refusalRegister();
  const calls: DoorCall[] = [];
  const names = ["previewCorroborate", "commitCorroborate", "previewRepudiate", "commitRepudiate", "previewInsertLevel", "commitInsertLevel", "requestMeasure"];
  const doors: Record<string, unknown> = {
    refusalOf: (code: string) => register[code],
  };
  for (const name of names) {
    doors[name] = async (argument: unknown): Promise<unknown> => {
      calls.push({ door: name, argument });
      const code = rejecting[name];
      if (code !== undefined) throw Object.assign(new Error(code), { refusalCode: code });
      if (name.startsWith("preview")) return aConsequence(name.replace("preview", "").toUpperCase(), [{ subjectId: objectKeyOf("C1"), before: ["NONE"], after: ["AGREED"] }]);
      if (name === "requestMeasure") return { requested: true, jobId: "job-1", deduplicated: false };
      return { actId: "act-1" };
    };
  }
  return { calls, doors };
}

/* --------------------------------------------------------------------------------- the mount */

/** What a mount may be varied by, beyond the view itself (Decision I-170's prop list). */
export interface MountOptions {
  density?: string;
  permitted?: boolean;
  offline?: boolean;
  doors?: Record<string, unknown>;
}

/** Mount the workspace over one view and hand back its own root (`register-workspace`). */
export async function mountRegister(view: RegisterViewLike, over: MountOptions = {}): Promise<HTMLElement> {
  const component = await registerWorkspace();
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
  const root = container.querySelector('[data-testid="register-workspace"]');
  expect(root, "RegisterWorkspace renders its root `register-workspace` (test contract)").not.toBeNull();
  return root as HTMLElement;
}

/* ------------------------------------------------------------------------------ reading a mount */

/** Every element carrying a contract test id, in document order. */
export function all(root: HTMLElement, testId: string): HTMLElement[] {
  return [...root.querySelectorAll(`[data-testid="${testId}"]`)] as HTMLElement[];
}

/** The one element carrying a contract test id — asserted to be exactly one. */
export function one(root: HTMLElement, testId: string): HTMLElement {
  const found = all(root, testId);
  expect(found.length, `the screen renders exactly one \`${testId}\``).toBe(1);
  return found[0] as HTMLElement;
}

/** The text a region states, whitespace-normalised the way a reader sees it. */
export function text(node: Element | null): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * The rows of the lines table: a `role="row"` that carries cells rather than column headers. The
 * primitive's own roles are read (I-171), never a class of this screen's.
 */
export function lineRows(root: HTMLElement): HTMLElement[] {
  const lines = one(root, "register-lines");
  return ([...lines.querySelectorAll('[role="row"]')] as HTMLElement[]).filter((row) => row.querySelector('[role="columnheader"]') === null);
}

/** The column headers of the lines table, in the order the reader meets them. */
export function lineHeaders(root: HTMLElement): string[] {
  const lines = one(root, "register-lines");
  return ([...lines.querySelectorAll('[role="columnheader"]')] as HTMLElement[]).map((cell) => text(cell));
}

/** The cells of one row, in order. */
export function cellsOf(row: HTMLElement): string[] {
  return ([...row.querySelectorAll('[role="cell"]')] as HTMLElement[]).map((cell) => text(cell));
}

/** The treeitems of the tree, by their labels — the tree's own role, one wrapper deeper (I-171). */
export function treeItems(root: HTMLElement): HTMLElement[] {
  const tree = one(root, "register-tree");
  return [...tree.querySelectorAll('[role="treeitem"]')] as HTMLElement[];
}

/** The one treeitem whose label reads exactly this, asserted to be exactly one. */
export function treeItem(root: HTMLElement, label: string): HTMLElement {
  const found = treeItems(root).filter((item) => text(item).split("\n")[0]?.trim() === label || item.getAttribute("aria-label") === label || firstLineOf(item) === label);
  expect(found.length, `exactly one treeitem is labelled \`${label}\` (AC-2)`).toBe(1);
  return found[0] as HTMLElement;
}

/** A branch treeitem states its own label before its children's: the first text it owns directly. */
export function firstLineOf(item: HTMLElement): string {
  const own = [...item.childNodes]
    .filter((node) => node.nodeType === 3 || (node instanceof HTMLElement && node.getAttribute("role") !== "treeitem" && node.querySelector('[role="treeitem"]') === null))
    .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter((said) => said.length > 0);
  return own.join(" ").trim();
}

/** Every text node under a region, as the reader meets them — what "spells a code" is asked of. */
export function textNodesUnder(root: HTMLElement, exclude: (node: HTMLElement) => boolean): string[] {
  const said: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === 3) {
      const value = (node.textContent ?? "").trim();
      if (value.length > 0) said.push(value);
      return;
    }
    if (node instanceof HTMLElement && exclude(node)) return;
    for (const child of node.childNodes) walk(child);
  };
  walk(root);
  return said;
}
