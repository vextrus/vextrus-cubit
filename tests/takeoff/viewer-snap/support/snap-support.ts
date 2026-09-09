/**
 * The mechanics inc-206's snapping is graded on (R-TO-012, R-UI-041, R-UI-032, L-REG-04).
 *
 * Mechanics only: nothing here judges the product and nothing here reads product source. Every name
 * below is one the increment's interfaces, its test contract or the Design Decision publishes, and
 * every expectation a suite takes from this file is DERIVED from the geometry declared here rather
 * than transcribed from a run (B-19) — moving a line in `SNAP_GEOMETRY` moves both sides of every
 * judgement at once.
 *
 * Product modules load by absolute path (`productModule`), so a module the Builder has not written
 * yet fails as an assertion naming it rather than as a collection death that would read as a defect
 * in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this file
 * typechecks against today's tree and grades tomorrow's.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { expect } from "vitest";

/* ------------------------------------------------------------------ the homes the spec names */

/** The modules this increment publishes (test contract: procedures). */
export const SNAP_MODULE = "src/modules/takeoff/viewer-snap/snap.ts";
export const SNAP_SERVER_MODULE = "src/modules/takeoff/viewer-snap/server.ts";
export const SNAP_SCENE_MODULE = "src/modules/takeoff/viewer-snap/scene.ts";
export const USE_SNAP_MODULE = "src/modules/takeoff/viewer-snap/use-snap.ts";

/** The modules it consumes rather than redefines (test contract: "consumed, not redefined"). */
export const KEYS_MODULE = "src/core/identity/keys.ts";
export const ROSTER_MODULE = "src/ui/shell/shortcuts/roster.ts";
export const STRINGS_MODULE = "src/ui/strings/index.ts";
export const FORMAT_MODULE = "src/core/format.ts";
export const VIEWER_CLIENT_MODULE = "src/modules/takeoff/viewer/client.ts";
export const VIEWER_SEAM_MODULE = "src/modules/takeoff/viewer/index.ts";
export const VIEWER_SCREEN_MODULE = "src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/viewer-screen.tsx";
export const VIEWER_ROUTE_MODULE = "src/app/api/viewer/[drawing]/[layout]/route.ts";

/** The roster id R-UI-032 binds the S key under — read through the roster, never spelled twice. */
export const SNAP_SHORTCUT_ID = "viewer-snap";

/** The test ids the Decision closes (§7, C-05). */
export const TESTID = Object.freeze({
  screen: "viewer-screen",
  canvas: "viewer-canvas",
  status: "viewer-status",
  toggle: "viewer-snap-toggle",
  ortho: "viewer-snap-ortho",
  angle: "viewer-snap-angle",
  glyph: "viewer-snap-glyph",
  pick: "viewer-snap-pick",
  statusSnap: "viewer-status-snap",
  statusDistance: "viewer-status-distance",
});

/** The prop a mount hands the screen the sheet's calibration answer under (AC-4's jsdom half). */
export const CALIBRATION_PROP = "calibration";

/** The six kinds, in the priority order AC-1 fixes. */
export const PRIORITY: readonly string[] = Object.freeze(["endpoint", "intersection", "midpoint", "perpendicular", "grid", "nearest"]);

/** The kinds, in the roster order AC-1 states for `SNAP_KINDS`. */
export const KINDS: readonly string[] = Object.freeze(["endpoint", "midpoint", "intersection", "perpendicular", "grid", "nearest"]);

/** The copy key each kind's word is rendered from (Decision §3). */
export const KIND_COPY_KEY = Object.freeze({
  endpoint: "viewer_snap_kind_endpoint",
  midpoint: "viewer_snap_kind_midpoint",
  intersection: "viewer_snap_kind_intersection",
  perpendicular: "viewer_snap_kind_perpendicular",
  grid: "viewer_snap_kind_grid",
  nearest: "viewer_snap_kind_nearest",
} as Record<string, string>);

/* ------------------------------------------------------------------ loading product modules */

/** The checkout the acceptance drives — a mounted set states it, a lane run stands in it. */
export function repoRoot(): string {
  return process.env["BUILDER_REPO_ROOT"]?.trim() || process.cwd();
}

