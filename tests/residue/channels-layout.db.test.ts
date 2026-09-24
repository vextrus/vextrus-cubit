/**
 * RES-1, through the store: F-RCC6-BNBC's stored partition read back by the residue's three channels,
 * each sighting naming the sheet it stands on (L-QTY-05, L-REG-04, L-CAD-05; I-548, I-549).
 *
 * WHAT IS READ AND NOTHING IS STAGED FROM A MODEL: the drawing is read by the shipped `cad/` CLI and
 * the partition's pure stages (`../takeoff/partition/support/bnbc-stages`). Its reading is recorded
 * as the pinned drawing's record by the shipped ingest job (the CLI stood in for by one that answers
 * exactly the shipped CLI's artifact, so the store holds the product's own reading of F-RCC6-BNBC),
 * and the views and placements are written by `rewritePartition` — the partition's one transaction.
 * The residue is then asked the way the coverage screen asks it (`residueOf`), and every expectation
 * is read off the drawing and the store rather than transcribed (B-19).
 *
 * WHAT IS STOOD IN FOR, named rather than hidden: the campaign, its project and its pinned set come
 * from the gate's own stage (`stageCampaign`), whose drawing bytes are a stand-in the ingest job reads
 * through the stood-in CLI; one column is sighted at the register's own door, at the point the plan
 * placed it. J-000 reads the same channels over a real upload of the drawing (the read-back).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ident, lit } from "../../db/__tests__/support/live-sql";
import { TENANT_COLUMN } from "../../db/__tests__/support/fixtures";
import { viewRefOf } from "@/core/identity";
import { membershipOf, type StoredView } from "@/core/residue/channels/layout";
import { sheetLabelOf, standingOfGraph, traceCitations, type MemberKeys, type RecordStanding } from "@/core/sheets/frames";
import { COLUMN_C1, COLUMN_CLASS, COLUMN_CONCRETE_PAIR, closeStage, field, productModule, stageCampaign, storeRows, type StagedCampaign } from "../takeoff/rails/support/column-rail-stage";
import { registerSeam } from "../takeoff/register/support/register-stage";
import { INGEST_JOB_MODULE, INGEST_MODULE, UPLOADS_MODULE, stubCli, tempDir, withCadCommand } from "../takeoff/support/ingest-stage";
import { BNBC_DXF, stagesOver, type StagesRead } from "../takeoff/partition/support/bnbc-stages";
import { sql } from "../spine/uploads/support/upload-stage";

/** The shipped CLI's read, the campaign, the ingest and the partition — the whole staging's budget. */
const BUDGET_MS = 600_000;

/** The residue's door, the partition's one transaction, and the ingest seams the record is made by. */
const RESIDUE_MODULE = "src/core/residue/index.ts";
const PARTITION_STORE_MODULE = "src/modules/takeoff/partition/store.ts";

/** The three channels, as a sighting spells the one it came through (L-QTY-05). */
const REGISTER = "REGISTER";
const PARTITION = "PARTITION";
const LAYOUT = "LAYOUT";

/** A source key of the committed fixture, by its handle — the extractor identity pins them. */
const handle = (hex: string): string => `DXF_HANDLE:${hex}`;

/**
 * The eight views the plans place members in: the caption's handle, each class it places, the sheet's
 * NUMBER. TEST_AMENDED (R0 Rev C): F1's footing in ring 638 on S-06 (W-44), and the stair-roof layout
 * 2157 on S-15 with its two C4 stubs and SB-R1..SB-R4 (W-49) — one row per view and class.
 * TEST_AMENDED (GB-READ, s-schedules I-673): S-08's grade-beam layout 2073 places the grade beams
 * it letters.
 */
const VIEWS: readonly (readonly [string, string, string])[] = [
  ["20B6", "column", "S-10"],
  ["1FEB", "pile", "S-04"],
  ["202C", "pile_cap", "S-06"],
  ["202C", "footing", "S-06"],
  ["2116", "beam", "S-13"],
  ["F31", "beam", "S-14"],
  ["10C1", "beam", "S-15"],
  ["2157", "column", "S-15"],
  ["2157", "beam", "S-15"],
  ["2073", "tie_beam", "S-08"],
];

type SightingRow = { class: string; levelId: string | null; channel: string; drawingId: string; layoutName: string; sourceKey: string; declared?: boolean };

