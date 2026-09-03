/**
 * AC-1 … AC-3 — sheet rasters end to end (R-SPINE-022, R-SPINE-021, SEAM-JOBS, Q-12).
 *
 * One job renders every sheet an ingest record's EntityGraph carries, at every tier the seam
 * declares; every raster is stored at its own address and recorded once; one read door answers the
 * signed URLs a sheet card will render from; and the door that asks for the work refuses what is
 * not this workspace's and what has never been ingested.
 *
 * Everything is driven through names the increment publishes. The ingest record the rasters are of
 * is written by the shipped ingest job over the committed `<fixture>.entitygraph.json` artifact
 * (`stageIngested`), so the sheets under test are the corpus's own rather than an invention here.
 *
 * READING RECORDED HERE (AC-3's "whose payload is …"): a queued job's payload is not readable
 * through SEAM-JOBS' log — `jobEvents` carries the kind, the key, the steps and the ending, never
 * the payload. It IS readable at the one place the seam hands a payload over: the handler a process
 * registers for the kind (`registerJobHandler`, SEAM-JOBS' published door). This file registers a
 * stand-in handler for the thumbnails kind and reads the payload the runtime delivers to it. The
 * stand-in holds the attempt open until it is released, which is what makes "a second request while
 * that job is queued" a settled state to ask about rather than a race. The rendering itself is
 * judged by AC-1, which runs the shipped `runThumbnailsJob` directly.
 */
import { afterAll, describe, expect, test } from "vitest";
import { waitUntil } from "../../jobs/support/jobs-acceptance";
import { closeStage, type Person } from "../../spine/uploads/support/upload-stage";
import { cadFixture, productModule, sha256Of, stageDrawing, tempDir, unique, type IngestRecord, type ProgressLike, type StagedDrawing } from "../support/ingest-stage";
import {
  byCodePoint,
  ERRORS_MODULE,
  inRasterOrder,
  JOBS_MODULE,
  layoutsOf,
  openThumbnailsStage,
  pngHeader,
  RASTER_NOT_AVAILABLE,
  RASTER_STEPS,
  rasterKey,
  stageIngested,
  stagePerson,
  stepOrder,
  storageOf,
  THUMBNAILS_HANDLER_MODULE,
  THUMBNAILS_MODULE,
  WORKSPACE_PERMISSION_NOT_HELD,
  type ArtifactLayout,
  type JobsLike,
  type SheetRasterRecord,
  type StorageLike,
  type ThumbnailsHandlerModule,
  type ThumbnailsSeam,
} from "../support/thumbnails-stage";

/** The tiers and their long edges, as the test contract fixes them (C-05: constants). */
const TIERS = ["thumb", "preview", "full"] as const;
const LONG_EDGE: Readonly<Record<string, number>> = Object.freeze({ thumb: 256, preview: 1024, full: 2048 });
const KIND = "thumbnails";
const LIFETIME_SECONDS = 900;

/** How long one staged case may take: a scratch database, a sign-up and an ingest of a committed artifact. */
const CASE_BUDGET_MS = 300_000;

/** How long the queue has to hand a job it accepted to the process consuming its kind. */
const DELIVERY_BUDGET_MS = 120_000;

/** What the stand-in handler was handed, in the order the runtime handed it over. */
type Delivered = { jobId: string; payload: unknown };

const delivered: Delivered[] = [];
const gates = new Map<string, () => void>();

/**
 * Record what the queue delivered, and hold a real request's attempt open until this file releases
 * it. A key probe (whose payload names no record to render) is let go at once, so nothing of this
 * file's making is still holding the kind's one slot when the runtime is stopped.
 */
async function standIn(payload: unknown, progress: ProgressLike): Promise<void> {
  const jobId = progress.jobId ?? "";
  delivered.push({ jobId, payload });
  const asks = typeof payload === "object" && payload !== null && "ingestId" in payload;
  if (asks) await new Promise<void>((open) => gates.set(jobId, open));
}

