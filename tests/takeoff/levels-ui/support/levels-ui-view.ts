/**
 * The MOUNT half of the stage S-Levels is judged over (inc-302-levels-editor: R-TO-033, L-MEA-07,
 * L-ACT-02, L-QTY-02, R-UI-021, R-UI-050, docs/design/s-levels.md).
 *
 * MECHANICS ONLY — nothing here judges the product. It holds the `LevelsView` fixture builder the
 * increment's interfaces spell, the doors a mounted workspace presses (recorded, never asserted
 * here), the chrome the route hands the workspace down (ARCH-01: a module may not reach `src/ui`),
 * the lane's own frame the screen stands in, and the mount itself. Every judgement lives in the
 * suites beside it, so this file cannot be edited into agreement with a product that does not
 * satisfy a criterion: what it cannot supply it THROWS over, and what it supplies it never grades.
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
import { createElement, type FunctionComponent, type ReactNode } from "react";
// The address the router would be at, handed to the hook the lane's row reads it through
// (`usePathname`). A jsdom mount has no router around it, so the one context that answers it is
// supplied here — nothing else of Next is staged, and no assertion is made about the router itself.
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect } from "vitest";
// jsdom performs no layout, so the shipped DataTable's virtualiser renders no row at all unless its
// scroll container is given a measurable box. The stubs are the primitive's own (inc-005's support,
// keyed on `datatable-viewport`), installed here and never written a second time beside them (B-17).
import { installDomStubs } from "../../../ui/primitives-overlay-data/support/render";

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

/**
 * THE LANE THE SCREEN STANDS IN. The takeoff tabs row is drawn by the lane's own layout, into the
 * frame's tool track, above whichever surface a reader is standing on — no screen draws it and no
 * screen may. A jsdom mount has no frame around it, so the mount here stands the workspace where the
 * route stands it: inside the lane's layout, with the track the row mounts into and the address the
 * router would be at. What a suite then reads of the row — its entries, their labels, their
 * addresses, which of them is current — is the product's own and nothing of this file's.
 */
export const TAKEOFF_LAYOUT_MODULE = "src/app/(app)/t/[tenant]/p/[project]/takeoff/layout.tsx";
export const TAKEOFF_NAV_MODULE = "src/app/(app)/t/[tenant]/p/[project]/takeoff/nav.tsx";
export const SHELL_SLOTS_MODULE = "src/ui/shell/slots.tsx";

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

/** The one workspace every mount stands in, so an address is BUILT from identities, never transcribed. */
export const TENANT = surrogate(400);

/**
 * This screen's address, spelled exactly as the test contract's route spells it — independently of
 * the product's own route builder, so a row linking somewhere else cannot agree with itself into a
 * current tab (B-12: the literal the reading needs is the contract's, not the tree's).
 */
