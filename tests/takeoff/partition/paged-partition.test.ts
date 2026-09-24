/**
 * M4P-2 on the live store: a paged drawing — a PDF set, a scan — is partitioned page by page by the
 * shipped partition job, each view is stored with the page it was read on, and the doors a QS reads
 * a sheet through place each view on its own page (s-drawings I-681 and I-682, viewer I-683).
 *
 * The staging is the product's own: the shipped ingest job over a stand-in extractor handing back a
 * two-page PDF_OBJECT artifact — page 1 a captioned column layout plan, page 2 lines with no text at
 * all, as a scanned sheet reads once traced — then the shipped partition job. (A traced scan's lines
 * are RASTER_TRACE keys, partitioned by the same rule: `views/__tests__/pages.test.ts` and
 * `tests/cad/pdf-sheets.test.ts`; the stand-in extractor here writes no page raster for them.) Nothing is asked of a model: a page's
 * caption the grammar cannot type anchors no view, so there is no untyped view to ask about.
 */
import { afterAll, describe, expect, test } from "vitest";
import { partitionOverlayOf } from "@/modules/takeoff/viewer-partition-overlay/server";
import { sheetIndexOf } from "@/modules/takeoff/sheets";
import { writtenAtV3 } from "../../cad/support/entitygraph-versions";
import { stageDrawing, stubCli, withCadCommand } from "../support/ingest-stage";
import {
  INGEST_JOB_MODULE,
  INGEST_MODULE,
  PRINCIPAL,
  closeStage,
  grantRole,
  openSheetsStage,
  productModule,
  sqlValue,
  stagePerson,
  stepSink,
  storageOf,
  tempDir,
  unique,
  rebuildDoor,
  type Person,
  type ProgressLike,
} from "./support/partition-stage";

const BUDGET_MS = 600_000;

const PAGE_1 = "Page 1";
const PAGE_2 = "Page 2";
const CAPTION = "COLUMN LAYOUT PLAN  SCALE 1:100";
const COLOUR = { rgb: [0, 0, 0], source: "truecolor" };

function keyOf(scheme: "PDF_OBJECT", salt: number, n: number): string {
  return `${scheme}:${(salt * 0x10000 + n).toString(16).toUpperCase().padStart(64, "0")}`;
}

type Built = { json: string; caption: string; titleKeys: readonly string[]; page1: readonly string[]; page2: readonly string[] };

/** Two pages, as the PDF lane inventories them: paper, no window onto any model space (I-511). */
function buildPagedArtifact(salt: number): Built {
  const caption = keyOf("PDF_OBJECT", salt, 1);
  const titleKeys = [keyOf("PDF_OBJECT", salt, 2), keyOf("PDF_OBJECT", salt, 3)];
  const page1 = [
    { key: caption, type: "TEXT", space: PAGE_1, layer: "0", text: CAPTION, height: 11.34, points: [[198, 351]] },
    { key: titleKeys[0], type: "TEXT", space: PAGE_1, layer: "0", text: "S-10", height: 12.76, points: [[2191, 1309]] },
    { key: titleKeys[1], type: "TEXT", space: PAGE_1, layer: "0", text: "B", height: 12.76, points: [[2302, 1309]] },
    { key: keyOf("PDF_OBJECT", salt, 4), type: "LINE", space: PAGE_1, layer: "0", points: [[422, 626], [1077, 626]] },
    { key: keyOf("PDF_OBJECT", salt, 5), type: "LINE", space: PAGE_1, layer: "0", points: [[1077, 626], [1077, 1152]] },
  ];
  const page2 = [
    { key: keyOf("PDF_OBJECT", salt, 6), type: "LINE", space: PAGE_2, layer: "0", points: [[0, 0], [400, 0]] },
    { key: keyOf("PDF_OBJECT", salt, 7), type: "LINE", space: PAGE_2, layer: "0", points: [[0, 0], [0, 300]] },
  ];
  const page = (name: string) => ({ name, kind: "paper", bbox: { min: [0, 0], max: [2400, 1700] }, strays_rejected: 0, viewports: [] });
  const graph = writtenAtV3({
    entitygraph_version: 3,
    ingest: { scheme: "PDF_OBJECT", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 0, unit: "unitless", unmapped: false },
    layouts: [page(PAGE_1), page(PAGE_2)],
    dropped_layouts: [],
    entities: [...page1, ...page2].map((entity) => ({ ...entity, colour: COLOUR })),
    derived: [],
    block_attributes: [],
    counters: [],
  });
  return { json: JSON.stringify(graph), caption, titleKeys, page1: page1.map((entity) => entity.key as string), page2: page2.map((entity) => entity.key) };
}

