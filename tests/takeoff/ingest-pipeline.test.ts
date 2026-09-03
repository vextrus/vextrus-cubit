/**
 * AC-3 … AC-6 — the ingest pipeline end to end (SEAM-CAD, SEAM-JOBS, SEAM-STORAGE, R-TO-001).
 *
 * One door in (`requestIngest`), one job per drawing, one invocation of the `cad/` CLI, one
 * content-addressed artifact and one append-only record pinning who took the geometry and what they
 * counted. Everything below is driven through names the increment publishes; the only thing read
 * out of the store directly is the seeding of a drawing the upload seam would refuse at its format
 * sniff (AC-6's unreadable sheet, and the format the pipeline itself refuses).
 *
 * The runtime is started in THIS process, exactly as `runWorker` starts it — `registerIngestHandler()`
 * first, then `startJobsRuntime(urlMigrate)` — so the handler under test is the one the worker
 * composes, not a stand-in wired up here.
 *
 * READING RECORDED HERE: a job's payload is not readable through SEAM-JOBS' published surface
 * (`jobEvents` carries the key, the steps and the ending, never the payload). AC-5's "whose payload
 * carries declared: { reason, supersedes }" is therefore judged by what that payload can only have
 * produced: the key the job stands under, and the `supersedes` / `declaredReason` the record it
 * writes carries. A job whose payload lost either of them cannot pass.
 */
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { waitForTerminal, waitUntil } from "../jobs/support/jobs-acceptance";
import { closeStage, enrol, openStage, stageProject, type Person } from "../spine/uploads/support/upload-stage";
import {
  cadFixture,
  committedArtifact,
  corpusBytes,
  ENTITYGRAPH_MODULE,
  endingOf,
  filesUnder,
  INGEST_HANDLER_MODULE,
  INGEST_KIND,
  INGEST_MODULE,
  JOBS_MODULE,
  orderOf,
  productModule,
  sha256Of,
  SHEET_NOT_INGESTABLE,
  stageDrawing,
  stepsOf,
  stubCli,
  tempDir,
  unique,
  UPLOADS_MODULE,
  withCadCommand,
  WORKSPACE_PERMISSION_NOT_HELD,
  type GraphSchema,
  type IngestRecord,
  type IngestSeam,
  type JobEvent,
  type JobsSeam,
  type StagedDrawing,
  type UploadSeam,
} from "./support/ingest-stage";

/** The four steps the handler records, in the order R-TO-001's pipeline takes them. */
const STEPS = ["fetched", "extracted", "stored", "recorded"] as const;

/** How long one drawing may take from enqueue to ending: a cold `uv run` builds the cad environment. */
const JOB_BUDGET_MS = 300_000;

/** The budget a whole case gets, which is more than one job's. */
const CASE_BUDGET_MS = 600_000;

/** Bytes no extractor can read, recorded as a `dxf` drawing anyway (AC-6). */
const NOT_A_DRAWING = new TextEncoder().encode("this is not a DXF; it is a sentence.\n");

/** The reason a declared re-ingest is asked for, and the ones that are not reasons at all (AC-5). */
const DECLARED_REASON = "extractor upgraded";
const BLANK_REASONS = ["", "   "] as const;

interface Staged {
  jobs: JobsSeam;
  ingest: IngestSeam;
  uploads: UploadSeam;
  graph: GraphSchema;
  person: Person;
  projectId: string;
  root: string;
}

let staging: Promise<Staged> | undefined;
let stopRuntime: (() => Promise<unknown>) | undefined;

