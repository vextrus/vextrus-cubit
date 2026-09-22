// Everything the machine reads a record's scale proposals from, gathered (L-MEA-05, R-TO-020): the
// frozen artifact, the partition's assignments of entities to views (L-CAD-06), inc-202's grid rows
// (L-CAD-07) and the header's own unit. Gathered on the caller's transaction, so the act seam judges
// against the very state its write lands in, and handed to the pure `proposalsFor` — nothing here
// proposes anything, and nothing here is stored.
//
// The lengths a drawing's own dimension texts state cross the seam already parsed, and a caller that
// brings no reader of its own is answered with the one the layer above registered: the act seam and
// the panel's door derive over the SAME evidence, which is what keeps the panel from offering a rank
// the act behind it refuses (`useStatedLengths` below, I-295b).
import { and, eq, grids, viewAssignments, type TenantTx } from "../db";
import { artifactAt } from "@/core/entitygraph/artifact";
import type { EntityGraph } from "../entitygraph/schema";
import type { Storage } from "../storage";
import type { GridReading, ScaleEvidence, ScaleTolerances, StatedLength } from "./proposals";

/**
 * How the caller reads the lengths a drawing's dimension texts state in their OWN units — the
 * notation grammar's job, and the takeoff module's one home for it (B-17). Core takes it as a
 * parameter because core may not reach a module (ARCH-01); a gatherer that hands none is answered
 * with the header-only reading, which is what this engine did before there was a grammar to ask.
 */
export type StatedLengthReader = (graph: EntityGraph) => ReadonlyMap<string, StatedLength>;

/**
 * THE ONE READING, BOTH SIDES OF THE SEAM. The panel's door hands its grammar down by hand
 * (`scaleProposalsOf`), and the act seam cannot: AFFIRM_SCALE is rendered in core, gathers its own
 * evidence on the transaction its write lands in, and core may not reach a module for the grammar
 * that reads `15'-0"` (ARCH-01). Were the act left with the header-only reading, the panel would
 * offer a rank on a unitless header that the act then refused SCALE_UNIT_UNMAPPED — a door offering
 * what the act behind it will not take.
 *
 * So the module that owns the grammar hands it down once, at its own import, and core holds it for
 * whoever gathers evidence without one. This is the job seam's own shape read from the other end
 * ("a kind whose work needs a module cannot be named here at all … so it registers its handler from
 * the layer that may compose one" — src/core/jobs/runtime.ts), and it is anchored to the PROCESS for
 * the reason that holder is: one home is an identity property, and a bundler that compiled this file
 * into two graphs would otherwise leave the tier with two readings of one drawing (ARCH-02).
 *
 * Nothing registered is not a fault: the gatherer falls back to the header-only reading, which
 * proposes a rank on a mapped header and refuses by name on an unmapped one — fail-closed, never a
 * guessed unit (L-MEA-05, L-QTY-04).
 */
const READER_KEY = Symbol.for("vextrus.cubit.core.scale.statedLengths");

const readerScope = globalThis as typeof globalThis & { [READER_KEY]?: { read?: StatedLengthReader } };

const held: { read?: StatedLengthReader } = (readerScope[READER_KEY] ??= {});

/** Say how a drawing's own words are read, for every gatherer that is handed no reader of its own. */
export function useStatedLengths(read: StatedLengthReader): void {
  held.read = read;
}

/** The reader the layer above registered, or undefined where none has — the header-only reading. */
export function statedLengthReader(): StatedLengthReader | undefined {
  return held.read;
}

/** Which record's evidence is being gathered, in whose workspace, for which of its views. */
export type ScaleEvidenceScope = {
  readonly tenantId: string;
  readonly ingestId: string;
  readonly viewKeys: readonly string[];
};

/**
 * The half of an ingest record the evidence is read from — stated structurally for the reason
 * `../sheets` states its own: the record's home is a module core may not name (ARCH-01).
 */
export type ScaleSourceRecord = {
  readonly ingestId: string;
  readonly artifactSha256: string;
};

/**
 * The evidence of one record's views. The unit is read off the artifact itself rather than off the
 * record's copied facts: the artifact is what the ingest pinned, and one source is one answer.
 */
export async function scaleEvidenceOf(
  tx: TenantTx,
  scope: ScaleEvidenceScope,
  record: ScaleSourceRecord,
  storage: Storage,
  tolerances: ScaleTolerances,
  statedLengths?: StatedLengthReader,
): Promise<ScaleEvidence> {
  const graph = await artifactOf(scope.tenantId, record, storage);

  const assigned = await tx
    .select({ entityKey: viewAssignments.entityKey, viewKey: viewAssignments.viewKey })
    .from(viewAssignments)
    .where(and(eq(viewAssignments.tenantId, scope.tenantId), eq(viewAssignments.ingestId, scope.ingestId)));

  const bubbles = await tx
    .select({ viewKey: grids.viewKey, axis: grids.axis, position: grids.position, bubbleKey: grids.bubbleKey })
    .from(grids)
    .where(and(eq(grids.tenantId, scope.tenantId), eq(grids.ingestId, scope.ingestId)))
    .orderBy(grids.bubbleKey);

  const grid: GridReading[] = bubbles.map((row) => ({ viewKey: row.viewKey, axis: row.axis, position: row.position, bubbleKey: row.bubbleKey }));

  // The caller's own reader where it brought one, the registered one otherwise: one drawing reads
  // one way whether the panel asked or the act did.
  const read = statedLengths ?? statedLengthReader();

  return {
    graph,
    viewKeys: scope.viewKeys,
    assignments: new Map(assigned.map((row) => [row.entityKey, row.viewKey])),
    grid,
    unit: graph.insunits.unit,
    statedMetres: read === undefined ? new Map() : read(graph),
    tolerances,
  };
}

/**
 * The artifact a record was written from, validated against the one mirror — ONCE per content
 * hash, wherever in the tree it is asked for (L-CAD-05). The hash is the store's own address for
 * exactly these bytes, so a second reader of the same drawing is answered without a second
 * validation and never with another drawing's geometry.
 */
async function artifactOf(tenantId: string, record: ScaleSourceRecord, storage: Storage): Promise<EntityGraph> {
  return await artifactAt(tenantId, record.artifactSha256, storage, `ingest ${record.ingestId}`);
}
