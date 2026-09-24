// One ingest per drawing per process. The recorders each ask their question of the same drawing's
// artifact, and each ran the extractor for it: the golden lane's corpus proof
// (tests/golden/bnbc-model-corpus.test.ts) ingested F-RCC6-BNBC three times over. The artifact is a
// pure function of the bytes (L-CAD-02), so it is kept by their sha-256 and asked for once.
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingestDrawing } from "../../src/modules/takeoff/ingest/job";

type Ingested = Extract<Awaited<ReturnType<typeof ingestDrawing>>, { ok: true }>;

const held = new Map<string, Promise<Ingested["graph"]>>();

/** The drawing's artifact graph; a refusal is answered through the recorder's own `fail`, by name. */
export async function ingestedGraph(drawing: string, fail: (message: string) => never): Promise<Ingested["graph"]> {
  const bytes = new Uint8Array(readFileSync(drawing));
  const key = createHash("sha256").update(bytes).digest("hex");
  let graph = held.get(key);
  if (graph === undefined) {
    const format = drawing.toLowerCase().endsWith(".dwg") ? "dwg" : "dxf";
    graph = ingestDrawing(bytes, format as Parameters<typeof ingestDrawing>[1], { tempDir: mkdtempSync(join(tmpdir(), "cubit-model-corpus-ingest-")) }).then((outcome) => {
      if (!outcome.ok) throw new Error(`the extractor refused ${drawing}: ${outcome.refusal} — ${outcome.detail}`);
      return outcome.graph;
    });
    held.set(key, graph);
  }
  try {
    return await graph;
  } catch (error) {
    held.delete(key);
    return fail(error instanceof Error ? error.message : String(error));
  }
}
