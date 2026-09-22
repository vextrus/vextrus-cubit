// AUTHOR_TYPICAL_RANGE (L-CAD-07: "typical ranges from captions; `AUTHOR_TYPICAL_RANGE` when
// unstated"), rendered as L-ACT-02's pair.
//
// A bare typical caption states no range, so the expansion leaves that view's vertical members in the
// UNRESOLVED slot and defers `TYPICAL_RANGE_UNSTATED`. This act is what settles it: a person states
// the two ends of the range, and the one act moves every placeholder standing under that view onto
// the levels the member stands on under it — one act with N subjects, because L-ACT-01 records an act
// "at the granularity performed" and a plan's typicality is one statement about the whole view.
//
// WHICH levels a member stands on is not this file's to say. It is the expansion resolver's — the
// span the range gives the view, cut by the band the member's schedule states (L-FRM-02) and by the
// note the plan wrote against it (I-303), with the drawn sighting owning a scope another view of the
// drawing also reaches (L-REG-03) — and the act asks it through core's port
// (`../levels/typical-range-reading`), on this transaction, and writes exactly the rows it answers.
// Until it did, the act re-did the cut itself and never read a note, so the rows it registered were a
// third spelling of the expansion: on F-RCC6-BNBC a porch column (C7) stood on seven storeys and a
// floating one (C5) on the ground, and the rebuild after it could only call the difference stale
// (the register is append-only, 0029). One reading, and the rebuild finds every key already standing.
//
// Two things happen to one placeholder, and they are one move: the row standing under
// `<placement>#UNRESOLVED` is RE-KEYED onto the row the resolver says was MEASURED — the storey the
// member's own drawing is of — and the member's other rows are first-registered beside it. The
// placeholder is re-keyed rather than deleted and re-offered: `cubit_app` holds no DELETE on the
// register (0029), and a placeholder offered again would be a second sighting of a scope already
// standing and be refused `DUPLICATE_IDENTITY` (L-REG-03) — the register would fill with evidence of a
// person answering a question the machine asked (risk note 3).
//
// The register rows are reached here rather than through `@/modules/takeoff/register` for the reason
// `../levels/store` reaches them: the act seam is core and core imports nothing above it (ARCH-01).
// Nothing is re-derived on the way — every key is the one the resolver derived through the identity
// grammar, and every other column of a minted row is the placeholder's own, copied across (B-17).
import { and, asc, eq, registerObjects, typicalRanges, type TenantTx } from "../db";
import { violatesConstraint } from "../db/violations";
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { SIGHTING_STANDINGS, type SightingStanding } from "../identity";
import { liveLevelsOf, type LevelRow, type LevelScope } from "../levels/store";
import { typicalRangeReading, type TypicalRangeRow } from "../levels/typical-range-reading";
import type { Discipline } from "../sheets/law";
import type { Consequence, ConsequenceSubject } from "./consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const AUTHOR_TYPICAL_RANGE = "AUTHOR_TYPICAL_RANGE" as const;

/** The standing a placeholder carries onto, read off the register's own roster rather than spelled (B-17). */
const MEASURED: SightingStanding = SIGHTING_STANDINGS[0];

/** The lawful-null slot a placeholder of an unstated range stands in (L-REG-04). */
const UNRESOLVED_SLOT = "UNRESOLVED";

/** The codes this act answers with, read off the closed taxonomy rather than agreed with by chance (Q-07). */
const LEVEL_RANGE_ENDPOINT_UNMAPPED: RefusalCode = "LEVEL_RANGE_ENDPOINT_UNMAPPED";
const DUPLICATE_IDENTITY: RefusalCode = "DUPLICATE_IDENTITY";

/** The register's own statement that one identity is one row — the key this act's re-key can meet. */
const REGISTER_OBJECTS_KEY = "register_objects_key";

/** The act's input: whose view is typical, and between which two levels of the live stack. */
export type AuthorTypicalRangeInput = {
  readonly type: typeof AUTHOR_TYPICAL_RANGE;
  readonly projectId: string;
  /** L-REG-04's view key — the view whose caption stated no range (L-CAD-07). */
  readonly viewKey: string;
  readonly fromLevelId: string;
  readonly toLevelId: string;
};

/** One placeholder the act retires, as the register holds it: its key, and what it is a sighting of. */
type Placeholder = {
  readonly setRevisionId: string;
  readonly objectKey: string;
  readonly placementKey: string;
  readonly projectId: string;
  /** The one authoritative discipline this scope was sighted under, carried across (L-REG-03). */
  readonly discipline: Discipline;
  readonly elementType: string;
  readonly mark: string;
  readonly viewKey: string;
  readonly semantic: string;
};

/** What the act would do, derived from the state this transaction read (L-ACT-02). */
type Derived = {
  /** The level the range runs from — what the authored range is recorded as starting at. */
  readonly from: LevelRow;
  readonly placeholders: readonly Placeholder[];
  /** The rows the resolver answers, by the placement each is a sighting of, lowest storey first. */
  readonly rows: ReadonlyMap<string, readonly TypicalRangeRow[]>;
};