/** Let a held attempt finish. */
function release(jobId: string): void {
  gates.get(jobId)?.();
  gates.delete(jobId);
}

interface Staged {
  thumbnails: ThumbnailsSeam;
  jobs: JobsLike;
  storage: StorageLike;
  person: Person;
  projectId: string;
  root: string;
}

let staging: Promise<Staged> | undefined;
let stopRuntime: (() => Promise<unknown>) | undefined;

/** Staged lazily and memoised: a throwing hook leaves every case skipped, and judges nothing. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    for (const declared of [THUMBNAILS_MODULE, THUMBNAILS_HANDLER_MODULE]) await productModule(declared);

    const { urlMigrate, root } = await openThumbnailsStage();
    const { person, projectId } = await stagePerson("thumbnails");

    const thumbnails = await productModule<ThumbnailsSeam>(THUMBNAILS_MODULE);
    const handler = await productModule<ThumbnailsHandlerModule>(THUMBNAILS_HANDLER_MODULE);
    expect(typeof handler.registerThumbnailsHandler, `${THUMBNAILS_HANDLER_MODULE} exports registerThumbnailsHandler — it is the composition root the worker calls`).toBe("function");

    const jobs = await productModule<JobsLike>(JOBS_MODULE);
    jobs.registerJobHandler(thumbnails.THUMBNAILS_KIND, standIn);
    await jobs.startJobsRuntime(urlMigrate);
    stopRuntime = jobs.stopJobsRuntime;

    return { thumbnails, jobs, storage: await storageOf(), person, projectId, root };
  })());
}

afterAll(async () => {
  for (const open of [...gates.values()]) open();
  gates.clear();
  // Let a released attempt write its own ending before the store it writes to is closed.
  await new Promise((settle) => setTimeout(settle, 1000));
  await stopRuntime?.().catch(() => undefined);
  await closeStage();
}, 120_000);

/** The drawing AC-1 renders, its record, its sheets and what one run of the job reported. */
interface Rendered {
  drawing: StagedDrawing;
  record: IngestRecord;
  layouts: ArtifactLayout[];
  steps: string[];
  jobId: string;
}

let rendering: Promise<Rendered> | undefined;

/**
 * One run of `runThumbnailsJob` over a drawing ingested from `cad/tests/fixtures/layouts.*` —
 * memoised, because AC-1 and AC-2 judge the same single run from two sides.
 */
function rendered(): Promise<Rendered> {
  return (rendering ??= (async () => {
    const stage = await staged();
    const { drawing, record } = await stageIngested(stage.person, stage.projectId, "layouts");
    const layouts = await layoutsOf(stage.storage, stage.person.tenantId, record);

    const steps: string[] = [];
    const jobId = unique("raster-job");
    await stage.thumbnails.runThumbnailsJob(
      { tenantId: stage.person.tenantId, drawingId: drawing.drawingId, ingestId: record.ingestId, requestedBy: stage.person.userId },
      {
        jobId,
        tempDir: tempDir("rasters"),
        step: async (name: string): Promise<void> => {
          steps.push(name);
        },
      },
      { storage: stage.storage },
    );
    return { drawing, record, layouts, steps, jobId };
  })());
}

