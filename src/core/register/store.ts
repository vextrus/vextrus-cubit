// L-REG-01's register, as the store: the reads and writes a caller performs INSIDE a transaction it
// already opened. The register's door (`src/modules/takeoff/register`) is one such caller, and an act
// rendering is the other — an act writes its act row and its state change in one transaction or
// neither (L-ACT-01), so a body that opens a transaction of its own cannot be the body an act commits
// through. Both therefore read and write here, and the invariants have one home (B-17, ARCH-02).
//
// It composes rather than computes: what a unit converts to is the canon's (`../units/canon`), what a
// refusal is called is the closed taxonomy's (`../errors`), and this file adds the store around them.
//
// Every write to `register_objects` is spelled here and nowhere else (I-495): the batch sighting
// door the rebuild and the manual measurement act register through, the one-hop re-key a level carry
// and a typical range take, and the rows a typical range stands up beside its placeholder. The
// module's door re-exports them; a core act commits through them in its own transaction.
import {
  and,
  asc,
  campaigns,
  desc,
  drawingSetRevisions,
  eq,
  inArray,
  refusedSightings,
  registerAttributes,
  registerObjects,
  registerObservations,
  repudiatedObjects,
  type TenantTx,
} from "../db";
import { REFUSALS, type RefusalCode } from "../errors";
import {
  OBSERVATION_BASES,
  SIGHTING_STANDINGS,
  instanceKey,
  levelFormOf,
  placementKey,
  semanticDigest,
  viewKey,
  type LevelRef,
  type ObservationBasis,
  type SightingStanding,
  type ViewRef,
} from "../identity";
import { DISCIPLINES, type Discipline } from "../sheets/law";
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
function canonicalise(valueAsWritten: string, unitAsWritten: string): { ok: true; value: string; unit: Unit; factor: string } | { ok: false; refusal: RefusalCode } {
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

/**
 * The revision a project's register is read and written under: the pinned revision of the campaign
 * standing on the project now (L-REG-07 — pinning a drawing set is what opens one).
 *
 * A caller that names only a project — an act does, because a person acts on a project — resolves the
 * revision here rather than each spelling the same read (B-17). A project with no campaign open has
 * no register, and that is an absence the caller answers for, never a fault.
 */
export async function registerScopeIn(tx: TenantTx, tenantId: string, projectId: string): Promise<RegisterScope | null> {
  const held = await tx
    .select({ setRevisionId: campaigns.setRevisionId })
    .from(campaigns)
    .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.projectId, projectId)))
    .orderBy(desc(campaigns.openedAt), desc(campaigns.campaignId))
    .limit(1);
  const standing = held[0];
  return standing === undefined ? null : { tenantId, projectId, setRevisionId: standing.setRevisionId };
}

/**
 * One reading as it WOULD stand if it were appended now: canonicalised through the canon, given no id
 * and written nowhere. It is what lets a preview state the standing its reading would produce without
 * writing the reading first (L-ACT-02: the Consequence is computed, never guessed), and it is derived
 * by the same `canonicalise` the append itself uses, so the two cannot disagree (B-17).
 */
export function readingAsAppended(scope: RegisterScope, input: ObservationInput): { readonly ok: true; readonly reading: ObservationRow } | { readonly ok: false; readonly refusal: RefusalCode } {
  const canonical = canonicalise(input.valueAsWritten, input.unitAsWritten);
  if (!canonical.ok) return { ok: false, refusal: canonical.refusal };
  return {
    ok: true,
    reading: {
      tenantId: scope.tenantId,
      // The store mints the id and the append sequence, so a reading nobody has appended carries the
      // empty spellings of both: what a preview reads off this row is its value, its unit and its
      // precedence, and never an identity the store has not handed out (L-REG-04).
      observationId: "",
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
      precedence: declaredPrecedence(input.precedence),
      actId: null,
      observedAt: new Date(0),
      appendSeq: Number.MAX_SAFE_INTEGER,
    },
  };
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

/* ------------------------------------------------------------------ the sighting door, in a caller's transaction */

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

/** The code this door answers with, read off the closed taxonomy rather than spelled beside it (Q-07). */
const DUPLICATE_IDENTITY = REFUSALS.DUPLICATE_IDENTITY.code;

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
 * The register's door, entered inside a transaction the caller already holds (L-ACT-01's tx-taking
 * form).
 *
 * A rebuild registers what it derived in ITS OWN transaction: the register rows and the partition
 * they were derived from stand or fall together, so a rebuild whose later stage throws leaves no
 * register row behind to be re-derived against (L-REG-04, ARCH-03).
 */
