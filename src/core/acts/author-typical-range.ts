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
import { and, asc, eq, registerObjects, typicalRanges, type TenantTx } from "../db";
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { levelSegment, SIGHTING_STANDINGS, type SightingStanding } from "../identity";
import { liveLevelsOf, type LevelRow, type LevelScope } from "../levels/store";
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

/** The code this act answers with, read off the closed taxonomy rather than agreed with by chance (Q-07). */
const LEVEL_RANGE_ENDPOINT_UNMAPPED: RefusalCode = "LEVEL_RANGE_ENDPOINT_UNMAPPED";

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

/** What the act would do, derived from the state this transaction read (L-ACT-02). */
type Derived = {
  readonly drawn: LevelRow;
  readonly span: readonly LevelRow[];
  readonly placeholders: readonly Placeholder[];
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

  return { drawn: from, span, placeholders: await placeholdersUnder(tx, ctx, input) };
}

/** The rows one placeholder becomes: one per level of the range, drawn at the end it runs from. */
function instancesOf(derived: Derived, placeholder: Placeholder): Instance[] {
  return derived.span.map((level) => ({
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
      const drawn = instances.find((instance) => instance.levelId === derived.drawn.levelId);
      // The span is the levels between the two ends inclusive and the drawn end is one of them, so a
      // span with no drawn row is a stack that moved under this transaction rather than a case.
      if (drawn === undefined) throw new Error(`the range ${input.viewKey} spans no level to have been drawn at, which its endpoints deny (L-CAD-07)`);

      // The one hop: the placeholder becomes the drawn row. Its key moves once, `level_id` takes the
      // surrogate and the lawful-null slot is cleared — the row is the same sighting all along
      // (L-REG-04, and the same shape as the level store's own carry).
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
