// The sixth stage's store: the deferrals it writes, the ranges a person authored that it reads, the
// pinned set revisions its rows are registered under, and the register pass itself.
//
// The deferrals are rewritten inside the partition's ONE transaction (`../store`) with the placements
// they were resolved from, and so is the register pass: it is entered through the register module's
// own tx-taking door (`registerSightingsIn`), inside the transaction the rebuild already holds — one
// door, one guard, and no second writer of a register object (B-17, ARCH-02). A rebuild whose later
// stage throws therefore leaves no register row behind for the next one to derive against (L-REG-04).
//
// A key already standing for a revision is skipped rather than re-offered: a blind second offer would
// be refused `DUPLICATE_IDENTITY` and kept as evidence, so a rebuild of an unchanged drawing would
// manufacture a refusal per member for a drawing nobody re-measured (L-REG-03, L-REG-04). And a
// placeholder standing for a row's own member on the row's own storey IS that row (I-366): it is
// carried onto the row's key, one hop, before anything is offered — never stood beside it.
import { and, asc, drawingSetRevisions, eq, expansionDeferrals, forTenant, typicalRanges, type TenantTx } from "@/core/db";
import { carryObjectOntoLevel, keysHoldingReadings, liveLevelsOf } from "@/core/levels/store";
import { recordOf } from "@/core/sets";
import { registerObjectsIn, registerSightingsIn, type RegisterObjectRow, type RegisterScope } from "@/modules/takeoff/register";
import { PLACEMENT_DISCIPLINE } from "../placement/law";
import { placeholderCarries, type AuthoredRange, type ExpansionRow, type PlaceholderCarry, type ResolvedExpansion, type StackedLevel } from "./resolve";

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

/**
 * What one pass of the register left: how many rows it wrote, how many already stood, and the keys
 * standing under the views it read that this rebuild NO LONGER derives (L-QTY-04).
 *
 * `stale` is reported and not retracted: the register door has no retraction — a register object is
 * the standing identity itself and nothing deletes one (L-REG-01) — so a rebuild that derives fewer
 * rows than the last one says so, where saying nothing would leave a quantity nobody can see is no
 * longer derived from any drawing.
 *
 * `carried` counts the placeholders the pass retired onto a row it derives (I-366). Each is one of
 * the `standing`: the sighting stood already, under the caption's word, and now stands on its storey.
 */
export type RegisteredExpansion = { readonly registered: number; readonly standing: number; readonly carried: number; readonly stale: readonly string[] };

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
  return forTenant({ tenantId }).transaction((tx) => storedTypicalRangesIn(tx, tenantId, projectId));
}

/** The same list, read on a transaction the caller holds (an act's own, L-ACT-02). */
export async function storedTypicalRangesIn(tx: TenantTx, tenantId: string, projectId: string): Promise<StoredTypicalRange[]> {
  return tx
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
  return forTenant({ tenantId }).transaction((tx) => liveStackIn(tx, tenantId, projectId));
}

/** The same stack, read on a transaction the caller holds. */
export async function liveStackIn(tx: TenantTx, tenantId: string, projectId: string): Promise<StackedLevel[]> {
  const rows = await liveLevelsOf(tx, { tenantId, projectId });
  return rows.map((row) => ({ levelId: row.levelId, label: row.label, ordinal: row.ordinal }));
}

/** The authored ranges of one project, as the pure resolver reads them (L-REG-02: by surrogate). */
export async function authoredRangesOf(tenantId: string, projectId: string): Promise<AuthoredRange[]> {
  return forTenant({ tenantId }).transaction((tx) => authoredRangesIn(tx, tenantId, projectId));
}

/** The same ranges, read on a transaction the caller holds. */
export async function authoredRangesIn(tx: TenantTx, tenantId: string, projectId: string): Promise<AuthoredRange[]> {
  const rows = await storedTypicalRangesIn(tx, tenantId, projectId);
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
 * What this rebuild's rows amount to against the register AS IT STANDS, read before the write.
 *
 * The write itself happens inside the partition's transaction and nowhere else, so the stage that
 * resolved the rows cannot report what the write did; it reports what it resolved, against what is
 * already standing. The two agree — the pass writes exactly the keys that were not standing when it
 * read them, inside one transaction over one revision — and where a rebuild fails before the write,
 * this census is what it said it would do rather than what it did (L-REG-03, L-REG-04).
 */
export async function expansionCensusOf(scope: RegisterScope, rows: readonly ExpansionRow[]): Promise<RegisteredExpansion> {
  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const before = await registerObjectsIn(tx, scope);
    // The carries the pass WILL make, planned by the same reading over the same state — so the census
    // counts a retired placeholder as the sighting that stood, exactly as the pass then records it.
    const carries = await carriesIn(tx, scope, before, rows);
    const objects = afterCarries(before, carries);
    const held = new Set(objects.map((object) => object.objectKey));
    let registered = 0;
    let standing = 0;

    for (const row of rows) {
      if (held.has(row.objectKey)) standing += 1;
      else {
        registered += 1;
        // Counted once: two rows of one key are one identity, and the pass offers the second no more
        // than this census counts it twice (L-REG-03).
        held.add(row.objectKey);
      }
    }

    return { registered, standing, carried: carries.length, stale: staleOf(objects, rows) };
  });
}

