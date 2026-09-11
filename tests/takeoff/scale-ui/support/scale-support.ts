/**
 * The mechanics inc-205's scale panel is graded on (R-TO-020, R-TO-021, L-MEA-05, R-UI-021/020/050).
 *
 * Mechanics only: nothing here judges the product and nothing here reads product source. Every name
 * below is one the increment's interfaces, its test contract or docs/design/s-scale.md publishes, and
 * every expectation a suite takes from this file is DERIVED — the factors, the anisotropy readouts
 * and the calibration keys are computed by the product's own scale law over the geometry declared
 * here, so moving a number moves both sides of every judgement at once (B-19).
 *
 * Product modules load by absolute path (`productModule`), so a module the Builder has not written
 * yet fails as an assertion naming it rather than as a collection death that would read as a defect
 * in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this file
 * typechecks against today's tree and grades tomorrow's.
 *
 * The sheet under the mount is inc-206's staged geometry (`snap-support`), so the picks this panel
 * consumes are the picks that region already takes: one snapping model, one home (I-158, B-17).
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { expect, vi } from "vitest";
import {
  SNAP_EXTENTS,
  SNAP_KEYS,
  STAGE_PX,
  VIEW_P,
  VIEW_Q,
  productModule,
  repoRoot,
  snapHead,
  viewerClient,
  type Point,
  type SnapMount,
} from "../../viewer-snap/support/snap-support";
import { LAYOUT_PLAN, SCHEDULE, type Box, type Overlay, type OverlayView } from "../../viewer-partition-overlay/support/overlay-stage";

export { productModule, repoRoot, SNAP_EXTENTS, SNAP_KEYS, STAGE_PX, VIEW_P, VIEW_Q };
export type { Point, SnapMount };

/* ------------------------------------------------------------------ the homes the spec names */

/** The modules this increment publishes (increment interfaces, Decision §0). */
export const TWO_POINT_MODULE = "src/modules/takeoff/scale-ui/two-point.ts";
export const COPY_MODULE = "src/modules/takeoff/scale-ui/copy.ts";
export const SCALE_STATE_MODULE = "src/modules/takeoff/sheets/scale-state.ts";
export const SCALE_REGION_MODULE = "src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/scale-region.tsx";
export const SCALE_ACTIONS_MODULE = "src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/scale-actions.ts";

/** The modules it consumes rather than redefines (ARCH-01, ARCH-02). */
export const VIEWER_SCREEN_MODULE = "src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/viewer-screen.tsx";
export const SCALE_CORE_MODULE = "src/core/scale/index.ts";
export const ERRORS_MODULE = "src/core/errors.ts";
export const KEYS_MODULE = "src/core/identity/keys.ts";

/** The test ids the contract closes (C-05, Decision §7). */
export const TESTID = Object.freeze({
  screen: "viewer-screen",
  canvas: "viewer-canvas",
  status: "viewer-status",
  tabs: "viewer-inspector-tabs",
  tabSelection: "viewer-inspector-tab-selection",
  tabScale: "viewer-inspector-tab-scale",
  inspector: "viewer-inspector",
  scale: "viewer-scale",
  view: "viewer-scale-view",
  proposal: "viewer-scale-proposal",
  member: "viewer-scale-member",
  affirm: "viewer-scale-affirm",
  distance: "viewer-scale-distance",
  unit: "viewer-scale-unit",
  observe: "viewer-scale-observe",
  observation: "viewer-scale-observation",
  checkVerification: "viewer-scale-check-verification",
  answer: "viewer-scale-answer",
  retry: "viewer-scale-retry",
  refusal: "refusal-state",
  dialog: "consequence-dialog",
  subjectRow: "consequence-subject-row",
  digestLine: "consequence-digest-line",
  confirm: "consequence-confirm",
  effectLines: "consequence-effect-lines",
  effectSignatures: "consequence-effect-signatures",
  partitionCanvas: "viewer-partition-canvas",
  partitionView: "viewer-partition-view",
  snapToggle: "viewer-snap-toggle",
  snapPick: "viewer-snap-pick",
  statusDistance: "viewer-status-distance",
  statusSnap: "viewer-status-snap",
});

