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
import {
  CANONICAL_LENGTH,
  carryToMetres,
  isStoreyHeightBasis,
  readingKey,
  storeyHeightStanding,
  storeyHeightUnstated,
  STOREY_HEIGHT_BASES,
  type CarriedReading,
  type ReadingOfHeight,
  type StoreyHeightBasis,
  type StoreyHeightStanding,
} from "../levels";
import { liveLevelsOf, readingsOfLevel, writeReadings, type LevelRow, type LevelScope } from "../levels/store";
import type { Consequence, ConsequenceStanding, StandingOfSubject } from "./consequence";
import { linesRederivingOn } from "./level-effects";
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

/**
 * What the act would do: the key it reads under, what that key said before, what it says now, and
 * how the level's height stands before and after the reading lands.
 */
type Derived = {
  readonly level: LevelRow;
  readonly basis: StoreyHeightBasis;
  readonly readingKey: string;
  readonly carried: CarriedReading;
  readonly before: readonly string[];
  readonly standing: ConsequenceStanding;
};

/** One standing as a consequence states it: its name, its metres, the metre, and its current readings. */
function stated(standing: StoreyHeightStanding): StandingOfSubject {
  return { standing: standing.standing, value: standing.canonicalMetres, unit: CANONICAL_LENGTH, readings: standing.current.length };
}

/**
 * How one reading moves a level's height (I-445): the standing over the readings the level holds
 * now, and the standing over those same readings with this one appended — judged by the one
 * `storeyHeightStanding`, so the dialog says exactly what the stack will say once it lands (B-17).
 * A reading under a key that already stands supersedes it, so a re-affirmation can settle a
 * suspension and the count of readings need not grow (L-MEA-07).
 */
export function storeyHeightMoved(readings: readonly ReadingOfHeight[], added: ReadingOfHeight): ConsequenceStanding {
  return {
    before: stated(storeyHeightStanding(readings)),
    after: stated(storeyHeightStanding([...readings, added])),
    recorded: { value: added.canonicalMetres, unit: CANONICAL_LENGTH },
  };
}

/**
 * The act, judged against the state this transaction read — or nothing, where there is no live level
 * to read a height on.
 *
 * A basis outside the three a storey height may be READ on records nothing anybody stated, so it is
 * refused by the name a quantity line would report the absence under (L-MEA-07). A level this project
 * does not hold, and a level an act has repudiated, are no subject at all: a height read on a level
 * that does not stand changes nothing the machine would derive, so the Consequence names no subject
 * and the seam refuses it by name (L-ACT-01) — the same answer `REPUDIATE_LEVEL` gives for the same
 * two cases, because one rule about a level that is not there has one reading (B-17).
 */
async function derive(ctx: ActorCtx, input: AuthorStoreyHeightInput, tx: TenantTx): Promise<Derived | undefined> {
  if (!isStoreyHeightBasis(input.basis)) {
    throw storeyHeightUnstated(
      `a storey height on the basis ${input.basis} is not a reading anybody made — a reading is ${STOREY_HEIGHT_BASES.join(", ")}`,
      { levelId: input.levelId, basis: input.basis },
    );
  }
  const scope: LevelScope = { tenantId: ctx.tenantId, projectId: input.projectId };
  const level = (await liveLevelsOf(tx, scope)).find((held) => held.levelId === input.levelId);
  if (level === undefined) return undefined;

  const carried = carryToMetres(input.valueAsWritten, input.unitAsWritten);
  const key = readingKey({ levelId: level.levelId, actorId: ctx.userId, basis: input.basis, sourceKey: input.sourceKey });
  // What this key said before: the reading standing under it today, where this actor has read the
  // level this way before. A re-affirmation of the very same metres moves nothing, and the seam says
  // so rather than appending a row that changes no answer (L-ACT-01).
  const readings = await readingsOfLevel(tx, scope, level.levelId);
  const standing = storeyHeightStanding(readings);
  const held = standing.current.find((reading) => reading.readingKey === key);
  const added: ReadingOfHeight = {
    readingKey: key,
    canonicalMetres: carried.canonicalMetres,
    basis: input.basis,
    sourceKey: input.sourceKey,
    valueAsWritten: carried.valueAsWritten,
    unitAsWritten: carried.unitAsWritten,
  };

  return {
    level,
    basis: input.basis,
    readingKey: key,
    carried,
    before: held === undefined ? [] : [held.canonicalMetres],
    standing: storeyHeightMoved(readings, added),
  };
}

export const authorStoreyHeight: ActRendering<AuthorStoreyHeightInput> = {
  async preview(ctx: ActorCtx, input: AuthorStoreyHeightInput, tx: TenantTx): Promise<Consequence> {
    const derived = await derive(ctx, input, tx);
    return {
      actType: AUTHOR_STOREY_HEIGHT,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "SUBJECTS",
      subjects:
        derived === undefined
          ? []
          : [
              {
                subjectId: derived.readingKey,
                subjectLabel: derived.level.label,
                before: derived.before,
                after: [derived.carried.canonicalMetres],
                standing: derived.standing,
              },
            ],
      // The lines standing on the level whose height was read: a contested or re-affirmed height
      // reaches them only through the gate, so they RE-derive rather than change here (R-TO-020).
      effects: {
        linesRederiving: await linesRederivingOn(tx, { tenantId: ctx.tenantId, projectId: input.projectId }, derived === undefined ? [] : [derived.level.levelId]),
        signaturesVoiding: [],
      },
    };
  },

  async commit(ctx: ActorCtx, input: AuthorStoreyHeightInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const derived = await derive(ctx, input, tx);
    if (derived === undefined) {
      throw new Error(`${AUTHOR_STOREY_HEIGHT} reached its write with no live level to read, which the seam refuses before it gets here (L-ACT-01)`);
    }
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
