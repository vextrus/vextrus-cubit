/**
 * The mechanics S-Viewer's views/grid panel and its overlay are graded on (R-TO-014, L-CAD-06/07,
 * L-ACT-02, R-UI-023/050/060).
 *
 * Mechanics only — nothing here judges the product. The database, the storage root, the accounts,
 * the projects, the recorded drawing, the stand-in for the `cad/` CLI, the partition job and the
 * minting of a recorded model answer all come from the stored partition's own stage
 * (`tests/takeoff/partition/support/partition-stage.ts`) rather than from a second staging dialect
 * invented here: one invariant, one home (B-17, ARCH-02). What this file adds is the one thing an
 * overlay needs beyond a partitioned ingest — a drawing whose model space carries a bubbled layout
 * plan, an unbubbled one, a schedule and three captions the grammar cannot read — plus the doors
 * the criteria drive and the store reads they are graded by.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one the increment's interfaces, its test
 * contract or the Bible publishes.
 */
import { expect } from "vitest";
import { TENANT_COLUMN } from "../../../../db/__tests__/support/fixtures";
import { ident, lit } from "../../../../db/__tests__/support/live-sql";
import {
  CAPTION_HEIGHT,
  INGEST_JOB_MODULE,
  INGEST_MODULE,
  LABEL_HEIGHT,
  MODEL_SPACE,
  PAPER_SPACE,
  mintFixture,
  productModule,
  rebuildDoor,
  requestHash,
  sql,
  stepSink,
  storageOf,
  tempDir,
  tempFixtureRoot,
  unique,
  viewCaptionsDoor,
  withFixtureRoot,
  type JsonValue,
  type Person,
  type ProgressLike,
  type StagedDrawing,
} from "../../partition/support/partition-stage";
import { stageDrawing, stubCli, withCadCommand } from "../../support/ingest-stage";

export { MODEL_SPACE, PAPER_SPACE, productModule, sql };

/* ------------------------------------------------------------------ the homes the spec names */

/** The modules this increment publishes (increment interfaces, test contract: procedures). */
export const OVERLAY_SERVER_MODULE = "src/modules/takeoff/viewer-partition-overlay/server.ts";
export const OVERLAY_SCENE_MODULE = "src/modules/takeoff/viewer-partition-overlay/scene.ts";
export const OVERLAY_GROUPS_MODULE = "src/modules/takeoff/viewer-partition-overlay/groups.ts";
export const OVERLAY_PAINT_MODULE = "src/modules/takeoff/viewer-partition-overlay/paint.ts";
export const OVERLAY_PANEL_MODULE = "src/modules/takeoff/viewer-partition-overlay/partition-panel.tsx";
export const OVERLAY_CSS = "src/modules/takeoff/viewer-partition-overlay/viewer-partition.css";
export const PARTITION_STRINGS_MODULE = "src/ui/strings/viewer-partition.ts";
export const VIEWER_ROUTE_MODULE = "src/app/api/viewer/[drawing]/[layout]/route.ts";
export const VIEWER_SCREEN_MODULE = "src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/viewer-screen.tsx";
export const VIEWER_MODULE = "src/modules/takeoff/viewer/index.ts";
export const VIEWER_CLIENT_MODULE = "src/modules/takeoff/viewer/client.ts";
export const ERRORS_MODULE = "src/core/errors.ts";
export const FORMAT_MODULE = "src/core/format.ts";
export const FACTS_MODULE = "src/modules/takeoff/ingest/facts.ts";

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The part of the feed this increment adds, and the part it stands beside (test contract: routes). */
export const PART_PARTITION = "partition";
export const PART_HEAD = "head";

/** The view classes this staging leans on, spelled as L-CAD-06's vocabulary spells them. */
export const LAYOUT_PLAN = "LAYOUT_PLAN";
export const SCHEDULE = "SCHEDULE";
export const UNTYPED = "UNTYPED";
export const DETAIL = "DETAIL";
export const LEGEND_NOTES = "LEGEND_NOTES";

/** The codes the panel and the feed carry (test contract). */
export const CAPTION_UNCLASSIFIABLE = "CAPTION_UNCLASSIFIABLE";
export const GRID_NO_BUBBLE_EVIDENCE = "GRID_NO_BUBBLE_EVIDENCE";
export const SIGNED_OUT = "SIGNED_OUT";
export const WORKSPACE_PERMISSION_NOT_HELD = "WORKSPACE_PERMISSION_NOT_HELD";

