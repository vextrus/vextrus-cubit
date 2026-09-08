/**
 * AC-3 — the partition is stored per ingest, by the job a completed ingest enqueues
 * (R-TO-030, L-CAD-06, SEAM-JOBS, L-REG-04).
 *
 * The chain is composition-root work: `src/worker/handlers/ingest.ts` is the layer that may hold
 * both seams, so the proof drives the SHIPPED handler through the shipped jobs runtime and NOTHING
 * here asks for a partition. The runtime is started with the ingest handler alone registered, so the
 * partition job the worker enqueued stands where it was put — which is the only state in which "a
 * second ask is deduplicated while it is queued" can be observed at all.
 *
 * The partition itself is then run directly over a second drawing, and what it wrote is read back
 * out of the store. Every expectation is derived from the artifact the ingest really recorded and
 * from the grammar's own answer for each caption, so a corpus or a grammar that changes changes the
 * expectation with it (B-19): nothing here transcribes a view key, a type or a count.
 *
 * The model is asked from an EMPTY fixture root: a silent caption still earns no guess, and no call
 * can leave this suite for a network (L-AI-01).
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import {
  CAPTION_UNCLASSIFIABLE,
  INGEST_HANDLER_MODULE,
  JOBS_MODULE,
  PARTITION_KIND,
  PARTITION_NOT_AVAILABLE,
  PRINCIPAL,
  UNASSIGNED,
  VIEWS_STAGE,
  byCodePoint,
  closeStage,
  grammar,
  grantRole,
  jobHasEnded,
  openSheetsStage,
  partitionDoor,
  partitionViewRows,
  productModule,
  rebuildDoor,
  runPartition,
  stageIngested,
  stagePerson,
  tempFixtureRoot,
  unique,
  viewAssignmentRows,
  withFixtureRoot,
  type CaptionSpec,
  type GrammarSeam,
  type JobsLike,
  type PartitionSeam,
  type Person,
  type StagedIngest,
} from "./support/partition-stage";
import { stageDrawing, stubCli, withCadCommand } from "../support/ingest-stage";
import { buildArtifact } from "./support/partition-stage";
import { CONVENTIONS_STAGE } from "./support/conventions-stage";

/** How long a staged case may take: a runtime started, one ingest consumed, one partition run. */
const BUDGET_MS = 600_000;

/** How long the chained request may take to stand after the ingest has recorded. */
const CHAIN_BUDGET_MS = 120_000;

/**
 * The captions the staged model space carries: one the grammar reads plainly, one it reads as a
 * different class, and one it cannot read at all. WHICH type each earns is never assumed here — the
 * grammar itself is asked, so a grammar that reclassifies a caption reclassifies the expectation.
 */
const CAPTIONS: readonly CaptionSpec[] = [
  { caption: "TYPICAL FLOOR PLAN", at: [0, 0] },
  { caption: "COLUMN SCHEDULE", at: [200, 0] },
  { caption: "XQZ 77", at: [400, 0] },
];

/** The steps a partition run records, in order (AC-3, re-baselined by inc-201's second stage). */
const STEPS = ["resolve", VIEWS_STAGE, CONVENTIONS_STAGE, "stored"];

interface Staged {
  partition: PartitionSeam;
  grammar: GrammarSeam;
  jobs: JobsLike;
  person: Person;
  projectId: string;
  urlMigrate: string;
}

let staging: Promise<Staged> | undefined;
let stopRuntime: (() => Promise<unknown>) | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const partition = await partitionDoor();
    const seam = await grammar();
    const handler = await productModule<{ registerIngestHandler: () => void }>(INGEST_HANDLER_MODULE);
    const jobs = await productModule<JobsLike>(JOBS_MODULE);

    const { urlMigrate } = await openSheetsStage();
    const { person, projectId } = await stagePerson("partition");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);

    // The ingest handler alone: the partition kind's queue is declared by the runtime either way, so
    // what the worker enqueues stands queued and nothing in this suite consumes it.
    handler.registerIngestHandler();
    await jobs.startJobsRuntime(urlMigrate);
    stopRuntime = jobs.stopJobsRuntime;
    return { partition, grammar: seam, jobs, person, projectId, urlMigrate };
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

describe("AC-3: the kind, the key and the stage list", () => {
  test("AC-3: the partition runs as its own job kind, keyed on the ingest it rebuilds", async () => {
    const stage = await staged();
    const rebuild = await rebuildDoor();
    expect(stage.partition.PARTITION_KIND, "the stored partition is enqueued as its own kind (SEAM-JOBS)").toBe(PARTITION_KIND);

    const tenantId = randomUUID();
    const ingestId = randomUUID();
    expect(stage.partition.partitionJobKey(tenantId, ingestId), "a partition job is idempotent on the ingest it rebuilds").toBe(`${PARTITION_KIND}:${tenantId}:${ingestId}`);

    expect(
      [...rebuild.PARTITION_STAGES],
      "the first stage of R-TO-030's partition is the view classification, and the convention profile is the second (L-CAD-06, L-CAD-08)",
    ).toEqual([VIEWS_STAGE, CONVENTIONS_STAGE]);
  }, BUDGET_MS);
});

