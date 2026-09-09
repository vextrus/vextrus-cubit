// R-TO-030's one door (ARCH-02): the request that rebuilds a drawing's stored partition, and the
// views it left. A caller — a screen's server action, the takeoff lane's transport, another takeoff
// module — speaks to the stored partition through this file and never reaches past it.
//
// What is NOT here, on purpose: the rebuild itself (`runPartitionJob`), which stands behind ./rebuild
// for the worker's composition root alone. A bundler follows a barrel's every re-export, and the
// rebuild reaches the object store and the model seam — neither of which belongs in a screen's module
// graph (ARCH-01, and the same reason SEAM-CAD keeps its job behind its own file).
import { ingestRecordOf } from "@/modules/takeoff/ingest";
import { storedExpansionDeferralsOf, storedTypicalRangesOf, type StoredExpansionDeferral, type StoredTypicalRange } from "./expansion/store";
import { storedGridOf, type StoredGrid } from "./grid/store";
import { storedProposedLevelsOf } from "./levels-proposal/store";
import { storedPlacementsOf, type StoredPlacement } from "./placement/store";
import { storedMemberTypesOf, storedSchedulesOf, type StoredMemberTypes, type StoredSchedules } from "./schedules/store";
import { drawingProjectOf, partitionStandsFor, storedConventionsOf, storedViewsOf, type StoredConventions } from "./store";
import type { GroupKind, ProposedLevel } from "@/core/acts";
import type { ViewRecord } from "@/core/views";

export { PARTITION_KIND, partitionJobKey, requestPartition, type PartitionRefused, type PartitionRequest, type PartitionRequested } from "./request";
export type { PartitionRefusalCode, PartitionNotAvailable } from "./refusals";
export type { PartitionScope, StoredConventions } from "./store";
export type { StoredGrid } from "./grid/store";
export type { GridAxisRow, GridDeferralRow } from "./grid/detect";
export type { StoredMemberTypes, StoredSchedule, StoredSchedules } from "./schedules/store";
export type { StoredPlacement } from "./placement/store";
export type { StoredExpansionDeferral, StoredTypicalRange } from "./expansion/store";
export type { PlacementShares } from "./placement/shares";
// The closed list an expansion defers under, published where its readers already look — the store's
// CHECK and this door's answer read ONE roster, for the reason the schedule list above does (Q-07).
export { EXPANSION_DEFERRAL_REASONS } from "@/core/errors";
export type { ExpansionDeferralReason } from "@/core/db";
export type { MemberFamily, MemberVariant, MemberZone } from "./schedules/registry";
export type { ScheduleCell, ScheduleDeferralRow, ScheduleTable } from "./schedules/reconstruct";
// The closed list a schedule view defers under, published where its readers already look: it is the
// store's CHECK and this door's answer read off ONE roster, which is why it is the seam's (Q-07).
// Read from the refusal register, which is where the list stands: the seam is a module's to read
// through its barrel alone (SEAM-TENANT), and that barrel hands out tables, never a list of its own
// (ARCH-02, B-17).
export { SCHEDULE_DEFERRAL_REASONS } from "@/core/errors";
export type { GridAxis, GridFamily, RebarZone, ScheduleDeferralReason, SectionUnit } from "@/core/db";
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

/**
 * The grid backbone of a drawing's current partition (L-CAD-07) — the axes the viewer's overlay draws
 * and the minimum spacing placement scales its content-scaled shares by (L-MEA-01), with the layout
 * plans that georeferenced as deferred standing beside them.
 *
 * A drawing this scope does not hold, and one nothing has ingested, answer null the way the profile
 * does. A drawing whose partition HAS been rebuilt answers a grid either way: a plan nobody bubbled
 * is a deferral a caller can say something about, never an absence to guess at (R-UI-050).
 */
export async function gridOf(scope: ViewsScope): Promise<StoredGrid | null> {
  const projectId = await drawingProjectOf(scope.tenantId, scope.drawingId);
  if (projectId === null || projectId !== scope.projectId) return null;
  const record = await ingestRecordOf({ tenantId: scope.tenantId, drawingId: scope.drawingId });
  return record === null ? null : storedGridOf(scope.tenantId, record.ingestId);
}

/**
 * The schedules of a drawing's current partition (L-CAD-08): the tables reconstructed from its
 * SCHEDULE views with the cells beneath them, and the views that yielded none standing beside them.
 *
 * A drawing this scope does not hold, one nothing has ingested, and one whose partition has never
 * been rebuilt all answer null — an absence a caller can act on rather than an empty table that
 * would read as a drawing with no schedules in it (R-UI-050).
 */
export async function schedulesOf(scope: ViewsScope): Promise<StoredSchedules | null> {
  const ingestId = await partitionedIngestOf(scope);
  return ingestId === null ? null : storedSchedulesOf(scope.tenantId, ingestId);
}

