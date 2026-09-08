/**
 * AC-1 — the data door mirrors the store.
 *
 * The expectations are READ, never transcribed (B-19): every row this criterion compares against is
 * taken out of the lane database by SQL, and every box is the union of `recordBox`'s own answer over
 * the manifest the sheet is drawn from — so a partition that stores different rows, or a record
 * measured a different way, moves both sides at once (B-17). The staging is the product's own: the
 * shipped ingest pipeline over a stand-in extractor, then the shipped partition job with a recorded
 * model answer minted for each caption the grammar cannot read.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  CAPTION_UNCLASSIFIABLE,
  MODEL_SPACE,
  PART_HEAD,
  PART_PARTITION,
  VIEWER_MODULE,
  VIEWER_CLIENT_MODULE,
  assignmentRows,
  atPrecision,
  boxAtPrecision,
  byKey,
  overlayServer,
  productModule,
  runOverlayPartition,
  stageOverlayIngest,
  storedAxisRows,
  storedDeferralRows,
  storedViewRows,
  UNTYPED,
  viewerRoute,
  type Box,
  type Overlay,
  type OverlayAxis,
  type OverlayView,
  type StagedOverlay,
} from "./support/overlay-stage";
import { PRINCIPAL, closeStage, grantRole, openSheetsStage, stagePerson, storageOf } from "../partition/support/partition-stage";

/** How long a staged case may take: two ingests recorded and a partition rebuilt over one of them. */
const BUDGET_MS = 600_000;

/** The address the in-process feed is dialled on — the handler reads only the path and the query. */
const DIALLED = "http://127.0.0.1";

type Staged = StagedOverlay & { unpartitionedDrawingId: string };

let staging: Promise<Staged> | undefined;

/** The stage, prepared once and awaited by each test rather than staged in a hook that can hide. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("overlay");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);

    const ingested = await stageOverlayIngest(person, projectId, 7, "overlay-plan");
    await runOverlayPartition(person, ingested, "overlay");

    // A second drawing of the same project, read through but never partitioned: the absence AC-1
    // names is a drawing whose partition has never been rebuilt, not a drawing nobody uploaded.
    const bare = await stageOverlayIngest(person, projectId, 9, "overlay-unpartitioned");

    // What the staging left, asserted here rather than in each criterion: a stage that did not
    // partition what the criteria are read on would grade nothing, and would say so late.
    const views = storedViewRows(person.tenantId, ingested.ingestId);
    expect(views.length, "the staged drawing partitioned into views").toBeGreaterThan(0);
    expect(
      views.filter((row) => row.type === UNTYPED && row.reason === CAPTION_UNCLASSIFIABLE).length,
      "the staged drawing carries views the grammar could not read, each with the stored reason",
    ).toBeGreaterThan(0);
    expect(
      new Set(views.filter((row) => row.proposedType !== null).map((row) => row.proposedType)).size,
      "and a recorded answer proposed a class for them, at more than one class",
    ).toBeGreaterThan(1);
    expect(storedAxisRows(person.tenantId, ingested.ingestId).length, "the staged drawing georeferenced a grid").toBeGreaterThan(1);
    expect(storedDeferralRows(person.tenantId, ingested.ingestId).length, "and left a layout plan with no grid to read").toBeGreaterThan(0);

    return {
      person,
      projectId,
      drawing: ingested.drawing,
      drawingId: ingested.drawing.drawingId,
      ingestId: ingested.ingestId,
      layoutName: MODEL_SPACE,
      artifact: ingested.artifact,
      unpartitionedDrawingId: bare.drawing.drawingId,
    };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** What the feed answers for one part of one sheet, asked in process, wearing one session. */
async function feed(stage: Staged, drawingId: string, part: string, cookie: string | null = stage.person.cookie): Promise<{ status: number; body: Record<string, unknown> }> {
  const route = await viewerRoute();
  const url = `${DIALLED}/api/viewer/${drawingId}/${encodeURIComponent(stage.layoutName)}?tenant=${stage.person.tenantId}&part=${part}`;
  const headers: Record<string, string> = {};
  if (cookie !== null) headers["cookie"] = cookie;
  const answer = await route.GET(new Request(url, { headers }), { params: Promise.resolve({ drawing: drawingId, layout: stage.layoutName }) });
  return { status: answer.status, body: (await answer.json()) as Record<string, unknown> };
}

/** The overlay the door answers for the staged sheet. */
async function overlayOf(stage: Staged, drawingId: string): Promise<Overlay | null> {
  const door = await overlayServer();
  return door.partitionOverlayOf({ tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId, layoutName: stage.layoutName });
}

/** One record of the drawn sheet, as the manifest states it. */
type Drawn = { key?: string; src?: string; type: string; points?: unknown };

/**
 * Every record of the opened layout, by the source key it belongs to — a derived record is paint of
 * its parent and joins that parent's view (L-CAD-03, I-86), which is exactly what `src` says.
 */
