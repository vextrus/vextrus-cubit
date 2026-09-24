/**
 * M4P-4 (I-684) over a live store: a scan ingested by the shipped job through the real vectoriser
 * (I-584), then (1) its sheet's tiers drawn from the scan by the shipped thumbnails job, (2) the viewer
 * head naming the scan it paints under the traced lines, at the corners the artifact records, and
 * (3) the feed's `?part=backdrop` serving that scan's picture to a participant and refusing everybody
 * else by the one refusal the sheet itself answers.
 *
 * Every expectation is read from what the product wrote (B-19): the artifact's own `rasters[]`, the
 * page raster at the address it names, and the tiers `renderSheet` draws of the same graph with the
 * scan and without it.
 */
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { corpusBytes, stageDrawing } from "../support/ingest-stage";
import { closeStage, enrol, openSheetsStage, productModule, stagePerson, storageOf, tempDir, unique, type Person, type StorageLike } from "../support/sheets-stage";

const BUDGET_MS = 600_000;
const ROUTE_MODULE = "src/app/api/viewer/[drawing]/[layout]/route.ts";
const PNG_MODULE = "src/modules/takeoff/thumbnails/png.ts";
const RASTER_MODULE = "src/modules/takeoff/thumbnails/raster.ts";
const THUMBNAILS_MODULE = "src/modules/takeoff/thumbnails/index.ts";
const INGEST_MODULE = "src/modules/takeoff/ingest/index.ts";
const INGEST_JOB_MODULE = "src/modules/takeoff/ingest/job.ts";

type Grey = { width: number; height: number; pixels: Uint8Array };
type RasterRecord = { space: string; sha256: string; width: number; height: number; placement: [number, number][] };
type Graph = { layouts: { name: string }[]; rasters?: RasterRecord[] };
type Route = { GET: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response> };
type Record_ = { ingestId: string; artifactSha256: string };

interface Staged {
  person: Person;
  projectId: string;
  drawingId: string;
  record: Record_;
  graph: Graph;
  scan: RasterRecord;
  storage: StorageLike;
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("scan-backdrop");
    const bytes = corpusBytes(join("fixtures", "rcc6-bnbc", "images", "hook-detail-scan.png"));
    const drawing = await stageDrawing(person, projectId, bytes, { name: unique("scan.png"), format: "png" });
    const job = await productModule<{ runIngestJob: (payload: unknown, progress: unknown, deps: { storage: StorageLike }) => Promise<void> }>(INGEST_JOB_MODULE);
    const storage = await storageOf();
    await job.runIngestJob(
      { tenantId: person.tenantId, drawingId: drawing.drawingId, requestedBy: person.userId, declared: null },
      { jobId: unique("ingest-scan"), tempDir: tempDir("ingest-scan"), step: async () => undefined },
      { storage },
    );
    const ingest = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<Record_ | null> }>(INGEST_MODULE);
    const record = await ingest.ingestRecordOf({ tenantId: person.tenantId, drawingId: drawing.drawingId });
    expect(record, "the scan was traced and recorded by the shipped ingest job").not.toBeNull();
    const artifact = await storage.get(person.tenantId, (record as Record_).artifactSha256);
    const graph = JSON.parse(new TextDecoder().decode(artifact as Uint8Array)) as Graph;
    const scan = graph.rasters?.[0];
    expect(scan, "the artifact records the page raster its lines were traced from (I-584)").toBeDefined();
    return { person, projectId, drawingId: drawing.drawingId, record: record as Record_, graph, scan: scan as RasterRecord, storage };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

async function pageRaster(stage: Staged): Promise<Grey> {
  const png = await productModule<{ decodeGreyPng: (bytes: Uint8Array) => Grey }>(PNG_MODULE);
  const bytes = await stage.storage.get(stage.person.tenantId, stage.scan.sha256);
  expect(bytes, "the page raster is held at the address its record names").not.toBeNull();
  return png.decodeGreyPng(bytes as Uint8Array);
}

async function feed(stage: Staged, cookie: string | null, query: string): Promise<Response> {
  const route = await productModule<Route>(ROUTE_MODULE);
  const url = `http://127.0.0.1/api/viewer/${stage.drawingId}/${encodeURIComponent(stage.scan.space)}?tenant=${stage.person.tenantId}&${query}`;
  const headers: Record<string, string> = {};
  if (cookie !== null) headers["cookie"] = cookie;
  return route.GET(new Request(url, { headers }), { params: Promise.resolve({ drawing: stage.drawingId, layout: stage.scan.space }) });
}