/**
 * The member types of a drawing's current partition (R-TO-031) — one row per mark family, with the
 * variants and the rebar zones beneath them. This is the door column placement and the RCC rails
 * read a member's section and reinforcement through.
 *
 * Absent for the same three reasons `schedulesOf` is, and in the same way.
 */
export async function memberTypesOf(scope: ViewsScope): Promise<StoredMemberTypes | null> {
  const ingestId = await partitionedIngestOf(scope);
  return ingestId === null ? null : storedMemberTypesOf(scope.tenantId, ingestId);
}

/**
 * The members a drawing's current partition places (L-CAD-07) — one row per closed outline a member
 * mark anchored, in the placement key's own order. This is the door the placements panel and the
 * column rails read a member's mark, class, grid reference and member family through.
 *
 * Absent for the same three reasons `schedulesOf` is, and in the same way (R-UI-050).
 */
export async function placementsOf(scope: ViewsScope): Promise<StoredPlacement[] | null> {
  const ingestId = await partitionedIngestOf(scope);
  return ingestId === null ? null : storedPlacementsOf(scope.tenantId, ingestId);
}

/**
 * The views of a drawing's current partition whose vertical members stand on no level, with the
 * reason each defers under (L-CAD-07). A view stands here because its caption states no range the
 * live stack can be read against — which is what `AUTHOR_TYPICAL_RANGE` exists to settle.
 *
 * Absent for the same three reasons `schedulesOf` is. An empty list is an answer of its own: a
 * partition whose every plan expanded lawfully defers nothing (R-UI-050).
 */
export async function expansionDeferralsOf(scope: ViewsScope): Promise<StoredExpansionDeferral[] | null> {
  const ingestId = await partitionedIngestOf(scope);
  return ingestId === null ? null : storedExpansionDeferralsOf(scope.tenantId, ingestId);
}

/**
 * The typical ranges a person has authored in one project (L-ACT-01, L-CAD-07). Project-scoped
 * rather than drawing-scoped because a range is a statement about a view, and the expansion resolves
 * every view of the project against the same list.
 */
export async function typicalRangesOf(scope: { tenantId: string; projectId: string }): Promise<StoredTypicalRange[]> {
  return storedTypicalRangesOf(scope.tenantId, scope.projectId);
}

/**
 * L-ACT-02's typed grouping key for the offer below: "bulk is offered, never assembled". The stack a
 * section states is confirmed whole or not at all, so the fact the group is keyed on is the stack —
 * the kind is the act seam's closed roster's, never a spelling of this module's (B-17, ARCH-02).
 */
const PROPOSED_LEVEL_STACK: GroupKind = "PROPOSED_LEVEL_STACK";

/** The stack a drawing's sections state, as ONE `INSERT_LEVEL` a person confirms whole (R-UI-023). */
export type ProposedLevelStackOffer = {
  readonly group: { readonly kind: GroupKind; readonly drawingId: string; readonly ingestId: string };
  readonly levels: readonly ProposedLevel[];
};

/**
 * The level stack a drawing's sections propose (L-MEA-07: "the machine proposes a stack, never a
 * level"), offered as the `levels` of one `INSERT_LEVEL` — labels, the ordinals the section stacks
 * them in, and the storey height each level states, kept as the drawing wrote it beside the entity it
 * was read off (L-REG-01, L-CAD-03).
 *
 * A drawing this scope does not hold, one nothing has ingested, one whose partition has never been
 * rebuilt, and one whose sections stated no level at all all answer null. An absence, never an empty
 * offer: a stack of no levels is not something a person could confirm (R-UI-050).
 */
export async function proposedLevelStackOf(scope: ViewsScope): Promise<ProposedLevelStackOffer | null> {
  const ingestId = await partitionedIngestOf(scope);
  if (ingestId === null) return null;
  const proposed = await storedProposedLevelsOf(scope.tenantId, ingestId);
  if (proposed.length === 0) return null;

  return {
    group: { kind: PROPOSED_LEVEL_STACK, drawingId: scope.drawingId, ingestId },
    levels: proposed.map((level) => ({
      label: level.label,
      ordinal: level.ordinal,
      // The top of a section states no storey height, and a level with no reading carries none: an
      // empty list is the drawing's own silence, never a zero somebody would have to disbelieve.
      readings:
        level.heightAsWritten === null || level.heightUnit === null
          ? []
          : [{ valueAsWritten: level.heightAsWritten, unitAsWritten: level.heightUnit, sourceKey: level.markKey }],
    })),
  };
}

/** The record a drawing's standing partition was rebuilt from, or null where none stands. */
async function partitionedIngestOf(scope: ViewsScope): Promise<string | null> {
  const projectId = await drawingProjectOf(scope.tenantId, scope.drawingId);
  if (projectId === null || projectId !== scope.projectId) return null;
  const record = await ingestRecordOf({ tenantId: scope.tenantId, drawingId: scope.drawingId });
  if (record === null) return null;
  return (await partitionStandsFor(scope.tenantId, record.ingestId)) ? record.ingestId : null;
}