describe("AC-1 — every sheet, at every tier, stored at its own address and recorded once", () => {
  test(
    "AC-1: one run leaves one PNG per sheet per tier, sized by the tier's long edge, and walks resolve → render → store → record",
    async () => {
      const stage = await staged();
      const { record, drawing, layouts, steps, jobId } = await rendered();

      // The vocabulary the test contract fixes (C-05), read from the seam so no caller re-spells it.
      expect([...stage.thumbnails.RASTER_TIERS], "RASTER_TIERS is the three zoom tiers R-SPINE-022 names").toEqual([...TIERS]);
      expect({ ...stage.thumbnails.RASTER_TIER_LONG_EDGE }, "and each tier's long edge in pixels").toStrictEqual({ ...LONG_EDGE });
      expect(stage.thumbnails.THUMBNAILS_KIND, "the job kind is the one the test contract spells").toBe(KIND);
      expect(stage.thumbnails.RASTER_URL_LIFETIME_SECONDS, "and the lifetime its signed URLs are minted for").toBe(LIFETIME_SECONDS);

      // The premise the criterion states about the corpus, asked of the corpus rather than assumed.
      expect(layouts.length, "layouts.dxf carries at least two sheets, which is what makes 3 × N a number worth counting").toBeGreaterThanOrEqual(2);

      const rows = await stage.thumbnails.sheetRasterRecords({ tenantId: stage.person.tenantId, ingestId: record.ingestId });
      expect(rows.length, "one row per sheet per tier — 3 × N, and nothing besides").toBe(layouts.length * stage.thumbnails.RASTER_TIERS.length);

      // The roster is derived from the artifact's own sheets crossed with the seam's own tiers: a
      // corpus that grows a layout, or a seam that grows a tier, grows this expectation with it.
      const expected = byCodePoint(layouts.flatMap((layout) => stage.thumbnails.RASTER_TIERS.map((tier) => rasterKey({ layoutName: layout.name, tier }))));
      expect(inRasterOrder(rows).map(rasterKey), "exactly one raster per (sheet, tier), each sheet of the record's own artifact").toEqual(expected);

      for (const row of rows) {
        const what = `the ${row.tier} raster of sheet ${JSON.stringify(row.layoutName)}`;
        expect(row.ingestId, `${what} is recorded against the ingest it was rendered from`).toBe(record.ingestId);
        expect(row.drawingId, `${what} names the drawing that ingest is of`).toBe(drawing.drawingId);
        expect(row.jobId, `${what} names the job that rendered it`).toBe(jobId);
        expect(Date.parse(row.createdAt), `${what} carries the instant it was recorded at`).not.toBeNaN();

        const bytes = await stage.storage.get(stage.person.tenantId, row.sha256);
        expect(bytes, `${what} is held by SEAM-STORAGE at the address its row names — a row pointing at nothing is not a raster`).not.toBeNull();
        const held = bytes as Uint8Array;
        expect(sha256Of(held), `${what} is addressed by the sha256 of its own bytes (R-SPINE-021: content addressing)`).toBe(row.sha256);

        const header = pngHeader(held, what);
        expect(header, `${what}'s own header agrees with the size its row records`).toStrictEqual({ width: row.width, height: row.height });
        expect(
          Math.max(header.width, header.height),
          `${what}'s long edge is the tier's (RASTER_TIER_LONG_EDGE.${row.tier})`,
        ).toBe(stage.thumbnails.RASTER_TIER_LONG_EDGE[row.tier]);
      }

      const reached = stepOrder(steps, RASTER_STEPS);
      expect(reached, `the job's steps stand in the order it takes them (it reported: ${steps.join(" → ")})`).toEqual([...reached].sort((left, right) => left - right));
    },
    CASE_BUDGET_MS,
  );
});

