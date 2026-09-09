/**
 * AC-5(d) — a drawing with no model space is not a drawing with an empty one.
 *
 * `censusOf` tallies only what stands in model space, so an artifact carrying no model layout at all
 * tallies nothing — and nothing resolves to a profile whose every role is deferred, which is then
 * stored as though the drawing had been read and found wanting (debt-src-modules-xytlzb). A reader
 * cannot tell that record from a real one. There is no census of a drawing with nowhere to take one,
 * and nothing is stored for it.
 *
 * Two readings: the pure one, over a hand-drawn artifact, and the stored one, over the shipped
 * partition job run against the same artifact really recorded.
 */
import { afterAll, expect, test } from "vitest";
import {
  INGEST_JOB_MODULE,
  INGEST_MODULE,
  PRINCIPAL,
  closeStage,
  grantRole,
  openSheetsStage,
  productModule,
  rebuildDoor,
  stagePerson,
  stepSink,
  storageOf,
  tempDir,
  tempFixtureRoot,
  unique,
  withFixtureRoot,
  type Person,
  type ProgressLike,
} from "../support/partition-stage";
import { censusDoor, viewsResultOf } from "../support/conventions-stage";
import { stageDrawing, stubCli, withCadCommand } from "../../support/ingest-stage";

/** How long a staged case may take: a database provisioned, a drawing ingested, a partition run. */
const BUDGET_MS = 600_000;

const STORE_MODULE = "src/modules/takeoff/partition/store.ts";

/** An artifact whose only layout is a sheet: a title block and a border, and nowhere to take a census. */
function paperOnlyArtifact(): Record<string, unknown> {
  const entities = [
    { key: "DXF_HANDLE:A1", type: "TEXT", space: "Layout1", layer: "TITLEBLOCK", text: "S-101 GENERAL ARRANGEMENT", height: 3, points: [[5, 5]] },
    { key: "DXF_HANDLE:A2", type: "LINE", space: "Layout1", layer: "TITLEBLOCK", points: [[0, 0], [297, 210]] },
  ];
  return {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [{ name: "Layout1", kind: "paper", bbox: { min: [0, 0], max: [297, 210] }, strays_rejected: 0 }],
    dropped_layouts: [],
    entities: entities.map((record) => ({ ...record, colour: { rgb: [0, 0, 0], source: "bylayer" } })),
    derived: [],
    block_attributes: [],
    counters: [],
  };
}

interface Staged {
  person: Person;
  projectId: string;
  drawingId: string;
  ingestId: string;
}

let staging: Promise<Staged> | undefined;

/**
 * A drawing whose recorded artifact carries no model layout, partitioned by the shipped job — staged
 * the way every other partition suite stages one: real bytes, the shipped ingest pipeline, and a
 * stand-in for the CAD CLI that hands back the artifact this case is about.
 */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("no-model-space");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);

    const job = await productModule<{ runIngestJob: (payload: unknown, progress: ProgressLike, deps: { storage: unknown }) => Promise<void> }>(INGEST_JOB_MODULE);
    const records = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>(INGEST_MODULE);

    const bytes = new TextEncoder().encode("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n; no model space\n");
    const drawing = await stageDrawing(person, projectId, bytes, { name: unique("no-model-space.dxf"), format: "dxf" });
    const stub = stubCli({ artifact: JSON.stringify(paperOnlyArtifact()), stderr: "", exitCode: 0 });
    await withCadCommand(stub.command, async () => {
      await job.runIngestJob(
        { tenantId: person.tenantId, drawingId: drawing.drawingId, requestedBy: person.userId, declared: null },
        { jobId: unique("ingest-no-model-space"), tempDir: tempDir("ingest"), step: async () => undefined },
        { storage: await storageOf() },
      );
    });

    const record = await records.ingestRecordOf({ tenantId: person.tenantId, drawingId: drawing.drawingId });
    expect(record, "staging left no ingest record — a partition is a reading of a record").not.toBeNull();
    const ingestId = (record as { ingestId: string }).ingestId;

    const rebuild = await rebuildDoor();
    const sink = stepSink("no-model-space");
    await withFixtureRoot(tempFixtureRoot("no-model-space"), async () =>
      rebuild.runPartitionJob({ tenantId: person.tenantId, drawingId: drawing.drawingId, ingestId, requestedBy: person.userId }, sink.progress, { storage: await storageOf() }),
    );
    return { person, projectId, drawingId: drawing.drawingId, ingestId };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

test("AC-5(d): an artifact with no model layout has no census to take", async () => {
  const { censusOf } = await censusDoor();
  const graph = paperOnlyArtifact();

  const answered = censusOf(graph, (await viewsResultOf(graph)).views);

  expect(answered, "no model space is not an empty model space — there is nothing to tally, and nothing is claimed").toBeNull();
});

test(
  "AC-5(d): and the conventions stage stores no profile for it",
  async () => {
    const stage = await staged();
    const store = await productModule<Record<string, unknown>>(STORE_MODULE);
    expect(typeof store["storedConventionsOf"], `${STORE_MODULE} publishes storedConventionsOf`).toBe("function");
    const storedConventionsOf = store["storedConventionsOf"] as (tenantId: string, ingestId: string) => Promise<unknown | null>;

    await expect(
      storedConventionsOf(stage.person.tenantId, stage.ingestId),
      "a fully-deferred profile stored for a drawing nobody could read is a reading nobody took",
    ).resolves.toBeNull();
  },
  BUDGET_MS,
);