/** Import a product module by repo-relative path, asserting it exists first. */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(repoRoot(), relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/* ------------------------------------------------------------------ the shapes the module answers in */

/** A world point, as every seam of this increment states one. */
export type Point = [number, number];

/** One candidate the screen hands the resolver (increment interfaces: `SnapCandidate`). */
export type SnapCandidate = { key?: string; src?: string; type: string; points?: unknown };

/** One grid intersection (increment interfaces: `GridIntersection`). */
export type GridIntersection = { point: Point; sourceKeys: [string, string]; viewKey: string };

/** One resolved snap (increment interfaces: `SnapResult`). */
export type SnapResult = { kind: string; point: Point; sourceKeys: string[]; keyPoint: [string, string] };

/** What `resolveSnap` is asked (increment interfaces). */
export type SnapInput = {
  cursor: Point;
  tolerance: number;
  candidates: readonly SnapCandidate[];
  grid: readonly GridIntersection[];
  firstPick: Point | null;
};

/** One stored grid axis, as `gridIntersectionsOf` reads one (`GridAxisRow`, inc-205). */
export type GridAxisRow = { viewKey: string; family: string; label: string; axis: "x" | "y"; position: number; bubbleKey: string; labelKey: string; minSpacing: number };

/** The pure module, through the surface the increment publishes. */
export type SnapModule = {
  SNAP_KINDS: readonly string[];
  SNAP_TOLERANCE_PX: number;
  ANGLE_STEP_DEG: number;
  resolveSnap: (input: SnapInput) => SnapResult | null;
  gridIntersectionsOf: (axes: readonly GridAxisRow[]) => GridIntersection[];
  constrainOrtho: (anchor: Point, point: Point) => Point;
  constrainAngle: (anchor: Point, point: Point, stepDeg: number) => Point;
  distanceBetween: (a: Point, b: Point) => number;
  metresBetween: (a: Point, b: Point, factors: { factorX: string; factorY: string }) => string;
};

/** The register's one lattice (`src/core/identity/keys`). */
export type KeysModule = { quantise: (n: number) => string };

/** The roster, through the two readings this region is bound by (R-UI-032). */
export type RosterModule = {
  shortcutById: (id: string) => { id: string; scope: string; keys: readonly string[]; label: string };
  matchesStep: (event: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }, step: string) => boolean;
  isTextField: (target: unknown) => boolean;
};

/** The one string table (R-SPINE-060) and the filler every sentence with a slot is rendered through. */
export type StringsModule = { strings: Record<string, string>; fill: (template: string, values: Record<string, string>) => string };

/** The figure seam every user-facing number renders through (R-SPINE-010). */
export type FormatModule = { formatUserFigure: (value: string) => string };

/** The browser-safe viewer barrel, through the two projections a mount inverts with. */
export type ViewerClientModule = {
  fitCamera: (extents: { min: Point; max: Point } | null, viewportPx: { width: number; height: number }) => { centre: Point; scale: number; viewport: { width: number; height: number } };
  worldAt: (camera: unknown, atPx: { x: number; y: number }) => Point;
};

/** The calibration door (increment interfaces: `snapCalibrationsOfSheet`). */
export type SnapCalibrationView = { viewKey: string; box: { min: Point; max: Point } | null; factorX: string; factorY: string };
export type SnapCalibration = { ingestId: string; views: readonly SnapCalibrationView[] };
export type SnapServerModule = {
  snapCalibrationsOfSheet: (scope: { tenantId: string; drawingId: string; layoutName: string }) => Promise<SnapCalibration | null>;
};

/** One door, with the calls a suite makes through it asserted by name before it is used. */
async function doorOf<T>(home: string, calls: readonly string[]): Promise<T> {
  const door = await productModule<Record<string, unknown>>(home);
  for (const call of calls) expect(typeof door[call], `${home} publishes \`${call}\``).toBe("function");
  return door as T;
}

/** The pure snap module (increment interfaces: `src/modules/takeoff/viewer-snap/snap.ts`). */
export async function snapModule(): Promise<SnapModule> {
  const module = await doorOf<SnapModule>(SNAP_MODULE, ["resolveSnap", "gridIntersectionsOf", "constrainOrtho", "constrainAngle", "distanceBetween", "metresBetween"]);
  for (const constant of ["SNAP_KINDS", "SNAP_TOLERANCE_PX", "ANGLE_STEP_DEG"]) {
    expect((module as unknown as Record<string, unknown>)[constant], `${SNAP_MODULE} publishes \`${constant}\` — the two numbers are code constants no surface transcribes (Decision §5)`).toBeDefined();
  }
  return module;
}