describe("AC-2 — one read door, per sheet and per tier, signed and expiring", () => {
  test(
    "AC-2: sheetRastersOf answers a signed URL per tier per sheet, vouched for now and expired a lifetime later",
    async () => {
      const stage = await staged();
      const { record, drawing, layouts } = await rendered();
      const scope = { tenantId: stage.person.tenantId, drawingId: drawing.drawingId };

      const rows = await stage.thumbnails.sheetRasterRecords({ tenantId: scope.tenantId, ingestId: record.ingestId });
      const sheets = await stage.thumbnails.sheetRastersOf(scope);

      expect(byCodePoint(sheets.map((sheet) => sheet.layoutName)), "one entry per sheet of the drawing's current ingest record").toEqual(
        byCodePoint(layouts.map((layout) => layout.name)),
      );

      // Judged at a single instant, a whole lifetime and one second after the URLs were minted: the
      // mint happened no later than this, so the expiry is settled rather than raced (Q-12).
      const afterwards = new Date(Date.now() + (stage.thumbnails.RASTER_URL_LIFETIME_SECONDS + 1) * 1000);

      for (const sheet of sheets) {
        const layout = layouts.find((candidate) => candidate.name === sheet.layoutName);
        expect(layout, `sheet ${JSON.stringify(sheet.layoutName)} is one of the artifact's own layouts`).toBeDefined();
        expect(sheet.kind, `sheet ${JSON.stringify(sheet.layoutName)} is served as the space the artifact says it is`).toBe(layout?.kind);
        expect(byCodePoint(Object.keys(sheet.tiers)), `sheet ${JSON.stringify(sheet.layoutName)} carries every tier and no other`).toEqual(byCodePoint([...stage.thumbnails.RASTER_TIERS]));

        for (const tier of stage.thumbnails.RASTER_TIERS) {
          const what = `the ${tier} URL of sheet ${JSON.stringify(sheet.layoutName)}`;
          const served = sheet.tiers[tier] as { url: string; width: number; height: number; sha256: string };
          const row = rows.find((candidate) => candidate.layoutName === sheet.layoutName && candidate.tier === tier) as SheetRasterRecord;
          expect(row, `${what} has a recorded raster behind it`).toBeDefined();
          expect({ width: served.width, height: served.height, sha256: served.sha256 }, `${what} serves the raster that was recorded`).toStrictEqual({
            width: row.width,
            height: row.height,
            sha256: row.sha256,
          });

          expect(stage.storage.verify(served.url), `${what} is one SEAM-STORAGE minted, for this tenant and this address (Q-12)`).toStrictEqual({
            ok: true,
            tenantId: scope.tenantId,
            sha256: row.sha256,
          });
          expect(stage.storage.verify(served.url, afterwards), `${what} is expired a lifetime and a second later — a download URL that never expires is not signed evidence`).toStrictEqual({
            ok: false,
            reason: "expired",
          });
        }
      }

      const unrecorded = await stageDrawing(stage.person, stage.projectId, cadFixture("basic"), { name: unique("never-ingested.dxf"), format: "dxf" });
      expect(await stage.thumbnails.sheetRastersOf({ tenantId: scope.tenantId, drawingId: unrecorded.drawingId }), "a drawing with no ingest record has no sheets to serve, which is an empty answer rather than a refusal").toEqual([]);
    },
    CASE_BUDGET_MS,
  );
});