/** Staged lazily and memoised: a throwing hook leaves every case skipped, and judges nothing. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    // Both homes this increment adds, asserted before a database is provisioned for them.
    for (const declared of [INGEST_MODULE, INGEST_HANDLER_MODULE]) await productModule(declared);

    const { db, root } = await openStage();
    const person = await enrol("ingest");
    const projectId = stageProject(person.tenantId, "Ingest acceptance");

    const jobs = await productModule<JobsSeam>(JOBS_MODULE);
    expect(typeof jobs.registerJobHandler, `${JOBS_MODULE} must export registerJobHandler — src/core cannot name a handler that spawns a CLI (ARCH-01)`).toBe("function");

    const ingest = await productModule<IngestSeam>(INGEST_MODULE);
    const handler = await productModule<{ registerIngestHandler: () => void }>(INGEST_HANDLER_MODULE);
    expect(typeof handler.registerIngestHandler, `${INGEST_HANDLER_MODULE} must export registerIngestHandler — it is the composition root`).toBe("function");

    // What `runWorker` does, in this order.
    handler.registerIngestHandler();
    await jobs.startJobsRuntime(db.urlMigrate);
    stopRuntime = jobs.stopJobsRuntime;

    const uploads = await productModule<UploadSeam>(UPLOADS_MODULE);
    const graph = await productModule<GraphSchema>(ENTITYGRAPH_MODULE);
    return { jobs, ingest, uploads, graph, person, projectId, root };
  })());
}

afterAll(async () => {
  await stopRuntime?.().catch(() => undefined);
  await closeStage();
}, 120_000);

/** The answer of `requestIngest`, read as the request that was accepted. */
function accepted(answer: Awaited<ReturnType<IngestSeam["requestIngest"]>>, what: string): { jobId: string; ingestId: string | null; deduplicated: boolean } {
  expect("refusal" in answer ? answer.refusal : null, `${what} was refused`).toBeNull();
  const requested = answer as { jobId: string | null; ingestId: string | null; deduplicated: boolean };
  expect(typeof requested.jobId, `${what} answers the id of the job it enqueued`).toBe("string");
  expect(requested.ingestId, `${what} enqueued work, so it answers no existing record`).toBeNull();
  expect(requested.deduplicated, `${what} deduplicated nothing`).toBe(false);
  return { jobId: requested.jobId ?? "", ingestId: requested.ingestId, deduplicated: requested.deduplicated };
}

/** Ask for an ingest, wait for the job to end, and answer the log it left. */
async function ingestAndWait(stage: Staged, drawing: StagedDrawing, declared?: { reason: string }): Promise<{ jobId: string; events: JobEvent[] }> {
  const answer = await stage.ingest.requestIngest({
    tenantId: stage.person.tenantId,
    drawingId: drawing.drawingId,
    requestedBy: stage.person.userId,
    ...(declared === undefined ? {} : { declared }),
  });
  const { jobId } = accepted(answer, `requestIngest for ${drawing.name}`);
  const events = await waitForTerminal(stage.jobs, jobId, JOB_BUDGET_MS);
  return { jobId, events };
}

/** A drawing of the committed corpus, recorded in the store and taken through the whole pipeline. */
async function pipeline(stage: Staged, fixture: string): Promise<{ drawing: StagedDrawing; record: IngestRecord; events: JobEvent[]; jobId: string }> {
  const drawing = await stageDrawing(stage.person, stage.projectId, cadFixture(fixture), { name: unique(`${fixture}.dxf`), format: "dxf" });
  const { jobId, events } = await ingestAndWait(stage, drawing);
  expect(endingOf(events)?.status, `the ingest of ${fixture}.dxf ended: ${JSON.stringify(endingOf(events))}`.slice(0, 600)).toBe("succeeded");
  const record = await stage.ingest.ingestRecordOf({ tenantId: stage.person.tenantId, drawingId: drawing.drawingId });
  expect(record, `an ingest that succeeded leaves a record of ${fixture}.dxf`).not.toBeNull();
  return { drawing, record: record as IngestRecord, events, jobId };
}

/** The artifact a record points at, read back out of SEAM-STORAGE by its own address. */
async function storedArtifact(stage: Staged, record: IngestRecord): Promise<{ bytes: Uint8Array; document: Record<string, unknown> }> {
  const bytes = await stage.uploads.uploadStorage().get(stage.person.tenantId, record.artifactSha256);
  expect(bytes, `the artifact at ${record.artifactSha256} is held by SEAM-STORAGE — a record pointing at nothing is not evidence`).not.toBeNull();
  const held = bytes as Uint8Array;
  expect(sha256Of(held), "every stored object is addressed by the sha256 of its own bytes (SEAM-STORAGE)").toBe(record.artifactSha256);
  return { bytes: held, document: JSON.parse(new TextDecoder().decode(held)) as Record<string, unknown> };
}