/**
 * L-CAD-07: "a stated range whose endpoint the stack lacks refuses `LEVEL_RANGE_ENDPOINT_UNMAPPED`"
 * — the same reason the expansion stage defers a caption's range under, because one rule about a
 * range reaching past the building has one reading (B-17, Q-07).
 */
function endpointUnmapped(projectId: string, levelId: string): Error {
  return refusal(LEVEL_RANGE_ENDPOINT_UNMAPPED, `no live level of this project stands at ${levelId}, so the range has no end to run to`, {
    actType: AUTHOR_TYPICAL_RANGE,
    projectId,
    levelId,
  });
}

/** The live level a surrogate names, or the refusal where the stack carries none (L-REG-02). */
function endpoint(live: readonly LevelRow[], projectId: string, levelId: string): LevelRow {
  const found = live.find((level) => level.levelId === levelId);
  if (found === undefined) throw endpointUnmapped(projectId, levelId);
  return found;
}

/**
 * Every placeholder standing under this view, across every pinned revision that holds one: a view is
 * a reading of one drawing, and the range a person states about it is true of every revision the
 * drawing was measured in. Ordered by the key, so one state renders one Consequence (L-ACT-02).
 */
async function placeholdersUnder(tx: TenantTx, ctx: ActorCtx, input: AuthorTypicalRangeInput): Promise<Placeholder[]> {
  return tx
    .select({
      setRevisionId: registerObjects.setRevisionId,
      objectKey: registerObjects.objectKey,
      placementKey: registerObjects.placementKey,
      projectId: registerObjects.projectId,
      discipline: registerObjects.discipline,
      elementType: registerObjects.elementType,
      mark: registerObjects.mark,
      viewKey: registerObjects.viewKey,
      semantic: registerObjects.semantic,
    })
    .from(registerObjects)
    .where(
      and(
        eq(registerObjects.tenantId, ctx.tenantId),
        eq(registerObjects.projectId, input.projectId),
        eq(registerObjects.viewKey, input.viewKey),
        eq(registerObjects.levelSlot, UNRESOLVED_SLOT),
      ),
    )
    .orderBy(asc(registerObjects.setRevisionId), asc(registerObjects.objectKey));
}

/** Code-point order, so a tie between two rows on one storey answers one way (L-REG-04). */
function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * The act, applied to the state this transaction read: the endpoints the range runs between, the
 * placeholders it moves, and the rows the resolver says each becomes.
 *
 * The range is physical, so its ends are surrogates of the LIVE stack (L-MEA-07, L-REG-02); an end
 * the stack does not carry is refused before anything is read or written.
 */
async function derive(ctx: ActorCtx, input: AuthorTypicalRangeInput, tx: TenantTx): Promise<Derived> {
  const scope: LevelScope = { tenantId: ctx.tenantId, projectId: input.projectId };
  const live = await liveLevelsOf(tx, scope);
  const from = endpoint(live, input.projectId, input.fromLevelId);
  endpoint(live, input.projectId, input.toLevelId);
  // Asked before anything else is read: a process nobody composed the reading into is a defect of
  // ours, and it says so whether or not this view happens to hold a placeholder (ARCH-03).
  const reading = typicalRangeReading();

  const placeholders = await placeholdersUnder(tx, ctx, input);
  const rows = new Map<string, TypicalRangeRow[]>();
  if (placeholders.length === 0) return { from, placeholders, rows };

  const answered = await reading(tx, { tenantId: ctx.tenantId, projectId: input.projectId, viewKey: input.viewKey, fromLevelId: input.fromLevelId, toLevelId: input.toLevelId });
  for (const row of answered) rows.set(row.placementKey, [...(rows.get(row.placementKey) ?? []), row]);
  // Each member's rows in storey order — by ORDINAL, never by label (L-REG-02) — so a subject names
  // the keys it becomes from the ground up, and the lowest row is the one a re-key falls back to.
  const ordinal = new Map(live.map((level) => [level.levelId, level.ordinal]));
  const at = (row: TypicalRangeRow): number => ordinal.get(row.levelId) ?? Number.POSITIVE_INFINITY;
  for (const held of rows.values()) held.sort((left, right) => at(left) - at(right) || byCodePoint(left.objectKey, right.objectKey));
  return { from, placeholders, rows };
}

/** The rows one placeholder becomes — none where the resolver places its member on no level of the range. */
function rowsOf(derived: Derived, placeholder: Placeholder): readonly TypicalRangeRow[] {
  return derived.rows.get(placeholder.placementKey) ?? [];
}

/**
 * The row the placeholder itself becomes: the one the resolver says was MEASURED — the storey the
 * member's own drawing is of (risk note 2, I-303) — and otherwise the lowest it stands on, which is
 * where a member whose band starts above the drawn storey was first read to stand.
 */
