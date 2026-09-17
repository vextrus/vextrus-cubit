// AUTHOR_TYPICAL_RANGE (L-CAD-07: "typical ranges from captions; `AUTHOR_TYPICAL_RANGE` when
// unstated"), rendered as L-ACT-02's pair.
//
// A bare typical caption states no range, so the expansion leaves that view's vertical members in the
// UNRESOLVED slot and defers `TYPICAL_RANGE_UNSTATED`. This act is what settles it: a person states
// the two ends of the range, and the one act moves every placeholder standing under that view onto
// every level between them — one act with N subjects, because L-ACT-01 records an act "at the
// granularity performed" and a plan's typicality is one statement about the whole view.
//
// Two things happen to one placeholder, and they are one move: the row standing under
// `<placement>#UNRESOLVED` is RE-KEYED onto the level the plan was drawn at — the range's `from` end,
// which is where a typical plan is drawn (risk note 2) — and the levels above it are first-registered
// beside it, DERIVED from that drawn geometry. The placeholder is re-keyed rather than deleted and
// re-offered: `cubit_app` holds no DELETE on the register (0029), and a placeholder offered again
// would be a second sighting of a scope already standing and be refused `DUPLICATE_IDENTITY`
// (L-REG-03) — the register would fill with evidence of a person answering a question the machine
// asked (risk note 3).
//
// The register rows are reached here rather than through `@/modules/takeoff/register` for the reason
// `../levels/store` reaches them: the act seam is core and core imports nothing above it (ARCH-01).
// Nothing is re-derived on the way — what a key IS stays the identity grammar's (`levelSegment`), and
// every other column of a minted row is the placeholder's own, copied across (B-17).
import { and, asc, eq, inArray, memberTypeVariants, placements, registerObjects, typicalRanges, type TenantTx } from "../db";
import { violatesConstraint } from "../db/violations";
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { levelSegment, SIGHTING_STANDINGS, type SightingStanding } from "../identity";
import { liveLevelsOf, type LevelRow, type LevelScope } from "../levels/store";
import { bandCovers, bandJudgeable, bandOpen, placedBy } from "../offers/contract";
import type { Discipline } from "../sheets/law";
import type { Consequence, ConsequenceSubject } from "./consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const AUTHOR_TYPICAL_RANGE = "AUTHOR_TYPICAL_RANGE" as const;

/**
 * The two standings, read off the register's own roster rather than spelled beside it (B-17). The
 * plan was drawn once, at the level the range runs FROM: that level's rows carry the geometry that
 * was read, and the levels above carry geometry derived from it (risk note 2, L-REG-01).
 */
const MEASURED: SightingStanding = SIGHTING_STANDINGS[0];
const DERIVED: SightingStanding = SIGHTING_STANDINGS[1];

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

/** One row the act leaves standing: the key it stands on, the level, and on what evidence. */
type Instance = {
  readonly objectKey: string;
  readonly levelId: string;
  readonly standing: SightingStanding;
};

/** One level band a schedule states, by the labels its two ends name — either end open (L-FRM-02). */
type Band = { readonly from: string | null; readonly to: string | null };

/** The bands the placements behind these placeholders state, by the placement each stands for. */
type Sighted = { readonly bands: ReadonlyMap<string, readonly Band[]> };