export const levelsAddress = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/levels`;

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

/* ------------------------------------------------------------------------- the shipped chrome */

/**
 * THE CHROME A ROUTE HANDS DOWN (ARCH-01, B-17, I-170). `src/modules` may not import `src/ui`, and a
 * screen may not re-implement a shipped primitive, so the workspace is handed its renderers, its two
 * mounts and the ids it publishes by the one file that may reach both trees. A mount here stands
 * where that file stands: it loads the SAME barrels — never a copy of a primitive, never a second
 * spelling of an id — so what the suites read is the shipped DataTable and the shipped Select.
 *
 * These are the barrels `tests/ui/takeoff-register/support/fixtures.ts` names for the register's own
 * hand-down, and the overlay barrel beside them, which is where the Popover ships from.
 */
export const CHROME_BARRELS: readonly string[] = Object.freeze([
  "src/ui/primitives/data/index.ts",
  "src/ui/primitives/core/index.ts",
  "src/ui/primitives/overlay/index.ts",
  "src/ui/patterns/refusal-state/index.ts",
  "src/ui/patterns/consequence-dialog/index.ts",
  // One RULE travels with the renderers, because a rule is not a component and the barrel publishes
  // components: the humanising EnumLabel says a SCREAMING value by. The table's own file stands
  // beside it for the same reason the register's stage names it.
  "src/ui/primitives/core/enum-label.tsx",
  "src/ui/primitives/data/data-table.tsx",
]);

/** Every renderer and rule the workspace is handed, each loaded from the barrel that ships it. */
export const CHROME_NAMES: readonly string[] = Object.freeze([
  "DataTable",
  "RefusalState",
  "ConsequenceDialog",
  "EmptyState",
  "Button",
  "Input",
  "NumberInput",
  "Select",
  "Skeleton",
  "IdChip",
  "EnumLabel",
  "BasisChip",
  "CoverageChip",
  "QuantityText",
  "UnitBadge",
  "Tooltip",
  "Popover",
  "PopoverTrigger",
  "PopoverContent",
  "humaniseEnum",
]);

/**
 * THE TWO MOUNTS (Design Direction 00 §3.2): the lane's tabs row and the frame's ONE inspector are
 * filled through hooks the app layer calls, so the workspace is handed a component for each.
 *
 * `TabsAside` is the route's own — `useTakeoffTabsAside`, the lane's slot — because the mount here
 * stands inside the lane's real row (see `inLane`), so the aside lands where a reader sees it.
 * `InspectorMount` renders in place, as the register's stage renders it: the frame's right column is
 * the shell's, not the lane's, and what a suite reads in place is exactly the node the route hands
 * the frame.
 */
export const MOUNT_NAMES: readonly string[] = Object.freeze(["TabsAside", "InspectorMount"]);

/**
 * The ids this screen publishes, read from the ONE registry (AM-09 §1). A module may not import it,
 * so they arrive as chrome exactly as the renderers do — and a suite that asserts on a spelling reads
 * the contract's own table beside this one, so a registry that disagreed with the contract is caught
 * there rather than agreed with here.
 */
export async function levelsTestIds(): Promise<Record<string, string>> {
  const module_ = await productModule<{ TESTIDS?: Record<string, Record<string, string> | undefined> }>(TESTIDS_MODULE);
  const group = module_.TESTIDS?.["levels"];
  return { ...staged(group, `${TESTIDS_MODULE} publishes \`TESTIDS.levels\` — this screen's group in the one registry (AM-09 §1)`) };
}

/**
 * A MECHANICAL precondition of the stage — what a mount needs in order to stand at all. It throws
 * rather than asserting, because nothing here grades the product: an assertion in this file would be
 * a judgement hidden behind the suites, and a stage that cannot stand is a broken stage.
 */
function staged<T>(value: T | undefined | null, said: string): T {
  if (value === undefined || value === null) throw new Error(`the stage cannot mount the workspace: ${said}`);
  return value;
}

/** The same, for a callable the stage hands over or calls. */
function stagedFunction<T>(value: unknown, said: string): T {
  if (typeof value !== "function") throw new Error(`the stage cannot mount the workspace: ${said}`);
  return value as T;
}

/** The shipped renderers, the two mounts and the registry's ids, as one `chrome` the workspace takes. */
export async function levelsChrome(): Promise<Record<string, unknown>> {
  const held: Record<string, unknown> = {};
  for (const barrel of CHROME_BARRELS) {
    const module_ = await productModule<Record<string, unknown>>(barrel);
    for (const [name, value] of Object.entries(module_)) held[name] ??= value;
  }
  const bound: Record<string, unknown> = {};
  for (const name of CHROME_NAMES) {
    bound[name] = stagedFunction(
      held[name],
      `the shipped \`${name}\` is published by one of ${CHROME_BARRELS.join(", ")} — the workspace is handed it, never a copy (B-17, I-170)`,
    );
  }
  // The lane's slot is the lane's own hook, so the one primary stands in the row a reader presses it
  // in; the inspector renders where it stands, the frame's column being no part of the lane.
  const nav = await productModule<{ useTakeoffTabsAside?: (node: ReactNode) => void }>(TAKEOFF_NAV_MODULE);
  const fill = stagedFunction<(node: ReactNode) => void>(nav.useTakeoffTabsAside, `${TAKEOFF_NAV_MODULE} publishes \`useTakeoffTabsAside\` — the lane's tabs-row slot (I-246)`);
  bound["TabsAside"] = ({ children }: { children?: ReactNode }) => {
    fill(children ?? null);
    return null;
  };
  bound["InspectorMount"] = ({ children }: { children?: ReactNode }) => children ?? null;
  bound["testIds"] = await levelsTestIds();
  return bound;
}