type CardReading = [layoutName: string, viewCount: number | null, scaleState: string, unplaceableViews: number | null];

type Staged = {
  person: Person;
  projectId: string;
  drawingId: string;
  ingestId: string;
  built: Built;
  steps: { step: string; detail: Record<string, unknown> }[];
  /** The drawing's cards read between its ingest and its partition (I-513 holds there). */
  unpartitioned: CardReading[];
};

async function cardReadings(tenantId: string, projectId: string, drawingId: string): Promise<CardReading[]> {
  const cards = (await sheetIndexOf({ tenantId, projectId })).filter((card) => card.drawingId === drawingId);
  return cards.map((card): CardReading => [card.layoutName, card.viewCount, card.scaleState, card.unplaceableViews]).sort();
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("paged");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);

    const job = await productModule<{ runIngestJob: (payload: unknown, progress: ProgressLike, deps: { storage: unknown }) => Promise<void> }>(INGEST_JOB_MODULE);
    const records = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>(INGEST_MODULE);
    const built = buildPagedArtifact(0x4d42);
    const drawing = await stageDrawing(person, projectId, new TextEncoder().encode(`%PDF-1.7\n% ${unique("paged")}\n%%EOF\n`), { name: unique("paged.pdf"), format: "pdf" });
    const stub = stubCli({ artifact: built.json, stderr: "", exitCode: 0 });
    await withCadCommand(stub.command, async () => {
      await job.runIngestJob(
        { tenantId: person.tenantId, drawingId: drawing.drawingId, requestedBy: person.userId, declared: null },
        { jobId: unique("ingest-paged"), tempDir: tempDir("ingest"), step: async () => undefined },
        { storage: await storageOf() },
      );
    });
    const record = await records.ingestRecordOf({ tenantId: person.tenantId, drawingId: drawing.drawingId });
    expect(record, "the paged drawing was ingested").not.toBeNull();
    const ingestId = (record as { ingestId: string }).ingestId;
    const unpartitioned = await cardReadings(person.tenantId, projectId, drawing.drawingId);

    const rebuild = await rebuildDoor();
    const sink = stepSink("paged");
    await rebuild.runPartitionJob({ tenantId: person.tenantId, drawingId: drawing.drawingId, ingestId, requestedBy: person.userId }, sink.progress, { storage: await storageOf() });
    return { person, projectId, drawingId: drawing.drawingId, ingestId, built, steps: sink.steps, unpartitioned };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The stored views of the record, with the page each was read on. */
function storedViews(tenantId: string, ingestId: string): { viewKey: string; type: string; anchorKey: string | null; page: string | null }[] {
  const rows = sqlValue(
    `select coalesce(json_agg(json_build_object('viewKey', view_key, 'type', type, 'anchorKey', anchor_key, 'page', page) order by view_key), '[]'::json)::text
       from partition_views where tenant_id = '${tenantId}'::uuid and ingest_id = '${ingestId}'::uuid;`,
  );
  return JSON.parse(rows) as { viewKey: string; type: string; anchorKey: string | null; page: string | null }[];
}

/** Which view each original of the record was assigned to. */
function storedAssignments(tenantId: string, ingestId: string): Map<string, string> {
  const rows = sqlValue(
    `select coalesce(json_agg(json_build_array(entity_key, view_key)), '[]'::json)::text
       from view_assignments where tenant_id = '${tenantId}'::uuid and ingest_id = '${ingestId}'::uuid;`,
  );
  return new Map(JSON.parse(rows) as [string, string][]);
}

