// L-MEA-07's one read-only door onto a project's level stack (ARCH-02): the live levels in the order
// they physically stand, each with what its storey height amounts to, the digest a campaign's open
// snapshots (inc-209), and the readings behind one level's height.
//
// It reads and never writes. A level is inserted, moved and repudiated by acts and by nothing else
// (L-ACT-01), and the act seam is the sole writer — so this door has no write to offer, and the
// levels editor that will drive those acts (R-TO-033) speaks to the seam rather than to this file.
//
// The engine is core's (`@/core/levels`): the act seam derives its Consequences over the same values
// and may not reach into a module (ARCH-01), so a standing and a digest have one reading each and
// this door asks for them rather than keeping a second (B-17).
import { forTenant } from "@/core/db";
import { levelStackDigest, storeyHeightStanding, type StoreyHeightStanding } from "@/core/levels";
import { levelsOf as levelRowsIn, liveLevelsOf, readingsOfLevel, readingsOfProject, type LevelRow, type StoreyHeightReadingRow } from "@/core/levels/store";

export type { StoreyHeightBasis, StoreyHeightStanding, StoreyHeightStandingName } from "@/core/levels";
export type { LevelRow, StoreyHeightReadingRow } from "@/core/levels/store";

/** Which project's stack is being read, in whose workspace — a level is project-scoped (L-MEA-07). */
export type LevelScope = { readonly tenantId: string; readonly projectId: string };

/** How a level's storey height stands, with the readings it stands on (R-TO-051). */
export type LevelHeight = StoreyHeightStanding<StoreyHeightReadingRow>;

/**
 * One level of the live stack: its surrogate, what it is called, where it physically stands, and
 * what its storey height amounts to. Label, ordinal and height are all non-identifying (L-REG-02) —
 * the surrogate is what anything else points at.
 */
export type StackLevel = {
  readonly levelId: string;
  readonly label: string;
  readonly ordinal: number;
  readonly insertedActId: string;
  readonly height: LevelHeight;
};

/** Ordinal order — what a stack physically IS, never the code-point order of its labels (L-MEA-07). */
function byOrdinal(left: StackLevel, right: StackLevel): number {
  if (left.ordinal !== right.ordinal) return left.ordinal - right.ordinal;
  return left.levelId < right.levelId ? -1 : left.levelId > right.levelId ? 1 : 0;
}

/** Every reading of one project, grouped by the level it was read for, in the order it was made. */
function byLevel(readings: readonly StoreyHeightReadingRow[]): Map<string, StoreyHeightReadingRow[]> {
  const held = new Map<string, StoreyHeightReadingRow[]>();
  for (const reading of readings) {
    const standing = held.get(reading.levelId);
    if (standing === undefined) held.set(reading.levelId, [reading]);
    else standing.push(reading);
  }
  return held;
}

/** One live level, with its height derived from the readings made of it. */
function stackLevel(level: LevelRow, readings: readonly StoreyHeightReadingRow[]): StackLevel {
  return {
    levelId: level.levelId,
    label: level.label,
    ordinal: level.ordinal,
    insertedActId: level.insertedActId,
    height: storeyHeightStanding(readings),
  };
}

/**
 * The live stack: every level no act has repudiated, in ordinal order, each carrying its storey
 * height's standing. A repudiated level is absent from it and renumbers nothing, so a gap in the
 * ordinals is lawful — the ordinal is physical (L-MEA-07, settled reading 1).
 */
export async function levelStackOf(scope: LevelScope): Promise<StackLevel[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const live = await liveLevelsOf(tx, scope);
    const readings = byLevel(await readingsOfProject(tx, scope));
    return live.map((level) => stackLevel(level, readings.get(level.levelId) ?? [])).sort(byOrdinal);
  });
}

/**
 * Every level the project holds, repudiated ones included, in the store's own order — the
 * scope-taking form of the store's `levelsOf(tx, …)`, for a caller reading outside a transaction of
 * its own. It answers rows rather than the stack: a reader that wants what physically stands, with
 * heights and in ordinal order, asks `levelStackOf`. One home, so no caller keeps its own
 * transaction-opening copy of this read (B-17, ARCH-02).
 */
export async function levelsOf(scope: LevelScope): Promise<LevelRow[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => levelRowsIn(tx, scope));
}

/**
 * The digest of the live stack, as inc-209's campaign open snapshots it: over the members' surrogate
 * ids and the ordinals they stand at, and blind to everything the law calls non-identifying.
 */
export async function levelStackDigestOf(scope: LevelScope): Promise<string> {
  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => levelStackDigest(await liveLevelsOf(tx, scope)));
}

/**
 * How one level's storey height stands. Answered for a repudiated level too: a level that stood is
 * still a level rows were measured on, and what it was read at is a fact of the record (L-ACT-01).
 * A level the project does not hold at all is a mistake in the caller, and says so (ARCH-03).
 */
export async function storeyHeightOf(scope: LevelScope, levelId: string): Promise<LevelHeight> {
  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const held = (await levelRowsIn(tx, scope)).some((level) => level.levelId === levelId);
    if (!held) throw new Error(`project ${scope.projectId} holds no level ${levelId}, so it has no storey height to stand at (L-MEA-07)`);
    return storeyHeightStanding(await readingsOfLevel(tx, scope, levelId));
  });
}

/** Every reading ever made of one level's storey height, oldest first. Nothing is ever removed. */
export async function readingsOf(scope: LevelScope, levelId: string): Promise<StoreyHeightReadingRow[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => readingsOfLevel(tx, scope, levelId));
}