describe("AC-3 — one door, one job, one artifact in the store", () => {
  test(
    "AC-3: requestIngest enqueues an ingest under the drawing's key, the worker walks the four steps, and the artifact lands addressed by its digest",
    async () => {
      const stage = await staged();
      const drawing = await stageDrawing(stage.person, stage.projectId, cadFixture("basic"), { name: unique("basic.dxf"), format: "dxf" });

      const answer = await stage.ingest.requestIngest({ tenantId: stage.person.tenantId, drawingId: drawing.drawingId, requestedBy: stage.person.userId });
      const { jobId } = accepted(answer, "the first requestIngest for a recorded drawing");

      const events = await waitForTerminal(stage.jobs, jobId, JOB_BUDGET_MS);
      const first = events[0];
      expect(first?.kind, "the job the door enqueued is of the kind the seam names").toBe(INGEST_KIND);
      expect(first?.key, "one job per drawing, keyed on the drawing (SEAM-JOBS: every job idempotent on its key)").toBe(
        `${INGEST_KIND}:${stage.person.tenantId}:${drawing.drawingId}`,
      );
      expect(stage.ingest.ingestJobKey(stage.person.tenantId, drawing.drawingId, null), "and `ingestJobKey` spells that same key, so no caller re-spells it").toBe(first?.key);

      expect(endingOf(events)?.status, `the job ended: ${JSON.stringify(endingOf(events))}`.slice(0, 600)).toBe("succeeded");
      const reached = orderOf(events, STEPS);
      expect(reached, `the pipeline's steps stand in the order it takes them (its log reads: ${stepsOf(events).join(" → ")})`).toEqual([...reached].sort((a, b) => a - b));

      const record = await stage.ingest.ingestRecordOf({ tenantId: stage.person.tenantId, drawingId: drawing.drawingId });
      expect(record, "a succeeded ingest leaves exactly the record the pipeline is for").not.toBeNull();
      const held = record as IngestRecord;
      expect(held.drawingId, "the record names the drawing it is of").toBe(drawing.drawingId);
      expect(held.sha256, "and the bytes it was taken from").toBe(drawing.sha256);
      expect(held.jobId, "and the job that took it").toBe(jobId);
      expect(held.supersedes, "a first ingest supersedes nothing").toBeNull();
      expect(held.declaredReason, "and was not declared").toBeNull();

      const { bytes } = await storedArtifact(stage, held);
      expect(() => stage.graph.entityGraphSchema.parse(JSON.parse(new TextDecoder().decode(bytes))), "the stored artifact is an EntityGraph both sides parse (L-CAD-05)").not.toThrow();
    },
    CASE_BUDGET_MS,
  );

  test(
    "AC-3: a drawing the upload seam recorded is ingestable through the same door",
    async () => {
      const stage = await staged();
      const bytes = corpusBytes(join("fixtures", "rcc6", "rcc6.dxf"));
      const actor = { tenantId: stage.person.tenantId, userId: stage.person.userId };
      const name = unique("rcc6.dxf");

      const opened = await stage.uploads.createUpload({ actor, projectId: stage.projectId, name, size: bytes.length, sha256: sha256Of(bytes) });
      expect(opened.refusal, `the upload seam opened no session for ${name}`).toBeUndefined();
      const uploadId = opened.uploadId ?? "";
      const chunkBytes = opened.chunkBytes ?? bytes.length;

      // As many chunks as the size the seam announced implies — never a count written down here.
      let recorded: { drawingId: string; name: string; sha256: string; format: string }[] = [];
      for (let offset = 0; offset < bytes.length; offset += chunkBytes) {
        const answer = await stage.uploads.appendChunk({ actor, uploadId, offset, bytes: bytes.subarray(offset, Math.min(offset + chunkBytes, bytes.length)) });
        expect(answer.refusal, `the chunk at ${offset} was refused`).toBeUndefined();
        if (answer.complete === true) recorded = answer.drawings ?? [];
      }
      const drawingId = recorded[0]?.drawingId ?? "";
      expect(drawingId, "the settled upload recorded a drawing to ingest").not.toBe("");

      const { events } = await ingestAndWait(stage, { drawingId, sha256: sha256Of(bytes), name });
      expect(endingOf(events)?.status, `the uploaded drawing's ingest ended: ${JSON.stringify(endingOf(events))}`.slice(0, 600)).toBe("succeeded");

      const record = await stage.ingest.ingestRecordOf({ tenantId: stage.person.tenantId, drawingId });
      expect(record?.sha256, "the record is of the content the upload seam stored, at its own address").toBe(sha256Of(bytes));
    },
    CASE_BUDGET_MS,
  );
});

