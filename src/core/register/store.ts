// L-REG-01's register, as the store: the reads and writes a caller performs INSIDE a transaction it
// already opened. The register's door (`src/modules/takeoff/register`) is one such caller, and an act
// rendering is the other — an act writes its act row and its state change in one transaction or
// neither (L-ACT-01), so a body that opens a transaction of its own cannot be the body an act commits
// through. Both therefore read and write here, and the invariants have one home (B-17, ARCH-02).
//
// It composes rather than computes: what a unit converts to is the canon's (`../units/canon`), what a
// refusal is called is the closed taxonomy's (`../errors`), and this file adds the store around them.
import { and, asc, eq, registerAttributes, registerObjects, registerObservations, repudiatedObjects, type TenantTx } from "../db";
import { REFUSALS } from "../errors";
import { OBSERVATION_BASES, type ObservationBasis } from "../identity";
import { CANONICAL_UNIT, convert, exact, isUnit, toCanonical, type Unit } from "../units/canon";

/** Which workspace, project and pinned set revision a call is scoped to (L-REG-03: per revision). */
export type RegisterScope = { readonly tenantId: string; readonly projectId: string; readonly setRevisionId: string };

/** One register object, whole. */
export type RegisterObjectRow = typeof registerObjects.$inferSelect;

/** One stored reading, whole — every column the ledger holds, as it holds it. */
export type ObservationRow = typeof registerObservations.$inferSelect;

/** One judgement that a register object is nothing, whole (R-TO-051). */
export type RepudiatedObjectRow = typeof repudiatedObjects.$inferSelect;

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

/** The code this store answers a reading that is no number with, off the closed taxonomy (Q-07). */
const READING_NOT_NUMERIC = REFUSALS.READING_NOT_NUMERIC.code;

/**
 * Where a conversion factor came from, recorded with the reading it carried. L-REG-01: a unit
 * conversion is not origination only because it carries its derivation — and a derivation whose
 * factor has no stated source is a number somebody would have to trust.
 */
const FACTOR_PROVENANCE = "unit canon (L-FRM-06)";

/** The three standings, spelled once. A caller reads them off this roster rather than beside its call. */
const AGREED: AttributeStanding = "AGREED";
const SUSPENDED: AttributeStanding = "SUSPENDED";
const NONE: AttributeStanding = "NONE";

/**
 * A value of one of the store's closed rosters. A spelling outside the roster is a mistake in the
 * caller rather than a refusal a person could act on — the walker and the screens draw these from the
 * same rosters — so it says so at its call site instead of reaching the store as a CHECK violation
 * nobody registered (ARCH-03).
 */
export function drawnFrom<T extends string>(roster: readonly T[], value: string, what: string): T {
  if ((roster as readonly string[]).includes(value)) return value as T;
  throw new Error(`"${value}" is no ${what} the register knows — the roster is ${roster.join(" | ")}`);
}

/**
 * Does this as-written value read as a number at all? A readability question, asked before any
 * arithmetic: the arithmetic itself is the canon's exact decimals, and a blank reads as nothing
 * rather than as the zero `Number("")` would answer.
 *
 * The guard and the arithmetic must read ONE grammar. JavaScript's `Number` ignores the space around
 * a spelling and the canon's decimals do not, so the value is trimmed once, here, and the trimmed
 * spelling is what both the guard and the canon are given — a reading transcribed with a trailing
 * newline is an ordinary reading, not a crash inside a decimal library (ARCH-03, L-FRM-06). What the
 * ledger keeps as written is still what was written.
 */
function asRead(value: string): string {
  return value.trim();
}

/** Does this as-read spelling read as a number the canon's arithmetic can take? */
export function readsAsANumber(value: string): boolean {
  const read = asRead(value);
  return read !== "" && Number.isFinite(Number(read));
}

/** The precedences the store accepts: a whole number from zero up to the ledger column's integer. */
const PRECEDENCE_CEILING = 2 ** 31 - 1;

/**
 * A declared precedence, drawn from what the store holds (R-TO-051). A precedence outside it is a
 * mistake in the caller and says so here, rather than reaching the store as a CHECK violation or an
 * overflow nobody registered (ARCH-03).
 */
export function declaredPrecedence(precedence: number): number {
  if (!Number.isInteger(precedence) || precedence < 0 || precedence > PRECEDENCE_CEILING) {
    throw new Error(`${String(precedence)} is no declared precedence — a precedence is a whole number from 0 to ${PRECEDENCE_CEILING} (R-TO-051)`);
  }
  return precedence;
}

/**
 * A reading in its canonical unit, with the derivation that carried it there (L-REG-01). The canon is
 * asked; no factor is spelled here (B-17). A unit the canon does not know at all is a mistake in the
 * caller rather than a refusal anybody typed — text from a person or a wire is asked through the
 * canon's own `isUnit` before it reaches this door (ARCH-03).
 */