/**
 * The prop `ViewerScreen` takes this region's doors under, the way inc-206's `calibration` prop
 * carries the calibration door's answer: the route hands the shipped server actions, and a mount
 * hands stand-ins, so a jsdom suite grades the panel over injected door answers (Decision §7).
 */
export const SCALE_PROP = "scale";

/** The ranks, as L-MEA-05 spells them (test contract). */
export const QS_TWO_POINT = "QS_TWO_POINT";
export const GRID_SPACING = "GRID_SPACING";
export const DIMENSION_RATIO = "DIMENSION_RATIO";
export const FILE_UNITS = "FILE_UNITS";

/** The two absence codes a view with no affirmation declares (L-MEA-05). */
export const SCALE_NO_EVIDENCE = "SCALE_NO_EVIDENCE";
export const SCALE_UNIT_UNMAPPED = "SCALE_UNIT_UNMAPPED";

/** The refusal a pick that cites nothing answers (L-MEA-05). */
export const SCALE_OBSERVATION_UNCITED = "SCALE_OBSERVATION_UNCITED";

/** The act this panel commits, and the state an affirmed row publishes. */
export const AFFIRM_SCALE = "AFFIRM_SCALE";
export const AFFIRMED = "affirmed";

/** The two spellings the verification readout is published in (test contract). */
export const VERIFIED = "verified";
export const UNVERIFIED = "unverified";

/** The copy key each rank's word is read from (Decision §3). */
export const RANK_COPY_KEY: Readonly<Record<string, string>> = Object.freeze({
  GRID_SPACING: "scale_rank_GRID_SPACING",
  DIMENSION_RATIO: "scale_rank_DIMENSION_RATIO",
  FILE_UNITS: "scale_rank_FILE_UNITS",
  QS_TWO_POINT: "scale_rank_QS_TWO_POINT",
});

/* ------------------------------------------------------------------ the product surfaces a case reaches */

/** One door, with the calls a suite makes through it asserted by name before it is used. */
async function doorOf<T>(home: string, calls: readonly string[]): Promise<T> {
  const door = await productModule<Record<string, unknown>>(home);
  for (const call of calls) expect(typeof door[call], `${home} publishes \`${call}\``).toBe("function");
  return door as T;
}

/** One pick, as inc-206's snap region hands one over (`SnapPick`). */
export type PickLike = { index: 1 | 2; point: Point; sourceKeys: readonly string[]; keyPoint: readonly [string, string] };

/** What `observationOf` answers (increment interfaces). */
export type ObservationAnswer = { observation?: unknown; refusal?: string };

/** What `judgeObservation` answers (increment interfaces). */
export type JudgementAnswer = { axis?: string; drawn?: string; factor?: string; verified?: boolean; refusal?: string };

/** The pure half of this region (increment interfaces: `src/modules/takeoff/scale-ui/two-point.ts`). */
export type TwoPointModule = {
  observationOf: (picks: readonly PickLike[], distance: { value: string; unit: string }) => ObservationAnswer;
  judgeObservation: (observation: unknown, corroborating: readonly string[], tolerance: string) => JudgementAnswer;
};

/** The scale law, as this acceptance derives its expected figures through (B-19). */
export type ScaleCoreModule = {
  SCALE_UNITS: readonly string[];
  SCALE_RANKS: readonly string[];
  citeObservation: (raw: unknown) => { axis: string; drawn: string; factor: string };
  verifyAxis: (axis: string, observed: readonly string[], corroborating: readonly string[], tolerance: string) => unknown;
  anisotropyOf: (factorX: string, factorY: string) => string;
  judgeAnisotropy: (pair: { factorX: string; factorY: string }, tolerance: string) => { anisotropy: string; placeable: boolean };
  calibrationKey: (viewKey: string, factorX: string, factorY: string) => string;
  renderFactor: (value: unknown) => string;
  metresPer: (unit: string | null) => string | null;
  DISTANCE_BASIS_ENTERED: string;
};

export function twoPointModule(): Promise<TwoPointModule> {
  return doorOf<TwoPointModule>(TWO_POINT_MODULE, ["observationOf", "judgeObservation"]);
}

export function scaleCore(): Promise<ScaleCoreModule> {
  return doorOf<ScaleCoreModule>(SCALE_CORE_MODULE, ["citeObservation", "verifyAxis", "anisotropyOf", "judgeAnisotropy", "calibrationKey", "renderFactor", "metresPer"]);
}

