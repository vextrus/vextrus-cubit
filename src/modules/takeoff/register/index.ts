// L-REG-01's quantity register, at its door: the one place a sighting becomes a register object, a
// second sighting of one physical scope becomes evidence, a reading becomes an appended observation,
// and an attribute's standing is derived from the readings that compete for it.
//
// It composes rather than computes. What an identity IS is core's (`@/core/identity`), what a unit
// converts to is the canon's (`@/core/units`), and the refusal it answers with is the closed
// taxonomy's — this file adds the store around them and no second opinion of any of the three
// (B-17, ARCH-02). A caller — the walker, the register screen's server actions — speaks to the
// register through this file and never reaches past it.
//
// Three properties are the whole door:
//   · L-REG-03: a second measured sighting of one identity inside one drawing-set revision is
//     refused and kept as unpriceable evidence in a table no bill can join. The guard is the store's
//     own key, so it holds against two writers as well as against one.
//   · R-TO-051: a change is an appended observation with declared precedence. Nothing here rewrites
//     a reading, a refusal or an attribute slot; the store holds no privilege that would let it.
//   · L-REG-03: "disagreement is declared, never resolved silently" — a standing is DERIVED from the
//     readings at read time, so no column anywhere holds a "current value" to overwrite.
import { and, asc, drawingSetRevisions, eq, forTenant, refusedSightings, registerObjects, type TenantTx } from "@/core/db";
import { REFUSALS } from "@/core/errors";
import { DISCIPLINES, type Discipline } from "@/core/sheets/law";
import { SIGHTING_STANDINGS, instanceKey, levelFormOf, placementKey, semanticDigest, viewKey, type LevelRef, type SightingStanding, type ViewRef } from "@/core/identity";
import {
  appendObservationIn,
  attributeStandingIn,
  drawnFrom,
  observationsIn,
  registerObjectIn,
  repudiatedObjectsIn,
  type AppendedObservation,
  type ObservationInput,
  type ObservationRow,
  type RegisterObjectRow,
  type RepudiatedObjectRow,
  type RegisterScope,
  type StandingOfAttribute,
} from "@/core/register/store";

// The tx-taking forms are the store's, and an act commits through them inside the transaction its
// act row is written in (L-ACT-01). They are published here because the register's door is where a
// caller meets the register (ARCH-02) — re-exported, never re-implemented (B-17).
export {
  ATTRIBUTE_STANDINGS,
  appendObservationIn,
  attributeStandingIn,
  isRepudiatedIn,
  observationsIn,
  registerObjectIn,
  repudiateObjectIn,
  type AppendedObservation,
  type AttributeStanding,
  type ObservationInput,
  type ObservationRow,
  type RegisterObjectRow,
  type RegisterScope,
  type RepudiatedObjectRow,
  type StandingOfAttribute,
} from "@/core/register/store";

/**
 * One measured sighting, as the door is given one: what it is, where it stands, and what it says
 * about itself. The content is opaque here — the door digests it into the row's semantic and never
 * reads a field of it (L-REG-04: the semantic invalidates; it never keys).
 */
export type Sighting = {
  readonly discipline: string;
  readonly elementType: string;
  readonly mark: string;
  readonly view: ViewRef;
  readonly x: number;
  readonly y: number;
  readonly level: LevelRef;
  readonly standing: string;
  // No bars: a bar row is a later leaf, and a field this door took and dropped would read as a store
  // that kept them. What a caller's bars are is asked of `barKey` when that leaf lands.
  readonly content: unknown;
};

/**
 * What a sighting at the door answered: the object it stands on, or why it was not registered.
 *
 * A refusal also says whether the second sighting said anything NEW about the scope
 * (`semanticUnchanged`): a rebuild that derived the same column again and a genuine second drawing
 * of it saying something else are both refused as double counts, and only one of them is a
 * disagreement somebody must look at (L-REG-03). The refusal itself is unchanged either way — the
 * answer is richer, not different.
 */
export type RegisteredSighting =
  | { readonly registered: true; readonly objectKey: string }
  | { readonly registered: false; readonly refusal: typeof DUPLICATE_IDENTITY; readonly objectKey: string; readonly semanticUnchanged: boolean };

/** One refused sighting, whole — the evidence a refusal was kept as. */
export type RefusedSightingRow = typeof refusedSightings.$inferSelect;

/** The code this door answers with, read off the closed taxonomy rather than spelled beside it (Q-07). */
const DUPLICATE_IDENTITY = REFUSALS.DUPLICATE_IDENTITY.code;

