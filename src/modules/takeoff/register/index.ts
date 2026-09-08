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
//   · R-TO-051: a change is an appended observation with declared precedence. Nothing here updates a
//     row; the store holds no privilege that would let it.
//   · L-REG-03: "disagreement is declared, never resolved silently" — a standing is DERIVED from the
//     readings at read time, so no column anywhere holds a "current value" to overwrite.
import { and, asc, eq, forTenant, refusedSightings, registerAttributes, registerObjects, registerObservations, type TenantTx } from "@/core/db";
import { REFUSALS } from "@/core/errors";
import { DISCIPLINES, type Discipline } from "@/core/sheets/law";
import {
  OBSERVATION_BASES,
  SIGHTING_STANDINGS,
  instanceKey,
  placementKey,
  semanticDigest,
  viewKey,
  type LevelRef,
  type ObservationBasis,
  type SightingStanding,
  type ViewRef,
} from "@/core/identity";
import { CANONICAL_UNIT, convert, exact, isUnit, toCanonical, type Unit } from "@/core/units/canon";

/** Which workspace, project and pinned set revision a call is scoped to (L-REG-03: per revision). */
export type RegisterScope = { readonly tenantId: string; readonly projectId: string; readonly setRevisionId: string };

/** One bar of a sighted member (L-REG-04's bar row key: role, diameter, sequence). */
export type SightedBar = { readonly role: string; readonly diameter: string; readonly sequence: number };

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
  readonly bars?: readonly SightedBar[];
  readonly content: unknown;
};

/** What a sighting at the door answered: the object it stands on, or why it was not registered. */
export type RegisteredSighting =
  | { readonly registered: true; readonly objectKey: string }
  | { readonly registered: false; readonly refusal: typeof DUPLICATE_IDENTITY; readonly objectKey: string };

/** One reading of one correctable attribute, as the door is given one (R-TO-051). */
export type ObservationInput = {
  readonly objectKey: string;
  readonly attribute: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly basis: string;
  readonly sourceKey: string;
  readonly precedence: number;
  readonly actId: string | null;
};

/** What appending a reading answered: the reading's own id, or why the canon carried no value. */
export type AppendedObservation = { readonly appended: true; readonly observationId: string } | { readonly appended: false; readonly refusal: string };

/** One stored reading, whole — every column the ledger holds, as it holds it. */
export type ObservationRow = typeof registerObservations.$inferSelect;

/** One register object, whole. */
export type RegisterObjectRow = typeof registerObjects.$inferSelect;

/** One refused sighting, whole — the evidence a refusal was kept as. */
export type RefusedSightingRow = typeof refusedSightings.$inferSelect;

/**
 * How an attribute stands (R-TO-051): AGREED where the readings at the highest declared precedence
 * say one thing, SUSPENDED where they disagree — declared, never resolved silently (L-REG-03) — and
 * NONE where nobody has read the attribute at all.
 */
export const ATTRIBUTE_STANDINGS = ["AGREED", "SUSPENDED", "NONE"] as const;

/** One standing, drawn from the closed roster above. */
export type AttributeStanding = (typeof ATTRIBUTE_STANDINGS)[number];

/**
 * What an attribute's readings amount to, derived and never stored. The value that stands is null
 * under SUSPENDED and under NONE: an attribute whose readings disagree has no value, and saying one
 * anyway would be the silent resolution L-REG-03 forbids.
 */
export type StandingOfAttribute = {
  readonly standing: AttributeStanding;
  readonly canonicalValue: string | null;
  readonly canonicalUnit: string | null;
  readonly precedence: number | null;
  /** The readings at the highest declared precedence — one where they agree, several where they do not. */
  readonly competing: readonly ObservationRow[];
  /** Every reading a higher precedence overrules. Overruled, never erased (L-ACT-01). */
  readonly overruled: readonly ObservationRow[];
};

/** The code this door answers with, read off the closed taxonomy rather than spelled beside it (Q-07). */
const DUPLICATE_IDENTITY = REFUSALS.DUPLICATE_IDENTITY.code;

/**
 * Where a conversion factor came from, recorded with the reading it carried. L-REG-01: a unit
 * conversion is not origination only because it carries its derivation — and a derivation whose
 * factor has no stated source is a number somebody would have to trust.
 */
const FACTOR_PROVENANCE = "unit canon (L-FRM-06)";

/**
 * The three standings, spelled once. A caller reads them off this roster rather than off a string
 * beside its own call (B-17).
 */
const AGREED: AttributeStanding = "AGREED";
const SUSPENDED: AttributeStanding = "SUSPENDED";
const NONE: AttributeStanding = "NONE";

/**
 * A value of one of the store's closed rosters. A spelling outside the roster is a mistake in the
 * caller rather than a refusal a person could act on — the walker and the screens draw these from the
 * same rosters — so it says so at its call site instead of reaching the store as a CHECK violation
 * nobody registered (ARCH-03).
 */
function drawnFrom<T extends string>(roster: readonly T[], value: string, what: string): T {
  if ((roster as readonly string[]).includes(value)) return value as T;
  throw new Error(`"${value}" is no ${what} the register knows — the roster is ${roster.join(" | ")}`);
}

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
  if ("levelId" in level) return { levelId: level.levelId, levelSlot: null, levelLabel: null };
  if ("slot" in level) return { levelId: null, levelSlot: level.slot, levelLabel: null };
  return { levelId: null, levelSlot: null, levelLabel: level.unregistered };
}