function carriedOnto(rows: readonly TypicalRangeRow[]): TypicalRangeRow | undefined {
  return rows.find((row) => row.standing === MEASURED) ?? rows[0];
}

/**
 * Every subject the act judges: one per placeholder it retires, naming the key it stands on now and
 * every key it becomes. L-ACT-01 records an act at the granularity performed, and what a person is
 * shown before they commit a one-to-many expansion is which member becomes which N rows.
 */
function subjectsOf(derived: Derived): ConsequenceSubject[] {
  return derived.placeholders.map((placeholder) => ({
    subjectId: placeholder.objectKey,
    subjectLabel: placeholder.mark,
    before: [placeholder.objectKey],
    after: rowsOf(derived, placeholder).map((row) => row.objectKey),
  }));
}

export const authorTypicalRange: ActRendering<AuthorTypicalRangeInput> = {
  async preview(ctx: ActorCtx, input: AuthorTypicalRangeInput, tx: TenantTx): Promise<Consequence> {
    const derived = await derive(ctx, input, tx);
    return {
      actType: AUTHOR_TYPICAL_RANGE,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "SUBJECTS",
      subjects: subjectsOf(derived),
    };
  },

  async commit(ctx: ActorCtx, input: AuthorTypicalRangeInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const derived = await derive(ctx, input, tx);

    for (const placeholder of derived.placeholders) {
      const rows = rowsOf(derived, placeholder);
      // A member the resolver places on no level of the stated range — its band or its note covers
      // none of it — is a member this range does not settle: it keeps its placeholder rather than
      // being moved onto a storey the drawing says it does not stand on, and a person who reads the
      // plan differently states it again (L-FRM-02, I-303, L-QTY-04).
      const carried = carriedOnto(rows);
      if (carried === undefined) continue;

      // The one hop: the placeholder becomes the carried row. Its key moves once, `level_id` takes the
      // surrogate and the lawful-null slot is cleared — the row is the same sighting all along
      // (L-REG-04, and the same shape as the level store's own carry).
      try {
        await tx
          .update(registerObjects)
          .set({ objectKey: carried.objectKey, levelId: carried.levelId, levelSlot: null, levelLabel: null, standing: carried.standing })
          .where(
            and(
              eq(registerObjects.tenantId, ctx.tenantId),
              eq(registerObjects.setRevisionId, placeholder.setRevisionId),
              eq(registerObjects.objectKey, placeholder.objectKey),
            ),
          );
      } catch (failure) {
        // The key this hop moves to can already be standing — another sighting of the same physical
        // scope under this revision, registered before this range was authored. The register's own
        // key says so, and what it says is the registered refusal a person can act on: one identity,
        // one row (L-REG-03, L-REG-04). Handed on as the driver's error it would reach that person
        // as a fault id for a fact about their drawing (ARCH-03, B-21).
        if (violatesConstraint(failure, REGISTER_OBJECTS_KEY)) {
          throw refusal(DUPLICATE_IDENTITY, `${carried.objectKey} already stands in this revision of the set, so the placeholder cannot be carried onto it`, { objectKey: carried.objectKey });
        }
        throw failure;
      }

      const minted = rows.filter((row) => row.objectKey !== carried.objectKey);
      if (minted.length === 0) continue;
      await tx
        .insert(registerObjects)
        .values(
          minted.map((row) => ({
            tenantId: ctx.tenantId,
            setRevisionId: placeholder.setRevisionId,
            objectKey: row.objectKey,
            projectId: placeholder.projectId,
            discipline: placeholder.discipline,
            elementType: placeholder.elementType,
            mark: placeholder.mark,
            viewKey: placeholder.viewKey,
            placementKey: placeholder.placementKey,
            levelId: row.levelId,
            standing: row.standing,
            semantic: placeholder.semantic,
          })),
        )
        // A key already standing IS this sighting (L-REG-04), so a range re-stated over a level the
        // member already stands on writes nothing rather than offering a second sighting of one
        // scope, which the register would rightly keep as evidence of over-measurement (L-REG-03).
        .onConflictDoNothing();
    }

    // What the person stated, kept so a rebuild resolves the same range the act did (L-CAD-07): the
    // expansion reads this row, and a caption that states nothing is settled by it forever after.
    await tx
      .insert(typicalRanges)
      .values({
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        viewKey: input.viewKey,
        fromLevelId: derived.from.levelId,
        toLevelId: input.toLevelId,
        actId: act.actId,
      })
      // One authored range per view (the store's own key), and the first statement is the one that
      // stands: the app role holds no UPDATE here, so a range is authored rather than edited — a
      // person who reads the plan differently repudiates what stands and states it again (L-ACT-01).
      // The act that reached this write moved placeholders no standing range had left, so this is
      // the row for a view that carried none.
      .onConflictDoNothing();
  },
};