/** The offered group's kind, and the act it offers (L-ACT-02, AC-4). */
export const PROPOSED_VIEW_TYPE = "PROPOSED_VIEW_TYPE";
export const CONFIRM_VIEW_TYPE = "CONFIRM_VIEW_TYPE";

/** The four tables the overlay's answer mirrors (AC-1). */
export const PARTITION_VIEWS = "partition_views";
export const VIEW_ASSIGNMENTS = "view_assignments";
export const GRIDS = "grids";
export const GRID_DEFERRALS = "grid_deferrals";

/** The test ids the Design Decision closes (§7) — spelled once, used by every criterion. */
export const TESTID = Object.freeze({
  panel: "viewer-partition",
  viewsToggle: "viewer-partition-views-toggle",
  gridToggle: "viewer-partition-grid-toggle",
  view: "viewer-partition-view",
  badge: "viewer-partition-view-badge",
  reason: "viewer-partition-view-reason",
  axis: "viewer-partition-axis",
  deferral: "viewer-partition-grid-deferral",
  canvas: "viewer-partition-canvas",
  groups: "viewer-partition-groups",
  retry: "viewer-partition-retry",
  sheet: "viewer-canvas",
  layers: "viewer-layers",
  status: "viewer-status",
  offeredGroups: "offered-groups",
  offeredGroup: "offered-group",
  offeredGroupCount: "offered-group-count",
  offeredGroupConfirm: "offered-group-confirm",
});

/** The copy this region owns, as docs/design/s-viewer-partition.md §3 and the contract fix it (C-05). */
export const COPY: Readonly<Record<string, string>> = Object.freeze({
  viewer_partition_heading: "Views and grid",
  viewer_partition_views_toggle: "Views",
  viewer_partition_grid_toggle: "Grid",
  viewer_partition_empty: "No partition has been rebuilt for this drawing yet, so there are no views or grid to show.",
  viewer_partition_failed: "The partition could not be read.",
  viewer_partition_retry: "Retry",
  viewer_partition_groups_heading: "Proposed view types",
  viewer_partition_group_label: "Views of this drawing whose captions the grammar could not read, proposed as {type}",
  viewer_partition_group_count_one: "1 view",
  viewer_partition_group_count_many: "{count} views",
  viewer_partition_off_sheet: "Not on this sheet",
});

/* ------------------------------------------------------------------ the shapes the doors answer in */

/** A world box, as every seam of the sheet states one. */
export type Box = { min: [number, number]; max: [number, number] };

/** One view of the overlay's answer (increment interfaces: `PartitionOverlayView`). */
export type OverlayView = {
  viewKey: string;
  type: string;
  reason: string | null;
  caption: string;
  anchorKey: string | null;
  proposed: { type: string; callId: string } | null;
  confirmed: { type: string; actId: string } | null;
  entityCount: number;
  box: Box | null;
};

/** One axis of the overlay's answer (increment interfaces: `PartitionOverlayAxis`). */
export type OverlayAxis = {
  viewKey: string;
  family: string;
  label: string;
  axis: string;
  position: number;
  bubbleKey: string;
  labelKey: string;
  minSpacing: number;
  bubble: { centre: [number, number]; radius: number } | null;
};

/** One deferral of the overlay's answer (increment interfaces: `GridDeferralRow`). */
export type OverlayDeferral = { viewKey: string; reason: string };

/** What the door and the feed answer (increment interfaces: `PartitionOverlay`). */
export type Overlay = { ingestId: string; views: OverlayView[]; axes: OverlayAxis[]; deferrals: OverlayDeferral[] };

/** The two switches, as the scene is gated by them (increment interfaces: `OverlayToggles`). */
export type Toggles = { views: boolean; grid: boolean };

/** What `overlayScene` answers (increment interfaces: `OverlayScene`). */
export type Scene = {
  outlines: { viewKey: string; type: string; rect: { x: number; y: number; width: number; height: number }; hatched: boolean; reason: string | null }[];
  axes: { viewKey: string; label: string; family: string; from: [number, number]; to: [number, number]; bubble: { centre: [number, number]; radius: number } | null }[];
};

/** The server-only door (increment interfaces: `partitionOverlayOf`). */
export type OverlayServer = {
  partitionOverlayOf: (scope: { tenantId: string; projectId: string; drawingId: string; layoutName: string }) => Promise<Overlay | null>;
};

