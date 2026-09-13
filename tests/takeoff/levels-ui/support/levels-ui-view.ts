/**
 * The MOUNT half of the stage S-Levels is judged over (inc-302-levels-editor: R-TO-033, L-MEA-07,
 * L-ACT-02, L-QTY-02, R-UI-021, R-UI-050, docs/design/s-levels.md).
 *
 * MECHANICS ONLY — nothing here judges the product. It holds the `LevelsView` fixture builder the
 * increment's interfaces spell, the doors a mounted workspace presses (recorded, never asserted
 * here), and the mount itself. Every judgement lives in the suites beside it, so this file cannot be
 * edited into agreement with a product that does not satisfy a criterion.
 *
 * It opens no database: the levels-ui screen is a presentational workspace over one reading, and a
 * jsdom mount that reached a cluster would move this whole suite out of the unit lane.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that would read as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one the increment's goal, its interfaces,
 * its test contract or the Design Decision publishes.
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

/* --------------------------------------------------------------------- the homes the spec names */

/** The module workspace the route mounts, and the reading it renders (goal, interfaces, §7). */
export const LEVELS_UI_MODULE = "src/modules/takeoff/levels-ui/index.tsx";
export const LEVELS_UI_VIEW_MODULE = "src/modules/takeoff/levels-ui/view.ts";
export const LEVELS_UI_SERVER_MODULE = "src/modules/takeoff/levels-ui/server.ts";

/** The read-only door onto the stack the reading composes over (interfaces). */
export const LEVELS_MODULE = "src/modules/takeoff/levels/index.ts";

/** The pure core a standing, a reading key and a carry to metres have their one home in (B-17). */
export const LEVELS_CORE = "src/core/levels/index.ts";

/** The act law, the three act renderings and the effects this increment lands (ownership). */
export const ACTS_LAW_MODULE = "src/core/acts/law.ts";

/** The copy this screen renders, and the one spelling of a test id (R-SPINE-060, AM-09 §1). */
export const LEVELS_STRINGS_MODULE = "src/ui/strings/levels.ts";
export const TESTIDS_MODULE = "src/ui/testids.ts";

/** The seven-state matrix R-UI-050 makes checkable (B-19). */
export const SCREEN_STATES_MODULE = "src/ui/screen-states/index.ts";

/** The closed refusal taxonomy — a code's words have one home. */
export const ERRORS_MODULE = "src/core/errors.ts";

/* ------------------------------------------------------------- the vocabulary the spec spells */

/** The file route the screen answers at, as the screen-states matrix keys it (test contract). */
export const LEVELS_ROUTE = "/t/[tenant]/p/[project]/takeoff/levels";

/** The three act types this screen drives, and the fourth the rail's range door commits (goal). */
export const INSERT_LEVEL = "INSERT_LEVEL";
export const REPUDIATE_LEVEL = "REPUDIATE_LEVEL";
export const AUTHOR_STOREY_HEIGHT = "AUTHOR_STOREY_HEIGHT";
export const AUTHOR_TYPICAL_RANGE = "AUTHOR_TYPICAL_RANGE";

/** The permissions the doors name when the reader holds none of them (AC-3, I-247). */
export const AUTHOR_LEVEL_STACK = "AUTHOR_LEVEL_STACK";
export const AUTHOR_PROJECT_FACT = "AUTHOR_PROJECT_FACT";
export const MEASURE = "MEASURE";

/** How a storey height stands, and the code a quantity line reports its absence under (L-MEA-07). */
export const AGREED = "AGREED";
export const SUSPENDED = "SUSPENDED";
export const NONE = "NONE";
export const STOREY_HEIGHT_UNSTATED = "STOREY_HEIGHT_UNSTATED";
export const STOREY_HEIGHT_CONTESTED = "STOREY_HEIGHT_CONTESTED";

/** L-QTY-02's two coverages a roll-up may read (interfaces). */
export const COMPLETE = "COMPLETE";
export const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/** The three bases a height may be READ on, and the one barred from the roster (I-244). */
export const TRANSCRIBED = "TRANSCRIBED";
export const DERIVED = "DERIVED";
export const ENTERED = "ENTERED";
export const DEFAULTED = "DEFAULTED";