describe("AC-4 — the record pins identity and counters as data, never as the app's own claim", () => {
  test(
    "AC-4: the extractor identity and the fidelity counters are read off the artifact, in the artifact's own order",
    async () => {
      const stage = await staged();

      /** Every value of `explode_truncated` the corpus this case walks really carries. */
      const truncation = new Set<boolean>();

      for (const fixture of ["basic", "blocks", "layouts"]) {
        const { record, events } = await pipeline(stage, fixture);
        const { document } = await storedArtifact(stage, record);
        const identity = document["ingest"] as Record<string, string>;

        expect(record.extractor, `${fixture}: the identity is the artifact's own, field for field (L-CAD-02: the ingest record pins extractor identity)`).toStrictEqual({
          scheme: identity["scheme"],
          tool: identity["tool"],
          toolVersion: identity["tool_version"],
          parameterSetHash: identity["parameter_set_hash"],
        });

        // Every named fact, read off the artifact the record points at rather than off the function
        // that derived it: what the extractor counted is what the record must hold, in the
        // artifact's own order. A `factsOf` that answered a constant for a counter — every space
        // `explode_truncated`, say — disagrees with the document here.
        const layouts = (document["layouts"] as Record<string, unknown>[]).map((layout) => ({
          name: layout["name"],
          kind: layout["kind"],
          strays_rejected: layout["strays_rejected"],
        }));
        const counters = (document["counters"] as Record<string, unknown>[]).map((counter) => ({
          space: counter["space"],
          explode_truncated: counter["explode_truncated"],
          explode_losses: counter["explode_losses"],
          flatten_capped: counter["flatten_capped"],
        }));
        expect(record.facts, `${fixture}: the record holds the artifact's own facts, whole and in its own order (stored as json, so the order survives)`).toStrictEqual({
          insunits: document["insunits"],
          dropped_layouts: document["dropped_layouts"],
          layouts,
          counters,
        });
        for (const counter of counters) truncation.add(counter["explode_truncated"] === true);

        // And they are that one derivation rather than a second spelling of it (ARCH-02): what the
        // record holds is what `factsOf` answers over the same artifact.
        const parsed = stage.graph.entityGraphSchema.parse(document);
        expect(record.facts, `${fixture}: the record's facts are factsOf(graph), whole`).toStrictEqual(stage.ingest.factsOf(parsed));

        const extracted = events.find((event) => event.step === "extracted");
        expect(extracted?.detail, `${fixture}: the extracted step tells an operator which extractor took the geometry`).toStrictEqual({
          tool: record.extractor.tool,
          tool_version: record.extractor.toolVersion,
          parameter_set_hash: record.extractor.parameterSetHash,
        });

        if (fixture === "blocks") {
          expect(
            record.facts.counters.some((counter) => counter.explode_truncated === true),
            "blocks.dxf explodes further than the cap allows, and the record says so (R-TO-001: fidelity counters as named facts)",
          ).toBe(true);
        }
        if (fixture === "layouts") {
          expect(record.facts.dropped_layouts.length, "layouts.dxf carries a content-less layout, dropped and counted (L-CAD-05)").toBeGreaterThan(0);
          expect(
            record.facts.layouts.some((layout) => layout.strays_rejected === 1),
            "and a layout with one stray entity rejected from its extents (L-CAD-05)",
          ).toBe(true);
        }
      }

      // A counter is only evidence if it can say either thing. The corpus walked above has to
      // disagree with itself about truncation, or nothing here could tell a counted fact from a
      // constant the pipeline hands out for every drawing.
      expect(
        [...truncation].sort(),
        "the drawings this case ingests must include one whose spaces were truncated and one whose were not",
      ).toStrictEqual([false, true]);
    },
    CASE_BUDGET_MS,
  );

  test(
    "AC-4: the identity recorded is the one the artifact carries, whatever the app might have assumed",
    async () => {
      const stage = await staged();
      // A stand-in extractor with an identity nothing in the tree could have guessed. If the record
      // agrees with it, the record is reading the artifact rather than repeating a constant.
      const artifact = committedArtifact("basic");
      const identity = { scheme: "DXF_HANDLE", tool: "ezdxf", tool_version: "9.9.9-stand-in", parameter_set_hash: "f".repeat(64) };
      const stub = stubCli({ artifact: JSON.stringify({ ...artifact, ingest: identity }), stderr: "", exitCode: 0 });

      const drawing = await stageDrawing(stage.person, stage.projectId, cadFixture("basic"), { name: unique("identity.dxf"), format: "dxf" });
      const { events } = await withCadCommand(stub.command, async () => await ingestAndWait(stage, drawing));
      expect(endingOf(events)?.status, `the stand-in's ingest ended: ${JSON.stringify(endingOf(events))}`.slice(0, 600)).toBe("succeeded");

      const record = await stage.ingest.ingestRecordOf({ tenantId: stage.person.tenantId, drawingId: drawing.drawingId });
      expect(record?.extractor, "the recorded identity is the artifact's, not the app's idea of which extractor ran").toStrictEqual({
        scheme: identity.scheme,
        tool: identity.tool,
        toolVersion: identity.tool_version,
        parameterSetHash: identity.parameter_set_hash,
      });
    },
    CASE_BUDGET_MS,
  );
});