/** What the act would do, derived from the state this transaction read (L-ACT-02). */
type Derived = {
  readonly drawn: LevelRow;
  readonly span: readonly LevelRow[];
  readonly placeholders: readonly Placeholder[];
  /** The project's live level stack, which a band's two ends are read against (L-REG-02). */
  readonly live: readonly LevelRow[];
  /** What the placements behind the placeholders say: their bands (L-FRM-02) and their grid addresses. */
  readonly sighted: Sighted;
  /** The physical scopes another view of this project already stands MEASURED at (L-REG-03). */
  readonly drawnElsewhere: ReadonlySet<string>;
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

/**
 * The act, applied to the state this transaction read: the levels the range spans, and the
 * placeholders it moves onto them.
 *
 * The range is physical, so it is read off the ordinals and never off the labels (L-MEA-07,
 * L-REG-02); an end the live stack does not carry is refused before anything is written.
 */
async function derive(ctx: ActorCtx, input: AuthorTypicalRangeInput, tx: TenantTx): Promise<Derived> {
  const scope: LevelScope = { tenantId: ctx.tenantId, projectId: input.projectId };
  const live = await liveLevelsOf(tx, scope);
  const from = endpoint(live, input.projectId, input.fromLevelId);
  const to = endpoint(live, input.projectId, input.toLevelId);

  const low = Math.min(from.ordinal, to.ordinal);
  const high = Math.max(from.ordinal, to.ordinal);
  const span = live.filter((level) => level.ordinal >= low && level.ordinal <= high);

  const placeholders = await placeholdersUnder(tx, ctx, input);
  return { drawn: from, span, placeholders, live, sighted: await bandsUnder(tx, ctx, placeholders), drawnElsewhere: await drawnElsewhereOf(tx, ctx, input) };
}

/**
 * The physical scopes another view of this project has already been MEASURED at (L-REG-03).
 *
 * A building is drawn more than once: a roof plan draws the storey a typical plan is also typical of,
 * and both readings are of one member. The plan that drew that storey read its geometry there, so it
 * owns the scope; a row this range would derive for the same member on the same storey is the weaker
 * of the two, and registering it as well would bill one beam twice — the over-measurement L-REG-03
 * exists to make unrepresentable ("a measured sighting landing where a level expansion already stands
 * is a promotion … not a refusal": the promotion is what stands, and the derivation yields to it).
 *
 * The scope is the MARK on the STOREY under one pinned REVISION, and deliberately not the mark at a
 * grid reference. A grid
 * reference is the nearest axis of each family of the view's OWN backbone, and two plans of one
 * building need not read the same backbone — a roof plan that draws four core columns georeferences
 * off fewer axes than the typical plan below it, and the same beam is lettered differently in the two.
 * Joining on a reference the two views disagree about would leave both rows standing, which is the
 * over-measurement this guard exists to prevent. What the two plans do agree about is the mark and the
 * storey: a plan OF a storey is what that storey is measured from, and a typical plan is typical of
 * the storeys no plan of their own draws (L-MEA-09, L-CAD-07).
 */
async function drawnElsewhereOf(tx: TenantTx, ctx: ActorCtx, input: AuthorTypicalRangeInput): Promise<Set<string>> {
  const standing = await tx
    .select({ setRevisionId: registerObjects.setRevisionId, mark: registerObjects.mark, levelId: registerObjects.levelId, viewKey: registerObjects.viewKey })
    .from(registerObjects)
    .where(and(eq(registerObjects.tenantId, ctx.tenantId), eq(registerObjects.projectId, input.projectId), eq(registerObjects.standing, MEASURED)));

  const owned = new Set<string>();
  for (const row of standing) {
    // Only ACROSS views: within one view a placement's rows stand on distinct levels already, and the
    // view this range is stated about is the one whose placeholders are being moved.
    if (row.viewKey === input.viewKey || row.levelId === null) continue;
    owned.add(scopeOf(row.setRevisionId, row.mark, row.levelId));
  }
  return owned;
}

/**
 * One physical scope, spelled once: the mark, on one storey, under one pinned revision of the set
 * (L-REG-03, L-REG-04).
 *
 * The revision is part of the scope because a revision is its own reading of the building: the
 * placeholders this act moves span every pinned revision that holds one, and each becomes rows under
 * its own. A sighting made under revision A says nothing about what revision B drew, so keying the
 * guard on the mark and the storey alone would let a row that landed under A delete the rows this act
 * derives under B — a register that loses members with no refusal and no observation, which is the
 * undeclared under-measurement L-QTY-02 makes unrepresentable. Every other register read in the tree
 * scopes by `setRevisionId` for the same reason.
 */
function scopeOf(setRevisionId: string, mark: string, levelId: string): string {
  return `${setRevisionId}|${mark}|${levelId}`;
}

/**
 * The bands each placeholder's own mark family is stated to stand over (L-FRM-02), keyed by the
 * placement the placeholder is a sighting of.
 *
 * A schedule's `LEVELS` cell is the drawing's statement of which storeys carry a mark, and it is a
 * statement about the MEMBER rather than about the plan: a `BEAM SCHEDULE` row reading `1F TO ROOF`
 * says the beam starts at the first floor whatever range the plan that draws it is typical of. So a
 * member is expanded over the range a person stated AND the band its own schedule names, which is the
 * only reading under which a plan typical of `GF … ROOF` does not register a first-floor beam in the
 * ground storey (L-QTY-04: a member is never registered on a level the drawing never said it stands
 * at). A placement whose mark the schedules name no family for states no band and is not cut.
 */
async function bandsUnder(tx: TenantTx, ctx: ActorCtx, placeholders: readonly Placeholder[]): Promise<Sighted> {
  const keys = [...new Set(placeholders.map((placeholder) => placeholder.placementKey))];
  const held = new Map<string, Band[]>();
  if (keys.length === 0) return { bands: held };

  const sighted = await tx
    .select({
      placementKey: placements.placementKey,
      ingestId: placements.ingestId,
      family: placements.memberFamily,
    })
    .from(placements)
    .where(and(eq(placements.tenantId, ctx.tenantId), inArray(placements.placementKey, keys)));

  const stated = await tx
    .select({ ingestId: memberTypeVariants.ingestId, family: memberTypeVariants.family, from: memberTypeVariants.bandFrom, to: memberTypeVariants.bandTo })
    .from(memberTypeVariants)
    .where(eq(memberTypeVariants.tenantId, ctx.tenantId));

  const byFamily = new Map<string, Band[]>();
  for (const variant of stated) {
    const at = `${variant.ingestId}@${variant.family}`;
    byFamily.set(at, [...(byFamily.get(at) ?? []), { from: variant.from, to: variant.to }]);
  }
  for (const one of sighted) {
    if (one.family === null) continue;
    const bands = byFamily.get(`${one.ingestId}@${one.family}`);
    if (bands !== undefined) held.set(one.placementKey, bands);
  }
  return { bands: held };
}

/**
 * The levels of the stated range one placeholder's own band covers (L-FRM-02).
 *
 * The cut is made only where the stack can be read against the band: a family whose schedule stated
 * no band, or whose every band names an endpoint no live level carries, is a statement nothing can
 * judge and cuts nothing — the member stands over the whole range the person stated, and the rail
 * says what it could not read per level rather than the member vanishing with no word said. The ends
 * are matched by the label the stack carries and bounded by ORDINAL, because the range is physical
 * (L-MEA-07, L-REG-02).
 */
function bandedSpan(derived: Derived, placeholder: Placeholder): readonly LevelRow[] {
  const stated = derived.sighted.bands.get(placeholder.placementKey) ?? [];
  if (stated.length === 0 || stated.some((band) => bandOpen(band))) return derived.span;
  const place = placedBy(derived.live);
  const readable = stated.filter((band) => bandJudgeable(band, place));
  if (readable.length === 0) return derived.span;
  return derived.span.filter((level) => readable.some((band) => bandCovers(band, level.ordinal, place)));
}

/**
 * The rows one placeholder becomes: one per level of the range its own band covers, drawn at the end
 * the range runs from.
 *
 * Only the level the plan was DRAWN at carries the geometry that was read; the rest are derived from
 * it. A member whose band starts above that level was still read off the one plan, and every row it
 * gains is DERIVED — there is no level of its own the geometry was read at, and naming one would
 * claim a sighting nobody made (L-REG-01, risk note 2).
 */
function instancesOf(derived: Derived, placeholder: Placeholder): Instance[] {
  return bandedSpan(derived, placeholder)
    // A storey another plan of this building DREW this member on is that plan's to register: the
    // derivation yields to the sighting (L-REG-03).
    .filter((level) => !derived.drawnElsewhere.has(scopeOf(placeholder.setRevisionId, placeholder.mark, level.levelId)))
    .map((level) => ({
      objectKey: `${placeholder.placementKey}${levelSegment({ levelId: level.levelId })}`,
      levelId: level.levelId,
      standing: level.levelId === derived.drawn.levelId ? MEASURED : DERIVED,
    }));
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
    after: instancesOf(derived, placeholder).map((instance) => instance.objectKey),
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
      const instances = instancesOf(derived, placeholder);
      // A member whose own band covers no level of the stated range is a member this range does not
      // settle: it keeps its placeholder rather than being moved onto a storey its schedule says it
      // does not stand on, and a person who reads the band differently states it again (L-FRM-02).
      const carries = instances[0];
      if (carries === undefined) continue;
      // The row the placeholder becomes: the level the plan was DRAWN at where the band covers it,
      // and otherwise the lowest level the band does cover. The geometry was read at the drawn level
      // either way, so a row above it is DERIVED and `instancesOf` has already said which.
      const drawn = instances.find((instance) => instance.levelId === derived.drawn.levelId) ?? carries;

      // The one hop: the placeholder becomes the drawn row. Its key moves once, `level_id` takes the
      // surrogate and the lawful-null slot is cleared — the row is the same sighting all along
      // (L-REG-04, and the same shape as the level store's own carry).
      try {
        await tx
          .update(registerObjects)
          .set({ objectKey: drawn.objectKey, levelId: drawn.levelId, levelSlot: null, levelLabel: null, standing: drawn.standing })
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
          throw refusal(DUPLICATE_IDENTITY, `${drawn.objectKey} already stands in this revision of the set, so the placeholder cannot be carried onto it`, { objectKey: drawn.objectKey });
        }
        throw failure;
      }

      const minted = instances.filter((instance) => instance.levelId !== drawn.levelId);
      if (minted.length === 0) continue;
      await tx
        .insert(registerObjects)
        .values(
          minted.map((instance) => ({
            tenantId: ctx.tenantId,
            setRevisionId: placeholder.setRevisionId,
            objectKey: instance.objectKey,
            projectId: placeholder.projectId,
            discipline: placeholder.discipline,
            elementType: placeholder.elementType,
            mark: placeholder.mark,
            viewKey: placeholder.viewKey,
            placementKey: placeholder.placementKey,
            levelId: instance.levelId,
            standing: instance.standing,
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
        fromLevelId: derived.drawn.levelId,
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