/** The code a view with no typical range is deferred under (interfaces). */
export const TYPICAL_RANGE_UNSTATED = "TYPICAL_RANGE_UNSTATED";

/** The refusals this screen's doors answer by name. */
export const ACT_CHANGES_NOTHING = "ACT_CHANGES_NOTHING";
export const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";
export const REQUEST_MALFORMED = "REQUEST_MALFORMED";

/** One kind a roll-up is read for — the kind the register stage's own lines are published under. */
export const RCC_CONCRETE = "rcc.concrete";

/**
 * Every test id this screen carries, exactly as the closed test contract spells it (C-05, AM-09 §2).
 * A suite reads a hook through this table so a spelling stands once in the acceptance too.
 */
export const TESTID = Object.freeze({
  screen: "levels-screen",
  grid: "levels-grid",
  row: "levels-row",
  rollup: "levels-rollup",
  empty: "levels-empty",
  insert: "levels-insert",
  insertLabel: "levels-insert-label",
  insertOrdinal: "levels-insert-ordinal",
  insertConfirm: "levels-insert-confirm",
  inspector: "levels-inspector",
  reading: "levels-reading",
  heightValue: "levels-height-value",
  heightUnit: "levels-height-unit",
  heightBasis: "levels-height-basis",
  heightSource: "levels-height-source",
  authorHeight: "levels-author-height",
  repudiate: "levels-repudiate",
  ranges: "levels-ranges",
  rangeRow: "levels-range-row",
  rangeFrom: "levels-range-from",
  rangeTo: "levels-range-to",
  authorRange: "levels-author-range",
  navRegister: "takeoff-nav-register",
  navCoverage: "takeoff-nav-coverage",
  navLevels: "takeoff-nav-levels",
  dialog: "consequence-dialog",
  dialogConfirm: "consequence-confirm",
  dialogDigest: "consequence-digest-line",
  dialogSubject: "consequence-subject-row",
  dialogLines: "consequence-effect-lines",
  dialogSignatures: "consequence-effect-signatures",
} as const);

/**
 * How a screen-states name is spelled on `levels-screen[data-state]` (Design Decision §2's order:
 * `loading · denied · offline · error · refused · empty · partial · ready`). Every matrix name is its
 * own spelling but the denial, which the screen reads as `denied`, and the refusal, as `refused`.
 */
export const SCREEN_STATE_OF: Readonly<Record<string, string>> = Object.freeze({
  loading: "loading",
  empty: "empty",
  error: "error",
  refusal: "refused",
  partial: "partial",
  offline: "offline",
  "permission-denied": "denied",
});

/* ---------------------------------------------------------------------- the shapes, loosely held */

export type ReadingShape = {
  readingKey: string;
  actorId: string;
  basis: string;
  sourceKey: string | null;
  valueAsWritten: string;
  unitAsWritten: string;
  canonicalMetres: string;
  superseded: boolean;
};

export type RollupShape = {
  kind: string;
  unit: string;
  lines: number;
  value: string | null;
  coverage: string;
  code: string | null;
};

export type LevelShape = {
  levelId: string;
  label: string;
  ordinal: number;
  standing: string;
  code: string | null;
  canonicalMetres: string | null;
  readings: ReadingShape[];
  rollups: RollupShape[];
};

export type RangeShape = { viewKey: string; drawingId: string; caption: string; code: string };

export type LevelsViewShape = { projectId: string; stack: LevelShape[]; unstatedRanges: RangeShape[] };

/* --------------------------------------------------------------- a reading, carried by the core */

/** One reading as a person wrote it, before the core carries it to metres and keys it. */
export type WrittenReading = { actorId?: string; basis?: string; sourceKey?: string | null; value: string; unit: string };