async function sheetRecords(stage: Staged): Promise<Map<string, Drawn[]>> {
  const seam = await productModule<{
    renderManifestOf: (scope: { tenantId: string; drawingId: string; layoutName: string }, deps: { storage: unknown }) => Promise<{ kind: string; manifest?: { layers: { records: Drawn[] }[] } }>;
  }>(VIEWER_MODULE);
  const head = await seam.renderManifestOf({ tenantId: stage.person.tenantId, drawingId: stage.drawingId, layoutName: stage.layoutName }, { storage: await storageOf() });
  expect(head.kind, "the staged sheet renders as a manifest — the overlay is drawn over that sheet").toBe("manifest");

  const byIdentity = new Map<string, Drawn[]>();
  for (const layer of head.manifest?.layers ?? []) {
    for (const record of layer.records) {
      const identity = record.key ?? record.src ?? "";
      if (identity === "") continue;
      byIdentity.set(identity, [...(byIdentity.get(identity) ?? []), record]);
    }
  }
  return byIdentity;
}

/** The union of the world boxes of some records, measured by the seam's own `recordBox` (B-17). */
async function unionOf(records: readonly Drawn[]): Promise<Box | null> {
  const client = await productModule<{ recordBox: (record: unknown) => { min: [number, number]; max: [number, number] } | null }>(VIEWER_CLIENT_MODULE);
  let held: Box | null = null;
  for (const record of records) {
    const box = client.recordBox(record);
    if (box === null) continue;
    held =
      held === null
        ? { min: [box.min[0], box.min[1]], max: [box.max[0], box.max[1]] }
        : {
            min: [Math.min(held.min[0], box.min[0]), Math.min(held.min[1], box.min[1])],
            max: [Math.max(held.max[0], box.max[0]), Math.max(held.max[1], box.max[1])],
          };
  }
  return held;
}

/** Where a ring stands and how big it is, read off the ring's own vertices (L-CAD-07's bubble). */
function ringGeometry(points: readonly number[][]): { centre: [number, number]; radius: number } {
  const centre: [number, number] = [
    points.reduce((sum, point) => sum + (point[0] ?? 0), 0) / points.length,
    points.reduce((sum, point) => sum + (point[1] ?? 0), 0) / points.length,
  ];
  const radius = points.reduce((sum, point) => sum + Math.hypot((point[0] ?? 0) - centre[0], (point[1] ?? 0) - centre[1]), 0) / points.length;
  return { centre: [atPrecision(centre[0]), atPrecision(centre[1])], radius: atPrecision(radius) };
}

