// INSERT_LEVEL (L-MEA-07: "Inserting a level mid-stack re-keys nothing (ordinals above move;
// mark-family ordinals do not); an insert states its consequences"), rendered as L-ACT-02's pair.
//
// One act over N proposed levels, because L-ACT-01 records an act "at the granularity performed" and
// a machine-proposed stack is confirmed as one thing. What the Consequence states is the whole of
// what the act does: the ordinal each proposal takes, every live level an insert below it pushes up,
// and every register object waiting under `@unregistered:<label>` that the act carries onto the
// surrogate the store is about to mint (L-REG-04's one-hop carry).
//
// The surrogate is the store's, so a preview cannot name it (settled reading 3): a proposed level is
// the subject `proposed:<i>` — its index in the act that proposed it — and a carried object says the
// label it is carried onto, with the key it lands on observable once the act has landed.
import type { TenantTx } from "../db";
import { STOREY_HEIGHT_BASES, carryToMetres, declaredOrdinal, readingKey, type CarriedReading, type StoreyHeightBasis } from "../levels";
import { carryObjectOntoLevel, insertLevels, liveLevelsOf, moveOrdinal, objectsUnderPlaceholders, writeReadings, type LevelScope, type PlaceholderObject, type ReadingWrite } from "../levels/store";
import type { Consequence, ConsequenceSubject } from "./consequence";
import { actChangesNothing } from "./refusals";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const INSERT_LEVEL = "INSERT_LEVEL" as const;

/**
 * A reading proposed alongside a level: it was read off the drawing that named the level, so its
 * basis is TRANSCRIBED and it cites the entity it was read from (L-MEA-07, R-TO-051).
 */
const PROPOSED_BASIS: StoreyHeightBasis = STOREY_HEIGHT_BASES[0];

/** One storey-height reading a proposal arrives with, as it was written on the drawing. */
export type ProposedReading = {
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly sourceKey: string;
};

/**
 * One level an act proposes: what it is called, where it physically stands, and — where the drawing
 * stated one — the storey height read off it. None of the three is identity (L-REG-02).
 */
export type ProposedLevel = {
  readonly label: string;
  readonly ordinal: number;
  readonly readings?: readonly ProposedReading[];
};

/** The act's input: one project, and the levels this one act authors into its stack. */
export type InsertLevelInput = {
  readonly type: typeof INSERT_LEVEL;
  readonly projectId: string;
  readonly levels: readonly ProposedLevel[];
};

/** Where a proposal ends up, once every proposal of the act has been applied in the order stated. */
type Placed = {
  readonly at: number;
  readonly label: string;
  readonly ordinal: number;
  readonly readings: readonly CarriedReading[];
  readonly sourceKeys: readonly string[];
};

/** One live level an insert below it pushed up — the "ordinals above move" of L-MEA-07. */
type Moved = {
  readonly levelId: string;
  readonly label: string;
  readonly from: number;
  readonly to: number;
};

/** What the act would do, derived from the state this transaction read (L-ACT-02). */
type Derived = {
  readonly placed: readonly Placed[];
  readonly moved: readonly Moved[];
  readonly carried: readonly PlaceholderObject[];
};

/** Code-point order, so a Consequence lists one state one way (L-ACT-02: one state, one digest). */
function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** A label a level may stand under. An empty one names nothing a person could carry an object onto. */
function statedLabel(label: string): string {
  if (label.trim().length === 0) throw new Error("a proposed level states the label it is known by, and an empty label names nothing (L-MEA-07)");
  return label;
}

/**
 * The act, applied to the state this transaction read.
 *
 * The proposals are applied in the order the act states them (settled reading 1): each shifts every
 * live level standing at or above the ordinal it names up by one — and every earlier proposal of the
 * same act too, because those levels are being authored by this act and stand in the same stack —
 * and then takes the ordinal it named.
 */