type LevelsCore = {
  carryToMetres: (value: string, unit: string) => { canonicalMetres: string } & Record<string, unknown>;
  readingKey: (o: { levelId: string; actorId: string; basis: string; sourceKey: string | null }) => string;
  storeyHeightStanding: (readings: readonly { readingKey: string; canonicalMetres: string }[]) => {
    standing: string;
    canonicalMetres: string | null;
    refusal: string | null;
    current: readonly { readingKey: string }[];
    superseded: readonly { readingKey: string }[];
  };
};

export async function levelsCore(): Promise<LevelsCore> {
  return productModule<LevelsCore>(LEVELS_CORE);
}

/** A surrogate id, as the store mints one — a level id is a uuid and nothing else (L-MEA-07). */
export function surrogate(seed: number): string {
  const hex = seed.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}

/**
 * One level of a view, with its standing DERIVED by the product's own core over the readings it was
 * written with — the acceptance never types a standing, a code or a figure in metres beside the rule
 * that computes them (B-19, B-17).
 */
export async function levelFixture(o: {
  levelId?: string;
  label: string;
  ordinal: number;
  readings?: readonly WrittenReading[];
  rollups?: readonly RollupShape[];
}): Promise<LevelShape> {
  const core = await levelsCore();
  const levelId = o.levelId ?? surrogate(o.ordinal + 1);
  const written = o.readings ?? [];
  const carried = written.map((reading) => {
    const basis = reading.basis ?? ENTERED;
    const actorId = reading.actorId ?? surrogate(900);
    const sourceKey = reading.sourceKey ?? null;
    return {
      readingKey: core.readingKey({ levelId, actorId, basis, sourceKey }),
      actorId,
      basis,
      sourceKey,
      valueAsWritten: reading.value,
      unitAsWritten: reading.unit,
      canonicalMetres: core.carryToMetres(reading.value, reading.unit).canonicalMetres,
    };
  });
  const standing = core.storeyHeightStanding(carried);
  const superseded = new Set(standing.superseded.map((reading) => reading.readingKey));
  return {
    levelId,
    label: o.label,
    ordinal: o.ordinal,
    standing: standing.standing,
    code: standing.refusal,
    canonicalMetres: standing.canonicalMetres,
    // Superseded is a property of the KEY, not of a row: the earlier reading under a re-affirmed key
    // is the superseded one, which is exactly what the core answers.
    readings: carried.map((reading, at) => ({
      ...reading,
      superseded: superseded.has(reading.readingKey) && carried.slice(at + 1).some((later) => later.readingKey === reading.readingKey),
    })),
    rollups: [...(o.rollups ?? [])],
  };
}

/** One roll-up cell, as `levelsViewOf` answers one over the stored lines (interfaces). */
export function rollup(o: { kind?: string; unit?: string; lines: number; value?: string | null; coverage?: string; code?: string | null }): RollupShape {
  return {
    kind: o.kind ?? RCC_CONCRETE,
    unit: o.unit ?? "m3",
    lines: o.lines,
    value: o.value ?? null,
    coverage: o.coverage ?? COMPLETE,
    code: o.code ?? null,
  };
}

/** One view of the partition whose typical range nobody has stated (interfaces). */
export function unstatedRange(o: { viewKey: string; drawingId?: string; caption?: string }): RangeShape {
  return {
    viewKey: o.viewKey,
    drawingId: o.drawingId ?? surrogate(700),
    caption: o.caption ?? o.viewKey,
    code: TYPICAL_RANGE_UNSTATED,
  };
}

/** One whole reading, as the route hands it to the workspace. */
export function viewFixture(o: { projectId?: string; stack: readonly LevelShape[]; unstatedRanges?: readonly RangeShape[] }): LevelsViewShape {
  return {
    projectId: o.projectId ?? surrogate(500),
    stack: [...o.stack],
    unstatedRanges: [...(o.unstatedRanges ?? [])],
  };
}

/* --------------------------------------------------------------------------------- the doors */

/** What a preview answers (L-ACT-02): the typed Consequence and the digest that binds it. */
export type PreviewAnswer = { consequence: Record<string, unknown>; consequenceDigest: string };