/**
 * The workspace, standing where the route stands it: inside the takeoff lane's own layout, at this
 * screen's address, with the shell tool track the lane's row mounts itself into.
 *
 * The layout is the product's — it is called with this mount's identities and its element rendered —
 * so the row's entries, their labels, their addresses and which of them is current are all read off
 * the lane and never written here. The two things a browser would have supplied are supplied: the
 * track a row drawn as chrome is drawn in, and the address the router is at.
 */
async function inLane(workspace: ReactNode, projectId: string): Promise<ReactNode> {
  type LaneLayout = (o: { children: ReactNode; params: Promise<{ tenant: string; project: string }> }) => Promise<ReactNode>;
  const layout = await productModule<{ default?: LaneLayout }>(TAKEOFF_LAYOUT_MODULE);
  const drawLane = stagedFunction<LaneLayout>(layout.default, `${TAKEOFF_LAYOUT_MODULE} is the lane's layout — the one home of the tabs row (Direction §3.2)`);
  const slots = await productModule<{
    ShellSlotsProvider?: FunctionComponent<{ children?: ReactNode }>;
    useShellSlots?: () => { toolbar: ReactNode | null };
  }>(SHELL_SLOTS_MODULE);
  const Provider = stagedFunction<FunctionComponent<{ children?: ReactNode }>>(
    slots.ShellSlotsProvider,
    `${SHELL_SLOTS_MODULE} publishes the frame's tool-track slot the lane's row mounts into`,
  );
  const read = stagedFunction<() => { toolbar: ReactNode | null }>(slots.useShellSlots, `${SHELL_SLOTS_MODULE} publishes the tool track's own reader`);

  const ToolTrack: FunctionComponent = () => createElement("div", { className: "stage-tool-track" }, read().toolbar);
  const lane = await drawLane({ children: workspace, params: Promise.resolve({ tenant: TENANT, project: projectId }) });
  return createElement(
    Provider,
    null,
    createElement(ToolTrack),
    createElement(PathnameContext.Provider, { value: levelsAddress(TENANT, projectId) }, lane),
  );
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
export async function propsFor(o: LevelsProps): Promise<Record<string, unknown>> {
  const permitted = { [AUTHOR_LEVEL_STACK]: true, [AUTHOR_PROJECT_FACT]: true, [MEASURE]: true, ...(o.permitted ?? {}) };
  return {
    view: o.view,
    permitted,
    offline: o.offline ?? false,
    state: o.state ?? null,
    level: o.level ?? null,
    chrome: await levelsChrome(),
    doors: (o.doors ?? doorBank({ actType: INSERT_LEVEL })).doors,
  };
}

/**
 * What one mount answers: the PAGE the screen stands in, and the screen's own root inside it.
 *
 * `container` is the whole document body rather than the render's own div, because two of the things
 * a suite reads stand outside that div: the lane's tabs row, which is chrome drawn above the surface,
 * and the shipped overlays — the ConsequenceDialog among them — which portal to the body the way
 * every overlay in this product does. Reading them inside the screen's subtree would be reading the
 * wrong scope, not reading a screen that failed to draw them.
 */
export type Mounted = { container: HTMLElement; root: HTMLElement; unmount: () => void };

/** Mount the shipped workspace over one reading, and answer the screen root it rendered. */
export async function mountLevels(o: LevelsProps): Promise<Mounted> {
  installDomStubs();
  const module_ = await productModule<Record<string, unknown>>(LEVELS_UI_MODULE);
  const Workspace = module_["LevelsWorkspace"];
  expect(typeof Workspace, `${LEVELS_UI_MODULE} publishes LevelsWorkspace, the presentational workspace the route mounts`).toBe("function");
  const workspace = createElement(Workspace as FunctionComponent<Record<string, unknown>>, await propsFor(o));
  const { unmount } = render(await inLane(workspace, o.view.projectId));
  const container = (globalThis as unknown as { document: Document }).document.body;
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

/** The roster a control publishes on its own attribute, where it publishes one at all. */
function publishedRoster(control: HTMLElement): { value: string; label: string }[] | null {
  const written = control.getAttribute("data-options");
  if (written === null || written.trim() === "") return null;
  const values = written.trim().startsWith("[") ? (JSON.parse(written) as unknown[]) : written.split(",");
  return values.map((held) => {
    const value = typeof held === "string" ? held.trim() : String((held as { value?: unknown }).value ?? "");
    const label = typeof held === "string" ? value : String((held as { label?: unknown }).label ?? value);
    return { value, label };
  });
}

/** Every option node a control offers, wherever the primitive renders them, in rendered order. */
function optionNodes(control: HTMLElement, root: ParentNode): HTMLElement[] {
  const document_ = control.ownerDocument ?? (root as Element).ownerDocument ?? document;
  const own = [...control.querySelectorAll<HTMLElement>('[role="option"], option')];
  if (own.length > 0) return own;
  // The shipped Select's list is a SIBLING of its trigger, named on the trigger while it is open —
  // the exact list, before any wider search, so two open controls can never be read as one roster.
  const owned = control.getAttribute("aria-controls");
  const listbox = owned === null ? null : document_.getElementById(owned);
  if (listbox !== null) return [...listbox.querySelectorAll<HTMLElement>('[role="option"], option')];
  // A primitive that portals its list keeps it out of both, so the whole document is the last look.
  return [...document_.querySelectorAll<HTMLElement>('[role="option"], option')];
}

/** The control this helper last opened — a reader has one list open at a time, and so does this. */
let openedControl: HTMLElement | null = null;

/**
 * The options a control OFFERS, whatever the shipped primitive renders them as (R-UI-083).
 *
 * The shipped Select is an OPEN-then-read control: the product's own page object opens it before it
 * reaches for an option (`chooseIn`, tests/e2e/pages/s-levels.page.ts), and a closed one keeps no
 * list in the DOM at all. So a roster is read the way a reader reads one — the roster the control
 * publishes of its own, where it publishes one; otherwise the control is opened and the options are
 * collected wherever they then stand. A control that offered NOTHING throws, naming itself, so no
 * roster assertion can pass on an empty reading.
 *
 * The open is synchronous on purpose: `fireEvent` flushes the render before the next statement, and
 * the suites beside this file read the returned sequence in place. This is the instrument only —
 * which values are admitted, and in what order, is judged there and never here.
 */
export function optionsOf(control: HTMLElement, root: ParentNode): { value: string; label: string }[] {
  const published = publishedRoster(control);
  if (published !== null) return published;

  let found = optionNodes(control, root);
  if (found.length === 0) {
    if (openedControl !== null && openedControl !== control && openedControl.isConnected) fireEvent.click(openedControl);
    fireEvent.click(control);
    openedControl = control;
    found = optionNodes(control, root);
  }
  if (found.length === 0) {
    fireEvent.pointerDown(control);
    found = optionNodes(control, root);
  }
  if (found.length === 0) {
    throw new Error(
      `the control offered no options: \`${attr(control, "data-testid")}\` (a <${control.tagName.toLowerCase()}>) offered nothing to choose from, opened or closed, and a roster is what this reading asks it for`,
    );
  }
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