describe("a scan painted under its trace (M4P-4, I-684)", () => {
  test(
    "the scanned sheet's tiers are drawn from the scan: every tier the job stored is the graph drawn with its page raster under it",
    async () => {
      const stage = await staged();
      const thumbnails = await productModule<{
        runThumbnailsJob: (payload: unknown, progress: unknown, deps: { storage: StorageLike }) => Promise<void>;
        sheetRasterRecords: (scope: { tenantId: string; ingestId: string }) => Promise<{ layoutName: string; tier: string; sha256: string }[]>;
        RASTER_TIER_LONG_EDGE: Record<string, number>;
      }>(THUMBNAILS_MODULE);
      const raster = await productModule<{ renderSheet: (graph: Graph, layout: string, longEdge: number, scans?: unknown[]) => { png: Uint8Array } }>(RASTER_MODULE);
      await thumbnails.runThumbnailsJob(
        { tenantId: stage.person.tenantId, drawingId: stage.drawingId, ingestId: stage.record.ingestId, requestedBy: stage.person.userId },
        { jobId: unique("thumbs-scan"), tempDir: tempDir("thumbs-scan"), step: async () => undefined },
        { storage: stage.storage },
      );
      const rows = await thumbnails.sheetRasterRecords({ tenantId: stage.person.tenantId, ingestId: stage.record.ingestId });
      const image = await pageRaster(stage);
      for (const row of rows.filter((candidate) => candidate.layoutName === stage.scan.space)) {
        const edge = thumbnails.RASTER_TIER_LONG_EDGE[row.tier] as number;
        const withScan = raster.renderSheet(stage.graph, stage.scan.space, edge, [{ record: stage.scan, image }]).png;
        const without = raster.renderSheet(stage.graph, stage.scan.space, edge).png;
        const stored = await stage.storage.get(stage.person.tenantId, row.sha256);
        expect(Buffer.from(stored as Uint8Array).equals(Buffer.from(withScan)), `the ${row.tier} tier is the sheet drawn over its scan`).toBe(true);
        expect(Buffer.from(withScan).equals(Buffer.from(without)), `and that is not the traced lines alone (${row.tier})`).toBe(false);
      }
      expect(rows.some((row) => row.layoutName === stage.scan.space), "the scanned sheet was rendered").toBe(true);
    },
    BUDGET_MS,
  );

  test(
    "the head names the scan it paints under the traced lines, at the corners the artifact records",
    async () => {
      const stage = await staged();
      const answer = await feed(stage, stage.person.cookie, "part=head");
      expect(answer.status).toBe(200);
      const head = (await answer.json()) as { kind: string; backdrops?: { index: number; sha256: string; width: number; height: number; placement: number[][] }[] };
      expect(head.kind).toBe("manifest");
      expect(head.backdrops, "one backdrop per scan the sheet was traced from").toEqual([
        { index: 0, sha256: stage.scan.sha256, width: stage.scan.width, height: stage.scan.height, placement: stage.scan.placement },
      ]);
    },
    BUDGET_MS,
  );

  test(
    "?part=backdrop serves a participant the scan itself, fitted to the full tier, and refuses a stranger as the sheet does",
    async () => {
      const stage = await staged();
      const answer = await feed(stage, stage.person.cookie, "part=backdrop&index=0");
      expect(answer.status).toBe(200);
      expect(answer.headers.get("content-type")).toBe("image/png");
      const png = await productModule<{ decodeGreyPng: (bytes: Uint8Array) => Grey }>(PNG_MODULE);
      const served = png.decodeGreyPng(new Uint8Array(await answer.arrayBuffer()));
      const image = await pageRaster(stage);
      const thumbnails = await productModule<{ RASTER_TIER_LONG_EDGE: Record<string, number> }>(THUMBNAILS_MODULE);
      const full = thumbnails.RASTER_TIER_LONG_EDGE["full"] as number;
      if (Math.max(image.width, image.height) <= full) {
        expect([served.width, served.height], "a scan no larger than the full tier is served at its own size").toEqual([image.width, image.height]);
        expect(Buffer.from(served.pixels).equals(Buffer.from(image.pixels)), "pixel for pixel").toBe(true);
      } else {
        expect(Math.max(served.width, served.height), "a larger scan is fitted to the full tier's edge").toBe(full);
      }

      expect((await feed(stage, stage.person.cookie, "part=backdrop&index=1")).status, "a scan the sheet does not hold is an absence").toBe(404);
      const stranger = await enrol("scan-backdrop-stranger");
      expect((await feed(stage, stranger.cookie, "part=backdrop&index=0")).status, "a stranger is refused by the sheet's own refusal").toBe(403);
      expect((await feed(stage, null, "part=backdrop&index=0")).status, "and a caller signed out is told so").toBe(401);
    },
    BUDGET_MS,
  );
});