/** A sighting of what was PLACED, as against what a caption declares (s-coverage I-479) — the grain these channels are proved at. */
const placedThrough = (channel: string) => (sighting: SightingRow): boolean => sighting.channel === channel && sighting.declared !== true;
type CellRow = { kind: string; class: string | null; grain: string; sightings: SightingRow[] };
type ResidueDoor = {
  residueOf: (scope: { tenantId: string; projectId: string }) => Promise<{ input: { sightings: SightingRow[] }; cells: CellRow[] }>;
  reportedAbsencesOf: (
    scope: { tenantId: string; projectId: string },
    campaign: { campaignId: string; setRevisionId: string },
  ) => Promise<{ views: readonly { drawingId: string; anchorKey: string | null; layoutName: string }[] }>;
};
type PartitionStore = { rewritePartition: (write: Record<string, unknown>) => Promise<unknown> };
type IngestJobDoor = { runIngestJob: (payload: unknown, progress: unknown, deps: { storage: unknown }) => Promise<void> };
type IngestDoor = { ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> };
type UploadsDoor = { uploadStorage: () => unknown };

let read: StagesRead;
let standing: RecordStanding;
let staged: StagedCampaign;
let drawingId: string;
let fileName: string;
let ingestId: string;
let sightings: SightingRow[];
let cells: CellRow[];
let registeredColumn: StagesRead["placed"]["placements"][number];
let absences: Awaited<ReturnType<ResidueDoor["reportedAbsencesOf"]>>;

/** The drawing the pinned revision names first, and the name the pin recorded it under (L-REG-06). */
function pinnedDrawingOf(tenantId: string, setRevisionId: string): { drawingId: string; name: string } {
  const held = sql(`select manifest::text from drawing_set_revisions where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and set_revision_id = ${lit(setRevisionId)}::uuid;`);
  const manifest = JSON.parse(held[0]?.[0] ?? "[]") as { drawingId: string; name: string }[];
  expect(manifest.length, `the pinned revision ${setRevisionId} names the drawings its set holds`).toBeGreaterThan(0);
  return manifest[0] as { drawingId: string; name: string };
}

beforeAll(async () => {
  read = await stagesOver(BNBC_DXF);
  standing = standingOfGraph(read.graph, new Map<string, MemberKeys>(read.placed.placements.map((placement) => [placement.placementKey, { outlineKey: placement.outlineKey, markKey: placement.markKey }])));
  staged = await stageCampaign("res1-sheets", { methods: [COLUMN_CONCRETE_PAIR], objects: 0 });
  ({ drawingId, name: fileName } = pinnedDrawingOf(staged.tenantId, staged.setRevisionId));

  /* --- the pinned drawing's record: the shipped ingest job over the shipped CLI's reading --- */
  const stub = stubCli({ artifact: JSON.stringify(read.graph), stderr: "", exitCode: 0 });
  const job = await productModule<IngestJobDoor>(INGEST_JOB_MODULE);
  const storage = (await productModule<UploadsDoor>(UPLOADS_MODULE)).uploadStorage();
  await withCadCommand(stub.command, () =>
    job.runIngestJob(
      { tenantId: staged.tenantId, drawingId, requestedBy: staged.person.userId, declared: null },
      { jobId: randomUUID(), tempDir: tempDir("res1-sheets"), step: async () => undefined },
      { storage },
    ),
  );
  const record = await (await productModule<IngestDoor>(INGEST_MODULE)).ingestRecordOf({ tenantId: staged.tenantId, drawingId });
  expect(record, "the ingest job recorded the pinned drawing's reading").not.toBeNull();
  ingestId = (record as { ingestId: string }).ingestId;

  /* --- the partition, written by its one transaction: the views and the placements read off them --- */
  const store = await productModule<PartitionStore>(PARTITION_STORE_MODULE);
  await store.rewritePartition({
    tenantId: staged.tenantId,
    projectId: staged.projectId,
    drawingId,
    ingestId,
    views: read.evidence.views,
    assignments: read.evidence.assignments,
    proposals: new Map(),
    conventions: null,
    grid: null,
    schedules: null,
    placements: read.placed,
    expansion: null,
    proposal: null,
  });

  /* --- one column at the register's own door, at the very point the plan placed it --- */
  registeredColumn = read.placed.placements.find((placement) => placement.elementType === COLUMN_CLASS) as typeof registeredColumn;
  const level = storeRows("levels", staged.tenantId)[0];
  expect(level, "the staged project holds the level its sighting stands on").toBeDefined();
  const register = await registerSeam();
  const answer = await register.registerSighting(staged.registerScope, {
    ...COLUMN_C1,
    elementType: COLUMN_CLASS,
    label: "res1-column",
    mark: registeredColumn.mark,
    view: registeredColumn.view,
    x: registeredColumn.x,
    y: registeredColumn.y,
    level: { levelId: String(field(level, "levelId", "level_id")) },
  } as never);
  expect(field(answer as Record<string, unknown>, "registered", "registered"), `the column registered at the register's door: ${JSON.stringify(answer)}`).toBe(true);

  const door = await productModule<ResidueDoor>(RESIDUE_MODULE);
  const residue = await door.residueOf({ tenantId: staged.tenantId, projectId: staged.projectId });
  absences = await door.reportedAbsencesOf({ tenantId: staged.tenantId, projectId: staged.projectId }, { campaignId: staged.campaignId, setRevisionId: staged.setRevisionId });
  sightings = residue.input.sightings;
  cells = residue.cells;
}, BUDGET_MS);

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The sheet NUMBER one layout stands for, as a reader names it. */
function numberOf(layoutName: string): string | null {
  return sheetLabelOf(read.graph, layoutName);
}