function canonicalise(valueAsWritten: string, unitAsWritten: string): { ok: true; value: string; unit: Unit; factor: string } | { ok: false; refusal: string } {
  const value = asRead(valueAsWritten);
  // L-REG-01: "convert of no input is no output, never a zero". A cell that said "N/A", or said
  // nothing at all, is not a reading of zero and is not stored as one. It is also nobody's mistake:
  // drawings say such things, so the door answers the registered refusal a person can act on rather
  // than a fault id (ARCH-03).
  if (!readsAsANumber(value)) return { ok: false, refusal: READING_NOT_NUMERIC };
  if (!isUnit(unitAsWritten)) {
    const canonical = toCanonical(unitAsWritten);
    if (canonical.ok) throw new Error(`"${unitAsWritten}" canonicalised without being a unit of the canon — the canon and its guard disagree (L-FRM-06)`);
    return { ok: false, refusal: canonical.code };
  }
  const source = toCanonical(unitAsWritten);
  if (!source.ok) return { ok: false, refusal: source.code };
  const unit = CANONICAL_UNIT[source.dimension];
  const carried = convert(value, unitAsWritten, unit);
  if (!carried.ok) return { ok: false, refusal: carried.code };
  return { ok: true, value: carried.value, unit, factor: source.factor };
}

/** The register object one identity stands on inside one revision, or nothing where none does. */
export async function registerObjectIn(tx: TenantTx, scope: RegisterScope, objectKey: string): Promise<RegisterObjectRow | undefined> {
  const held = await tx
    .select()
    .from(registerObjects)
    .where(and(eq(registerObjects.tenantId, scope.tenantId), eq(registerObjects.setRevisionId, scope.setRevisionId), eq(registerObjects.objectKey, objectKey)))
    .limit(1);
  return held[0];
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
export async function appendObservationIn(tx: TenantTx, scope: RegisterScope, input: ObservationInput): Promise<AppendedObservation> {
  const precedence = declaredPrecedence(input.precedence);
  const canonical = canonicalise(input.valueAsWritten, input.unitAsWritten);
  if (!canonical.ok) return { appended: false, refusal: canonical.refusal };

  const object = await registerObjectIn(tx, scope, input.objectKey);
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
      precedence,
      actId: input.actId,
    })
    .returning({ observationId: registerObservations.observationId });
  const observationId = written[0]?.observationId;
  if (observationId === undefined) throw new Error("the observation ledger accepted no row for an appended reading — a reading nobody can cite is not a reading");
  return { appended: true, observationId };
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
export async function observationsIn(tx: TenantTx, scope: RegisterScope, objectKey: string, attribute: string): Promise<ObservationRow[]> {
  return tx
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
    .orderBy(asc(registerObservations.appendSeq));
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
export function standingOf(readings: readonly ObservationRow[]): StandingOfAttribute {
  if (readings.length === 0) return { standing: NONE, canonicalValue: null, canonicalUnit: null, precedence: null, competing: [], overruled: [] };

  const precedence = readings.reduce((highest, reading) => (reading.precedence > highest ? reading.precedence : highest), readings[0]?.precedence ?? 0);
  const competing = readings.filter((reading) => reading.precedence === precedence);
  const overruled = readings.filter((reading) => reading.precedence !== precedence);

  // Agreement is judged among ALL the readings at the standing precedence: one that disagrees with
  // the rest suspends the attribute rather than correcting it, because a correction that carried the
  // day by being appended later would be the silent resolution L-REG-03 forbids — a correction
  // declares itself by standing at a HIGHER precedence. Where they all agree, the latest of them is
  // the one whose spelling of the agreed value is reported.
  const stands = competing[competing.length - 1];
  const suspended = stands === undefined || competing.some((reading) => !agree(reading, stands));
  if (suspended) return { standing: SUSPENDED, canonicalValue: null, canonicalUnit: null, precedence, competing, overruled };
  return { standing: AGREED, canonicalValue: stands.canonicalValue, canonicalUnit: stands.canonicalUnit, precedence, competing, overruled };
}

/** How one attribute stands, read inside a transaction the caller already opened. */
export async function attributeStandingIn(tx: TenantTx, scope: RegisterScope, objectKey: string, attribute: string): Promise<StandingOfAttribute> {
  return standingOf(await observationsIn(tx, scope, objectKey, attribute));
}

/** Whether one object of one revision already stands repudiated, read in a caller's transaction. */
export async function isRepudiatedIn(tx: TenantTx, scope: RegisterScope, objectKey: string): Promise<boolean> {
  const held = await tx
    .select({ objectKey: repudiatedObjects.objectKey })
    .from(repudiatedObjects)
    .where(and(eq(repudiatedObjects.tenantId, scope.tenantId), eq(repudiatedObjects.setRevisionId, scope.setRevisionId), eq(repudiatedObjects.objectKey, objectKey)))
    .limit(1);
  return held[0] !== undefined;
}

/**
 * Record one judgement that an object is nothing, inside the transaction the act's row is written in
 * (L-ACT-01). Nothing is updated and nothing is deleted: the object, its readings and every line
 * measured off it stand exactly as they did, and this row is what a reader is told about them.
 */
export async function repudiateObjectIn(tx: TenantTx, scope: RegisterScope, objectKey: string, actId: string): Promise<void> {
  await tx
    .insert(repudiatedObjects)
    .values({ tenantId: scope.tenantId, setRevisionId: scope.setRevisionId, projectId: scope.projectId, objectKey, actId })
    .onConflictDoNothing();
}

/** Every object a person has repudiated inside one pinned revision, in the order they judged them. */
export async function repudiatedObjectsIn(tx: TenantTx, scope: RegisterScope): Promise<RepudiatedObjectRow[]> {
  return tx
    .select()
    .from(repudiatedObjects)
    .where(and(eq(repudiatedObjects.tenantId, scope.tenantId), eq(repudiatedObjects.setRevisionId, scope.setRevisionId)))
    .orderBy(asc(repudiatedObjects.repudiatedAt), asc(repudiatedObjects.objectKey));
}