/** The pure scene door (test contract: `overlayScene`). */
export type SceneDoor = { overlayScene: (overlay: Overlay, toggles: Toggles, camera: unknown) => Scene };

/** One offered group (the shipped `OfferedGroupItem`), as `offeredViewGroups` answers one (AC-4). */
export type GroupItem = { key: { kind: string; drawingId: string; viewType: string }; label: string; count: string };

/** The offer door (test contract: `offeredViewGroups`). */
export type GroupsDoor = { offeredViewGroups: (views: readonly OverlayView[], drawingId: string) => readonly GroupItem[] };

/** The register, as this acceptance reads one entry out of it. */
export type ErrorsModule = { REFUSALS: Record<string, { code: string; message: string; remedy: string }> };

/** The figure seam every user-facing number renders through (R-SPINE-010). */
export type FormatModule = { formatUserFigure: (value: string) => string };

/** The shipped route handler this increment widens (test contract: routes). */
export type RouteModule = { GET: (request: Request, route: { params: Promise<{ drawing: string; layout: string }> }) => Promise<Response> };

/* ------------------------------------------------------------------ loading the doors */

/** One door, with the calls a criterion makes through it asserted by name before it is used. */
async function doorOf<T>(home: string, calls: readonly string[]): Promise<T> {
  const door = await productModule<Record<string, unknown>>(home);
  for (const call of calls) expect(typeof door[call], `${home} publishes \`${call}\``).toBe("function");
  return door as T;
}

export const overlayServer = (): Promise<OverlayServer> => doorOf<OverlayServer>(OVERLAY_SERVER_MODULE, ["partitionOverlayOf"]);
export const sceneDoor = (): Promise<SceneDoor> => doorOf<SceneDoor>(OVERLAY_SCENE_MODULE, ["overlayScene"]);
export const groupsDoor = (): Promise<GroupsDoor> => doorOf<GroupsDoor>(OVERLAY_GROUPS_MODULE, ["offeredViewGroups"]);
export const viewerRoute = (): Promise<RouteModule> => doorOf<RouteModule>(VIEWER_ROUTE_MODULE, ["GET"]);
export const errorsSeam = (): Promise<ErrorsModule> => productModule<ErrorsModule>(ERRORS_MODULE);
export const formatSeam = (): Promise<FormatModule> => doorOf<FormatModule>(FORMAT_MODULE, ["formatUserFigure"]);

/** The copy table this region's sentences live in (test contract: strings keys). */
export async function partitionStrings(): Promise<Record<string, string>> {
  const table = await productModule<Record<string, unknown>>(PARTITION_STRINGS_MODULE);
  const found = Object.values(table).find((value) => typeof value === "object" && value !== null && "viewer_partition_heading" in (value as object));
  const flat = (found ?? table) as Record<string, string>;
  for (const key of Object.keys(COPY)) expect(typeof flat[key], `${PARTITION_STRINGS_MODULE} carries ${key}`).toBe("string");
  return flat;
}

/** One sentence of the table, with its slots filled the way the Decision fills them. */
export function fill(sentence: string, slots: Readonly<Record<string, string>>): string {
  return Object.entries(slots).reduce((held, [name, value]) => held.replaceAll(`{${name}}`, value), sentence);
}

/* ------------------------------------------------------------------ a hand-authored artifact */

/** A colour every built entity carries: channels, never a spelled colour (the artifact's own shape). */
const CHANNELS = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" };

/** The DXF types the artifact is built from. */
const TYPE_TEXT = "TEXT";
const TYPE_LINE = "LINE";
const TYPE_RING = "LWPOLYLINE";

/** The layers the staged artifact draws on — census data, never environment names (L-CAD-07). */
const LAYER_CAPTIONS = "CAPTIONS";
const LAYER_BUBBLES = "GRID-BUBBLES";
const LAYER_LABELS = "GRID-LABELS";
const LAYER_LINES = "GRID-LINES";

/** The captions the artifact is drawn around, and what the grammar reads each as. */
export const CAPTION_PLAN = "TYPICAL FLOOR PLAN";
export const CAPTION_SCHEDULE = "COLUMN SCHEDULE";

/** The three captions no grammar rule reads, and so the three a model is asked about (L-AI-02). */
export const SILENT_CAPTIONS: readonly string[] = Object.freeze(["XQZ 77", "XQZ 78", "XQZ 79"]);