describe("AC-5 — a re-ingest is declared, never drift", () => {
  test(
    "AC-5: an undeclared second request answers the record that exists; a declared one supersedes it",
    async () => {
      const stage = await staged();
      const { drawing, record: prior } = await pipeline(stage, "basic");
      const scope = { tenantId: stage.person.tenantId, drawingId: drawing.drawingId };

      // Undeclared, and the two spellings of "no reason at all".
      for (const declared of [undefined, ...BLANK_REASONS.map((reason) => ({ reason }))]) {
        const answer = await stage.ingest.requestIngest({ ...scope, requestedBy: stage.person.userId, ...(declared === undefined ? {} : { declared }) });
        expect(answer, `a request declaring ${JSON.stringify(declared ?? null)} re-runs nothing: an ingested drawing is answered with the record it already has`).toStrictEqual({
          jobId: null,
          ingestId: prior.ingestId,
          deduplicated: true,
        });
      }

      const declaredAnswer = await stage.ingest.requestIngest({ ...scope, requestedBy: stage.person.userId, declared: { reason: DECLARED_REASON } });
      const { jobId } = accepted(declaredAnswer, "a declared re-ingest");
      const events = await waitForTerminal(stage.jobs, jobId, JOB_BUDGET_MS);
      expect(events[0]?.key, "a declared re-ingest stands under a key of its own, naming the record it supersedes").toBe(
        `${INGEST_KIND}:${scope.tenantId}:${scope.drawingId}:${prior.ingestId}`,
      );
      expect(stage.ingest.ingestJobKey(scope.tenantId, scope.drawingId, prior.ingestId), "and `ingestJobKey` spells that same key").toBe(events[0]?.key);
      expect(endingOf(events)?.status, `the declared re-ingest ended: ${JSON.stringify(endingOf(events))}`.slice(0, 600)).toBe("succeeded");

      const records = await stage.ingest.ingestRecords(scope);
      expect(records.length, "the drawing now has two ingests: nothing was replaced").toBe(2);
      expect(records[0]?.supersedes, "the newest names the record it supersedes — declared, never drift (L-CAD-02)").toBe(prior.ingestId);
      expect(records[0]?.declaredReason, "and carries the reason it was asked for, verbatim").toBe(DECLARED_REASON);
      expect(records[1], "the record it superseded is unchanged — an ingest record is evidence").toStrictEqual(prior);
      expect(await stage.ingest.ingestRecordOf(scope), "and the drawing's current ingest is the newest of them").toStrictEqual(records[0]);
    },
    CASE_BUDGET_MS,
  );

  test(
    "AC-5: a retried attempt of one job writes no second record",
    async () => {
      const stage = await staged();
      const drawing = await stageDrawing(stage.person, stage.projectId, cadFixture("basic"), { name: unique("retry.dxf"), format: "dxf" });
      const scope = { tenantId: stage.person.tenantId, drawingId: drawing.drawingId };
      const payload = { tenantId: scope.tenantId, drawingId: scope.drawingId, requestedBy: stage.person.userId, declared: null };

      // The same attempt, run twice: same job, same temp dir, same payload — which is what a retry
      // after a lost connection or an expired lease is. `ingests_job_once` is the belt; the handler
      // answering the row it already wrote is the braces.
      const progress = { jobId: unique("retried-job"), tempDir: tempDir("retry"), step: async (): Promise<void> => undefined };
      const deps = { storage: stage.uploads.uploadStorage() };
      await stage.ingest.runIngestJob(payload, progress, deps);
      await stage.ingest.runIngestJob(payload, progress, deps);

      const records = await stage.ingest.ingestRecords(scope);
      expect(records.length, "one job wrote one record, however many times its attempt ran (SEAM-JOBS: every job idempotent on its key)").toBe(1);
    },
    CASE_BUDGET_MS,
  );
});

