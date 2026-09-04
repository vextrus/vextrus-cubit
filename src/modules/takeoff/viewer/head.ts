// R-UI-043: the viewer never blocks, and the manifest is cached by content hash. This is the seam a
// screen and the layer feed both ask for a sheet through — one read of the ingest record, one read
// of the bytes it names, one build, and every later ask for the same content answered from memory.
//
// The three answers stay three (ARCH-03, B-21): a drawing nobody has read yet, or a sheet name the
// reading does not carry, is an absence a screen teaches from; and every way the bytes the record
// names fail to yield a sheet — the store holding nothing at that address, bytes that are not JSON,
// JSON the one mirror refuses — is the same registered refusal, carrying the facts the reading did
// record so the reader still learns what was recovered.
import { entityGraphSchema } from "../../../core/entitygraph/schema";
import { REFUSALS } from "../../../core/errors";
import type { Storage } from "../../../core/storage";
import type { IngestFacts } from "../ingest/facts";
import { ingestRecordOf } from "../ingest/records";
import { buildRenderManifest, graphHoldsLayout, manifestCacheKey } from "./manifest";
import type { RenderManifest, ViewerHead } from "./types";

/** Which sheet of which drawing, in whose workspace. */
export type ViewerScope = {
  tenantId: string;
  drawingId: string;
  layoutName: string;
};

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

/** The anchor of the builds still in flight, so one sheet is read and built once however many ask. */
const FLIGHT_ANCHOR = Symbol.for("cubit.viewer.manifestFlights");

/** The process's manifest memo, made once. */
function manifestCache(): Map<string, RenderManifest> {
  const host = globalThis as typeof globalThis & {
    [CACHE_ANCHOR]?: Map<string, RenderManifest>;
  };
  const held = host[CACHE_ANCHOR];
  if (held !== undefined) return held;
  const made = new Map<string, RenderManifest>();
  host[CACHE_ANCHOR] = made;
  return made;
}

/** The builds this process has started and not finished, on the same anchor and for the same reason. */
function manifestFlights(): Map<string, Promise<Build>> {
  const host = globalThis as typeof globalThis & {
    [FLIGHT_ANCHOR]?: Map<string, Promise<Build>>;
  };
  const held = host[FLIGHT_ANCHOR];
  if (held !== undefined) return held;
  const made = new Map<string, Promise<Build>>();
  host[FLIGHT_ANCHOR] = made;
  return made;
}

/**
 * The memo's key. The content hash and the layout name say which sheet — and the workspace says
 * whose, because the memo answers *instead of* the store: two workspaces that uploaded the same
 * drawing name one content address, and a hit keyed on the address alone would answer one workspace
 * out of bytes only the other's store ever held, including where this workspace's store holds
 * nothing at that address at all (which is AC-7's refusal, not a sheet).
 */
function memoKey(tenantId: string, artifactSha256: string, layoutName: string): string {
  return `${tenantId}/${manifestCacheKey(artifactSha256, layoutName)}`;
}

/** What building a sheet out of the bytes an address names can come to. */
type Build =
  | { kind: "manifest"; manifest: RenderManifest }
  | { kind: "refusal"; refusal: typeof REFUSALS.MANIFEST_NOT_RENDERABLE }
  | { kind: "absent"; reason: "layout-unknown" };

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
  const record = await ingestRecordOf({
    tenantId: scope.tenantId,
    drawingId: scope.drawingId,
  });
  if (record === null) return { kind: "absent", reason: "not-ingested" };

  const key = memoKey(scope.tenantId, record.artifactSha256, scope.layoutName);
  const held = manifestCache().get(key);
  if (held !== undefined)
    return {
      kind: "manifest",
      manifest: held,
      cache: "hit",
      facts: record.facts,
    };

  // Two readers opening one sheet at once are one read of the bytes and one build: the cache check
  // and the write are separated by the reading itself, so without this the warm path R-UI-043 asks
  // for is bought only by whoever arrives second in wall-clock time. The facts are this caller's own
  // record's either way — only the work is shared.
  const built = await buildOnce(key, () => build(scope, record.artifactSha256, deps.storage));
  if (built.kind === "absent") return built;
  if (built.kind === "refusal") return refused(record.facts);
  return {
    kind: "manifest",
    manifest: built.manifest,
    cache: "miss",
    facts: record.facts,
  };
}

/** The one build behind a key, shared by everyone who asks for it while it is in flight. */
function buildOnce(key: string, work: () => Promise<Build>): Promise<Build> {
  const flights = manifestFlights();
  const held = flights.get(key);
  if (held !== undefined) return held;
  const flight = work().finally(() => flights.delete(key));
  flights.set(key, flight);
  return flight;
}

/** Every way the bytes fail to be a sheet, as the one registered refusal (R-UI-043, L-CAD-05). */
function refuse(): Build {
  return { kind: "refusal", refusal: REFUSALS.MANIFEST_NOT_RENDERABLE };
}

/** The bytes one address names, read once and made into a sheet — or into the reason there is none. */
async function build(scope: ViewerScope, artifactSha256: string, storage: Storage): Promise<Build> {
  const bytes = await storage.get(scope.tenantId, artifactSha256);
  // An address the store cannot answer leaves the sheet exactly as unrenderable as bytes the mirror
  // refuses, and the reader's move is the same one: re-read the drawing. So it is the registered
  // refusal with the recovered facts beside it, never a raise the reader can do nothing with
  // (R-UI-043, R-UI-020).
  if (bytes === null) return refuse();

  // Both ways bytes can fail to be an artifact — not JSON at all, and JSON the one mirror refuses —
  // are the same fact about the reading, so they answer the same registered way (L-CAD-05).
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return refuse();
  }
  const parsed = entityGraphSchema.safeParse(json);
  if (!parsed.success) return refuse();

  const graph = parsed.data;
  if (!graphHoldsLayout(graph, scope.layoutName)) return { kind: "absent", reason: "layout-unknown" };

  const manifest = buildRenderManifest(graph, scope.layoutName);
  remember(memoKey(scope.tenantId, artifactSha256, scope.layoutName), manifest);
  return { kind: "manifest", manifest };
}

/**
 * The registered answer for a reading nothing can be drawn from: the code, its message and its
 * remedy carried whole out of the register, with the facts the reading did record beside them so a
 * reader learns what was recovered (R-UI-043, R-SPINE-062).
 */
function refused(facts: IngestFacts): ViewerHead {
  return { kind: "refusal", refusal: REFUSALS.MANIFEST_NOT_RENDERABLE, facts };
}