/** The sheet the view captioned at one handle stands on, by the table above. */
function sheetOfCaption(anchor: string): string | undefined {
  return VIEWS.find(([caption]) => handle(caption) === anchor)?.[2];
}

describe("RES-1: the layout channel sees every stored placement in its view (I-549)", () => {
  test("RES-1: all of F-RCC6-BNBC's stored placements join a stored view of their record", () => {
    const views = sql(
      `select drawing_id::text, ingest_id::text, view_key, type, anchor_key from partition_views
        where ${ident(TENANT_COLUMN)} = ${lit(staged.tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid;`,
    ).map(
      (row): StoredView => ({
        drawingId: row[0] ?? "",
        ingestId: row[1] ?? "",
        viewKey: row[2] ?? "",
        // The store closes the column over L-CAD-06's eleven (`partition_views_type_closed`), so the
        // spelling read back is one the type names.
        type: (row[3] ?? "") as StoredView["type"],
        anchorKey: row[4] === "" || row[4] === undefined ? null : row[4],
      }),
    );
    const members = sql(
      `select ingest_id::text, view_key, element_type from placements
        where ${ident(TENANT_COLUMN)} = ${lit(staged.tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid;`,
    ).map((row) => ({ ingestId: row[0] ?? "", viewKey: row[1] ?? "", class: row[2] ?? "" }));
    expect(members.length, "the partition stored every member the plans place").toBe(read.placed.placements.length);
    const byClass = (klass: string): number => members.filter((member) => member.class === klass).length;
    expect([byClass("column"), byClass("pile"), byClass("pile_cap"), byClass("footing")], "29 columns (S-10's 27 and Rev C's two C4 stubs), 89 piles, 26 caps and Rev C's F1, and the beams of four layouts").toEqual([29, 89, 26, 1]);
    expect(membershipOf(views, members).length, "and the channel's join meets every one in its view — none is lost").toBe(members.length);
  });

  test("RES-1: the residue's layout channel sights each class in each view it holds a member of", () => {
    const layout = sightings.filter(placedThrough(LAYOUT));
    const expected = new Set(read.placed.placements.map((placement) => `${placement.elementType}|${placement.viewKey}`));
    expect(new Set(layout.map((sighting) => `${sighting.class}|${sighting.sourceKey}`)), "one sighting per class and view, keyed at the view as L-REG-04 spells it").toEqual(expected);
    expect(layout.length, "each once").toBe(expected.size);
  });
});