/** The calibration door (increment interfaces: `src/modules/takeoff/viewer-snap/server.ts`). */
export function snapServer(): Promise<SnapServerModule> {
  return doorOf<SnapServerModule>(SNAP_SERVER_MODULE, ["snapCalibrationsOfSheet"]);
}

/** The register's lattice, as the resolver consumes it. */
export function keysModule(): Promise<KeysModule> {
  return doorOf<KeysModule>(KEYS_MODULE, ["quantise"]);
}

/** The one roster of bindings (R-UI-032). */
export function rosterModule(): Promise<RosterModule> {
  return doorOf<RosterModule>(ROSTER_MODULE, ["shortcutById", "matchesStep", "isTextField"]);
}

/** The one string table, and the one copy key this region's word is read from. */
export async function stringsModule(): Promise<StringsModule> {
  const module = await productModule<StringsModule>(STRINGS_MODULE);
  expect(typeof module.fill, `${STRINGS_MODULE} publishes \`fill\``).toBe("function");
  return module;
}

/** One line of copy by its key, refused loudly where the table does not carry it yet. */
export async function copy(key: string): Promise<string> {
  const { strings } = await stringsModule();
  const line = strings[key];
  expect(typeof line, `the one string table carries \`${key}\` (Decision §3, R-SPINE-060)`).toBe("string");
  expect((line as string).length, `\`${key}\` is a sentence, not an empty slot`).toBeGreaterThan(0);
  return line as string;
}

export function formatModule(): Promise<FormatModule> {
  return doorOf<FormatModule>(FORMAT_MODULE, ["formatUserFigure"]);
}

export function viewerClient(): Promise<ViewerClientModule> {
  return doorOf<ViewerClientModule>(VIEWER_CLIENT_MODULE, ["fitCamera", "worldAt"]);
}

/* ------------------------------------------------------------------ the geometry every case stands on */

/** The layer the staged records are drawn on — fixture data, never an environment name. */
export const SNAP_LAYER = "SNAP";

/** The colour every staged record carries: channels, as a manifest holds them. */
const RGB: [number, number, number] = [40, 40, 40];

/** One drawn record, in the shape the manifest and the resolver both read (`RenderRecord`). */
export function lineRecord(key: string, from: Point, to: Point): SnapCandidate & { rgb: [number, number, number] } {
  return { key, type: "LINE", rgb: RGB, points: [[...from], [...to]] };
}

/**
 * The three segments every geometric case is taken over, and why each stands where it does:
 *
 * - `H` runs along y = 0 from (0,0) to (100,0). Its midpoint (50,0) is also where `V` crosses it, so
 *   one cursor proves intersection outranks midpoint.
 * - `V` runs up x = 50 from (50,-40) to (50,60). Its own midpoint (50,10) stands 10 units clear of
 *   everything else, so one cursor proves midpoint outranks nearest.
 * - `T` rises to a stop ON `H` at (20,0): an endpoint and an intersection at one point, so one
 *   cursor proves endpoint outranks intersection.
 *
 * Every feature of the set stands at least 10 drawing units from every other, and every case's
 * cursor stands 0.2 from the feature it names — twenty times inside `CASE_TOLERANCE` and fifty times
 * outside the nearest rival, so no case is decided by a rounding.
 */
/**
 * The source key each staged segment carries, declared once here and imported wherever it is
 * asserted (B-19). The scheme is `DXF_HANDLE` — one of L-CAD-02's closed `SOURCE_SCHEMES`, and the
 * one a staged CAD plan's own entities carry — because a key is PARSED wherever it is cited:
 * L-MEA-05's calibration point refuses a key outside that set (`SCALE_OBSERVATION_UNCITED`), so a
 * fixture key of any other scheme is data no lawful product could accept.
 */
export const SNAP_KEYS = Object.freeze({ h: "DXF_HANDLE:H", v: "DXF_HANDLE:V", t: "DXF_HANDLE:T" });

export const SNAP_GEOMETRY = Object.freeze({
  h: lineRecord(SNAP_KEYS.h, [0, 0], [100, 0]),
  v: lineRecord(SNAP_KEYS.v, [50, -40], [50, 60]),
  t: lineRecord(SNAP_KEYS.t, [20, -30], [20, 0]),
});

