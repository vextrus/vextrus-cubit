// R-TO-030's one door (ARCH-02): the request that rebuilds a drawing's stored partition, and the
// views it left. A caller — a screen's server action, the takeoff lane's transport, another takeoff
// module — speaks to the stored partition through this file and never reaches past it.
//
// What is NOT here, on purpose: the rebuild itself (`runPartitionJob`), which stands behind ./rebuild
// for the worker's composition root alone. A bundler follows a barrel's every re-export, and the
// rebuild reaches the object store and the model seam — neither of which belongs in a screen's module
// graph (ARCH-01, and the same reason SEAM-CAD keeps its job behind its own file).
import { ingestRecordOf } from "@/modules/takeoff/ingest";
import { drawingProjectOf, storedConventionsOf, storedViewsOf, type StoredConventions } from "./store";
import type { ViewRecord } from "@/core/views";

export { PARTITION_KIND, partitionJobKey, requestPartition, type PartitionRefused, type PartitionRequest, type PartitionRequested } from "./request";
export type { PartitionRefusalCode, PartitionNotAvailable } from "./refusals";
export type { PartitionScope, StoredConventions } from "./store";
export type { ConventionProfile, ConventionRole, EntityCensus } from "@/core/rulesets/methods/conventions/resolve";
export type { ConfirmedViewType, ProposedViewType, ViewRecord } from "@/core/views";

/** Which drawing's views are being asked about, in whose workspace and under which project. */
export type ViewsScope = { tenantId: string; projectId: string; drawingId: string };

/**
 * The views of a drawing's current partition (R-TO-030: "each stage's result is visible"), in view-key
 * order. The current record is the newest, since a re-ingest supersedes rather than replaces — so a
 * drawing read here answers the partition of the artifact that stands for it now.
 *
 * A drawing this scope does not hold, one nothing has ingested, or one whose partition has not been
 * rebuilt yet answers no views. That is an empty answer rather than a refusal: a caller asks this of
 * every drawing it lists, and a drawing waiting on its first partition is not an error anybody can
 * act on (R-UI-050 asks the surface to say which emptiness it is).
 */
export async function viewsOf(scope: ViewsScope): Promise<ViewRecord[]> {
  const projectId = await drawingProjectOf(scope.tenantId, scope.drawingId);
  if (projectId === null || projectId !== scope.projectId) return [];
  const record = await ingestRecordOf({ tenantId: scope.tenantId, drawingId: scope.drawingId });
  return record === null ? [] : storedViewsOf(scope.tenantId, record.ingestId);
}

/**
 * The convention profile of a drawing's current partition (R-TO-030: "each stage's result is
 * visible"), with the census it was resolved from and the method that resolved it.
 *
 * A drawing this scope does not hold, one nothing has ingested, or one whose partition has not been
 * rebuilt yet answers null — the same absence `viewsOf` answers with an empty list, and for the same
 * reason: a drawing waiting on its first partition is not an error anybody can act on (R-UI-050).
 */
export async function conventionProfileOf(scope: ViewsScope): Promise<StoredConventions | null> {
  const projectId = await drawingProjectOf(scope.tenantId, scope.drawingId);
  if (projectId === null || projectId !== scope.projectId) return null;
  const record = await ingestRecordOf({ tenantId: scope.tenantId, drawingId: scope.drawingId });
  return record === null ? null : storedConventionsOf(scope.tenantId, record.ingestId);
}