/** What each silent caption is proposed as: two of one class, one of another (AC-4, AC-6b). */
export const PROPOSED_AS: Readonly<Record<string, string>> = Object.freeze({
  "XQZ 77": DETAIL,
  "XQZ 78": DETAIL,
  "XQZ 79": LEGEND_NOTES,
});

/** The bubble radius the plan draws, and how many vertices a round ring is flattened into. */
const RADIUS = 3;
const VERTICES = 16;

/** One bubble as the artifact draws one: what its text says and where it stands. */
type BubbleSpec = { text: string; centre: [number, number] };

/** The lawful bubbles of the bubbled plan: three letters spread along x, two numerals along y. */
const PLAN_BUBBLES: readonly BubbleSpec[] = [
  { text: "A", centre: [0, -30] },
  { text: "B", centre: [20, -30] },
  { text: "C", centre: [50, -30] },
  { text: "1", centre: [-30, -10] },
  { text: "2", centre: [-30, -25] },
];

/** Where each cluster stands. Far enough apart that no caption reaches another's geometry. */
const PLAN_AT: [number, number] = [0, 0];
const SCHEDULE_AT: [number, number] = [600, 0];
const BARE_PLAN_AT: [number, number] = [1200, 0];
const SILENT_AT: readonly [number, number][] = [
  [1800, 0],
  [2400, 0],
  [3000, 0],
];

/** One drawn record of the built artifact, in the shape the mirror validates (L-CAD-05). */
export type Drawn = { key: string; type: string; space: string; layer: string; text?: string; height?: number; points?: number[][]; closed?: boolean };

/** What a built artifact carries, so a criterion derives its expectations from it (B-19). */
export type BuiltOverlayArtifact = {
  json: string;
  graph: Record<string, JsonValue>;
  /** Every ORIGINAL record, model space and paper alike. */
  originals: readonly Drawn[];
  /** The key of each caption's own text entity, by the words that caption says. */
  anchorOf: ReadonlyMap<string, string>;
};

/** A source key of the DXF-handle scheme, from an ordinal (L-CAD-02). */
function handle(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
}

/** A closed ring of evenly spaced points about a centre — a circle, as the seam carries one. */
function ringPoints(centre: readonly [number, number], radius: number, vertices: number): number[][] {
  return Array.from({ length: vertices }, (_unused, index) => {
    const angle = (2 * Math.PI * index) / vertices;
    return [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)];
  });
}

/**
 * An EntityGraph v2 whose model space carries what this increment paints: a layout plan with lawful
 * grid bubbles, a second layout plan with none (a georeference that defers), a schedule, and three
 * captions the grammar cannot read (each of which a recorded answer proposes a class for). Every
 * ordinal is minted from `salt`, so two artifacts built here are two different drawings.
 */
