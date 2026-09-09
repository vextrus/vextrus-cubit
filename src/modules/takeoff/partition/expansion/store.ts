// The sixth stage's store: the deferrals it writes, the ranges a person authored that it reads, the
// pinned set revisions its rows are registered under, and the register pass itself.
//
// The deferrals are rewritten inside the partition's ONE transaction (`../store`) with the placements
// they were resolved from. The REGISTER is not: L-REG-03's double-count guard is the register's own
// key and the door that holds it is the register module's (`registerSighting`), which opens its own
// transaction — one door, one guard, and no second writer of a register object (B-17, ARCH-02).
//
// A key already standing for a revision is skipped rather than re-offered: a blind second offer would
// be refused `DUPLICATE_IDENTITY` and kept as evidence, so a rebuild of an unchanged drawing would
// manufacture a refusal per member for a drawing nobody re-measured (L-REG-03, L-REG-04).
import { and, asc, drawingSetRevisions, eq, expansionDeferrals, forTenant, typicalRanges, type TenantTx } from "@/core/db";
import { liveLevelsOf } from "@/core/levels/store";
import { recordOf } from "@/core/sets";
import { registerObjectsOf, registerSighting, type RegisterScope } from "@/modules/takeoff/register";
import { PLACEMENT_DISCIPLINE } from "../placement/law";
import type { AuthoredRange, ExpansionRow, ResolvedExpansion, StackedLevel } from "./resolve";

/** One stored deferral, whole — every column the store holds, as it holds it. */
export type StoredExpansionDeferral = typeof expansionDeferrals.$inferSelect;

/** One stored authored range, whole (L-ACT-01: a person's statement about a view). */
export type StoredTypicalRange = typeof typicalRanges.$inferSelect;

/** One record's deferrals, as a rebuild hands them over to be written. */
export type ExpansionWrite = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
  readonly ingestId: string;
  /** What the expansion stage resolved, or null where the stage list ran no such stage. */
  readonly expansion: ResolvedExpansion | null;
};

/** What one pass of the register left: how many rows it wrote, and how many already stood. */
export type RegisteredExpansion = { readonly registered: number; readonly standing: number };

/**
 * Rewrite one record's expansion deferrals inside the partition's transaction. Cleared first, so a
 * view whose range a person has since authored leaves no deferral behind it (L-CAD-07, AC-5).
 */
export async function rewriteExpansionRows(tx: TenantTx, write: ExpansionWrite): Promise<void> {
  await tx.delete(expansionDeferrals).where(and(eq(expansionDeferrals.tenantId, write.tenantId), eq(expansionDeferrals.ingestId, write.ingestId)));
  const resolved = write.expansion;
  if (resolved === null || resolved.deferrals.length === 0) return;

  const stamp = { tenantId: write.tenantId, projectId: write.projectId, drawingId: write.drawingId, ingestId: write.ingestId };
  await tx.insert(expansionDeferrals).values(
    resolved.deferrals.map((deferral) => ({
      ...stamp,
      viewKey: deferral.viewKey,
      reason: deferral.reason,
      fromLabel: deferral.fromLabel,
      toLabel: deferral.toLabel,
    })),
  );
}

/** Every deferral one record stands under, in the view's own order (R-TO-030, L-REG-05). */
export async function storedExpansionDeferralsOf(tenantId: string, ingestId: string): Promise<StoredExpansionDeferral[]> {
  return forTenant({ tenantId })
    .select()
    .from(expansionDeferrals)
    .where(and(eq(expansionDeferrals.tenantId, tenantId), eq(expansionDeferrals.ingestId, ingestId)))
    .orderBy(asc(expansionDeferrals.viewKey));
}