/** The register, read for the message and remedy a code is rendered by (R-SPINE-062). */
export async function refusalEntry(code: string): Promise<{ code: string; message: string; remedy: string }> {
  const { REFUSALS } = await productModule<{ REFUSALS: Record<string, { code: string; message: string; remedy: string }> }>(ERRORS_MODULE);
  const held = REFUSALS[code];
  expect(held, `the refusal register carries \`${code}\` (R-SPINE-062)`).toBeTruthy();
  return held as { code: string; message: string; remedy: string };
}

/** One line of this panel's copy by its key, refused loudly where the table does not carry it yet. */
export async function copy(key: string): Promise<string> {
  const module = await productModule<Record<string, unknown>>(COPY_MODULE);
  const table = (module["SCALE_COPY"] ?? module["default"]) as Record<string, string> | undefined;
  expect(table, `${COPY_MODULE} publishes \`SCALE_COPY\` — this panel's one copy home (Decision I-153)`).toBeTruthy();
  const line = (table as Record<string, string>)[key];
  expect(typeof line, `\`SCALE_COPY\` carries \`${key}\` (Decision §3)`).toBe("string");
  expect((line as string).length, `\`${key}\` is a sentence, not an empty slot`).toBeGreaterThan(0);
  return line as string;
}

/** The register's one lattice, as a pick's coordinates are quantised onto it (L-REG-04). */
export async function quantise(value: number): Promise<string> {
  const { quantise: onto } = await doorOf<{ quantise: (n: number) => string }>(KEYS_MODULE, ["quantise"]);
  return onto(value);
}

/* ------------------------------------------------------------------ the door answers a mount is driven over */

/** One machine proposal, as the door answers one (`ScaleProposal`). */
export type ProposalLike = { rank: string; factorX: string; factorY: string; evidence: readonly string[]; anisotropy: string; placeable: boolean };

/** One view's scale, as the door answers it (`ViewScale`). */
export type ViewScaleLike = {
  viewKey: string;
  type: string;
  caption: string;
  proposals: readonly ProposalLike[];
  affirmed: { calibrationKey: string; rank: string; factorX: string; factorY: string; actId: string; anisotropy: string; placeable: boolean } | null;
  refusal: string | null;
};

/** What `readScaleProposals` answers (increment interfaces: the `partition-actions.ts` shapes, verbatim). */
export type ReadAnswer = { read: true; views: readonly ViewScaleLike[]; tolerances: { anisotropy: string; verification: string } } | { read: false; refusal: string };

/** What `previewAffirmScale` answers. */
export type PreviewAnswer = { previewed: true; consequence: unknown; consequenceDigest: string } | { previewed: false; refusal: string };

/** What `commitAffirmScale` answers. */
export type CommitAnswer = { committed: true; actId: string } | { committed: false; refusal: string };

/** What an affirmation asks for (increment interfaces: `previewAffirmScale`'s input). */
export type AffirmRequest = { projectId: string; drawingId: string; rank: string; viewKeys: readonly string[]; observations?: readonly unknown[] };

/** The three doors the region is handed, as the route hands it the shipped server actions. */
export type SuppliedScale = {
  read: () => Promise<ReadAnswer>;
  preview: (request: AffirmRequest) => Promise<PreviewAnswer>;
  commit: (request: AffirmRequest & { consequenceDigest: string }) => Promise<CommitAnswer>;
};

/** The edition's two tolerances, as `scaleTolerancesOf` carries them (ratios, L-MEA-01). */
export const TOLERANCES = Object.freeze({ anisotropy: "0.02", verification: "0.01" });

/** The unit the staged sheet's header names — the mapped spelling every FILE_UNITS proposal follows from. */
export const HEADER_UNIT = "mm";

/**
 * The two views of the staged sheet, and where each stands. `VIEW_P` holds the whole of inc-206's
 * geometry — both endpoints of its horizontal line (`SNAP_KEYS.h`) — so a two-point observation is
 * taken inside ONE view; `VIEW_Q`
 * stands clear of every drawn record, so a pick never lands in it.
 */