export function buildOverlayArtifact(salt: number): BuiltOverlayArtifact {
  const base = salt * 0x10000;
  let ordinal = 0;
  const next = (): string => handle(base + (ordinal += 1));
  const originals: Drawn[] = [];
  const anchorOf = new Map<string, string>();

  const caption = (text: string, at: readonly [number, number]): void => {
    const key = next();
    if (!anchorOf.has(text)) anchorOf.set(text, key);
    originals.push({ key, type: TYPE_TEXT, space: MODEL_SPACE, layer: LAYER_CAPTIONS, text, height: CAPTION_HEIGHT, points: [[at[0], at[1]]] });
  };

  const bubble = (spec: BubbleSpec, offset: readonly [number, number]): void => {
    const centre: [number, number] = [spec.centre[0] + offset[0], spec.centre[1] + offset[1]];
    originals.push({ key: next(), type: TYPE_RING, space: MODEL_SPACE, layer: LAYER_BUBBLES, closed: true, points: ringPoints(centre, RADIUS, VERTICES) });
    originals.push({ key: next(), type: TYPE_TEXT, space: MODEL_SPACE, layer: LAYER_LABELS, text: spec.text, height: LABEL_HEIGHT, points: [[centre[0], centre[1]]] });
  };

  const line = (from: readonly [number, number], to: readonly [number, number]): void => {
    originals.push({ key: next(), type: TYPE_LINE, space: MODEL_SPACE, layer: LAYER_LINES, points: [[from[0], from[1]], [to[0], to[1]]] });
  };

  /* --- the bubbled layout plan: axes, bubbles and a minimum spacing --- */
  caption(CAPTION_PLAN, PLAN_AT);
  for (const spec of PLAN_BUBBLES) bubble(spec, [0, 0]);
  line([-5, -30], [55, -30]);
  line([-30, -5], [-30, -30]);
  line([0, -35], [0, -5]);

  /* --- the schedule: a view a grid may never be read off (L-CAD-06, L-CAD-07) --- */
  caption(CAPTION_SCHEDULE, SCHEDULE_AT);
  line([595, -5], [640, -5]);
  line([595, -15], [640, -15]);

  /* --- a second layout plan nobody bubbled: the georeference that defers (L-CAD-07) --- */
  caption(CAPTION_PLAN, BARE_PLAN_AT);
  line([1195, -5], [1250, -5]);
  line([1195, -15], [1250, -15]);
  line([1210, -25], [1210, -3]);

  /* --- three captions the grammar cannot read: the views a model is asked about (L-AI-02) --- */
  SILENT_CAPTIONS.forEach((text, at) => {
    const spot = SILENT_AT[at] ?? [3600 + at * 600, 0];
    caption(text, spot);
    line([spot[0] - 5, spot[1] - 5], [spot[0] + 25, spot[1] - 5]);
    line([spot[0] - 5, spot[1] - 15], [spot[0] + 25, spot[1] - 15]);
  });

  /* --- the paper layout: a sheet's own furniture, which L-CAD-06 does not partition at all --- */
  originals.push({ key: next(), type: TYPE_TEXT, space: PAPER_SPACE, layer: "TITLEBLOCK", text: "S-101 GENERAL ARRANGEMENT", height: 3, points: [[5, 5]] });
  originals.push({ key: next(), type: TYPE_LINE, space: PAPER_SPACE, layer: "TITLEBLOCK", points: [[0, 0], [297, 210]] });

  const graph: Record<string, JsonValue> = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: MODEL_SPACE, kind: "model", bbox: { min: [-60, -140], max: [3700, 20] }, strays_rejected: 0 },
      { name: PAPER_SPACE, kind: "paper", bbox: { min: [0, 0], max: [297, 210] }, strays_rejected: 0 },
    ] as unknown as JsonValue,
    dropped_layouts: [],
    entities: originals.map((record) => ({ ...record, colour: CHANNELS })) as unknown as JsonValue,
    derived: [],
    block_attributes: [],
    counters: [],
  };

  return { json: JSON.stringify(graph), graph, originals, anchorOf };
}

/* ------------------------------------------------------------------ staging a partitioned drawing */

/** A drawing of the built artifact, read through the shipped pipeline and partitioned over it. */
export type StagedOverlay = {
  person: Person;
  projectId: string;
  drawing: StagedDrawing;
  drawingId: string;
  ingestId: string;
  layoutName: string;
  artifact: BuiltOverlayArtifact;
};

/** The bytes a stored drawing is addressed by — the sniffed format only has to be accepted. */
function drawingBytes(label: string): Uint8Array {
  return new TextEncoder().encode(`0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n; ${label}\n`);
}

/** A recorded drawing whose ingest artifact is the built one, written by the product's own pipeline. */
export async function stageOverlayIngest(person: Person, projectId: string, salt: number, label: string): Promise<{ drawing: StagedDrawing; ingestId: string; artifact: BuiltOverlayArtifact }> {
  const job = await productModule<{ runIngestJob: (payload: unknown, progress: ProgressLike, deps: { storage: unknown }) => Promise<void> }>(INGEST_JOB_MODULE);
  const records = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>(INGEST_MODULE);

  const artifact = buildOverlayArtifact(salt);
  const drawing = await stageDrawing(person, projectId, drawingBytes(label), { name: unique(`${label}.dxf`), format: "dxf" });
  const stub = stubCli({ artifact: artifact.json, stderr: "", exitCode: 0 });

  await withCadCommand(stub.command, async () => {
    await job.runIngestJob(
      { tenantId: person.tenantId, drawingId: drawing.drawingId, requestedBy: person.userId, declared: null },
      { jobId: unique(`ingest-${label}`), tempDir: tempDir("ingest"), step: async () => undefined },
      { storage: await storageOf() },
    );
  });

  const record = await records.ingestRecordOf({ tenantId: person.tenantId, drawingId: drawing.drawingId });
  expect(record, `staging ${label} left no ingest record — an overlay is a reading of a stored partition`).not.toBeNull();
  return { drawing, ingestId: (record as { ingestId: string }).ingestId, artifact };
}