/** The three records as the screen and the resolver are handed them. */
export const SNAP_RECORDS: readonly (SnapCandidate & { rgb: [number, number, number] })[] = Object.freeze([SNAP_GEOMETRY.h, SNAP_GEOMETRY.v, SNAP_GEOMETRY.t]);

/** The two views the staged grid axes belong to — one grid may never pair across them (I-149). */
export const VIEW_P = "v:PLAN:CAP-P";
export const VIEW_Q = "v:PLAN:CAP-Q";

/** One stored grid axis, as the partition overlay holds one. */
function axis(viewKey: string, at: "x" | "y", position: number, bubbleKey: string, label: string): GridAxisRow {
  return { viewKey, family: at === "x" ? "letter" : "numeral", label, axis: at, position, bubbleKey, labelKey: `${bubbleKey}:LABEL`, minSpacing: 40 };
}

/**
 * The axes of two views whose positions CROSS: P's x rows stand either side of Q's, and Q's y row
 * stands between P's. A resolver that paired every x row with every y row would therefore answer
 * intersections that stand nowhere on either view's grid, and one that paired within a view answers
 * four for P and one for Q (AC-1, AC-6(e)).
 */
export const SNAP_AXES: readonly GridAxisRow[] = Object.freeze([
  axis(VIEW_P, "x", 90, "BUB:PX1", "A"),
  axis(VIEW_P, "x", 130, "BUB:PX2", "B"),
  axis(VIEW_P, "y", 50, "BUB:PY1", "1"),
  axis(VIEW_P, "y", -30, "BUB:PY2", "2"),
  axis(VIEW_Q, "x", 110, "BUB:QX1", "A"),
  axis(VIEW_Q, "y", 20, "BUB:QY1", "1"),
]);

/**
 * The intersections `gridIntersectionsOf` owes for `SNAP_AXES`, derived here by the rule AC-1
 * states rather than transcribed: every x row paired with every y row OF THE SAME view, sourced by
 * the two bubble keys in [x, y] order.
 */
export function expectedGridIntersections(axes: readonly GridAxisRow[] = SNAP_AXES): GridIntersection[] {
  const owed: GridIntersection[] = [];
  for (const x of axes.filter((row) => row.axis === "x")) {
    for (const y of axes.filter((row) => row.axis === "y" && row.viewKey === x.viewKey)) {
      owed.push({ point: [x.position, y.position], sourceKeys: [x.bubbleKey, y.bubbleKey], viewKey: x.viewKey });
    }
  }
  return owed;
}

/** One intersection as one comparable string — a whole answer graded in one comparison. */
export function intersectionSignature(entry: { point: readonly number[]; sourceKeys: readonly string[]; viewKey: string }): string {
  return `${entry.viewKey}|${entry.point[0]},${entry.point[1]}|${entry.sourceKeys.join("+")}`;
}

/** The tolerance every pure case is asked at: far above each cursor's 0.2, far below the 10 that separates rivals. */
export const CASE_TOLERANCE = 0.5;

/** How far every case's cursor stands from the feature it names. */
export const CASE_OFFSET = 0.2;

/**
 * One case of the resolver: where the cursor is, whether a pick stands, and what the six-way
 * priority owes there.
 */
export type SnapCase = {
  name: string;
  cursor: Point;
  firstPick: Point | null;
  kind: string;
  point: Point;
  sourceKeys: readonly string[];
};

/**
 * Every kind, each proved at a cursor where a lower-priority kind is ALSO in reach, so a resolver
 * that answered by proximity rather than by priority answers a different kind at four of the six
 * (I-147). The offsets and the separations are stated once, above.
 */