export const PLAN_BOX: Box = { min: [-5, -45], max: [105, 65] };
export const OTHER_BOX: Box = { min: [110, -45], max: [135, 65] };

/** The factor the whole of this fixture's evidence agrees on along x: 1.25 m across that line's 100 units. */
export const OBSERVED_METRES = "1.25";
export const OBSERVED_UNIT = "m";

/** A factor pair, rendered by the product's own law rather than transcribed (B-19). */
export async function factorsOf(x: string, y: string): Promise<{ factorX: string; factorY: string }> {
  const core = await scaleCore();
  return { factorX: core.renderFactor(x), factorY: core.renderFactor(y) };
}

/** One proposal of the fixture, with its anisotropy and placeable flag judged by the engine's own law. */
export async function proposal(rank: string, x: string, y: string, evidence: readonly string[]): Promise<ProposalLike> {
  const core = await scaleCore();
  const pair = await factorsOf(x, y);
  const judged = core.judgeAnisotropy(pair, TOLERANCES.anisotropy);
  return { rank, ...pair, evidence: [...evidence], anisotropy: judged.anisotropy, placeable: judged.placeable };
}

/** The proposals of the plan view: a grid-spacing reading that agrees with the observation, then the header's own. */
export async function planProposals(): Promise<ProposalLike[]> {
  const core = await scaleCore();
  const header = core.metresPer(HEADER_UNIT);
  expect(typeof header, `the scale law maps the header spelling ${HEADER_UNIT} into metres (L-MEA-05)`).toBe("string");
  return [
    await proposal(GRID_SPACING, "0.0125", "0.0125", [SNAP_KEYS.h, "BUB:PX1"]),
    await proposal(DIMENSION_RATIO, "0.0126", "0.0125", [SNAP_KEYS.h]),
    await proposal(FILE_UNITS, header as string, header as string, []),
  ];
}

/** The proposals of the other view: the header's own alone — nothing of the drawing offers it a rank. */
export async function otherProposals(): Promise<ProposalLike[]> {
  const core = await scaleCore();
  const header = core.metresPer(HEADER_UNIT) as string;
  return [await proposal(FILE_UNITS, header, header, [])];
}

/** One view of the door's answer, standing at its declared absence. */
export async function unaffirmedView(viewKey: string, o: { type?: string; caption?: string; refusal?: string; proposals?: readonly ProposalLike[] } = {}): Promise<ViewScaleLike> {
  return {
    viewKey,
    type: o.type ?? LAYOUT_PLAN,
    caption: o.caption ?? `Caption of ${viewKey}`,
    proposals: o.proposals ?? (await planProposals()),
    affirmed: null,
    refusal: o.refusal ?? SCALE_NO_EVIDENCE,
  };
}

/** The same view, as the door answers it once an act of record names it at a rank. */
export async function affirmedView(view: ViewScaleLike, o: { rank: string; factorX: string; factorY: string; actId?: string }): Promise<ViewScaleLike> {
  const core = await scaleCore();
  const judged = core.judgeAnisotropy({ factorX: o.factorX, factorY: o.factorY }, TOLERANCES.anisotropy);
  return {
    ...view,
    affirmed: {
      calibrationKey: core.calibrationKey(view.viewKey, o.factorX, o.factorY),
      rank: o.rank,
      factorX: o.factorX,
      factorY: o.factorY,
      actId: o.actId ?? "11111111-2222-4333-8444-555555555555",
      anisotropy: judged.anisotropy,
      placeable: judged.placeable,
    },
    refusal: null,
  };
}

/** The door's whole answer over a set of views. */
export function readAnswer(views: readonly ViewScaleLike[]): ReadAnswer {
  return { read: true, views: [...views], tolerances: { ...TOLERANCES } };
}

/** The two views this acceptance is read over: the plan the picks stand in, and the schedule beside it. */
export async function stagedViews(): Promise<ViewScaleLike[]> {
  return [
    await unaffirmedView(VIEW_P, { type: LAYOUT_PLAN, proposals: await planProposals() }),
    await unaffirmedView(VIEW_Q, { type: SCHEDULE, proposals: await otherProposals() }),
  ];
}