/** One call a mounted workspace made at a door, in the order it made them. */
export type DoorCall = { name: string; argument: Record<string, unknown> };

/** A recorded door bank: every preview answers `answer`, every commit answers an act id. */
export type DoorBank = {
  calls: DoorCall[];
  /** What each `preview…` answers; the default is a Consequence that moves one subject. */
  answer: PreviewAnswer;
  doors: Record<string, (argument: Record<string, unknown>) => Promise<unknown>>;
  /** The calls made at one door, in order. */
  callsTo: (name: string) => DoorCall[];
};

/** The nine doors of the test contract, as the screen presses them. */
export const DOOR_NAMES: readonly string[] = Object.freeze([
  "levels",
  "previewInsertLevel",
  "commitInsertLevel",
  "previewRepudiateLevel",
  "commitRepudiateLevel",
  "previewAuthorStoreyHeight",
  "commitAuthorStoreyHeight",
  "previewAuthorTypicalRange",
  "commitAuthorTypicalRange",
]);

/**
 * A bank of doors that record what they were asked and answer what they were told to answer. A
 * suite drives the screen and then reads the calls: what a door was asked is the act the reader
 * confirmed, and it is a fact of the screen's behaviour rather than of its source.
 */
export function doorBank(o: { actType: string; digest?: string; consequence?: Record<string, unknown>; actId?: string } = { actType: INSERT_LEVEL }): DoorBank {
  const calls: DoorCall[] = [];
  const answer: PreviewAnswer = {
    consequence: o.consequence ?? {
      actType: o.actType,
      tenantId: surrogate(400),
      projectId: surrogate(500),
      rendering: "SUBJECTS",
      subjects: [{ subjectId: surrogate(1), subjectLabel: "GF", before: [], after: ["1"] }],
      effects: { linesRederiving: [], signaturesVoiding: [] },
    },
    consequenceDigest: o.digest ?? "d".repeat(64),
  };
  const doors: Record<string, (argument: Record<string, unknown>) => Promise<unknown>> = {};
  for (const name of DOOR_NAMES) {
    doors[name] = async (argument: Record<string, unknown> = {}) => {
      calls.push({ name, argument });
      if (name === "levels") return { stack: [], unstatedRanges: [] };
      return name.startsWith("preview") ? answer : { actId: o.actId ?? surrogate(800) };
    };
  }
  return { calls, answer, doors, callsTo: (name: string) => calls.filter((call) => call.name === name) };
}

/* --------------------------------------------------------------------------------- the mount */

/** What the route hands the presentational workspace (Design Decision §1, I-243, I-247). */
export type LevelsProps = {
  view: LevelsViewShape;
  /** Which of the three permissions the reader holds, read server-side (§2's permission-denied). */
  permitted?: Partial<Record<string, boolean>>;
  offline?: boolean;
  state?: string | null;
  /** The level the reader has selected, where a suite mounts with a selection already made. */
  level?: string | null;
  doors?: DoorBank;
};

/**
 * The props one mount is made with. A Builder whose workspace takes its reading, its doors or its
 * chrome under other names — or needs the shipped primitives handed down as `chrome`, the way
 * `RegisterWorkspace` does — edits THIS function: the suites beside it judge what the mount
 * RENDERS and which door it PRESSES, never how the route hands the props over.
 */
export function propsFor(o: LevelsProps): Record<string, unknown> {
  const permitted = { [AUTHOR_LEVEL_STACK]: true, [AUTHOR_PROJECT_FACT]: true, [MEASURE]: true, ...(o.permitted ?? {}) };
  return {
    view: o.view,
    permitted,
    offline: o.offline ?? false,
    state: o.state ?? null,
    level: o.level ?? null,
    doors: (o.doors ?? doorBank({ actType: INSERT_LEVEL })).doors,
  };
}

export type Mounted = { container: HTMLElement; root: HTMLElement; unmount: () => void };

