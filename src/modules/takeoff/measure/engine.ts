// L-QTY-03's engine, derived for a placement rather than stamped on it (OPEN-4, s-drawings I-654).
//
// A placement is read off atoms of a drawing — the outline it was placed by, the mark that named it,
// the note that spoke of it — and each atom is a source key whose scheme says who minted it
// (L-CAD-02). Where any of them was minted by the vectoriser (`RASTER_TRACE`), the placement was
// read off a scan's trace, and a line it publishes says so: its engine is RASTER, and it carries the
// identity of the trace — the vectoriser, its version and parameter set, and the page raster with the
// resolution it was read at (L-QTY-03, L-QTY-06, I-584). A placement whose atoms are all a CAD
// handle or a PDF object is the vector engine's, exactly as every placement was before a scan could
// be placed.
//
// Nothing here reads a store: the setup hands in the ingest record and, only for a drawing that
// places something off a trace, the artifact — so a DXF revision opens nothing it did not open before.
import type { EntityGraph, RasterRecord } from "@/core/entitygraph/schema";
import type { Engine, RasterIdentity } from "@/core/offers/contract";
import { parseSourceKey, type SourceScheme } from "@/core/sources";

/** The scheme the vectoriser mints (L-CAD-02, I-584). */
const RASTER_TRACE: SourceScheme = "RASTER_TRACE";

/** The two engines, by their roster names (`ENGINES`, `@/core/offers/law`). */
const VECTOR: Engine = "VECTOR";
const RASTER: Engine = "RASTER";

/** The atoms a placement was read off, as the store names them; a null is an atom it has none of. */
export type PlacementAtoms = { readonly outlineKey: string; readonly markKey: string; readonly noteKey: string | null };

/** The identities an ingest record pins (I-518): its extractor's, and the vectoriser's beside a PDF's. */
export type EngineRecord = {
  readonly extractor: { readonly scheme: SourceScheme; readonly tool: string; readonly toolVersion: string; readonly parameterSetHash: string };
  readonly trace: { readonly tool: string; readonly toolVersion: string; readonly parameterSetHash: string } | null;
};

/** What the engine seam reads of an artifact: its originals and the pictures it traced. */
export type EngineGraph = Pick<EntityGraph, "entities" | "rasters">;

/** A placement's engine and, under RASTER, the identity of the trace it was read off. */
export type Sighting = { readonly engine: Engine; readonly raster?: RasterIdentity };

/** The first atom the vectoriser minted, in the order a placement cites them (outline, mark, note), or null. */
export function tracedAtomOf(atoms: PlacementAtoms): string | null {
  for (const key of [atoms.outlineKey, atoms.markKey, atoms.noteKey]) {
    if (key === null) continue;
    const parsed = parseSourceKey(key);
    if (parsed !== null && parsed.startsWith(`${RASTER_TRACE}:`)) return parsed;
  }
  return null;
}

/** The engine a placement was read by: RASTER where any atom it stands on is a trace, VECTOR otherwise. */
export function engineOf(atoms: PlacementAtoms): Engine {
  return tracedAtomOf(atoms) === null ? VECTOR : RASTER;
}

/** Is the point inside (or on) the convex quadrilateral a traced picture stands at? */
function inside(point: readonly [number, number], quad: readonly (readonly [number, number])[]): boolean {
  let sign = 0;
  for (let index = 0; index < quad.length; index += 1) {
    const [ax, ay] = quad[index] as readonly [number, number];
    const [bx, by] = quad[(index + 1) % quad.length] as readonly [number, number];
    const cross = (bx - ax) * (point[1] - ay) - (by - ay) * (point[0] - ax);
    if (cross === 0) continue;
    const side = cross > 0 ? 1 : -1;
    if (sign === 0) sign = side;
    else if (side !== sign) return false;
  }
  return true;
}

/**
 * The traced picture an atom was traced from: the one record on the atom's page, or — where a page
 * carries several pasted scans — the one whose placement holds every point of the atom. Null where
 * the atom names no original of the artifact or no single picture answers for it: a raster reading
 * whose resolution nobody can name is carried as RASTER with no identity, and the gate's own rule
 * for an identity-less raster reading is what answers it — never a picture guessed (L-QTY-03).
 */
function pictureOf(atom: string, graph: EngineGraph): RasterRecord | null {
  const entity = graph.entities.find((one) => one.key === atom);
  if (entity === undefined) return null;
  const onPage = (graph.rasters ?? []).filter((record) => record.space === entity.space);
  if (onPage.length === 1) return onPage[0] as RasterRecord;
  const points = entity.points ?? [];
  if (points.length === 0) return null;
  const holding = onPage.filter((record) => points.every((point) => inside(point, record.placement)));
  return holding.length === 1 ? (holding[0] as RasterRecord) : null;
}

/**
 * The identity a raster reading carries: the vectoriser that minted the atom (the record's own
 * extractor where the file was a scan, the trace beside pdfium's where a PDF page carried one, I-518),
 * and the page raster the atom was traced from with the DPI it was read at, as the artifact states it
 * — a DPI nobody stated is carried as null under `unstated`, never inferred (I-584 §4).
 */
export function rasterIdentityOf(atom: string, record: EngineRecord, graph: EngineGraph): RasterIdentity | null {
  const vectoriser = record.extractor.scheme === RASTER_TRACE ? record.extractor : record.trace;
  if (vectoriser === null) return null;
  const picture = pictureOf(atom, graph);
  if (picture === null) return null;
  return {
    tool: vectoriser.tool,
    toolVersion: vectoriser.toolVersion,
    parameterSetHash: vectoriser.parameterSetHash,
    pageSha256: picture.sha256,
    dpi: picture.dpi === null ? null : String(picture.dpi),
    dpiSource: picture.dpi_source,
  };
}

/**
 * A placement's sighting: VECTOR with no identity where nothing it stands on was traced, RASTER with
 * the trace's identity where something was — and RASTER with none where the identity could not be
 * read (`rasterIdentityOf`). `graph` is asked for only under RASTER, so a vector drawing's artifact
 * is never opened for this.
 */
export async function sightingOf(atoms: PlacementAtoms, record: EngineRecord, graph: () => Promise<EngineGraph>): Promise<Sighting> {
  const traced = tracedAtomOf(atoms);
  if (traced === null) return { engine: VECTOR };
  const identity = rasterIdentityOf(traced, record, await graph());
  return identity === null ? { engine: RASTER } : { engine: RASTER, raster: identity };
}
