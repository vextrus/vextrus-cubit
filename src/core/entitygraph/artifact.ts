// L-CAD-05's artifact, read ONCE per content hash: the geometry a drawing was ingested as, validated
// against the one mirror at the moment it is first read and answered from the hash thereafter.
//
// Five readers had the same twelve lines copied into them — sheets, scale evidence, the partition
// rebuild, the thumbnails pipeline and the viewer's head — and every one of them fetched the bytes,
// decoded them, and put a graph of tens of thousands of entities back through the zod mirror. On a
// real set that is the same validation paid five times per drawing per pass, and a sixth the next
// time a sheet index is rendered. One fact, read five ways (B-17, B-19).
//
// The key is the content hash the store already minted for exactly these bytes (SEAM-STORAGE
// addresses an object by the sha256 of its content), so the cache cannot answer with a graph that is
// not the one the caller asked for: a different artifact is a different address. The tenant is part
// of the key for the same reason the viewer's manifest memo carries one — an object is a tenant's,
// and a cache one tenant could read another's entry out of would be a leak, not a saving.
//
// What is cached is the VALIDATED graph, so the validated flag rides with the hash and there is no
// second place where "this one was checked" could be recorded and go stale (ARCH-02).
import type { Storage } from "@/core/storage";
import { entityGraphSchema, type EntityGraph } from "./schema";

/**
 * How many artifacts one process keeps. Small on purpose: a graph is large, and the readers of one
 * drawing run together — the pass that wants it wants it five times in a row, not once an hour.
 */
const KEPT = 4;

/** The one home of the cache in this process — anchored on the global so two module instances (the
 * app's bundle and a job runner's direct import) share it rather than each keeping a copy. */
const ANCHOR = Symbol.for("vextrus.cubit.core.entitygraph.artifacts");

/** What the anchor holds: the validated graphs, the reads in flight, and the tally the tests read. */
type Held = {
  readonly kept: Map<string, EntityGraph>;
  readonly flights: Map<string, Promise<EntityGraph>>;
  validations: number;
  hits: number;
};

function held(): Held {
  const anchored = globalThis as unknown as Record<symbol, Held | undefined>;
  const already = anchored[ANCHOR];
  if (already !== undefined) return already;
  const made: Held = { kept: new Map(), flights: new Map(), validations: 0, hits: 0 };
  anchored[ANCHOR] = made;
  return made;
}

/** One artifact's address: the tenant that owns the object, and the content hash that names it. */
function addressOf(tenantId: string, artifactSha256: string): string {
  return `${tenantId}/${artifactSha256}`;
}

/** Keep this graph under its address, retiring the oldest when the cache is full (insertion order). */
function keep(store: Held, address: string, graph: EntityGraph): EntityGraph {
  store.kept.delete(address);
  store.kept.set(address, graph);
  while (store.kept.size > KEPT) {
    const oldest = store.kept.keys().next();
    if (oldest.done === true) break;
    store.kept.delete(oldest.value);
  }
  return graph;
}

/** The bytes at one address, decoded and put to the mirror. The one place a graph is validated. */
async function validate(tenantId: string, artifactSha256: string, storage: Storage, whose: string): Promise<EntityGraph> {
  const bytes = await storage.get(tenantId, artifactSha256);
  // An artifact a record points at that the store does not hold is an outage of ours, not the
  // drawing's fault: the record and the object were written together (ARCH-03).
  if (bytes === null) throw new Error(`the store holds no artifact at ${artifactSha256} for ${whose} (SEAM-STORAGE)`);
  const parsed = entityGraphSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
  if (!parsed.success) throw new Error(`the artifact at ${artifactSha256} is not an EntityGraph this tree reads: ${parsed.error.message}`);
  return parsed.data;
}

/**
 * The validated geometry at one content hash. Validated once per hash: the second reader of the same
 * drawing is answered from the address, and two readers who ask at the same moment share one read
 * rather than racing two (the flight).
 *
 * `whose` names the record that pointed here, so a missing object still says which ingest asked.
 */
export async function artifactAt(tenantId: string, artifactSha256: string, storage: Storage, whose: string): Promise<EntityGraph> {
  const store = held();
  const address = addressOf(tenantId, artifactSha256);

  const already = store.kept.get(address);
  if (already !== undefined) {
    store.hits += 1;
    return keep(store, address, already);
  }
  const flying = store.flights.get(address);
  if (flying !== undefined) {
    store.hits += 1;
    return await flying;
  }

  const reading = (async () => {
    const graph = await validate(tenantId, artifactSha256, storage, whose);
    store.validations += 1;
    return keep(store, address, graph);
  })();
  store.flights.set(address, reading);
  try {
    return await reading;
  } finally {
    store.flights.delete(address);
  }
}

/**
 * A graph the INGEST has just validated, put under its hash without a second reading. This is what
 * makes "validated once, at ingest" true rather than "validated once, whenever someone first asks":
 * the pipeline that wrote the object knows both the bytes and the verdict, so the flag rides with
 * the hash from the moment the hash exists.
 */
export function rememberValidated(tenantId: string, artifactSha256: string, graph: EntityGraph): void {
  keep(held(), addressOf(tenantId, artifactSha256), graph);
}

/** What the cache has done, for the suites that prove a second read does not re-validate. */
export function artifactCacheTally(): { readonly validations: number; readonly hits: number; readonly kept: number } {
  const store = held();
  return { validations: store.validations, hits: store.hits, kept: store.kept.size };
}

/** Forget everything and reset the tally — a suite's own setup, never a caller's. */
export function forgetArtifacts(): void {
  const store = held();
  store.kept.clear();
  store.flights.clear();
  store.validations = 0;
  store.hits = 0;
}