describe("M4P-2: a paged drawing is partitioned page by page, on the live store", () => {
  test(
    "each page's views are stored with their page, and every original is assigned once to a view of its page",
    async () => {
      const stage = await staged();
      const views = storedViews(stage.person.tenantId, stage.ingestId);
      const plan = views.find((view) => view.anchorKey === stage.built.caption);
      expect(plan, "the typed caption anchors a stored view").toMatchObject({ type: "LAYOUT_PLAN", page: PAGE_1 });
      expect(views.filter((view) => view.page === PAGE_2), "the text-less page is one view no caption anchors, on its own page").toEqual([
        { viewKey: `UNASSIGNED:${PAGE_2}`, type: "UNASSIGNED", anchorKey: null, page: PAGE_2 },
      ]);
      expect(views.length, "and nothing else: the sheet number and revision letter anchor no view").toBe(2);

      const assigned = storedAssignments(stage.person.tenantId, stage.ingestId);
      expect(assigned.size, "every original of both pages is assigned").toBe(stage.built.page1.length + stage.built.page2.length);
      for (const key of stage.built.page1) expect(assigned.get(key), `${key} is the plan's`).toBe(plan?.viewKey);
      for (const key of stage.built.page2) expect(assigned.get(key), `${key} is its page's own view`).toBe(`UNASSIGNED:${PAGE_2}`);
    },
    BUDGET_MS,
  );

  test(
    "the views step says it read pages, and the stages that measure read none of them",
    async () => {
      const stage = await staged();
      const viewsStep = stage.steps.find((step) => step.step === "views");
      expect(viewsStep?.detail, "the step states the views, the assignments and the pages").toMatchObject({ views: 2, assigned: 7, pages: 2 });
      // A LAYOUT_PLAN of model space with no bubble on it is a grid deferral; the page's plan is not
      // read for a grid at all, so it defers nothing and places nothing (I-682).
      const where = `where tenant_id = '${stage.person.tenantId}'::uuid and ingest_id = '${stage.ingestId}'::uuid`;
      expect(sqlValue(`select count(*)::text from grid_deferrals ${where};`), "no grid is read off a page").toBe("0");
      expect(sqlValue(`select count(*)::text from placements ${where};`), "and no member is placed off one").toBe("0");
    },
    BUDGET_MS,
  );

  test(
    "the partition overlay of a page lists that page's views alone",
    async () => {
      const stage = await staged();
      const scope = { tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId: stage.drawingId };
      const first = await partitionOverlayOf({ ...scope, layoutName: PAGE_1 });
      const second = await partitionOverlayOf({ ...scope, layoutName: PAGE_2 });
      expect(first?.views.map((view) => [view.type, view.entityCount]), "page 1 lists its plan, holding the page's five originals").toEqual([["LAYOUT_PLAN", 5]]);
      expect(second?.views.map((view) => [view.viewKey, view.entityCount]), "page 2 lists its one view").toEqual([[`UNASSIGNED:${PAGE_2}`, 2]]);
    },
    BUDGET_MS,
  );

  test(
    "each page's card counts its own view, the text-less page's included",
    async () => {
      const stage = await staged();
      // Before its partition a page holds no view and its card reads No scale of record, as I-513 says;
      // once partitioned it counts its views as a DXF sheet's card does — "No scale of record on 1 of
      // 1 views" (I-681 supersedes I-513's "never unplaceable" there).
      expect(stage.unpartitioned, "an unpartitioned page counts no view and reads unaffirmed (I-513)").toEqual([
        [PAGE_1, null, "unaffirmed", null],
        [PAGE_2, null, "unaffirmed", null],
      ]);
      expect(await cardReadings(stage.person.tenantId, stage.projectId, stage.drawingId), "a partitioned page counts its one unscaled view (I-681)").toEqual([
        [PAGE_1, 1, "unplaceable", 1],
        [PAGE_2, 1, "unplaceable", 1],
      ]);
    },
    BUDGET_MS,
  );
});