/** Mount the shipped workspace over one reading, and answer the screen root it rendered. */
export async function mountLevels(o: LevelsProps): Promise<Mounted> {
  const module_ = await productModule<Record<string, unknown>>(LEVELS_UI_MODULE);
  const Workspace = module_["LevelsWorkspace"];
  expect(typeof Workspace, `${LEVELS_UI_MODULE} publishes LevelsWorkspace, the presentational workspace the route mounts`).toBe("function");
  const { container, unmount } = render(createElement(Workspace as FunctionComponent<Record<string, unknown>>, propsFor(o)));
  const root = container.querySelector(`[data-testid="${TESTID.screen}"]`);
  expect(root, `the mounted workspace renders ${TESTID.screen}`).not.toBeNull();
  return { container, root: root as HTMLElement, unmount };
}

/* ------------------------------------------------------------------------- reading the DOM */

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
  return (element.textContent ?? "").replace(/\s+/gu, " ").trim();
}

/**
 * The text a person HEARS the screen say: the shipped primitives keep machine-readable spellings in
 * the DOM inside a technical disclosure (`[data-technical]`, hidden by CSS — see
 * src/ui/primitives/core/enum-label.tsx), and `textContent` cannot see that CSS. Reading the spoken
 * voice means dropping those subtrees, never asserting the raw value is absent from the row.
 */
export function spokenText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  for (const technical of [...copy.querySelectorAll("[data-technical]")]) technical.remove();
  return textOf(copy);
}

/**
 * The options a Select offers, whatever the primitive renders them as: the shipped Select is not a
 * native `select` (R-UI-083), so an option is read as a `listbox` option wherever it stands — in the
 * control's own subtree or in the portal the overlay primitive mounts it in.
 */
export function optionsOf(control: HTMLElement, root: ParentNode): { value: string; label: string }[] {
  const owned = control.getAttribute("aria-controls");
  const listbox =
    (owned === null ? null : (root.ownerDocument ?? document).getElementById(owned)) ??
    control.querySelector<HTMLElement>('[role="listbox"]') ??
    ((root as ParentNode & { querySelector: typeof document.querySelector }).querySelector(`[role="listbox"][data-testid="${attr(control, "data-testid")}"]`) as HTMLElement | null) ??
    control;
  const found = [...listbox.querySelectorAll<HTMLElement>('[role="option"], option')];
  return found.map((option) => ({
    value: option.getAttribute("value") ?? option.getAttribute("data-value") ?? textOf(option),
    label: textOf(option),
  }));
}

/**
 * Choose one value at a control, whatever the shipped primitive renders it as: a listbox option is
 * opened and clicked the way a reader clicks it, and a control that is in fact an input takes the
 * value as typed. A Builder whose Select opens another way edits THIS helper — the suites judge what
 * the screen then DOES with the value, never how the primitive takes it.
 */
export function chooseOption(control: HTMLElement, root: ParentNode, value: string): void {
  fireEvent.click(control);
  fireEvent.pointerDown(control);
  const scope = (root as Element).ownerDocument ?? document;
  const option = [...scope.querySelectorAll<HTMLElement>('[role="option"], option')].find(
    (candidate) => (candidate.getAttribute("value") ?? candidate.getAttribute("data-value") ?? textOf(candidate)) === value,
  );
  if (option !== undefined) {
    fireEvent.click(option);
    return;
  }
  const field_ = control.tagName.toLowerCase() === "input" || control.tagName.toLowerCase() === "select" ? control : control.querySelector<HTMLElement>("input, select");
  expect(field_, `the control offers ${value} to a reader, one way or another`).toBeTruthy();
  fireEvent.change(field_ as HTMLElement, { target: { value } });
}

/** The copy table the screen renders every string from (R-SPINE-060). */
export async function levelsStrings(): Promise<Readonly<Record<string, string>>> {
  const module_ = await productModule<Record<string, unknown>>(LEVELS_STRINGS_MODULE);
  const table = (module_["levels"] ?? module_["LEVELS"] ?? module_["default"]) as Record<string, string> | undefined;
  expect(table, `${LEVELS_STRINGS_MODULE} publishes this screen's copy table`).toBeTruthy();
  return table as Readonly<Record<string, string>>;
}