describe("RES-1: a coverage read-back names the sheet per sighting (I-548)", () => {
  test("RES-1: a layout sighting names the sheet its view stands on", () => {
    const layout = sightings.filter(placedThrough(LAYOUT));
    expect(layout.length, "each class in each of the eight views the plans place members in is sighted").toBe(VIEWS.length);
    for (const sighting of layout) {
      const anchor = viewRefOf(sighting.sourceKey)?.captionAnchorSourceKey ?? "";
      expect(numberOf(sighting.layoutName), `the ${sighting.class} view anchored at ${anchor} stands on ${sheetOfCaption(anchor) ?? "?"}`).toBe(sheetOfCaption(anchor));
    }
  });

  test("RES-1: a partition sighting names the sheet the member's Trace opens", () => {
    const partition = sightings.filter(placedThrough(PARTITION));
    expect(partition.length, "one sighting per placement").toBe(read.placed.placements.length);
    const byKey = new Map(read.placed.placements.map((placement) => [placement.placementKey, placement]));
    const bySheet = new Map<string, number>();
    for (const sighting of partition) {
      const placementKey = [...byKey.keys()].find((key) => sighting.sourceKey === key || sighting.sourceKey.startsWith(`${key}@`));
      expect(placementKey, `${sighting.sourceKey} is a placement the stages placed`).toBeDefined();
      const placed = byKey.get(placementKey as string) as (typeof read.placed.placements)[number];
      expect(sighting.layoutName, `${placed.placementKey} stands where its Trace opens (I-421)`).toBe(traceCitations({ viewKey: placed.viewKey, sources: [placed.placementKey] }, standing).layoutName);
      const tally = `${sighting.class}@${numberOf(sighting.layoutName) ?? "model"}`;
      bySheet.set(tally, (bySheet.get(tally) ?? 0) + 1);
    }
    const expected = new Map<string, number>();
    for (const [caption, klass, sheet] of VIEWS) {
      const placed = read.placed.placements.filter((placement) => viewRefOf(placement.viewKey)?.captionAnchorSourceKey === handle(caption) && placement.elementType === klass).length;
      expected.set(`${klass}@${sheet}`, (expected.get(`${klass}@${sheet}`) ?? 0) + placed);
    }
    expect(Object.fromEntries(bySheet), "columns on S-10 and S-15, piles on S-04, caps and F1 on S-06, grade beams on S-08, beams on S-13, S-14 and S-15").toEqual(Object.fromEntries(expected));
  });

  test("RES-1: the register's sighting names the sheet its placement stands on", () => {
    const registered = sightings.filter((sighting) => sighting.channel === REGISTER);
    expect(registered.map((sighting) => sighting.sourceKey), "the one column sighted at the register's door").toEqual([registeredColumn.placementKey]);
    expect(numberOf((registered[0] as SightingRow).layoutName), "stands on S-10, the column layout plan that placed it").toBe("S-10");
  });

  test("RES-1: a caption's declaration names the sheet the caption stands on", () => {
    const declared = sightings.filter((sighting) => sighting.declared === true && sheetOfCaption(sighting.sourceKey) !== undefined);
    expect(declared.length, "the eight plans' captions declare what they place").toBeGreaterThan(0);
    for (const sighting of declared) {
      expect(numberOf(sighting.layoutName), `the caption at ${sighting.sourceKey} stands on ${sheetOfCaption(sighting.sourceKey) ?? "?"}`).toBe(sheetOfCaption(sighting.sourceKey));
    }
  });

  test("RES-1: the register's deferrals open each view on the sheet its caption stands on", () => {
    for (const [caption, , sheet] of VIEWS) {
      const view = absences.views.find((one) => one.anchorKey === handle(caption));
      expect(view, `the stored partition holds the view captioned at ${caption}`).toBeDefined();
      expect(numberOf((view as { layoutName: string }).layoutName), `a deferral about it is opened on ${sheet}, never at ${fileName}`).toBe(sheet);
    }
  });

  test("RES-1: no sighting names the file the pin recorded the drawing under", () => {
    const named = new Set(sightings.map((sighting) => sighting.layoutName));
    expect(named.has(fileName), `${fileName} is the drawing's name, not a sheet of it`).toBe(false);
    expect(named.has(""), "and every sighting on the pinned drawing names a sheet").toBe(false);
  });

  test("RES-1: the column's coverage cells carry what was sighted, each on its sheet", () => {
    const columnCells = cells.filter((cell) => cell.grain === "CELL" && cell.class === COLUMN_CLASS);
    expect(columnCells.length, "the sighted column bears cells").toBeGreaterThan(0);
    for (const cell of columnCells) {
      const layout = cell.sightings.filter(placedThrough(LAYOUT));
      // TEST_AMENDED (R0 Rev C, W-49): the stair-roof layout 2157 places the two C4 stubs, so a column
      // cell carries two plans' sightings — S-10's column layout plan and S-15's stair-roof layout.
      expect(
        layout.map((sighting) => `${viewRefOf(sighting.sourceKey)?.captionAnchorSourceKey ?? ""}@${numberOf(sighting.layoutName) ?? "model"}`).sort(),
        `${cell.kind} on ${cell.class} carries each column plan's own sighting, on its own sheet`,
      ).toEqual([`${handle("20B6")}@S-10`, `${handle("2157")}@S-15`]);
    }
  });
});