export async function registerSightingIn(tx: TenantTx, scope: RegisterScope, sighting: Sighting): Promise<RegisteredSighting> {
  // One sighting is a batch of one: the write, the store's own key and the refusal evidence have ONE
  // implementation, and a caller offering one row is the same caller offering a hundred (B-17).
  const answered = await registerSightingsIn(tx, scope, [sighting]);
  const answer = answered[0];
  if (answer === undefined) throw new Error(`the register answered nothing about a sighting it was handed, which is no answer at all (L-REG-03)`);
  return answer;
}

/**
 * The same door, entered ONCE for a whole batch of one revision's sightings (L-REG-03).
 *
 * A rebuild derives every instance of a drawing at once, and offering them one at a time is one scope
 * proof and one round trip per member of the building. The batch is proved once, offered as one
 * insert the store's own key decides, and the answers come back in the order the rows were handed
 * over — each row still registered or refused on its own identity, exactly as the single-sighting
 * door answers it.
 *
 * The guard is the store's key and not a read this function remembers to make: the insert is offered
 * and the store keeps the first one, so two walkers sighting the same column at the same moment leave
 * one register object and one piece of evidence rather than two rows of quantity. The refused sighting
 * is kept whole in a table no foreign key reaches — refused is not discarded, it is evidence.
 */
export async function registerSightingsIn(tx: TenantTx, scope: RegisterScope, sightings: readonly Sighting[]): Promise<RegisteredSighting[]> {
  if (sightings.length === 0) return [];
  await proveScope(tx, scope);

  const read = sightings.map((sighting) => ({
    sighting,
    identity: identityOf(sighting),
    semantic: semanticDigest(sighting.content),
    discipline: drawnFrom(DISCIPLINES, sighting.discipline, "discipline") as Discipline,
    standing: drawnFrom(SIGHTING_STANDINGS, sighting.standing, "sighting standing") as SightingStanding,
  }));

  // One identity is offered once however many times the batch derives it: a second row of one key in
  // one statement is the same double count the store's key refuses, and it is answered as one here
  // rather than sent to the store to be refused by (L-REG-03).
  const offeredAt = new Map<string, number>();
  read.forEach((row, at) => {
    if (!offeredAt.has(row.identity.objectKey)) offeredAt.set(row.identity.objectKey, at);
  });
  const offered = [...offeredAt.values()].map((at) => read[at] as (typeof read)[number]);

  const written = await tx
    .insert(registerObjects)
    .values(
      offered.map((row) => ({
        tenantId: scope.tenantId,
        setRevisionId: scope.setRevisionId,
        objectKey: row.identity.objectKey,
        projectId: scope.projectId,
        discipline: row.discipline,
        elementType: row.sighting.elementType,
        mark: row.sighting.mark,
        viewKey: row.identity.viewKey,
        placementKey: row.identity.placementKey,
        ...levelColumns(row.sighting.level),
        standing: row.standing,
        semantic: row.semantic,
      })),
    )
    .onConflictDoNothing()
    .returning({ objectKey: registerObjects.objectKey });
  const wrote = new Set(written.map((row) => row.objectKey));

  // What each refusal is about is read from the rows that STAND, inside this same transaction — the
  // ones this insert just wrote among them, so a key the batch derived twice recognises itself.
  const refused = read.filter((row, at) => !(wrote.has(row.identity.objectKey) && offeredAt.get(row.identity.objectKey) === at));
  const standing = new Map(
    refused.length === 0
      ? []
      : (
          await tx
            .select()
            .from(registerObjects)
            .where(
              and(
                eq(registerObjects.tenantId, scope.tenantId),
                eq(registerObjects.setRevisionId, scope.setRevisionId),
                inArray(registerObjects.objectKey, [...new Set(refused.map((row) => row.identity.objectKey))]),
              ),
            )
        ).map((object) => [object.objectKey, object] as const),
  );
  for (const row of refused) {
    if (standing.get(row.identity.objectKey) === undefined) {
      throw new Error(`the register refused ${row.identity.objectKey} as already standing, yet no register object stands at it — the store's own key and this read disagree (L-REG-03)`);
    }
  }
  if (refused.length > 0) {
    await tx.insert(refusedSightings).values(
      refused.map((row) => ({
        tenantId: scope.tenantId,
        setRevisionId: scope.setRevisionId,
        projectId: scope.projectId,
        objectKey: row.identity.objectKey,
        refusal: DUPLICATE_IDENTITY,
        discipline: row.discipline,
        elementType: row.sighting.elementType,
        mark: row.sighting.mark,
        viewKey: row.identity.viewKey,
        placementKey: row.identity.placementKey,
        semantic: row.semantic,
        sighting: row.sighting,
      })),
    );
  }

  const refusedAt = new Set(refused.map((row) => read.indexOf(row)));
  return read.map((row, at) =>
    refusedAt.has(at)
      ? {
          registered: false,
          refusal: DUPLICATE_IDENTITY,
          objectKey: row.identity.objectKey,
          semanticUnchanged: standing.get(row.identity.objectKey)?.semantic === row.semantic,
        }
      : { registered: true, objectKey: row.identity.objectKey },
  );
}