describe("AC-3: a completed ingest enqueues its partition, and asking twice asks once", () => {
  test("AC-3: the worker enqueues a partition job under partitionJobKey, and a second requestPartition is deduplicated", async () => {
    const stage = await staged();
    const artifact = buildArtifact(CAPTIONS, 1);
    const stub = stubCli({ artifact: artifact.json, stderr: "", exitCode: 0 });
    const drawing = await stageDrawing(stage.person, stage.projectId, new TextEncoder().encode("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n"), {
      name: unique("chained.dxf"),
      format: "dxf",
    });

    await withCadCommand(stub.command, async () => {
      const ingest = await productModule<{ requestIngest: (r: { tenantId: string; drawingId: string; requestedBy: string }) => Promise<Record<string, unknown>> }>(
        "src/modules/takeoff/ingest/index.ts",
      );
      const asked = await ingest.requestIngest({ tenantId: stage.person.tenantId, drawingId: drawing.drawingId, requestedBy: stage.person.userId });
      expect(asked, `requesting an ingest for a stored drawing was refused: ${JSON.stringify(asked)}`).not.toHaveProperty("refusal");

      const records = await productModule<{ ingestRecordOf: (s: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>(
        "src/modules/takeoff/ingest/index.ts",
      );
      const record = await until(
        "the worker consumed the ingest job and recorded the drawing",
        () => records.ingestRecordOf({ tenantId: stage.person.tenantId, drawingId: drawing.drawingId }),
        (value) => value !== null,
        CHAIN_BUDGET_MS,
      );

      // The ingest job is over — and the chain happens inside that job, so whatever it asked for it
      // has already asked for. Read through the seam's own `jobEvents` rather than the jobs log's
      // tables: those are made at runtime by the app role (R-SPINE-031), and this suite's role can
      // neither find them in a database nothing has enqueued in nor read them in one where it did.
      const jobId = String((asked as { jobId?: unknown }).jobId ?? "");
      expect(jobId, "requesting an ingest answers the id of the job it enqueued").not.toBe("");
      await until("the ingest job recorded an ending", () => jobHasEnded(jobId), (ended) => ended, CHAIN_BUDGET_MS);

      // Nothing in this suite has asked for a partition, and this is the FIRST ask — so an answer of
      // `deduplicated: true` can only mean the worker's own chain put a job on this ingest's key and
      // it is still there (nothing consumes `partition` in this process). That is the enqueue, the
      // key and the idempotency in one reading, all through the door (SEAM-JOBS, X-1).
      const key = stage.partition.partitionJobKey(stage.person.tenantId, (record as { ingestId: string }).ingestId);
      const again = await stage.partition.requestPartition({ tenantId: stage.person.tenantId, drawingId: drawing.drawingId, requestedBy: stage.person.userId });
      expect(again, `asking for a partition that is already queued was refused: ${JSON.stringify(again)}`).not.toHaveProperty("refusal");
      expect(
        (again as { deduplicated?: boolean }).deduplicated,
        `a partition job already holds ${key}: the composition root is what asked for it, and a second ask is that same ask (ARCH-01, X-1, SEAM-JOBS)`,
      ).toBe(true);
      expect((again as { jobId?: string | null }).jobId, "and it answers with the job that already holds the key").toBeTruthy();
    });
  }, BUDGET_MS);

  test("AC-3: a drawing no ingest record names has no partition to ask for", async () => {
    // Exercised publicly because Q-07's register admits a refusal only where an EXECUTED test names
    // it; the whole of this door's refusal law is the held-out set's.
    const stage = await staged();
    const drawing = await stageDrawing(stage.person, stage.projectId, new TextEncoder().encode("0\nSECTION\n0\nEOF\n"), { name: unique("uningested.dxf"), format: "dxf" });
    const asked = await stage.partition.requestPartition({ tenantId: stage.person.tenantId, drawingId: drawing.drawingId, requestedBy: stage.person.userId });
    expect((asked as { refusal?: string }).refusal, `a drawing nothing has ingested is refused ${PARTITION_NOT_AVAILABLE} by name`).toBe(PARTITION_NOT_AVAILABLE);
  }, BUDGET_MS);
});

describe("AC-3: every model-space original entity lands in exactly one view", () => {
  let rebuilt: Promise<{ staged: StagedIngest; steps: { step: string; detail: Record<string, unknown> }[] }> | undefined;

  const partitioned = async (): Promise<{ staged: StagedIngest; steps: { step: string; detail: Record<string, unknown> }[] }> =>
    (rebuilt ??= (async () => {
      const stage = await staged();
      const ingested = await stageIngested(stage.person, stage.projectId, CAPTIONS, 2, "rebuilt");
      // An empty fixture root: the model is reachable only through recorded answers, and there are
      // none — so a silent caption earns no guess here and nothing leaves for a network (L-AI-01).
      const steps = await withFixtureRoot(tempFixtureRoot("partition-empty"), async () => runPartition(stage.person, ingested, "rebuild"));
      return { staged: ingested, steps };
    })());

  test("AC-3: the run records resolve, views, conventions and stored, in that order", async () => {
    const { steps } = await partitioned();
    const said = steps.map((entry) => entry.step);
    const at = STEPS.map((step) => said.indexOf(step));
    for (const [index, step] of STEPS.entries()) {
      expect(at[index], `the run never recorded the step \`${step}\` — its log reads: ${said.join(" → ")}`).toBeGreaterThanOrEqual(0);
    }
    expect([...at].sort((left, right) => left - right), `the steps stand in the order the stage list runs them; the log reads: ${said.join(" → ")}`).toEqual(at);
  }, BUDGET_MS);

  test("AC-3: every model-space original entity key is assigned exactly once, and to a view of this ingest", async () => {
    const stage = await staged();
    const { staged: ingested } = await partitioned();
    const assignments = viewAssignmentRows(stage.person.tenantId, ingested.ingestId);
    const views = partitionViewRows(stage.person.tenantId, ingested.ingestId);

    expect(byCodePoint(assignments.map((row) => row.entityKey)), "every model-space original entity of the artifact belongs to exactly one view — no more, no fewer (L-CAD-06)").toEqual(
      byCodePoint(ingested.artifact.modelKeys),
    );

    const known = new Set(views.map((view) => view.viewKey));
    expect(
      assignments.filter((row) => !known.has(row.viewKey)).map((row) => `${row.entityKey} → ${row.viewKey}`),
      "an assignment names a view this ingest's partition does not hold",
    ).toEqual([]);
  }, BUDGET_MS);

  test("AC-3: a view is keyed by its class and its caption anchor, and the anchorless one is keyed UNASSIGNED", async () => {
    const stage = await staged();
    const { staged: ingested } = await partitioned();
    const views = partitionViewRows(stage.person.tenantId, ingested.ingestId);
    expect(views.length, "the partition holds views — an empty partition assigns nothing").toBeGreaterThan(0);

    const anchors = new Set(ingested.artifact.modelKeys);
    const malformed = views
      .filter((view) => {
        if (view.viewKey === UNASSIGNED) return view.type !== UNASSIGNED;
        const at = view.viewKey.indexOf(":");
        return at <= 0 || view.viewKey.slice(0, at) !== view.type || !anchors.has(view.viewKey.slice(at + 1));
      })
      .map((view) => `${view.viewKey} (type ${view.type})`);
    expect(
      malformed,
      "a view key is its class and the source key of the caption that anchors it (L-REG-04: content-derived, no minted ids), and the one view with no caption at all is keyed exactly UNASSIGNED",
    ).toEqual([]);
  }, BUDGET_MS);

  test("AC-3: each caption anchors the view its own grammar answer names, and its own entity is assigned there", async () => {
    const stage = await staged();
    const { staged: ingested } = await partitioned();
    const views = new Map(partitionViewRows(stage.person.tenantId, ingested.ingestId).map((view) => [view.viewKey, view]));
    const assigned = new Map(viewAssignmentRows(stage.person.tenantId, ingested.ingestId).map((row) => [row.entityKey, row.viewKey]));

    for (const spec of CAPTIONS) {
      const anchor = ingested.artifact.anchorOf.get(spec.caption) ?? "";
      const said = stage.grammar.classifyCaption(spec.caption);
      const key = `${said.type}:${anchor}`;

      expect(views.get(key), `the caption ${JSON.stringify(spec.caption)} anchors a view keyed ${key}; the partition holds ${[...views.keys()].join(", ")}`).toBeTruthy();
      expect(views.get(key)?.type, `the view the caption anchors carries the type the grammar read`).toBe(said.type);
      expect(views.get(key)?.reason, `a classified caption carries no reason, and an unreadable one carries ${CAPTION_UNCLASSIFIABLE}`).toBe(said.reason);
      expect(assigned.get(anchor), `the caption's own entity belongs to the view it anchors`).toBe(key);
    }
  }, BUDGET_MS);
});
