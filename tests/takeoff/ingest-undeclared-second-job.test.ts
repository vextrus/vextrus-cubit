/**
 * The undeclared job that arrives after the drawing was already ingested (SEAM-JOBS, L-CAD-02).
 *
 * `runIngestJob` is idempotent twice over. AC-5's retry case drives the first half — one job, run
 * twice, writes one record. This is the other half the increment's interface names: a SECOND,
 * distinct job standing under the same undeclared key, delivered for a drawing another job has
 * since recorded. It must write nothing and run no extractor — running one again undeclared would
 * mint a second key multiset for one drawing revision, which is the drift L-CAD-02 forbids.
 *
 * The extractor is stood in for (`CUBIT_CAD_COMMAND`) so that "ran nothing" is a fact this suite can
 * read, rather than a duration it could only guess at.
 */
import { afterAll, expect, test } from "vitest";
import { closeStage, enrol, openStage, stageProject } from "../spine/uploads/support/upload-stage";
import {
  cadFixture,
  committedArtifact,
  ingestSeam,
  productModule,
  stageDrawing,
  stubCli,
  tempDir,
  unique,
  UPLOADS_MODULE,
  withCadCommand,
  type IngestRecord,
  type ProgressLike,
  type UploadSeam,
} from "./support/ingest-stage";

/** The budget a case gets: a scratch database is provisioned and migrated inside it. */
const CASE_BUDGET_MS = 600_000;

/** What a running job is given, plus the steps it was told about. */
function attempt(label: string): ProgressLike & { steps: string[] } {
  const steps: string[] = [];
  return {
    jobId: unique(`${label}-job`),
    tempDir: tempDir(label),
    steps,
    step: async (name: string): Promise<void> => {
      steps.push(name);
    },
  };
}

afterAll(async () => {
  await closeStage();
}, 120_000);

test(
  "an undeclared second job for an ingested drawing writes nothing and runs no extractor",
  async () => {
    await openStage();
    const person = await enrol("ingest-undeclared");
    const projectId = stageProject(person.tenantId, "Undeclared second job");
    const ingest = await ingestSeam();
    const uploads = await productModule<UploadSeam>(UPLOADS_MODULE);

    const drawing = await stageDrawing(person, projectId, cadFixture("basic"), { name: unique("undeclared.dxf"), format: "dxf" });
    const scope = { tenantId: person.tenantId, drawingId: drawing.drawingId };
    const payload = { ...scope, requestedBy: person.userId, declared: null };
    const deps = { storage: uploads.uploadStorage() };
    const stub = stubCli({ artifact: JSON.stringify(committedArtifact("basic")), stderr: "", exitCode: 0 });

    // The first job records the drawing.
    const first = attempt("first");
    await withCadCommand(stub.command, () => ingest.runIngestJob(payload, first, deps));
    const recorded: IngestRecord[] = await ingest.ingestRecords(scope);
    expect(recorded.length, "the first job recorded the ingest it took").toBe(1);
    expect(stub.calls(), "and reached the extractor once").toBe(1);

    // A second job, under the same undeclared key but a job id of its own — what a re-enqueue of the
    // base key after the first job ended delivers.
    const second = attempt("second");
    expect(second.jobId, "the second job is a different job, not a retry of the first").not.toBe(first.jobId);
    await withCadCommand(stub.command, () => ingest.runIngestJob(payload, second, deps));

    expect(await ingest.ingestRecords(scope), "an undeclared job that finds a record writes nothing: the drawing's ingests are untouched").toStrictEqual(recorded);
    expect(stub.calls(), "and it runs no extractor over bytes already ingested (L-CAD-02: a re-ingest is declared or it does not happen)").toBe(1);
    expect(second.steps, "it ends having recorded only the step it really took — the bytes were fetched, nothing was extracted, stored or recorded").toStrictEqual(["fetched"]);
  },
  CASE_BUDGET_MS,
);