export const SNAP_CASES: readonly SnapCase[] = Object.freeze([
  { name: "an endpoint, with the nearest point of the same segment also in reach", cursor: [0, CASE_OFFSET], firstPick: null, kind: "endpoint", point: [0, 0], sourceKeys: [SNAP_KEYS.h] },
  { name: "an endpoint standing ON another segment, so an intersection is in reach too", cursor: [20, CASE_OFFSET], firstPick: null, kind: "endpoint", point: [20, 0], sourceKeys: [SNAP_KEYS.t] },
  { name: "an intersection standing on a midpoint, so a midpoint is in reach too", cursor: [50, CASE_OFFSET], firstPick: null, kind: "intersection", point: [50, 0], sourceKeys: [SNAP_KEYS.h, SNAP_KEYS.v] },
  { name: "a midpoint, with the nearest point of the same segment also in reach", cursor: [50, 10 + CASE_OFFSET], firstPick: null, kind: "midpoint", point: [50, 10], sourceKeys: [SNAP_KEYS.v] },
  { name: "the foot of the perpendicular from the first pick, with nearest also in reach", cursor: [80, CASE_OFFSET], firstPick: [80, 25], kind: "perpendicular", point: [80, 0], sourceKeys: [SNAP_KEYS.h] },
  { name: "a grid intersection of the view whose two bubbles name it", cursor: [90, 50 + CASE_OFFSET], firstPick: null, kind: "grid", point: [90, 50], sourceKeys: ["BUB:PX1", "BUB:PY1"] },
  { name: "the nearest point of a segment, where the same cursor with no pick standing offers no perpendicular", cursor: [80, CASE_OFFSET], firstPick: null, kind: "nearest", point: [80, 0], sourceKeys: [SNAP_KEYS.h] },
]);

/** The input one case asks the resolver with. */
export function inputOf(one: SnapCase, o: { tolerance?: number; candidates?: readonly SnapCandidate[]; grid?: readonly GridIntersection[] } = {}): SnapInput {
  return {
    cursor: [...one.cursor] as Point,
    tolerance: o.tolerance ?? CASE_TOLERANCE,
    candidates: o.candidates ?? SNAP_RECORDS,
    grid: o.grid ?? expectedGridIntersections(),
    firstPick: one.firstPick === null ? null : ([...one.firstPick] as Point),
  };
}

/** A snap answer as one comparable string: the kind, the point and the keys it named. */
export function resultSignature(answer: { kind: string; point: readonly number[]; sourceKeys: readonly string[] }): string {
  return `${answer.kind}|${answer.point[0]},${answer.point[1]}|${[...answer.sourceKeys].sort().join("+")}`;
}

/** What a case owes, in the same one comparable string. */
export function caseSignature(one: SnapCase): string {
  return `${one.kind}|${one.point[0]},${one.point[1]}|${[...one.sourceKeys].sort().join("+")}`;
}

/* ------------------------------------------------------------------ the sheet a mount is drawn over */

/** The box the staged sheet is drawn into, in CSS pixels — big enough that 8 px is well under 10 units. */
export const STAGE_PX = Object.freeze({ width: 800, height: 600 });

/** The sheet the mount is drawn over: the three segments, in one layer, on one layout. */
export const SNAP_LAYOUT = "model";

/**
 * The world box the mount's camera is fitted to. It holds every record and every grid intersection
 * with a margin, and its span is small enough that `SNAP_TOLERANCE_PX` at the fitted scale stays
 * far under the 10 drawing units that separate one feature of the geometry from the next.
 */
export const SNAP_EXTENTS = Object.freeze({ min: [-5, -45] as Point, max: [135, 65] as Point });

/** The manifest head the screen is mounted over — the shape `ViewerHead` publishes. */
export function snapHead(): Record<string, unknown> {
  return {
    kind: "manifest",
    cache: "miss",
    facts: {},
    manifest: {
      version: 1,
      layoutName: SNAP_LAYOUT,
      extents: { min: [...SNAP_EXTENTS.min], max: [...SNAP_EXTENTS.max] },
      insunits: { code: 4, unit: "mm", unmapped: false },
      digest: "snap-support",
      layers: [{ name: SNAP_LAYER, rgb: RGB, entityCount: SNAP_RECORDS.length, records: SNAP_RECORDS.map((record) => ({ ...record })) }],
    },
  };
}

/* ------------------------------------------------------------------ the jsdom mount */

/** The identifiers the route hands the screen. */
const TENANT = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const DRAWING = "33333333-3333-4333-8333-333333333333";

/** A box every element of a jsdom mount reports — jsdom lays nothing out, so the stage states its own. */
function stubbedBox(): DOMRect {
  const box = { x: 0, y: 0, left: 0, top: 0, right: STAGE_PX.width, bottom: STAGE_PX.height, width: STAGE_PX.width, height: STAGE_PX.height };
  return { ...box, toJSON: () => box } as DOMRect;
}