/**
 * One run of the shipped partition job over a staged ingest, with a recorded answer minted for each
 * caption the grammar cannot read — filed under the request the product itself composes for that
 * caption on that anchor, so nothing here knows how a request is built (L-AI-01).
 */
export async function runOverlayPartition(person: Person, staged: { drawing: StagedDrawing; ingestId: string; artifact: BuiltOverlayArtifact }, label: string): Promise<void> {
  const rebuild = await rebuildDoor();
  const captions = await viewCaptionsDoor();
  const hashOf = await requestHash();

  const root = tempFixtureRoot(`overlay-captions-${label}`);
  for (const caption of SILENT_CAPTIONS) {
    const anchorKey = staged.artifact.anchorOf.get(caption) ?? "";
    expect(anchorKey, `the staged artifact carries an entity for the caption ${JSON.stringify(caption)}`).not.toBe("");
    mintFixture(root, hashOf(captions.viewCaptionRequest(caption, anchorKey)), { payload: { type: PROPOSED_AS[caption] as string }, sources: [anchorKey] });
  }

  const sink = stepSink(label);
  await withFixtureRoot(root, async () => {
    await rebuild.runPartitionJob(
      { tenantId: person.tenantId, drawingId: staged.drawing.drawingId, ingestId: staged.ingestId, requestedBy: person.userId },
      sink.progress,
      { storage: await storageOf() },
    );
  });
}

/* ------------------------------------------------------------------ reading the store */

/** One `partition_views` row, as the store holds one and as the door answers one (AC-1). */
export type StoredView = {
  viewKey: string;
  type: string;
  reason: string | null;
  caption: string;
  anchorKey: string | null;
  proposedType: string | null;
  proposedCallId: string | null;
};

/** Every `partition_views` row of one ingest, in view-key order — the acceptance's own audit read. */
export function storedViewRows(tenantId: string, ingestId: string): StoredView[] {
  return sql(
    `select view_key, type, coalesce(reason, ''), caption, coalesce(anchor_key, ''), coalesce(proposed_type, ''), coalesce(proposed_call_id::text, '')
       from ${ident(PARTITION_VIEWS)}
      where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid
      order by view_key;`,
  ).map((row) => ({
    viewKey: row[0] ?? "",
    type: row[1] ?? "",
    reason: (row[2] ?? "") === "" ? null : (row[2] as string),
    caption: row[3] ?? "",
    anchorKey: (row[4] ?? "") === "" ? null : (row[4] as string),
    proposedType: (row[5] ?? "") === "" ? null : (row[5] as string),
    proposedCallId: (row[6] ?? "") === "" ? null : (row[6] as string),
  }));
}

/** Every `view_assignments` row of one ingest: which entity key landed in which view. */
export function assignmentRows(tenantId: string, ingestId: string): { entityKey: string; viewKey: string }[] {
  return sql(
    `select entity_key, view_key from ${ident(VIEW_ASSIGNMENTS)}
      where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid
      order by entity_key;`,
  ).map((row) => ({ entityKey: row[0] ?? "", viewKey: row[1] ?? "" }));
}

/** Every `grids` row of one ingest, in bubble-key order, as the acceptance's own audit read. */
export function storedAxisRows(tenantId: string, ingestId: string): Omit<OverlayAxis, "bubble">[] {
  return sql(
    `select view_key, family, label, axis, position::text, bubble_key, label_key, min_spacing::text
       from ${ident(GRIDS)}
      where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid
      order by bubble_key;`,
  ).map((row) => ({
    viewKey: row[0] ?? "",
    family: row[1] ?? "",
    label: row[2] ?? "",
    axis: row[3] ?? "",
    position: Number(row[4] ?? ""),
    bubbleKey: row[5] ?? "",
    labelKey: row[6] ?? "",
    minSpacing: Number(row[7] ?? ""),
  }));
}

/** Every `grid_deferrals` row of one ingest, as the acceptance's own audit read. */
export function storedDeferralRows(tenantId: string, ingestId: string): OverlayDeferral[] {
  return sql(
    `select view_key, reason from ${ident(GRID_DEFERRALS)}
      where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid
      order by view_key;`,
  ).map((row) => ({ viewKey: row[0] ?? "", reason: row[1] ?? "" }));
}