/** The partition overlay of the same sheet: one outline per view of the door's answer, in its box. */
export function overlayOf(views: readonly ViewScaleLike[], ingestId = "44444444-4444-4444-8444-444444444444"): Overlay {
  const boxes: Record<string, Box> = { [VIEW_P]: PLAN_BOX, [VIEW_Q]: OTHER_BOX };
  const outlines: OverlayView[] = views.map((view) => ({
    viewKey: view.viewKey,
    type: view.type,
    reason: null,
    caption: view.caption,
    anchorKey: null,
    proposed: null,
    confirmed: null,
    entityCount: 6,
    box: boxes[view.viewKey] ?? { min: [200, -45], max: [260, 65] },
  }));
  return { ingestId, views: outlines, axes: [], deferrals: [] };
}

/** The calibration of record the snap region reads, built from what an affirmed row publishes (I-146). */
export function calibrationOf(views: readonly ViewScaleLike[], ingestId = "44444444-4444-4444-8444-444444444444"): { ingestId: string; views: { viewKey: string; box: Box | null; factorX: string; factorY: string }[] } {
  const boxes: Record<string, Box> = { [VIEW_P]: PLAN_BOX, [VIEW_Q]: OTHER_BOX };
  return {
    ingestId,
    views: views
      .filter((view) => view.affirmed !== null)
      .map((view) => ({
        viewKey: view.viewKey,
        box: boxes[view.viewKey] ?? null,
        factorX: (view.affirmed as { factorX: string }).factorX,
        factorY: (view.affirmed as { factorY: string }).factorY,
      })),
  };
}

/* ------------------------------------------------------------------ the jsdom mount */

/** The identifiers the route hands the screen. */
export const TENANT = "11111111-1111-4111-8111-111111111111";
export const PROJECT = "22222222-2222-4222-8222-222222222222";
export const DRAWING = "33333333-3333-4333-8333-333333333333";

/** A box every element of a jsdom mount reports — jsdom lays nothing out, so the stage states its own. */
function stubbedBox(): DOMRect {
  const box = { x: 0, y: 0, left: 0, top: 0, right: STAGE_PX.width, bottom: STAGE_PX.height, width: STAGE_PX.width, height: STAGE_PX.height };
  return { ...box, toJSON: () => box } as DOMRect;
}

/** The media stub a mount answers `matchMedia` with — jsdom carries none of its own. */
function stubMatchMedia(): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      matches: false,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
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