describe("AC-1: the door and the feed answer the partition the store holds", () => {
  test(
    "AC-1: a drawing whose partition has never been rebuilt answers no overlay, through both doors",
    async () => {
      const stage = await staged();
      expect(await overlayOf(stage, stage.unpartitionedDrawingId), "nothing has partitioned this drawing, so there is no overlay to draw").toBeNull();

      const answered = await feed(stage, stage.unpartitionedDrawingId, PART_PARTITION);
      expect(answered.status, "the absence is an answer, not a refusal and not a fault").toBe(200);
      expect(answered.body, "the feed says the same thing the door does, in the shape the contract fixes").toEqual({ overlay: null });
    },
    BUDGET_MS,
  );

  test(
    "AC-1: views hold one entry per stored row, in view-key order, carrying what the row carries",
    async () => {
      const stage = await staged();
      const overlay = await overlayOf(stage, stage.drawingId);
      expect(overlay, "the rebuilt partition answers an overlay").not.toBeNull();
      const answered = overlay as Overlay;

      expect(answered.ingestId, "the overlay names the record it is a reading of").toBe(stage.ingestId);

      const stored = storedViewRows(stage.person.tenantId, stage.ingestId);
      expect(stored.length, "the staged drawing really was partitioned into views").toBeGreaterThan(0);
      expect(
        answered.views.map((view) => view.viewKey),
        "one entry per partition_views row of the current ingest, in view-key order",
      ).toEqual(stored.map((row) => row.viewKey));

      // What each row carries, compared field by field against the row itself.
      for (const row of stored) {
        const view = answered.views.find((candidate) => candidate.viewKey === row.viewKey) as OverlayView;
        expect(view.type, `${row.viewKey} answers the type the store holds`).toBe(row.type);
        expect(view.reason, `${row.viewKey} answers the reason the store holds`).toBe(row.reason);
        expect(view.caption, `${row.viewKey} answers the caption the store holds`).toBe(row.caption);
        expect(view.anchorKey, `${row.viewKey} answers the anchor the store holds`).toBe(row.anchorKey);
        expect(view.proposed === null ? null : view.proposed.type, `${row.viewKey}'s proposal is the stored one`).toBe(row.proposedType);
        if (row.proposedCallId !== null) expect(view.proposed?.callId, `${row.viewKey}'s proposal names the call that made it`).toBe(row.proposedCallId);
        expect(view.confirmed, `${row.viewKey} carries no confirmation until somebody makes one`).toBeNull();
      }

      // The count is the assignments naming that view — read from the store, never counted here twice.
      const assignments = assignmentRows(stage.person.tenantId, stage.ingestId);
      expect(assignments.length, "the staged partition really assigned entities to views").toBeGreaterThan(0);
      for (const view of answered.views) {
        const members = assignments.filter((row) => row.viewKey === view.viewKey);
        expect(view.entityCount, `${view.viewKey} counts the assignments naming it`).toBe(members.length);
      }

      // The box is the union of the world boxes of that view's member records standing on this sheet.
      const records = await sheetRecords(stage);
      for (const view of answered.views) {
        const members = assignments.filter((row) => row.viewKey === view.viewKey).flatMap((row) => records.get(row.entityKey) ?? []);
        const expected = boxAtPrecision(await unionOf(members));
        expect(boxAtPrecision(view.box), `${view.viewKey}'s box is the union of its members' boxes on ${stage.layoutName}, or null where none stands on it`).toEqual(expected);
      }

      expect(
        answered.views.some((view) => view.box !== null),
        "the staged sheet really does stand some views on it — an overlay of nothing would grade nothing",
      ).toBe(true);
    },
    BUDGET_MS,
  );

  test(
    "AC-1: axes hold one entry per stored grid row, in bubble-key order, bubbled at the ring's own geometry",
    async () => {
      const stage = await staged();
      const answered = (await overlayOf(stage, stage.drawingId)) as Overlay;
      const stored = storedAxisRows(stage.person.tenantId, stage.ingestId);
      expect(stored.length, "the staged drawing really did georeference a grid").toBeGreaterThan(0);

      expect(
        answered.axes.map((axis) => axis.bubbleKey),
        "one entry per grids row of the current ingest, in bubble-key order",
      ).toEqual(stored.map((row) => row.bubbleKey));

      const rings = new Map(stage.artifact.originals.filter((record) => record.closed === true).map((record) => [record.key, record.points ?? []]));
      for (const row of stored) {
        const axis = answered.axes.find((candidate) => candidate.bubbleKey === row.bubbleKey) as OverlayAxis;
        expect(
          { viewKey: axis.viewKey, family: axis.family, label: axis.label, axis: axis.axis, labelKey: axis.labelKey },
          `${row.bubbleKey} answers the reading the store holds`,
        ).toEqual({ viewKey: row.viewKey, family: row.family, label: row.label, axis: row.axis, labelKey: row.labelKey });
        expect(atPrecision(axis.position), `${row.bubbleKey} answers the stored position`).toBe(atPrecision(row.position));
        expect(atPrecision(axis.minSpacing), `${row.bubbleKey} answers the stored minimum spacing`).toBe(atPrecision(row.minSpacing));

        const ring = rings.get(row.bubbleKey);
        expect(ring, `the bubble ${row.bubbleKey} is a ring the drawing really carries`).toBeDefined();
        const geometry = ringGeometry(ring as number[][]);
        expect(axis.bubble, `${row.bubbleKey}'s bubble stands at the ring's own centre and radius`).not.toBeNull();
        expect(
          { centre: [atPrecision(axis.bubble?.centre[0] ?? NaN), atPrecision(axis.bubble?.centre[1] ?? NaN)], radius: atPrecision(axis.bubble?.radius ?? NaN) },
          `${row.bubbleKey}'s bubble is derived from the ring record, never from the label`,
        ).toEqual(geometry);
      }
    },
    BUDGET_MS,
  );

  test(
    "AC-1: deferrals hold one entry per stored grid_deferrals row",
    async () => {
      const stage = await staged();
      const answered = (await overlayOf(stage, stage.drawingId)) as Overlay;
      const stored = storedDeferralRows(stage.person.tenantId, stage.ingestId);
      expect(stored.length, "the staged drawing really did leave a layout plan with no grid to read").toBeGreaterThan(0);
      expect(
        byKey(answered.deferrals, (row) => `${row.viewKey}|${row.reason}`),
        "one entry per grid_deferrals row, carrying the view and the closed reason the store holds",
      ).toEqual(byKey(stored, (row) => `${row.viewKey}|${row.reason}`));
    },
    BUDGET_MS,
  );

  test(
    "AC-1: the feed's ?part=partition answers exactly what the door answered, beside ?part=head",
    async () => {
      const stage = await staged();
      const answered = (await overlayOf(stage, stage.drawingId)) as Overlay;
      const head = await feed(stage, stage.drawingId, PART_HEAD);
      expect(head.status, "the head still answers — this part stands beside it, it does not replace it").toBe(200);

      const part = await feed(stage, stage.drawingId, PART_PARTITION);
      expect(part.status, "a member of the workspace is answered the partition").toBe(200);
      expect(part.body, "the feed carries the door's answer whole, under `overlay`").toEqual(JSON.parse(JSON.stringify({ overlay: answered })));
    },
    BUDGET_MS,
  );
});
