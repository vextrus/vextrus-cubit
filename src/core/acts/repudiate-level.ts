// REPUDIATE_LEVEL (L-MEA-07: "a level with live rows is never deleted, only repudiated"), rendered
// as L-ACT-02's pair.
//
// The act marks and does nothing else. The row stays, its ordinal stays, and every register object
// measured on it keeps the key it stands on and the level id in it — nothing is deleted and nothing
// is re-keyed (L-REG-04). No other level is renumbered either: the ordinal is physical, so a gap in
// the live stack is what a repudiated level leaves behind, and closing it would move ordinals no act
// named (settled reading 1).
//
// A level the project does not hold, and a level already marked, move nothing — the Consequence says
// so and the seam answers `ACT_CHANGES_NOTHING` (L-ACT-01).
import type { TenantTx } from "../db";
import { levelsOf, type LevelRow, type LevelScope } from "../levels/store";
import type { Consequence, ConsequenceSubject } from "./consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";
import { markRepudiated } from "../levels/store";

/** The act this file renders, spelled once. */
const REPUDIATE_LEVEL = "REPUDIATE_LEVEL" as const;

/** What a repudiated level's state reads as — the state a marked level stands in. */
const REPUDIATED = "repudiated";

/** The act's input: one project, and the one level it marks. */
export type RepudiateLevelInput = {
  readonly type: typeof REPUDIATE_LEVEL;
  readonly projectId: string;
  readonly levelId: string;
};

/** The level the act names, as this project holds it — or nothing, where it holds no such level. */
async function levelNamed(ctx: ActorCtx, input: RepudiateLevelInput, tx: TenantTx): Promise<LevelRow | undefined> {
  const scope: LevelScope = { tenantId: ctx.tenantId, projectId: input.projectId };
  return (await levelsOf(tx, scope)).find((level) => level.levelId === input.levelId);
}

/**
 * What the act would move. A level this project does not hold is no subject at all — there is
 * nothing to name — and a level already marked stands where it stood, so both consequences move
 * nothing and the seam refuses them by name rather than writing a second act row (L-ACT-01).
 */
function subjectsOf(level: LevelRow | undefined): ConsequenceSubject[] {
  if (level === undefined) return [];
  if (level.repudiatedActId !== null) return [{ subjectId: level.levelId, subjectLabel: level.label, before: [REPUDIATED], after: [REPUDIATED] }];
  return [{ subjectId: level.levelId, subjectLabel: level.label, before: [`ordinal:${String(level.ordinal)}`], after: [REPUDIATED] }];
}

export const repudiateLevel: ActRendering<RepudiateLevelInput> = {
  async preview(ctx: ActorCtx, input: RepudiateLevelInput, tx: TenantTx): Promise<Consequence> {
    return {
      actType: REPUDIATE_LEVEL,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "SUBJECTS",
      subjects: subjectsOf(await levelNamed(ctx, input, tx)),
    };
  },

  async commit(ctx: ActorCtx, input: RepudiateLevelInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const level = await levelNamed(ctx, input, tx);
    if (level === undefined || level.repudiatedActId !== null) {
      throw new Error(`${REPUDIATE_LEVEL} reached its write with nothing to mark, which the seam refuses before it gets here (L-ACT-01)`);
    }
    await markRepudiated(tx, { tenantId: ctx.tenantId, projectId: input.projectId }, level.levelId, act.actId);
  },
};