describe("AC-3 — the door enqueues once, and refuses what is not its to render", () => {
  test(
    "AC-3: an in-scope ingested drawing is enqueued once, under its own key, carrying the record it is of",
    async () => {
      const stage = await staged();
      const { drawing, record } = await stageIngested(stage.person, stage.projectId, "basic");
      const request = { tenantId: stage.person.tenantId, drawingId: drawing.drawingId, requestedBy: stage.person.userId };

      const answer = await stage.thumbnails.requestThumbnails(request);
      expect("refusal" in answer ? answer.refusal : null, "a drawing of this workspace with an ingest record is not refused").toBeNull();
      const accepted = answer as { jobId: string | null; deduplicated: boolean };
      expect(typeof accepted.jobId, "the door answers the id of the job it enqueued").toBe("string");
      expect(accepted.deduplicated, "the first request deduplicated nothing").toBe(false);
      const jobId = accepted.jobId ?? "";

      // The payload, read where SEAM-JOBS hands one over: the registered handler for the kind.
      await waitUntil(() => delivered.some((job) => job.jobId === jobId), `the queue handed job ${jobId} to the process consuming its kind`, DELIVERY_BUDGET_MS);
      expect(delivered.find((job) => job.jobId === jobId)?.payload, "the job carries the tenant, the drawing, the record it renders and who asked for it").toStrictEqual({
        tenantId: request.tenantId,
        drawingId: request.drawingId,
        ingestId: record.ingestId,
        requestedBy: request.requestedBy,
      });

      // The attempt is held open by the stand-in, so the job is demonstrably still under way while
      // both questions below are asked of it.
      const key = stage.thumbnails.thumbnailsJobKey(request.tenantId, record.ingestId);
      expect(key, "the key is the one the seam spells, so no caller re-spells it").toBe(`${stage.thumbnails.THUMBNAILS_KIND}:${request.tenantId}:${record.ingestId}`);
      expect(await stage.thumbnails.requestThumbnails(request), "a second request while that job is running is the same job, said again").toStrictEqual({
        jobId,
        deduplicated: true,
      });
      expect(
        await stage.jobs.enqueue(stage.thumbnails.THUMBNAILS_KIND, { ...request, ingestId: record.ingestId }, { key }),
        "and the job the door made stands under that kind and that key — enqueueing it again is answered with the job that is already there (SEAM-JOBS)",
      ).toStrictEqual({ jobId, deduplicated: true });

      release(jobId);
    },
    CASE_BUDGET_MS,
  );

  test(
    "AC-3: a drawing another workspace holds, and one that has never been ingested, are refused with nothing enqueued",
    async () => {
      const stage = await staged();
      const register = await productModule<{ REFUSALS: Readonly<Record<string, { code: string }>> }>(ERRORS_MODULE);
      expect(register.REFUSALS[RASTER_NOT_AVAILABLE]?.code, `${RASTER_NOT_AVAILABLE} is registered in ${ERRORS_MODULE} (Q-07: the register is a code's one home)`).toBe(RASTER_NOT_AVAILABLE);

      // Somebody else's workspace, with an ingest record of its own — so the only thing wrong with
      // the request is whose drawing it is (R-SPINE-004).
      const stranger = await stagePerson("stranger");
      const theirs = await stageIngested(stranger.person, stranger.projectId, "basic");
      expect(
        await stage.thumbnails.requestThumbnails({ tenantId: stage.person.tenantId, drawingId: theirs.drawing.drawingId, requestedBy: stage.person.userId }),
        "a drawing this tenant scope cannot see is not a drawing this workspace may render",
      ).toStrictEqual({ refusal: WORKSPACE_PERMISSION_NOT_HELD });

      for (const tenantId of [stage.person.tenantId, stranger.person.tenantId]) {
        await expectKeyFree(stage, stage.thumbnails.thumbnailsJobKey(tenantId, theirs.record.ingestId), "the refused cross-workspace request");
      }

      // In scope, and nothing has ever been taken from it: there is no record to render sheets of.
      const unrecorded = await stageDrawing(stage.person, stage.projectId, cadFixture("basic"), { name: unique("unrendered.dxf"), format: "dxf" });
      expect(
        await stage.thumbnails.requestThumbnails({ tenantId: stage.person.tenantId, drawingId: unrecorded.drawingId, requestedBy: stage.person.userId }),
        "a drawing with no ingest record is answered by name, not by an empty job",
      ).toStrictEqual({ refusal: RASTER_NOT_AVAILABLE });
      await expectKeyFree(stage, stage.thumbnails.thumbnailsJobKey(stage.person.tenantId, unrecorded.drawingId), "the refused un-ingested request");
    },
    CASE_BUDGET_MS,
  );
});

/**
 * Nothing of the thumbnails kind stands under this key. Asked of the seam rather than assumed from
 * the refusal's shape: enqueueing a key again is answered `deduplicated: false` only when no job of
 * it is queued or active, which is exactly what "enqueued nothing" means (SEAM-JOBS' idempotency).
 * The probe job the question costs is held by the stand-in and released when the file ends.
 */
async function expectKeyFree(stage: Staged, key: string, what: string): Promise<void> {
  const probe = await stage.jobs.enqueue(stage.thumbnails.THUMBNAILS_KIND, { key }, { key });
  expect(probe.deduplicated, `${what} enqueued nothing: the key ${key} was free for this probe to take`).toBe(false);
}