/** What a mount hands back: the screen's elements, and the projection a case drives it through. */
export type SnapMount = {
  screen: HTMLElement;
  canvas: HTMLElement;
  status: HTMLElement;
  /** Where a world point stands in the mount's client pixels, inverted through the shipped projection. */
  pxOf: (world: Point) => { x: number; y: number };
  /** The tolerance the screen derives at this camera, in drawing units (SNAP_TOLERANCE_PX / scale). */
  toleranceUnits: number;
  /** Whether `prefers-reduced-motion` reads as reduced in this mount. */
  reduced: boolean;
};

/** The media stub a mount answers `matchMedia` with — jsdom carries none of its own. */
function stubMatchMedia(reduced: boolean): void {
  const listeners = new Set<(event: { matches: boolean; media: string }) => void>();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      matches: reduced && query.includes("prefers-reduced-motion"),
      onchange: null,
      addEventListener: (_kind: string, listener: (event: { matches: boolean; media: string }) => void) => listeners.add(listener),
      removeEventListener: (_kind: string, listener: (event: { matches: boolean; media: string }) => void) => listeners.delete(listener),
      addListener: (listener: (event: { matches: boolean; media: string }) => void) => listeners.add(listener),
      removeListener: (listener: (event: { matches: boolean; media: string }) => void) => listeners.delete(listener),
      dispatchEvent: () => true,
    }),
  });
}

/** The pointer-capture calls a gesture makes, which jsdom does not implement. */
function stubPointerCapture(): void {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto["setPointerCapture"] ??= function setPointerCapture(): void {};
  proto["releasePointerCapture"] ??= function releasePointerCapture(): void {};
  proto["hasPointerCapture"] ??= function hasPointerCapture(): boolean {
    return false;
  };
}

/** Everything a mount replaced, put back. */
let restoreRect: (() => void) | null = null;

/** Undo the mount's stubs and unmount the tree. Call from `afterEach`. */
export function unmountSnap(): void {
  cleanup();
  restoreRect?.();
  restoreRect = null;
}

/**
 * `ViewerScreen` mounted over a supplied head, laid out in a stated box, with the projection the
 * shipped camera answers for that box handed back so a case can put the pointer on a world point.
 *
 * The camera is not assumed: the mount reads the scale the screen itself publishes on
 * `viewer-status` and refuses to go on if it is not the one the shipped `fitCamera` answers for
 * this box, so a case that inverted the wrong projection says so in place rather than hovering
 * somewhere nobody meant.
 */
export async function mountSnapScreen(o: { reduced?: boolean; calibration?: unknown } = {}): Promise<SnapMount> {
  const reduced = o.reduced ?? false;
  stubMatchMedia(reduced);
  stubPointerCapture();

  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = stubbedBox;
  restoreRect = () => {
    Element.prototype.getBoundingClientRect = original;
  };

  const client = await viewerClient();
  const { ViewerScreen } = await productModule<{ ViewerScreen: (props: Record<string, unknown>) => unknown }>(VIEWER_SCREEN_MODULE);
  expect(typeof ViewerScreen, `${VIEWER_SCREEN_MODULE} publishes \`ViewerScreen\``).toBe("function");

  const props: Record<string, unknown> = {
    tenantId: TENANT,
    projectId: PROJECT,
    drawingId: DRAWING,
    layoutName: SNAP_LAYOUT,
    initialViewport: null,
    initialSelection: null,
    head: snapHead(),
  };
  if (o.calibration !== undefined) props[CALIBRATION_PROP] = o.calibration;

  const view = render(createElement(ViewerScreen as never, props as never));
  const screen = await waitFor(() => view.getByTestId(TESTID.screen));
  const canvas = within(screen).getByTestId(TESTID.canvas);
  const status = within(screen).getByTestId(TESTID.status);

  const camera = client.fitCamera({ min: [...SNAP_EXTENTS.min] as Point, max: [...SNAP_EXTENTS.max] as Point }, { width: STAGE_PX.width, height: STAGE_PX.height });
  await waitFor(() => {
    expect(
      Number(status.getAttribute("data-scale")),
      "the mounted sheet opens at the camera the shipped `fitCamera` answers for the box it is drawn into (R-UI-031) — a case inverts that projection to reach a world point",
    ).toBeCloseTo(camera.scale, 6);
  });

  const origin = client.worldAt(camera, { x: 0, y: 0 });
  const unit = client.worldAt(camera, { x: 1, y: 1 });
  const perPixelX = unit[0] - origin[0];
  const perPixelY = unit[1] - origin[1];
  expect(perPixelX !== 0 && perPixelY !== 0, "the camera maps pixels onto the drawing at a scale of its own").toBe(true);

  const snap = await snapModule();
  return {
    screen,
    canvas,
    status,
    reduced,
    toleranceUnits: snap.SNAP_TOLERANCE_PX / camera.scale,
    pxOf: (world) => ({ x: (world[0] - origin[0]) / perPixelX, y: (world[1] - origin[1]) / perPixelY }),
  };
}