/** The identity a sighting derives, and the columns that identity is spelled across. */
function identityOf(sighting: Sighting): { objectKey: string; viewKey: string; placementKey: string } {
  const placement = { view: sighting.view, mark: sighting.mark, x: sighting.x, y: sighting.y };
  return {
    objectKey: instanceKey({ placement, level: sighting.level }),
    viewKey: viewKey(sighting.view),
    placementKey: placementKey(placement),
  };
}

/**
 * The level a sighting stands on, as the three columns that hold it. A level's label, ordinal and
 * height are never part of an identity (L-REG-02); the one label the store keeps is the placeholder's,
 * which is there to be carried onto a surrogate when somebody authors the level (L-REG-04).
 */
function levelColumns(level: LevelRef): { levelId: string | null; levelSlot: string | null; levelLabel: string | null } {
  // The form is asked of the identity grammar's own reading (`levelFormOf`), which validates the
  // slot: the columns and the key derived from one level are two renderings of ONE discrimination,
  // and a slot the key grammar refuses is refused here too, before any row is written (B-17).
  switch (levelFormOf(level)) {
    case "surrogate":
      return { levelId: (level as { readonly levelId: string }).levelId, levelSlot: null, levelLabel: null };
    case "slot":
      return { levelId: null, levelSlot: (level as { readonly slot: string }).slot, levelLabel: null };
    case "unregistered":
      return { levelId: null, levelSlot: null, levelLabel: (level as { readonly unregistered: string }).unregistered };
  }
}

/**
 * The scope a call names, proved against the store rather than taken on the caller's word.
 *
 * A register object cites the set revision it was sighted in and the project it belongs to (L-REG-02,
 * L-REG-03), and the store's foreign key to `drawing_set_revisions` is on the revision id alone — so
 * nothing but this read stops a scope whose three parts do not belong together: another workspace's
 * revision written under this tenant, or this workspace's other project stamped on scope that is not
 * its. The read runs inside the tenant transaction, so a revision of another workspace is not there
 * to be found at all (SEAM-TENANT).
 */
async function proveScope(tx: TenantTx, scope: RegisterScope): Promise<void> {
  const found = await tx
    .select({ projectId: drawingSetRevisions.projectId })
    .from(drawingSetRevisions)
    .where(and(eq(drawingSetRevisions.tenantId, scope.tenantId), eq(drawingSetRevisions.setRevisionId, scope.setRevisionId)))
    .limit(1);
  const revision = found[0];
  if (revision === undefined) {
    throw new Error(`no pinned set revision ${scope.setRevisionId} stands in this workspace, so a sighting scoped to it is a sighting of nothing (L-REG-03, SEAM-TENANT)`);
  }
  if (revision.projectId !== scope.projectId) {
    throw new Error(`set revision ${scope.setRevisionId} belongs to another project than ${scope.projectId}, and a register object's project is part of what it IS (L-REG-02)`);
  }
}

/**
 * Register a measured sighting, or refuse it as a double count (L-REG-03).
 *
 * The guard is the store's key and not a read this function remembers to make: the insert is offered
 * and the store keeps the first one, so two walkers sighting the same column at the same moment leave
 * one register object and one piece of evidence rather than two rows of quantity. The refused sighting
 * is kept whole in a table no foreign key reaches — refused is not discarded, it is evidence.
 */