/** Every range a person has authored in one project, in the view's own order (L-ACT-01, L-CAD-07). */
export async function storedTypicalRangesOf(tenantId: string, projectId: string): Promise<StoredTypicalRange[]> {
  return forTenant({ tenantId })
    .select()
    .from(typicalRanges)
    .where(and(eq(typicalRanges.tenantId, tenantId), eq(typicalRanges.projectId, projectId)))
    .orderBy(asc(typicalRanges.viewKey));
}

/**
 * The project's LIVE level stack, as the pure resolver reads it: the levels no act has repudiated,
 * by the surrogate each stands under (L-REG-02, L-MEA-07). Read through the level store's own door,
 * so "which levels stand" has one answer wherever it is asked (B-17).
 */
export async function liveStackOf(tenantId: string, projectId: string): Promise<StackedLevel[]> {
  const rows = await forTenant({ tenantId }).transaction((tx) => liveLevelsOf(tx, { tenantId, projectId }));
  return rows.map((row) => ({ levelId: row.levelId, label: row.label, ordinal: row.ordinal }));
}

/** The authored ranges of one project, as the pure resolver reads them (L-REG-02: by surrogate). */
export async function authoredRangesOf(tenantId: string, projectId: string): Promise<AuthoredRange[]> {
  const rows = await storedTypicalRangesOf(tenantId, projectId);
  return rows.map((row) => ({ viewKey: row.viewKey, fromLevelId: row.fromLevelId, toLevelId: row.toLevelId }));
}

/**
 * Every pinned set revision of this project whose manifest NAMES this drawing at the bytes this
 * record was ingested from (L-REG-06). A revision is what a register object is scoped to (L-REG-03),
 * and a revision that does not carry these bytes is a revision this reading is not of.
 *
 * The manifest is read through core's own reader and never by reaching into the column (B-17); it is
 * plain JSON with no indexed path, so the membership question is asked of the records themselves.
 */
export async function revisionsNaming(scope: { tenantId: string; projectId: string; drawingId: string; sha256: string }): Promise<string[]> {
  const rows = await forTenant({ tenantId: scope.tenantId })
    .select()
    .from(drawingSetRevisions)
    .where(and(eq(drawingSetRevisions.tenantId, scope.tenantId), eq(drawingSetRevisions.projectId, scope.projectId)))
    .orderBy(asc(drawingSetRevisions.createdAt), asc(drawingSetRevisions.setRevisionId));

  return rows
    .map((row) => recordOf(row))
    .filter((record) => record.manifest.some((member) => member.drawingId === scope.drawingId && member.sha256 === scope.sha256))
    .map((record) => record.setRevisionId);
}

/**
 * Register one revision's worth of resolved rows through the register's own door (L-REG-01). What is
 * already standing is left alone: the key is the identity, so a row that stands IS this sighting, and
 * offering it again would be offering a second measured sighting of one scope (L-REG-03).
 */
export async function registerExpansion(scope: RegisterScope, rows: readonly ExpansionRow[]): Promise<RegisteredExpansion> {
  const held = new Set((await registerObjectsOf(scope)).map((object) => object.objectKey));
  let registered = 0;
  let standing = 0;

  for (const row of rows) {
    if (held.has(row.objectKey)) {
      standing += 1;
      continue;
    }
    const answer = await registerSighting(scope, {
      discipline: PLACEMENT_DISCIPLINE,
      elementType: row.placement.elementType,
      mark: row.placement.mark,
      view: row.placement.view,
      x: row.placement.x,
      y: row.placement.y,
      level: row.level,
      standing: row.standing,
      // What the row SAYS about itself, digested into the semantic that invalidates a disposition and
      // never keys a row (L-REG-04). Read off the placement, so a re-derivation says the same thing.
      content: {
        mark: row.placement.mark,
        elementType: row.placement.elementType,
        gridLetter: row.placement.gridLetter,
        gridNumeral: row.placement.gridNumeral,
        memberFamily: row.placement.memberFamily,
      },
    });
    if (answer.registered) registered += 1;
    else standing += 1;
    held.add(row.objectKey);
  }

  return { registered, standing };
}