/** One answer of the sheet's feed, in the shape `fetch` gives the screen. */
function answer(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

/** The feed the mounted sheet asks for itself: its head, its layers and its partition (the contract's `?part=`). */
function serve(overlay: Overlay | null): void {
  const head = snapHead();
  const manifest = head["manifest"] as { version: number; layoutName: string; extents: unknown; insunits: unknown; digest: string; layers: { name: string; rgb: unknown; entityCount: number; records: unknown[] }[] };
  vi.stubGlobal("fetch", async (url: string) => {
    const asked = String(url);
    if (asked.includes("part=partition")) return overlay === null ? answer(404, {}) : answer(200, { overlay });
    if (asked.includes("part=head")) {
      return answer(200, {
        kind: "manifest",
        cache: "miss",
        facts: head["facts"],
        version: manifest.version,
        layoutName: manifest.layoutName,
        extents: manifest.extents,
        insunits: manifest.insunits,
        digest: manifest.digest,
        layers: manifest.layers.map((layer) => ({ name: layer.name, rgb: layer.rgb, entityCount: layer.entityCount })),
      });
    }
    const index = Number(new URL(asked, "http://feed.invalid").searchParams.get("index"));
    const layer = manifest.layers[index];
    return answer(200, { index, name: layer?.name, rgb: layer?.rgb, entityCount: layer?.entityCount, records: layer?.records });
  });
}

/** What a mount hands back: the screen's elements, and the projection a case drives it through. */
export type ScaleMount = SnapMount & { scale: SuppliedScale };

/** Everything a mount replaced, put back. */
let restoreRect: (() => void) | null = null;

/** Undo the mount's stubs and unmount the tree. Call from `afterEach`. */
export function unmountScale(): void {
  cleanup();
  vi.unstubAllGlobals();
  restoreRect?.();
  restoreRect = null;
}

/**
 * `ViewerScreen` mounted over a supplied head, a supplied partition overlay and the region's three
 * doors supplied as stand-ins — the shape the route hands them in. The camera is not assumed: the
 * mount refuses to go on unless the screen opens at the camera the shipped `fitCamera` answers for
 * the box it is drawn into, so a case that inverted the wrong projection says so in place.
 */
export async function mountScaleScreen(o: { scale: SuppliedScale; overlay?: Overlay | null; calibration?: unknown }): Promise<ScaleMount> {
  stubMatchMedia();
  stubPointerCapture();
  serve(o.overlay ?? null);

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
    layoutName: (snapHead()["manifest"] as { layoutName: string }).layoutName,
    initialViewport: null,
    initialSelection: null,
    head: snapHead(),
    [SCALE_PROP]: o.scale,
  };
  if (o.calibration !== undefined) props["calibration"] = o.calibration;

  const view = render(createElement(ViewerScreen as never, props as never));
  const screen = await waitFor(() => view.getByTestId(TESTID.screen));
  const canvas = screen.querySelector<HTMLElement>(`[data-testid="${TESTID.canvas}"]`) as HTMLElement;
  const status = screen.querySelector<HTMLElement>(`[data-testid="${TESTID.status}"]`) as HTMLElement;
  expect(canvas, "the mounted sheet carries its canvas").not.toBeNull();
  expect(status, "and its status line").not.toBeNull();

  const camera = client.fitCamera({ min: [...SNAP_EXTENTS.min] as Point, max: [...SNAP_EXTENTS.max] as Point }, { width: STAGE_PX.width, height: STAGE_PX.height });
  await waitFor(() => {
    expect(Number(status.getAttribute("data-scale")), "the mounted sheet opens at the camera the shipped `fitCamera` answers for the box it is drawn into (R-UI-031)").toBeCloseTo(camera.scale, 6);
  });

  const origin = client.worldAt(camera, { x: 0, y: 0 });
  const unit = client.worldAt(camera, { x: 1, y: 1 });
  const perPixelX = unit[0] - origin[0];
  const perPixelY = unit[1] - origin[1];

  return {
    screen,
    canvas,
    status,
    reduced: false,
    toleranceUnits: 0,
    scale: o.scale,
    pxOf: (world: Point) => ({ x: (world[0] - origin[0]) / perPixelX, y: (world[1] - origin[1]) / perPixelY }),
  };
}

/** A set of doors that answers one prepared read and records what it was asked (the panel's own re-read). */
export function doorsOver(answers: readonly ReadAnswer[], o: { preview?: (request: AffirmRequest) => Promise<PreviewAnswer>; commit?: (request: AffirmRequest & { consequenceDigest: string }) => Promise<CommitAnswer> } = {}): SuppliedScale & {
  reads: number;
  asked: AffirmRequest[];
} {
  const doors = {
    reads: 0,
    asked: [] as AffirmRequest[],
    read: async (): Promise<ReadAnswer> => {
      const at = Math.min(doors.reads, answers.length - 1);
      doors.reads += 1;
      return answers[at] as ReadAnswer;
    },
    preview: async (request: AffirmRequest): Promise<PreviewAnswer> => {
      doors.asked.push(request);
      if (o.preview === undefined) return { previewed: false, refusal: "CONSEQUENCES_NOT_CARRIED" };
      return o.preview(request);
    },
    commit: async (request: AffirmRequest & { consequenceDigest: string }): Promise<CommitAnswer> => {
      doors.asked.push(request);
      if (o.commit === undefined) return { committed: false, refusal: "CONSEQUENCES_NOT_CARRIED" };
      return o.commit(request);
    },
  };
  return doors;
}

/* ------------------------------------------------------------------ driving and reading the panel */

/** An element of the mounted screen by the test id the contract closes, or a loud absence. */
export function cell(mount: ScaleMount, testid: string): HTMLElement {
  const found = mount.screen.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  expect(found, `the screen mounts \`${testid}\` (Decision §7)`).not.toBeNull();
  return found as HTMLElement;
}

/** Every element of the mounted screen under one test id. */
export function cells(mount: ScaleMount, testid: string): HTMLElement[] {
  return [...mount.screen.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)];
}

/** Every element under one test id inside one element. */
export function within(element: HTMLElement, testid: string): HTMLElement[] {
  return [...element.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)];
}