/**
 * A reading in its canonical unit, with the derivation that carried it there (L-REG-01). The canon is
 * asked; no factor is spelled here (B-17). A unit the canon does not know at all is a mistake in the
 * caller rather than a refusal anybody typed — text from a person or a wire is asked through the
 * canon's own `isUnit` before it reaches this door (ARCH-03).
 */
function canonicalise(valueAsWritten: string, unitAsWritten: string): { ok: true; value: string; unit: Unit; factor: string } | { ok: false; refusal: string } {
  if (!isUnit(unitAsWritten)) {
    const canonical = toCanonical(unitAsWritten);
    if (canonical.ok) throw new Error(`"${unitAsWritten}" canonicalised without being a unit of the canon — the canon and its guard disagree (L-FRM-06)`);
    return { ok: false, refusal: canonical.code };
  }
  const source = toCanonical(unitAsWritten);
  if (!source.ok) return { ok: false, refusal: source.code };
  const unit = CANONICAL_UNIT[source.dimension];
  const carried = convert(valueAsWritten, unitAsWritten, unit);
  if (!carried.ok) return { ok: false, refusal: carried.code };
  return { ok: true, value: carried.value, unit, factor: source.factor };
}

/** The register object one identity stands on inside one revision, or nothing where none does. */
async function objectOf(tx: TenantTx, scope: RegisterScope, objectKey: string): Promise<RegisterObjectRow | undefined> {
  const held = await tx
    .select()
    .from(registerObjects)
    .where(and(eq(registerObjects.tenantId, scope.tenantId), eq(registerObjects.setRevisionId, scope.setRevisionId), eq(registerObjects.objectKey, objectKey)))
    .limit(1);
  return held[0];
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
    return { registered: false, refusal: DUPLICATE_IDENTITY, objectKey: identity.objectKey };
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
  const canonical = canonicalise(input.valueAsWritten, input.unitAsWritten);
  if (!canonical.ok) return { appended: false, refusal: canonical.refusal };

  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const object = await objectOf(tx, scope, input.objectKey);
    if (object === undefined) {
      throw new Error(`no register object stands at ${input.objectKey} in this set revision, so there is nothing for a reading to be about (L-REG-01)`);
    }

    await tx
      .insert(registerAttributes)
      .values({
        tenantId: scope.tenantId,
        setRevisionId: scope.setRevisionId,
        objectKey: input.objectKey,
        attribute: input.attribute,
        authority: object.discipline,
      })
      .onConflictDoNothing();

    const written = await tx
      .insert(registerObservations)
      .values({
        tenantId: scope.tenantId,
        setRevisionId: scope.setRevisionId,
        objectKey: input.objectKey,
        attribute: input.attribute,
        valueAsWritten: input.valueAsWritten,
        unitAsWritten: input.unitAsWritten,
        canonicalValue: canonical.value,
        canonicalUnit: canonical.unit,
        factor: canonical.factor,
        factorProvenance: FACTOR_PROVENANCE,
        basis: drawnFrom<ObservationBasis>(OBSERVATION_BASES, input.basis, "observation basis"),
        sourceKey: input.sourceKey,
        precedence: input.precedence,
        actId: input.actId,
      })
      .returning({ observationId: registerObservations.observationId });
    const observationId = written[0]?.observationId;
    if (observationId === undefined) throw new Error("the observation ledger accepted no row for an appended reading — a reading nobody can cite is not a reading");
    return { appended: true, observationId };
  });
}

/** Every reading of one attribute of one register object, in the order they were appended. */
export async function observationsOf(scope: RegisterScope, objectKey: string, attribute: string): Promise<ObservationRow[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select()
      .from(registerObservations)
      .where(
        and(
          eq(registerObservations.tenantId, scope.tenantId),
          eq(registerObservations.setRevisionId, scope.setRevisionId),
          eq(registerObservations.objectKey, objectKey),
          eq(registerObservations.attribute, attribute),
        ),
      )
      .orderBy(asc(registerObservations.observedAt), asc(registerObservations.observationId)),
  );
}

/** Do two readings say the same thing? Judged on the canonical pair: "10 ft" and "3.048 m" agree. */
function agree(left: ObservationRow, right: ObservationRow): boolean {
  return left.canonicalUnit === right.canonicalUnit && exact(left.canonicalValue).eq(exact(right.canonicalValue));
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
  const readings = await observationsOf(scope, objectKey, attribute);
  if (readings.length === 0) return { standing: NONE, canonicalValue: null, canonicalUnit: null, precedence: null, competing: [], overruled: [] };

  const precedence = readings.reduce((highest, reading) => (reading.precedence > highest ? reading.precedence : highest), readings[0]?.precedence ?? 0);
  const competing = readings.filter((reading) => reading.precedence === precedence);
  const overruled = readings.filter((reading) => reading.precedence !== precedence);

  // The latest reading at the standing precedence is the one that stands: a later reading of the same
  // authority is a correction, and it is a correction by being appended after (L-ACT-01).
  const stands = competing[competing.length - 1];
  const suspended = stands === undefined || competing.some((reading) => !agree(reading, stands));
  if (suspended) return { standing: SUSPENDED, canonicalValue: null, canonicalUnit: null, precedence, competing, overruled };
  return { standing: AGREED, canonicalValue: stands.canonicalValue, canonicalUnit: stands.canonicalUnit, precedence, competing, overruled };
}
