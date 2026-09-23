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
import { and, asc, eq, forTenant, refusedSightings, registerObjects, type TenantTx } from "@/core/db";
import {
  appendObservationIn,
  attributeStandingIn,
  observationsIn,
  registerSightingIn,
  repudiatedObjectsIn,
  type AppendedObservation,
  type ObservationInput,
  type ObservationRow,
  type RefusedSightingRow,
  type RegisterObjectRow,
  type RegisteredSighting,
  type RepudiatedObjectRow,
  type RegisterScope,
  type Sighting,
  type StandingOfAttribute,
} from "@/core/register/store";

// The tx-taking forms are the store's, and an act commits through them inside the transaction its
// act row is written in (L-ACT-01). They are published here because the register's door is where a
// caller meets the register (ARCH-02) — re-exported, never re-implemented (B-17). The batch sighting
// write stands there too (I-495): a core act registers a hand measurement through it, and core may
// not reach this module (ARCH-01), so the door's one implementation is the store's and this is its
// address for every caller above core.
export {
  ATTRIBUTE_STANDINGS,
  appendObservationIn,
  attributeStandingIn,
  isRepudiatedIn,
  observationsIn,
  registerObjectIn,
  registerSightingIn,
  registerSightingsIn,
  repudiateObjectIn,
  type AppendedObservation,
  type AttributeStanding,
  type ObservationInput,
  type ObservationRow,
  type RefusedSightingRow,
  type RegisterObjectRow,
  type RegisterScope,
  type RegisteredSighting,
  type RepudiatedObjectRow,
  type Sighting,
  type StandingOfAttribute,
} from "@/core/register/store";

/**
 * Register a measured sighting, or refuse it as a double count (L-REG-03), in a transaction of its
 * own. The door itself — the store's key, the refusal kept as evidence — is the store's
 * (`registerSightingsIn`); this is the form a caller holding no transaction enters it by.
 */
export async function registerSighting(scope: RegisterScope, sighting: Sighting): Promise<RegisteredSighting> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => registerSightingIn(tx, scope, sighting));
}

/** Every register object of one pinned set revision, inside a transaction the caller already holds. */
export async function registerObjectsIn(tx: TenantTx, scope: RegisterScope): Promise<RegisterObjectRow[]> {
  return tx
    .select()
    .from(registerObjects)
    .where(and(eq(registerObjects.tenantId, scope.tenantId), eq(registerObjects.setRevisionId, scope.setRevisionId)))
    .orderBy(asc(registerObjects.registeredAt), asc(registerObjects.objectKey));
}

/** Every register object of one pinned set revision, in the order they were registered. */
export async function registerObjectsOf(scope: RegisterScope): Promise<RegisterObjectRow[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => registerObjectsIn(tx, scope));
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