async function derive(ctx: ActorCtx, input: InsertLevelInput, tx: TenantTx): Promise<Derived> {
  if (input.levels.length === 0) throw actChangesNothing(INSERT_LEVEL, []);
  const scope: LevelScope = { tenantId: ctx.tenantId, projectId: input.projectId };
  const live = await liveLevelsOf(tx, scope);

  const standing = new Map(live.map((level) => [level.levelId, level.ordinal]));
  const placed: Placed[] = [];
  for (const [at, proposal] of input.levels.entries()) {
    const ordinal = declaredOrdinal(proposal.ordinal);
    for (const [levelId, stands] of standing) {
      if (stands >= ordinal) standing.set(levelId, stands + 1);
    }
    for (const [index, earlier] of placed.entries()) {
      if (earlier.ordinal >= ordinal) placed[index] = { ...earlier, ordinal: earlier.ordinal + 1 };
    }
    const readings = (proposal.readings ?? []).map((reading) => carryToMetres(reading.valueAsWritten, reading.unitAsWritten));
    placed.push({
      at,
      label: statedLabel(proposal.label),
      ordinal,
      readings,
      sourceKeys: (proposal.readings ?? []).map((reading) => reading.sourceKey),
    });
  }

  const moved = live
    .filter((level) => standing.get(level.levelId) !== level.ordinal)
    .map((level) => ({ levelId: level.levelId, label: level.label, from: level.ordinal, to: standing.get(level.levelId) ?? level.ordinal }))
    .sort((left, right) => byCodePoint(left.levelId, right.levelId));

  // One label, one level: where an act proposes the same label twice, the objects waiting under that
  // placeholder are carried onto the first of them — the placeholder names one level, and the carry
  // is one hop (L-REG-04).
  const labels = [...new Set(placed.map((level) => level.label))];
  const carried = await objectsUnderPlaceholders(tx, scope, labels);

  return { placed, moved, carried };
}

/** The level each carried object is carried onto: the first proposal standing under its placeholder. */
function levelFor(derived: Derived, object: PlaceholderObject): Placed {
  const found = derived.placed.find((level) => level.label === object.levelLabel);
  if (found === undefined) throw new Error(`${object.objectKey} stands under a placeholder no proposal of this act names, so nothing carries it (L-REG-04)`);
  return found;
}

/** Every subject the act judges: the levels it authors, the levels it moves, the objects it carries. */
function subjectsOf(derived: Derived): ConsequenceSubject[] {
  return [
    ...derived.placed.map((level) => ({
      subjectId: `proposed:${String(level.at)}`,
      subjectLabel: level.label,
      before: [],
      after: [`ordinal:${String(level.ordinal)}`],
    })),
    ...derived.moved.map((level) => ({
      subjectId: level.levelId,
      subjectLabel: level.label,
      before: [`ordinal:${String(level.from)}`],
      after: [`ordinal:${String(level.to)}`],
    })),
    // One subject per register object carried, by the key it stands on NOW: "registers N objects
    // across M classes" is stated by naming each of them and what class it is (settled reading 4).
    ...derived.carried.map((object) => ({
      subjectId: object.objectKey,
      subjectLabel: object.elementType,
      before: [],
      after: [object.levelLabel],
    })),
  ];
}

export const insertLevel: ActRendering<InsertLevelInput> = {
  async preview(ctx: ActorCtx, input: InsertLevelInput, tx: TenantTx): Promise<Consequence> {
    const derived = await derive(ctx, input, tx);
    return {
      actType: INSERT_LEVEL,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "SUBJECTS",
      subjects: subjectsOf(derived),
    };
  },

  async commit(ctx: ActorCtx, input: InsertLevelInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const scope: LevelScope = { tenantId: ctx.tenantId, projectId: input.projectId };
    const derived = await derive(ctx, input, tx);

    // Highest first: the stack is opened from the top down, so no level is ever momentarily standing
    // where another still stands.
    for (const level of [...derived.moved].sort((left, right) => right.to - left.to)) {
      await moveOrdinal(tx, scope, level.levelId, level.to);
    }

    const minted = await insertLevels(tx, scope, act.actId, derived.placed.map((level) => ({ label: level.label, ordinal: level.ordinal })));

    const readings: ReadingWrite[] = derived.placed.flatMap((level, at) => {
      const levelId = minted[at];
      if (levelId === undefined) throw new Error(`the store minted no surrogate for the proposed level ${level.label} (L-MEA-07)`);
      return level.readings.map((reading, index) => {
        const sourceKey = level.sourceKeys[index] ?? null;
        return {
          levelId,
          readingKey: readingKey({ levelId, actorId: ctx.userId, basis: PROPOSED_BASIS, sourceKey }),
          actorId: ctx.userId,
          basis: PROPOSED_BASIS,
          sourceKey,
          ...reading,
        };
      });
    });
    await writeReadings(tx, scope, act.actId, readings);

    for (const object of derived.carried) {
      const level = levelFor(derived, object);
      const levelId = minted[level.at];
      if (levelId === undefined) throw new Error(`the store minted no surrogate for the proposed level ${level.label} (L-MEA-07)`);
      await carryObjectOntoLevel(tx, scope, object, { label: level.label, levelId });
    }
  },
};
