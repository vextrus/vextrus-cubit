/**
 * AC-4's chaining leg — the worker asks for thumbnails once an ingest has recorded (X-1, ARCH-01).
 *
 * The chain is composition-root work: `src/worker/handlers/ingest.ts` is the one layer that may hold
 * both modules, so the proof drives the SHIPPED handlers through the shipped jobs runtime — one
 * ingest is requested and NOTHING here ever asks for a thumbnail. If rasters exist afterwards, the
 * only thing that can have asked for them is the worker itself.
 *
 * The screen's own half of that sentence — an upload reaching `stored` asking `requestSheetsFor` for
 * an ingest — is walked end to end by J-010 against the served product, where a session exists; a
 * server action is not callable outside a request.
 *
 * The corpus here is the cheap committed one: which artifact was extracted decides nothing about
 * whether the second job was asked for.
 */
import { afterAll, describe, expect, test } from "vitest";
import { cadFixture, corpusBytes, stageDrawing, stubCli, unique, withCadCommand, type IngestSeam } from "../support/ingest-stage";
import { THUMBNAILS_HANDLER_MODULE } from "../support/thumbnails-stage";
import {
  INGEST_HANDLER_MODULE,
  INGEST_MODULE,
  JOBS_MODULE,
  PRINCIPAL,
  THUMBNAILS_MODULE,
  closeStage,
  grantRole,
  openSheetsStage,
  productModule,
  stagePerson,
  type IngestHandlerModule,
  type JobsLike,
  type Person,
  type ThumbnailsSeam,
} from "../support/sheets-stage";

/** How long the staged chain may take: a runtime started, one job consumed, one job asked after. */
const BUDGET_MS = 600_000;

/** How long the chained request may take to stand after the ingest has recorded. */
const CHAIN_BUDGET_MS = 60_000;

/** The committed fixture whose artifact stands in for an extraction here. */
const FIXTURE = "layouts";

interface Staged {
  ingest: IngestSeam;
  thumbnails: ThumbnailsSeam;
  jobs: JobsLike;
  person: Person;
  projectId: string;
  urlMigrate: string;
}

let staging: Promise<Staged> | undefined;
let stopRuntime: (() => Promise<unknown>) | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const ingest = await productModule<IngestSeam>(INGEST_MODULE);
    const thumbnails = await productModule<ThumbnailsSeam>(THUMBNAILS_MODULE);
    const handler = await productModule<IngestHandlerModule>(INGEST_HANDLER_MODULE);
    const rasterHandler = await productModule<{ registerThumbnailsHandler: () => void }>(THUMBNAILS_HANDLER_MODULE);
    const jobs = await productModule<JobsLike>(JOBS_MODULE);

    const { urlMigrate } = await openSheetsStage();
    const { person, projectId } = await stagePerson("chain");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);

    // Both composition roots, exactly as `src/worker/main.ts` wires them: the runtime can consume
    // whatever kind is enqueued, so the only question left is whether anything enqueued the second.
    handler.registerIngestHandler();
    rasterHandler.registerThumbnailsHandler();
    await jobs.startJobsRuntime(urlMigrate);
    stopRuntime = jobs.stopJobsRuntime;
    return { ingest, thumbnails, jobs, person, projectId, urlMigrate };
  })());
}

afterAll(async () => {
  await stopRuntime?.().catch(() => undefined);
  await closeStage();
}, 120_000);

/** Wait for a reading to settle, or give up saying what it last read. */
async function until<T>(what: string, read: () => Promise<T>, settled: (value: T) => boolean, budgetMs: number): Promise<T> {
  const startedAt = Date.now();
  let last = await read();
  while (!settled(last)) {
    expect(Date.now() - startedAt, `${what} — it last read ${JSON.stringify(last)}`).toBeLessThan(budgetMs);
    await new Promise((resolve) => setTimeout(resolve, 500));
    last = await read();
  }
  return last;
}

describe("AC-4: a thumbnails job stands enqueued once an ingest job has recorded", () => {
  test("AC-4: the worker's ingest handler asks for the drawing's thumbnails after runIngestJob records", async () => {
    const stage = await staged();
    const artifact = new TextDecoder().decode(corpusBytes(`cad/tests/fixtures/${FIXTURE}.entitygraph.json`));
    const stub = stubCli({ artifact, stderr: "", exitCode: 0 });
    const drawing = await stageDrawing(stage.person, stage.projectId, cadFixture(FIXTURE), { name: unique(`${FIXTURE}.dxf`), format: "dxf" });

    await withCadCommand(stub.command, async () => {
      const asked = await stage.ingest.requestIngest({ tenantId: stage.person.tenantId, drawingId: drawing.drawingId, requestedBy: stage.person.userId });
      expect(asked, `requesting an ingest for a stored drawing was refused: ${JSON.stringify(asked)}`).not.toHaveProperty("refusal");

      const record = await until(
        "the worker consumed the ingest job and recorded the drawing",
        () => stage.ingest.ingestRecordOf({ tenantId: stage.person.tenantId, drawingId: drawing.drawingId }),
        (value) => value !== null,
        CHAIN_BUDGET_MS,
      );
      expect(record, "an ingest that recorded nothing chains nothing").not.toBeNull();

      // Nothing above or below asks for a thumbnail: the drawing was requested once, as an ingest.
      const sheets = await until(
        "the worker chained a thumbnails job after the record landed, and the runtime drew the rasters",
        () => stage.thumbnails.sheetRastersOf({ tenantId: stage.person.tenantId, drawingId: drawing.drawingId }),
        (value) => value.length > 0,
        CHAIN_BUDGET_MS,
      );
      expect(sheets.length, "a record whose rasters nobody asked for is a screen with no thumbnails — the composition root is what asks (X-1)").toBeGreaterThan(0);
    });
  }, BUDGET_MS);
});