/**
 * The placeholders this pass retires onto the rows it derives (I-366), read on the pass's own
 * transaction: every object of the revision standing under `@unregistered:<label>` — what a placeholder
 * row IS: no surrogate, a label (L-REG-04) — put to the one resolver's carry over the live stack, less
 * any a person's attribute reading hangs on (I-367: its key cannot move, and the placeholder is left
 * standing where it is rather than the rebuild failing over it). Nothing is written here.
 */
async function carriesIn(tx: TenantTx, scope: RegisterScope, objects: readonly RegisterObjectRow[], rows: readonly ExpansionRow[]): Promise<PlaceholderCarry[]> {
  const placeholders = objects.flatMap((object) =>
    object.levelId === null && object.levelLabel !== null ? [{ objectKey: object.objectKey, label: object.levelLabel, standing: object.standing }] : [],
  );
  if (placeholders.length === 0 || rows.length === 0) return [];
  const stack = await liveStackIn(tx, scope.tenantId, scope.projectId);
  const carries = placeholderCarries(rows, placeholders, stack, new Set(objects.map((object) => object.objectKey)));
  if (carries.length === 0) return [];
  const read = await keysHoldingReadings(tx, scope, carries.map((carry) => carry.placeholder.objectKey));
  return carries.filter((carry) => !read.has(carry.placeholder.objectKey));
}

/** The revision's objects as they stand once these carries are made: each retired key is its row's. */
function afterCarries(objects: readonly RegisterObjectRow[], carries: readonly PlaceholderCarry[]): RegisterObjectRow[] {
  const onto = new Map(carries.map((carry) => [carry.placeholder.objectKey, carry]));
  return objects.map((object) => {
    const carry = onto.get(object.objectKey);
    return carry === undefined ? object : { ...object, objectKey: carry.row.objectKey, levelId: carry.levelId, levelLabel: null };
  });
}

/**
 * Register one revision's worth of resolved rows through the register's own door (L-REG-01). What is
 * already standing is left alone: the key is the identity, so a row that stands IS this sighting, and
 * offering it again would be offering a second measured sighting of one scope (L-REG-03).
 *
 * A placeholder of the row's member, under a word the resolver reads as the row's storey, is that
 * sighting too, and it is carried onto the row FIRST — through the level store's own one-hop carry,
 * the move `INSERT_LEVEL` makes — so the row is then found standing and nothing is offered beside it
 * (I-366, L-REG-04). A carry the grammar declines moves nothing, and its row is offered as before.
 */
export async function registerExpansion(tx: TenantTx, scope: RegisterScope, rows: readonly ExpansionRow[]): Promise<RegisteredExpansion> {
  const before = await registerObjectsIn(tx, scope);
  const planned = await carriesIn(tx, scope, before, rows);
  const standingByKey = new Map(before.map((object) => [object.objectKey, object]));
  const carries: PlaceholderCarry[] = [];
  for (const carry of planned) {
    // The placeholder as the register holds it; the carry is the level store's own (the move
    // `INSERT_LEVEL` makes), keyed off the label the placeholder's key was spelled with (L-REG-02).
    const object = standingByKey.get(carry.placeholder.objectKey);
    if (object === undefined) continue;
    const placeholder = { setRevisionId: scope.setRevisionId, objectKey: object.objectKey, levelLabel: carry.placeholder.label, elementType: object.elementType };
    if (await carryObjectOntoLevel(tx, { tenantId: scope.tenantId, projectId: scope.projectId }, placeholder, carry.levelId)) carries.push(carry);
  }
  const objects = afterCarries(before, carries);
  const held = new Set(objects.map((object) => object.objectKey));
  const offering = rows.filter((row) => !held.has(row.objectKey));

  // The door is entered ONCE for the whole revision: a drawing's members are derived together and are
  // offered together, so the scope is proved once and the store's key decides the batch in one
  // statement rather than one round trip per member of the building (L-REG-03, AC-2(e)).
  const answers = await registerSightingsIn(
    tx,
    scope,
    offering.map((row) => ({
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
    })),
  );

  const registered = answers.filter((answer) => answer.registered).length;
  return { registered, standing: rows.length - registered, carried: carries.length, stale: staleOf(objects, rows) };
}

/**
 * The keys standing in the register that this rebuild no longer derives, in key order.
 *
 * Judged over the VIEWS this rebuild read and no others: a set revision holds every drawing of the
 * set, and the rows another drawing's own rebuild derived are no business of this one — naming them
 * would report the whole register as stale on every rebuild (L-REG-02, L-CAD-06).
 */
function staleOf(standing: readonly { objectKey: string; viewKey: string }[], rows: readonly ExpansionRow[]): string[] {
  const read = new Set(rows.map((row) => row.placement.viewKey));
  const derived = new Set(rows.map((row) => row.objectKey));
  return standing
    .filter((object) => read.has(object.viewKey) && !derived.has(object.objectKey))
    .map((object) => object.objectKey)
    .sort();
}
