// R-UI-043: the viewer never blocks, and the manifest is cached by content hash. This is the seam a
// screen and the layer feed both ask for a sheet through — one read of the ingest record, one read
// of the bytes it names, one build, and every later ask for the same content answered from memory.
//
// The three answers stay three (ARCH-03, B-21): a drawing nobody has read yet, or a sheet name the
// reading does not carry, is an absence a screen teaches from; bytes the one mirror cannot parse are
// the registered refusal with the facts the reading did record; and bytes the store does not hold at
// the address the record names is an outage of ours, which is raised as a fault rather than dressed
// up as an answer about the drawing.
import { entityGraphSchema } from "../../../core/entitygraph/schema";
import { REFUSALS } from "../../../core/errors";
import type { Storage } from "../../../core/storage";
import type { IngestFacts } from "../ingest/facts";
import { ingestRecordOf } from "../ingest/records";
import { buildRenderManifest, graphHoldsLayout, manifestCacheKey } from "./manifest";
import type { RenderManifest, ViewerHead } from "./types";

/** Which sheet of which drawing, in whose workspace. */
export type ViewerScope = { tenantId: string; drawingId: string; layoutName: string };

/**
 * How many built sheets are held. The cache is a process memo rather than a table: a manifest is
 * derivable from bytes that never change, so what it buys is time and not durability, and a handful
 * of sheets is what one reader moves between. The oldest entry leaves when the next one arrives.
 */
const CACHE_LIMIT = 4;

/**
 * The memo's anchor. A module-level `Map` is per module instance, and a Next server holds several of
 * those over one process — so the cache hangs off the process itself, which is what makes a second
 * request for one sheet a hit (R-UI-043, PB-2's warm reading).
 */
const CACHE_ANCHOR = Symbol.for("cubit.viewer.manifestCache");

/** The process's manifest memo, made once. */
function manifestCache(): Map<string, RenderManifest> {
  const host = globalThis as typeof globalThis & { [CACHE_ANCHOR]?: Map<string, RenderManifest> };
  const held = host[CACHE_ANCHOR];
  if (held !== undefined) return held;
  const made = new Map<string, RenderManifest>();
  host[CACHE_ANCHOR] = made;
  return made;
}

/** Hold a built sheet, and let the oldest go once the memo is full. */
function remember(key: string, manifest: RenderManifest): void {
  const cache = manifestCache();
  cache.set(key, manifest);
  for (const oldest of cache.keys()) {
    if (cache.size <= CACHE_LIMIT) break;
    cache.delete(oldest);
  }
}

/**
 * The sheet a viewer opens: built once per content and layout, served from the memo thereafter.
 *
 * The storage seam is injected rather than reached for, so the caller that already holds one — a
 * route, a job, a test stage — hands it over and the bytes behind one address are read once.
 */
export async function renderManifestOf(scope: ViewerScope, deps: { storage: Storage }): Promise<ViewerHead> {
  const record = await ingestRecordOf({ tenantId: scope.tenantId, drawingId: scope.drawingId });
  if (record === null) return { kind: "absent", reason: "not-ingested" };

  const key = manifestCacheKey(record.artifactSha256, scope.layoutName);
  const held = manifestCache().get(key);
  if (held !== undefined) return { kind: "manifest", manifest: held, cache: "hit", facts: record.facts };

  const bytes = await deps.storage.get(scope.tenantId, record.artifactSha256);
  // The record and the object were written together, so an address the store cannot answer is our
  // outage and not a fact about the drawing — it is raised, reported at the fault seam by whoever
  // called, and never rendered as a refusal the reader could act on (ARCH-03).
  if (bytes === null) throw new Error(`the store holds no artifact at ${record.artifactSha256} for ingest ${record.ingestId} (SEAM-STORAGE)`);

  // Both ways bytes can fail to be an artifact — not JSON at all, and JSON the one mirror refuses —
  // are the same fact about the reading, so they answer the same registered way (L-CAD-05).
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return refused(record.facts);
  }
  const parsed = entityGraphSchema.safeParse(json);
  if (!parsed.success) return refused(record.facts);

  const graph = parsed.data;
  if (!graphHoldsLayout(graph, scope.layoutName)) return { kind: "absent", reason: "layout-unknown" };

  const manifest = buildRenderManifest(graph, scope.layoutName);
  remember(key, manifest);
  return { kind: "manifest", manifest, cache: "miss", facts: record.facts };
}

/**
 * The registered answer for a reading nothing can be drawn from: the code, its message and its
 * remedy carried whole out of the register, with the facts the reading did record beside them so a
 * reader learns what was recovered (R-UI-043, R-SPINE-062).
 */
function refused(facts: IngestFacts): ViewerHead {
  return { kind: "refusal", refusal: REFUSALS.MANIFEST_NOT_RENDERABLE, facts };
}