/* ------------------------------------------------------------------ the one-hop re-key and the rows beside it */

/** Where one register row stands before a re-key: its revision and its key (L-REG-04). */
export type StandingRow = { readonly tenantId: string; readonly setRevisionId: string; readonly objectKey: string };

/**
 * The key a row moves to and the level it then stands on: a surrogate, with the lawful-null slot and
 * the placeholder label both cleared — a level is stated once (`register_objects_level_stated_once`).
 * The standing moves only where the caller says it does (a typical range's carried row is the one the
 * resolver says was MEASURED); left out, the row keeps the standing it had.
 */
export type RekeyedRow = { readonly objectKey: string; readonly levelId: string; readonly standing?: SightingStanding };

/**
 * L-REG-04's one hop, as the store writes it: the row IS the same sighting all along, so it is moved
 * in place rather than deleted and offered again — `cubit_app` holds no DELETE on the register (0029),
 * and a placeholder offered again would be a second sighting of a scope already standing (L-REG-03).
 * What the key BECOMES is the caller's to derive through the identity grammar (`carryLevel`, the
 * typical-range resolver); this moves the columns that grammar names and nothing else.
 *
 * The key the row moves to can already stand. The store's own key (`register_objects_key`) then
 * refuses the update, and the driver's error is handed back unchanged: what that means to a person is
 * the calling act's to say (ARCH-03).
 */
export async function rekeyObjectIn(tx: TenantTx, row: StandingRow, onto: RekeyedRow): Promise<void> {
  await tx
    .update(registerObjects)
    .set({
      objectKey: onto.objectKey,
      levelId: onto.levelId,
      levelSlot: null,
      levelLabel: null,
      ...(onto.standing === undefined ? {} : { standing: onto.standing }),
    })
    .where(and(eq(registerObjects.tenantId, row.tenantId), eq(registerObjects.setRevisionId, row.setRevisionId), eq(registerObjects.objectKey, row.objectKey)));
}

/**
 * The placeholder a row stood up beside another is copied from: every column a sighting states, which
 * the rows beside it share (L-REG-04 — the same scope on another storey).
 */
export type BesideOf = Pick<RegisterObjectRow, "tenantId" | "setRevisionId" | "projectId" | "discipline" | "elementType" | "mark" | "viewKey" | "placementKey" | "semantic">;

/** One row stood up beside a sighting: its key, the surrogate it stands on and its own standing. */
export type BesideRow = { readonly objectKey: string; readonly levelId: string; readonly standing: SightingStanding };

/**
 * Rows stood up beside one sighting — the storeys a typical range places its member on besides the
 * one the placeholder itself is carried onto. Every column but the key, the level and the standing is
 * the placeholder's own, copied across, so nothing is re-derived on the way (B-17).
 *
 * A key already standing IS this sighting (L-REG-04), so a row whose key stands writes nothing rather
 * than being offered as a second sighting of one scope, which the register would rightly keep as
 * evidence of over-measurement (L-REG-03).
 */
export async function registerBesideIn(tx: TenantTx, beside: BesideOf, rows: readonly BesideRow[]): Promise<void> {
  if (rows.length === 0) return;
  await tx
    .insert(registerObjects)
    .values(
      rows.map((row) => ({
        tenantId: beside.tenantId,
        setRevisionId: beside.setRevisionId,
        objectKey: row.objectKey,
        projectId: beside.projectId,
        discipline: beside.discipline,
        elementType: beside.elementType,
        mark: beside.mark,
        viewKey: beside.viewKey,
        placementKey: beside.placementKey,
        levelId: row.levelId,
        standing: row.standing,
        semantic: beside.semantic,
      })),
    )
    .onConflictDoNothing();
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