/* ------------------------------------------------------------------ driving and reading the mount */

/** The pointer moved onto a world point of the mounted sheet. */
export async function hoverWorld(mount: SnapMount, world: Point): Promise<void> {
  const at = mount.pxOf(world);
  await act(async () => {
    fireEvent.pointerMove(mount.canvas, { clientX: at.x, clientY: at.y, pointerId: 1, pointerType: "mouse", bubbles: true });
  });
}

/** Alt+click at a world point — the pick gesture (I-145). */
export async function altClickWorld(mount: SnapMount, world: Point): Promise<void> {
  const at = mount.pxOf(world);
  const shared = { clientX: at.x, clientY: at.y, pointerId: 1, pointerType: "mouse", altKey: true, bubbles: true };
  await act(async () => {
    fireEvent.pointerDown(mount.canvas, shared);
    fireEvent.pointerUp(mount.canvas, shared);
  });
}

/** A plain click at a world point — selection, exactly as it behaved before this region existed. */
export async function plainClickWorld(mount: SnapMount, world: Point): Promise<void> {
  const at = mount.pxOf(world);
  const shared = { clientX: at.x, clientY: at.y, pointerId: 1, pointerType: "mouse", bubbles: true };
  await act(async () => {
    fireEvent.pointerDown(mount.canvas, shared);
    fireEvent.pointerUp(mount.canvas, shared);
  });
}

/** A control activated, as a hand or a keyboard activates one. */
export async function pressButton(control: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(control, { bubbles: true });
  });
}

/** One key pressed on an element, as a keyboard reaches this region. */
export async function press(target: HTMLElement, init: { key: string; altKey?: boolean; shiftKey?: boolean }): Promise<void> {
  await act(async () => {
    fireEvent.keyDown(target, { ...init, bubbles: true });
    fireEvent.keyUp(target, { ...init, bubbles: true });
  });
}

/** An element of the mounted screen by the test id the contract closes, or a loud absence. */
export function cell(mount: SnapMount, testid: string): HTMLElement {
  const found = mount.screen.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  expect(found, `the screen mounts \`${testid}\` (Decision §7)`).not.toBeNull();
  return found as HTMLElement;
}

/** Every element of the mounted screen under one test id. */
export function cells(mount: SnapMount, testid: string): HTMLElement[] {
  return [...mount.screen.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)];
}

/** One `data-` hook of an element, or a loud absence. */
export function hook(element: HTMLElement, name: string): string {
  const raw = element.getAttribute(name);
  expect(raw, `${element.getAttribute("data-testid") ?? element.tagName} publishes ${name} (Decision §7)`).not.toBeNull();
  return raw as string;
}

/** Whether a toggle reads as pressed — the one channel WCAG gives a toggle (R-UI-060). */
export function pressed(element: HTMLElement): boolean {
  const raw = element.getAttribute("aria-pressed");
  expect(raw, `${element.getAttribute("data-testid") ?? "the toggle"} states whether it is pressed (WCAG 4.1.2)`).not.toBeNull();
  return raw === "true";
}

/** The step the roster binds this region's key under — read from the roster, never spelled twice. */
export async function snapStep(): Promise<string> {
  const roster = await rosterModule();
  const entry = roster.shortcutById(SNAP_SHORTCUT_ID);
  const step = entry.keys[0];
  expect(typeof step, `the roster binds \`${SNAP_SHORTCUT_ID}\` to a step (R-UI-032, B-17)`).toBe("string");
  return step as string;
}

/**
 * A key event that presses the roster's step for this region, built from the roster's own reading of
 * it: the event this returns is one `matchesStep` accepts, so no second spelling of the key is
 * written anywhere in this acceptance (B-17).
 */
export async function snapKeyEvent(): Promise<{ key: string }> {
  const roster = await rosterModule();
  const step = await snapStep();
  const key = step.split("+").pop() as string;
  expect(roster.matchesStep({ key }, step), `the roster's own reading of "${step}" accepts a bare press of "${key}"`).toBe(true);
  return { key };
}