export async function registerSighting(scope: RegisterScope, sighting: Sighting): Promise<RegisteredSighting> {
  const identity = identityOf(sighting);
  const semantic = semanticDigest(sighting.content);
  const discipline: Discipline = drawnFrom(DISCIPLINES, sighting.discipline, "discipline");
  const standing: SightingStanding = drawnFrom(SIGHTING_STANDINGS, sighting.standing, "sighting standing");

  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    await proveScope(tx, scope);
    const written = await tx
      .insert(registerObjects)
      .values({
        tenantId: scope.tenantId,
        setRevisionId: scope.setRevisionId,
        objectKey: identity.objectKey,
        projectId: scope.projectId,
        discipline,
        elementType: sighting.elementType,
        mark: sighting.mark,
        viewKey: identity.viewKey,
        placementKey: identity.placementKey,
        ...levelColumns(sighting.level),
        standing,
        semantic,
      })
      .onConflictDoNothing()
      .returning({ objectKey: registerObjects.objectKey });
    if (written[0] !== undefined) return { registered: true, objectKey: identity.objectKey };

    // The identity is already registered. WHAT the standing row says about the scope decides whether
    // this second sighting is a rebuild that derived the same column again or a drawing saying
    // something else about it — read inside the same transaction the refusal is written in, so the
    // recognition is of the row the refusal is about.
    const alreadyStanding = await registerObjectIn(tx, scope, identity.objectKey);
    if (alreadyStanding === undefined) {
      throw new Error(`the register refused ${identity.objectKey} as already standing, yet no register object stands at it — the store's own key and this read disagree (L-REG-03)`);
    }
    const semanticUnchanged = alreadyStanding.semantic === semantic;

    await tx.insert(refusedSightings).values({
      tenantId: scope.tenantId,
      setRevisionId: scope.setRevisionId,
      projectId: scope.projectId,
      objectKey: identity.objectKey,
      refusal: DUPLICATE_IDENTITY,
      discipline,
      elementType: sighting.elementType,
      mark: sighting.mark,
      viewKey: identity.viewKey,
      placementKey: identity.placementKey,
      semantic,
      sighting,
    });
    return { registered: false, refusal: DUPLICATE_IDENTITY, objectKey: identity.objectKey, semanticUnchanged };
  });
}

/** Every register object of one pinned set revision, in the order they were registered. */
export async function registerObjectsOf(scope: RegisterScope): Promise<RegisterObjectRow[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select()
      .from(registerObjects)
      .where(and(eq(registerObjects.tenantId, scope.tenantId), eq(registerObjects.setRevisionId, scope.setRevisionId)))
      .orderBy(asc(registerObjects.registeredAt), asc(registerObjects.objectKey)),
  );
}

/** Every sighting refused inside one pinned set revision, in the order they were refused. */
export async function refusedSightingsOf(scope: RegisterScope): Promise<RefusedSightingRow[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select()
      .from(refusedSightings)
      .where(and(eq(refusedSightings.tenantId, scope.tenantId), eq(refusedSightings.setRevisionId, scope.setRevisionId)))
      .orderBy(asc(refusedSightings.refusedAt), asc(refusedSightings.refusedSightingId)),
  );
}

/**
 * Append a reading of one correctable attribute (R-TO-051): "every human change is an act adding a
 * competing observation with declared precedence... nothing overwrites".
 *
 * So this only ever inserts. The attribute's slot is declared once — the authority is the object's
 * own discipline until a general-note sheet supplies one of its own (L-REG-03) — and the reading is
 * carried to its canonical unit through the canon, with the factor and the factor's provenance
 * written beside it, because a conversion that does not carry its derivation is origination (L-REG-01).
 */
export async function appendObservation(scope: RegisterScope, input: ObservationInput): Promise<AppendedObservation> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => appendObservationIn(tx, scope, input));
}

/**
 * Every reading of one attribute of one register object, in the order they were appended.
 *
 * The order is the store's own `append_seq` and nothing else: a clock reading is what a reading SAYS
 * about when it was observed, and two readings appended inside one tick — a rebuild transcribing a
 * drawing's cells, a person correcting twice — would otherwise read back in whichever order their
 * random ids happened to sort, so which reading stands would be decided by a random number
 * (R-TO-051: the standing is derived over the append order).
 */
export async function observationsOf(scope: RegisterScope, objectKey: string, attribute: string): Promise<ObservationRow[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => observationsIn(tx, scope, objectKey, attribute));
}

/**
 * How one attribute stands, derived from its readings and stored nowhere (L-REG-03, R-TO-051).
 *
 * The readings at the highest declared precedence decide: where they say one thing the attribute is
 * AGREED at that reading, and where they disagree it is SUSPENDED and carries no value at all —
 * "disagreement is declared, never resolved silently". Everything a higher precedence overrules is
 * listed, still whole: overruled is not erased.
 */
export async function attributeStanding(scope: RegisterScope, objectKey: string, attribute: string): Promise<StandingOfAttribute> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => attributeStandingIn(tx, scope, objectKey, attribute));
}

/**
 * Every object a person has repudiated inside one pinned set revision, in the order they judged them.
 *
 * The lines those objects published stay where they are: a repudiation is a reading of the record,
 * never a deletion of it (L-ACT-01), so a caller marks them rather than dropping them.
 */
export async function repudiatedObjectsOf(scope: RegisterScope): Promise<RepudiatedObjectRow[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => repudiatedObjectsIn(tx, scope));
}