describe("AC-6 — a sheet nothing can be taken from is refused, loudly and emptily", () => {
  test(
    "AC-6: an unreadable sheet ends the job refused after it was fetched, and leaves neither record nor artifact",
    async () => {
      const stage = await staged();
      const drawing = await stageDrawing(stage.person, stage.projectId, NOT_A_DRAWING, { name: unique("unreadable.dxf"), format: "dxf" });
      const scope = { tenantId: stage.person.tenantId, drawingId: drawing.drawingId };
      const before = filesUnder(stage.root);

      const { jobId, events } = await ingestAndWait(stage, drawing);
      const ending = endingOf(events);
      expect(ending?.status, `a sheet the extractor cannot read is an answer, not a fault: ${JSON.stringify(ending)}`.slice(0, 600)).toBe("refused");
      expect(ending?.refusalCode, "and it is answered with the registered code").toBe(SHEET_NOT_INGESTABLE);
      expect(
        events.filter((event) => event.status === "failed").length,
        `nothing here is a fault — the log reads: ${events.map((event) => `${event.step}/${event.status}`).join(", ")}`,
      ).toBe(0);
      expect(stepsOf(events), "the bytes were fetched before anything could be said about them").toContain(STEPS[0]);

      const dead = await stage.jobs.deadLetters();
      expect(dead.map((letter) => letter.jobId), "a refusal is never a dead letter — it is what the extractor answered").not.toContain(jobId);

      expect(await stage.ingest.ingestRecordOf(scope), "a refused sheet leaves no record (a refusal lives in the job log)").toBeNull();
      expect(await stage.ingest.ingestRecords(scope), "and no history of one").toEqual([]);
      expect(filesUnder(stage.root), "and nothing new in the store: there was no artifact to address").toEqual(before);
    },
    CASE_BUDGET_MS,
  );

  test(
    "AC-6: a format this pipeline does not read, and a drawing this workspace cannot see, are refused at the door",
    async () => {
      const stage = await staged();

      // A format the CLI has no lane for: PDF and raster are other nodes' ground (out of scope).
      const pdf = await stageDrawing(stage.person, stage.projectId, corpusBytes(join("fixtures", "rcc6", "rcc6.pdf")), { name: unique("sheet.pdf"), format: "pdf" });
      const refusedFormat = await stage.ingest.requestIngest({ tenantId: stage.person.tenantId, drawingId: pdf.drawingId, requestedBy: stage.person.userId });
      expect(refusedFormat, "a drawing whose format is neither dxf nor dwg is refused by name").toStrictEqual({ refusal: SHEET_NOT_INGESTABLE });
      await expectNothingQueued(stage, pdf.drawingId, "the refused format");

      // A drawing of somebody else's workspace: not visible in this scope, so not this scope's to run.
      const stranger = await enrol("stranger");
      const strangerProject = stageProject(stranger.tenantId, "Another workspace");
      const theirs = await stageDrawing(stranger, strangerProject, cadFixture("basic"), { name: unique("theirs.dxf"), format: "dxf" });
      const refusedScope = await stage.ingest.requestIngest({ tenantId: stage.person.tenantId, drawingId: theirs.drawingId, requestedBy: stage.person.userId });
      expect(refusedScope, "a drawing the tenant scope cannot see is not a drawing this workspace may ingest (R-SPINE-004)").toStrictEqual({
        refusal: WORKSPACE_PERMISSION_NOT_HELD,
      });
      await expectNothingQueued(stage, theirs.drawingId, "the drawing of another workspace");
    },
    CASE_BUDGET_MS,
  );
});

/**
 * Nothing stands under this drawing's ingest key. Asked of the seam rather than assumed from the
 * answer's shape: enqueuing that key again is answered `deduplicated: false` only when no job of it
 * is queued-or-active, which is exactly what "enqueues nothing" means (SEAM-JOBS' idempotency).
 * The probe job that proves it is then waited out, so nothing of this case is left in flight.
 */
async function expectNothingQueued(stage: Staged, drawingId: string, what: string): Promise<void> {
  const key = `${INGEST_KIND}:${stage.person.tenantId}:${drawingId}`;
  const probe = await stage.jobs.enqueue(INGEST_KIND, { tenantId: stage.person.tenantId, drawingId, requestedBy: stage.person.userId, declared: null }, { key });
  expect(probe.deduplicated, `${what} enqueued nothing: its key was free for this probe to take`).toBe(false);
  await waitUntil(
    async () => (await stage.jobs.jobEvents(probe.jobId)).length > 0,
    `the probe job under ${key} was picked up`,
    JOB_BUDGET_MS,
  );
  await waitForTerminal(stage.jobs, probe.jobId, JOB_BUDGET_MS);
}