/** One `data-` hook of an element, or a loud absence. */
export function hook(element: HTMLElement, name: string): string {
  const raw = element.getAttribute(name);
  expect(raw, `${element.getAttribute("data-testid") ?? element.tagName} publishes ${name} (Decision §7)`).not.toBeNull();
  return raw as string;
}

/** A control activated, as a hand or a keyboard activates one. */
export async function press(control: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(control, { bubbles: true });
  });
}

/** A field filled, as a person types into it. */
export async function fillIn(field: HTMLElement, value: string): Promise<void> {
  await act(async () => {
    fireEvent.change(field, { target: { value } });
  });
}

/**
 * A choice taken from one of the screen's Select controls, as a person takes it: the trigger is
 * pressed and the option is pressed. Since U1 the unit is the shipped `Select` rather than the
 * platform's own control (Design Direction 00 §1), so there is no `change` event to fire at it —
 * there is a listbox to open and an option to press, which is what this does.
 */
export async function choose(mount: ScaleMount, testid: string, value: string): Promise<void> {
  const trigger = cell(mount, testid);
  if (trigger.getAttribute("aria-expanded") !== "true") await press(trigger);
  const option = mount.screen.querySelector<HTMLElement>(`[data-testid="${testid}-listbox"] [data-value="${value}"]`);
  expect(option, `\`${testid}\` offers the choice ${value}`).not.toBeNull();
  await press(option as HTMLElement);
}

/** The pointer moved onto a world point of the mounted sheet. */
export async function hoverWorld(mount: ScaleMount, world: Point): Promise<void> {
  const at = mount.pxOf(world);
  await act(async () => {
    fireEvent.pointerMove(mount.canvas, { clientX: at.x, clientY: at.y, pointerId: 1, pointerType: "mouse", bubbles: true });
  });
}

/** Alt+click at a world point — the pick gesture (I-145, I-158). */
export async function altClickWorld(mount: ScaleMount, world: Point): Promise<void> {
  const at = mount.pxOf(world);
  const shared = { clientX: at.x, clientY: at.y, pointerId: 1, pointerType: "mouse", altKey: true, bubbles: true };
  await act(async () => {
    fireEvent.pointerDown(mount.canvas, shared);
    fireEvent.pointerUp(mount.canvas, shared);
  });
}

/** A pick taken at a world point, with the pointer moved there first, as a reader takes one. */
export async function pick(mount: ScaleMount, world: Point): Promise<void> {
  await hoverWorld(mount, world);
  await altClickWorld(mount, world);
}

/** The scale tab pressed, and the panel it opens once the door has answered. */
export async function openScalePanel(mount: ScaleMount): Promise<HTMLElement> {
  await press(cell(mount, TESTID.tabScale));
  return waitFor(() => {
    const panel = mount.screen.querySelector<HTMLElement>(`[data-testid="${TESTID.scale}"]`);
    expect(panel, "pressing the scale tab shows the scale panel (AC-1)").not.toBeNull();
    expect((panel as HTMLElement).getAttribute("data-state"), "and the panel settles out of its loading state").not.toBe("loading");
    return panel as HTMLElement;
  });
}

/** The view rows of the panel, in the order they stand in the DOM. */
export function viewRows(mount: ScaleMount): HTMLElement[] {
  return cells(mount, TESTID.view);
}

/** One view's row, by the key it publishes. */
export function rowFor(mount: ScaleMount, viewKey: string): HTMLElement {
  const found = viewRows(mount).filter((row) => row.getAttribute("data-view-key") === viewKey);
  expect(found.length, `exactly one row of the panel stands for the view ${viewKey} (AC-1)`).toBe(1);
  return found[0] as HTMLElement;
}

/** The picks standing on the overlay, in the order they were taken. */
export function picksTaken(mount: ScaleMount): HTMLElement[] {
  return cells(mount, TESTID.snapPick).sort((left, right) => Number(left.getAttribute("data-index")) - Number(right.getAttribute("data-index")));
}

/** The lattice point one taken pick stands on, as the overlay publishes it. */
export function keyPointOf(mark: HTMLElement): [string, string] {
  return [hook(mark, "data-key-x"), hook(mark, "data-key-y")];
}
