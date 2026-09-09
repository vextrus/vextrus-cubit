// AUTHOR_STOREY_HEIGHT (L-MEA-07: a storey height is a correctable attribute of a level, read rather
// than set; L-REG-02: it "participates in diffs, never in identity"), rendered as L-ACT-02's pair.
//
// The reading is kept as it was written, beside what the canon says it is worth in metres and the
// factor that carried it there (L-REG-01). Nothing is overwritten: a reading stands under the key
// (level, actor, basis, source key), and a later reading under that same key is a re-affirmation
// that supersedes the earlier one — which is the only thing that clears a contest between two
// readers (L-MEA-07, R-TO-051).
//
// DEFAULTED is barred here, and at the store's own CHECK: a height nobody read is unstated, and the
// act says so by name rather than recording a number the machine invented (L-MEA-07).
import type { TenantTx } from "../db";
import { carryToMetres, isStoreyHeightBasis, readingKey, storeyHeightStanding, storeyHeightUnstated, STOREY_HEIGHT_BASES, type CarriedReading, type StoreyHeightBasis } from "../levels";
import { liveLevelsOf, readingsOfLevel, writeReadings, type LevelRow, type LevelScope } from "../levels/store";
import type { Consequence } from "./consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const AUTHOR_STOREY_HEIGHT = "AUTHOR_STOREY_HEIGHT" as const;

/** The act's input: whose level, on what basis, off which source, and what was written. */
export type AuthorStoreyHeightInput = {
  readonly type: typeof AUTHOR_STOREY_HEIGHT;
  readonly projectId: string;
  readonly levelId: string;
  readonly basis: string;
  /** Null where the reading cites no drawing entity — a height somebody entered cites none. */
  readonly sourceKey: string | null;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
};

/** What the act would do: the key it reads under, what that key said before, and what it says now. */
type Derived = {
  readonly level: LevelRow;
  readonly basis: StoreyHeightBasis;
  readonly readingKey: string;
  readonly carried: CarriedReading;
  readonly before: readonly string[];
};

/**
 * The act, judged against the state this transaction read.
 *
 * A basis outside the three a storey height may be READ on records nothing anybody stated, so it is
 * refused by the name a quantity line would report the absence under (L-MEA-07). A level the project
 * does not hold live is a mistake in the caller rather than a refusal anyone could act on: a surface
 * names a level off the live stack (ARCH-03).
 */
async function derive(ctx: ActorCtx, input: AuthorStoreyHeightInput, tx: TenantTx): Promise<Derived> {
  if (!isStoreyHeightBasis(input.basis)) {
    throw storeyHeightUnstated(
      `a storey height on the basis ${input.basis} is not a reading anybody made — a reading is ${STOREY_HEIGHT_BASES.join(", ")}`,
      { levelId: input.levelId, basis: input.basis },
    );
  }
  const scope: LevelScope = { tenantId: ctx.tenantId, projectId: input.projectId };
  const level = (await liveLevelsOf(tx, scope)).find((held) => held.levelId === input.levelId);
  if (level === undefined) throw new Error(`no live level ${input.levelId} stands in project ${input.projectId}, so there is no storey height to read (L-MEA-07)`);

  const carried = carryToMetres(input.valueAsWritten, input.unitAsWritten);
  const key = readingKey({ levelId: level.levelId, actorId: ctx.userId, basis: input.basis, sourceKey: input.sourceKey });
  // What this key said before: the reading standing under it today, where this actor has read the
  // level this way before. A re-affirmation of the very same metres moves nothing, and the seam says
  // so rather than appending a row that changes no answer (L-ACT-01).
  const standing = storeyHeightStanding(await readingsOfLevel(tx, scope, level.levelId));
  const held = standing.current.find((reading) => reading.readingKey === key);

  return { level, basis: input.basis, readingKey: key, carried, before: held === undefined ? [] : [held.canonicalMetres] };
}

export const authorStoreyHeight: ActRendering<AuthorStoreyHeightInput> = {
  async preview(ctx: ActorCtx, input: AuthorStoreyHeightInput, tx: TenantTx): Promise<Consequence> {
    const derived = await derive(ctx, input, tx);
    return {
      actType: AUTHOR_STOREY_HEIGHT,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "SUBJECTS",
      subjects: [
        {
          subjectId: derived.readingKey,
          subjectLabel: derived.level.label,
          before: derived.before,
          after: [derived.carried.canonicalMetres],
        },
      ],
    };
  },

  async commit(ctx: ActorCtx, input: AuthorStoreyHeightInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const derived = await derive(ctx, input, tx);
    await writeReadings(tx, { tenantId: ctx.tenantId, projectId: input.projectId }, act.actId, [
      {
        levelId: derived.level.levelId,
        readingKey: derived.readingKey,
        actorId: ctx.userId,
        basis: derived.basis,
        sourceKey: input.sourceKey,
        ...derived.carried,
      },
    ]);
  },
};
