// Everything the machine reads a record's scale proposals from, gathered (L-MEA-05, R-TO-020): the
// frozen artifact, the partition's assignments of entities to views (L-CAD-06), inc-202's grid rows
// (L-CAD-07) and the header's own unit. Gathered on the caller's transaction, so the act seam judges
// against the very state its write lands in, and handed to the pure `proposalsFor` — nothing here
// proposes anything, and nothing here is stored.
import { and, eq, grids, viewAssignments, type TenantTx } from "../db";
import { artifactAt } from "@/core/entitygraph/artifact";
import type { EntityGraph } from "../entitygraph/schema";
import type { Storage } from "../storage";
import type { GridReading, ScaleEvidence, ScaleTolerances } from "./proposals";

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
export async function scaleEvidenceOf(tx: TenantTx, scope: ScaleEvidenceScope, record: ScaleSourceRecord, storage: Storage, tolerances: ScaleTolerances): Promise<ScaleEvidence> {
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

  return {
    graph,
    viewKeys: scope.viewKeys,
    assignments: new Map(assigned.map((row) => [row.entityKey, row.viewKey])),
    grid,
    unit: graph.insunits.unit,
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
