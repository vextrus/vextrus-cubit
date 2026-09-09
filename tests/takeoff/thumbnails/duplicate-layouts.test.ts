/**
 * AC-4(d) — two sheets that would be recorded under one name are not silently one sheet.
 *
 * A raster is keyed by (record, sheet, tier), so two layouts of one artifact whose RECORDED names
 * agree land on one key: the belt swallows the second sheet's rows and serves the first sheet's
 * pictures under both names (debt-src-modules-193fyri). Nothing renders and nothing is stored: the
 * job says which name collided, and an operator can see it in the drawing.
 *
 * The record and the store are stood in for, because what is judged is the job's own judgement:
 * that it makes it BEFORE it renders or stores anything.
 */
import { expect, test, vi } from "vitest";

const INGEST_MODULE = "../../../src/modules/takeoff/ingest";
const PIPELINE_MODULE = "../../../src/modules/takeoff/thumbnails/pipeline";

/** The sheet name both layouts of the staged artifact carry. */
const COLLIDING = "PLAN";

const seam = vi.hoisted(() => ({
  ingestRecords: vi.fn<() => Promise<unknown[]>>(),
  put: vi.fn<(tenantId: string, bytes: Uint8Array) => Promise<{ sha256: string }>>(),
  get: vi.fn<(tenantId: string, sha256: string) => Promise<Uint8Array | null>>(),
}));

vi.mock("../../../src/modules/takeoff/ingest", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return { ...original, ingestRecords: seam.ingestRecords };
});

const pipeline = await import("../../../src/modules/takeoff/thumbnails/pipeline");

const TENANT = "3f1c2e10-8a44-4e2b-9f0a-1c2d3e4f5061";
const DRAWING = "11111111-1111-4111-8111-111111111111";
const INGEST = "22222222-2222-4222-8222-222222222222";
const ARTIFACT = "0".repeat(64);

/** An artifact carrying two paper layouts that say the same name. */
function artifact(): string {
  const layout = (name: string): Record<string, unknown> => ({ name, kind: "paper", bbox: { min: [0, 0], max: [297, 210] }, strays_rejected: 0 });
  return JSON.stringify({
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: ARTIFACT },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [layout(COLLIDING), layout(COLLIDING)],
    dropped_layouts: [],
    entities: [
      { key: "DXF_HANDLE:1", type: "LINE", space: COLLIDING, layer: "0", points: [[0, 0], [100, 100]], colour: { rgb: [0, 0, 0], source: "bylayer" } },
    ],
    derived: [],
    block_attributes: [],
    counters: [],
  });
}

/** The record the job is run over, as the ingest module answers with one. */
function record(): Record<string, unknown> {
  return {
    ingestId: INGEST,
    drawingId: DRAWING,
    sha256: ARTIFACT,
    jobId: "job",
    artifactSha256: ARTIFACT,
    extractor: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", toolVersion: "0.0.0", parameterSetHash: ARTIFACT },
    facts: { layouts: [{ name: COLLIDING, kind: "paper" }, { name: COLLIDING, kind: "paper" }] },
    supersedes: null,
    declaredReason: null,
    createdAt: new Date().toISOString(),
  };
}

test("AC-4(d): two layouts recorded under one name stop the job, before anything is rendered or stored", async () => {
  seam.ingestRecords.mockImplementation(async () => [record()]);
  seam.get.mockImplementation(async () => new TextEncoder().encode(artifact()));
  seam.put.mockImplementation(async () => ({ sha256: ARTIFACT }));
  const steps: string[] = [];

  const answered = await pipeline
    .runThumbnailsJob(
      { tenantId: TENANT, drawingId: DRAWING, ingestId: INGEST, requestedBy: "someone" } as never,
      { jobId: "job", tempDir: "", step: async (name: string) => void steps.push(name) } as never,
      { storage: { put: seam.put, get: seam.get, sign: () => "", verify: () => ({ ok: false }) } as never },
    )
    .then(
      () => ({ threw: false, said: "" }),
      (reason: unknown) => ({ threw: true, said: reason instanceof Error ? reason.message : String(reason) }),
    );

  expect(answered.threw, "two sheets that cannot be told apart in the store are not something to store anyway").toBe(true);
  expect(answered.said, "the name that collided is named, so the collision can be found in the drawing").toContain(COLLIDING);
  expect(seam.put, "nothing was stored: the judgement is made before the first raster is rendered").not.toHaveBeenCalled();
});

void INGEST_MODULE;
void PIPELINE_MODULE;