/* --------------------------------------------- an overlay a surface is read over, without a store */

/** One view of an overlay, in the shape the increment's interface list publishes. */
export function aView(over: Partial<OverlayView> & { viewKey: string }): OverlayView {
  return {
    type: LAYOUT_PLAN,
    reason: null,
    caption: `caption of ${over.viewKey}`,
    anchorKey: `DXF_HANDLE:${over.viewKey}`,
    proposed: null,
    confirmed: null,
    entityCount: 3,
    box: { min: [0, -100], max: [200, 0] },
    ...over,
  };
}

/** One axis of an overlay, the same way. */
export function anAxis(over: Partial<OverlayAxis> & { viewKey: string; bubbleKey: string }): OverlayAxis {
  return {
    family: "letter",
    label: "A",
    axis: "x",
    position: 20,
    labelKey: `${over.bubbleKey}-label`,
    minSpacing: 20,
    bubble: { centre: [20, -30], radius: 3 },
    ...over,
  };
}

/**
 * The overlay every surface criterion is read over: a typed view standing on the sheet, a view the
 * grammar could not read (proposed at one class), two more silent views (one proposed at the same
 * class, one at another), a view standing on no box of this sheet, two bubbled axes, one axis with
 * no ring behind it, and one layout plan that georeferenced as deferred.
 */
export function overlayFixture(ingestId = "11111111-1111-4111-8111-111111111111"): Overlay {
  return {
    ingestId,
    views: [
      aView({ viewKey: "plan-1", type: LAYOUT_PLAN, entityCount: 12, box: { min: [0, -100], max: [200, 0] } }),
      aView({ viewKey: "silent-1", type: UNTYPED, reason: CAPTION_UNCLASSIFIABLE, entityCount: 4, proposed: { type: DETAIL, callId: "call-1" }, box: { min: [400, -80], max: [520, -10] } }),
      aView({ viewKey: "silent-2", type: UNTYPED, reason: CAPTION_UNCLASSIFIABLE, entityCount: 5, proposed: { type: DETAIL, callId: "call-2" }, box: { min: [600, -80], max: [700, -10] } }),
      aView({ viewKey: "silent-3", type: UNTYPED, reason: CAPTION_UNCLASSIFIABLE, entityCount: 6, proposed: { type: LEGEND_NOTES, callId: "call-3" }, box: { min: [750, -80], max: [820, -10] } }),
      aView({ viewKey: "elsewhere-1", type: SCHEDULE, entityCount: 7, box: null }),
    ],
    axes: [
      anAxis({ viewKey: "plan-1", bubbleKey: "ring-a", label: "A", axis: "x", position: 20, bubble: { centre: [20, -30], radius: 3 } }),
      anAxis({ viewKey: "plan-1", bubbleKey: "ring-1", family: "numeral", label: "1", axis: "y", position: -40, bubble: { centre: [-30, -40], radius: 3 } }),
      anAxis({ viewKey: "plan-1", bubbleKey: "ring-b", label: "B", axis: "x", position: 60, bubble: null }),
    ],
    deferrals: [{ viewKey: "elsewhere-1", reason: GRID_NO_BUBBLE_EVIDENCE }],
  };
}

/* ------------------------------------------------------------------ derivations both sides share */

/** How many decimals two readings of one measurement are compared to (a double's last bit is free). */
const PLACES = 9;

/** One measurement, at the precision the two sides are compared to; a rounded zero is positive zero. */
export function atPrecision(value: number): number {
  const rounded = Math.round(value * 10 ** PLACES) / 10 ** PLACES;
  return rounded === 0 ? 0 : rounded;
}

/** A box at that precision, or null — so two derivations of one union compare as values. */
export function boxAtPrecision(box: Box | null): Box | null {
  return box === null
    ? null
    : {
        min: [atPrecision(box.min[0]), atPrecision(box.min[1])],
        max: [atPrecision(box.max[0]), atPrecision(box.max[1])],
      };
}

/** Any list of rows, in one comparable order — a door's order is nobody's contract but the spec's. */
export function byKey<T>(rows: readonly T[], of: (row: T) => string): T[] {
  return [...rows].sort((left, right) => (of(left) < of(right) ? -1 : of(left) > of(right) ? 1 : 0));
}
