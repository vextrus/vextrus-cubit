// S-Levels' reading (R-TO-033): one project's live level stack, composed into the one value the
// screen renders.
//
// It composes rather than computes. How a storey height stands is `@/core/levels`' — asked through
// the one read-only door onto the stack (`@/modules/takeoff/levels`) — what a campaign is open on a
// project is the campaigns seam's, and which views state no typical range is the partition's. This
// file asks each of them once and lays the answers side by side (B-17, ARCH-02).
//
// Nothing here re-derives a figure. A roll-up states the STORED quantity lines of the register
// objects standing on a level exactly as the gate published them: the count, the sum of the COMPLETE
// values, the weakest coverage over them and the code that weakest line declared its omission under
// (I-241). A contested height reaches a line only through the gate (L-MEA-07), so a reading that
// changed today moves no line here — the act's own Consequence is what names the lines that will
// re-derive at the next campaign.
import { campaignsOf } from "@/core/campaigns";
import { and, asc, drawingSetRevisions, eq, forTenant, quantityLines, registerObjects } from "@/core/db";
import type { RefusalCode } from "@/core/errors";
import { exact } from "@/core/units/canon";
import { levelStackOf, readingsOf, type LevelScope, type StackLevel, type StoreyHeightReadingRow } from "@/modules/takeoff/levels";
import { expansionDeferralsOf, viewsOf } from "@/modules/takeoff/partition";
import type { LevelsView, LevelsViewLevel, LevelsViewRange, LevelsViewReading, LevelsViewRollup } from "./view";

/** Which project's stack is being read, in which workspace. */
export type LevelsViewScope = { readonly tenantId: string; readonly projectId: string };

/** L-QTY-02's two coverages a stored line stands at; the second is the weaker of them. */
const COMPLETE = "COMPLETE";
const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/** The code a view whose caption stated no typical range is deferred under (L-CAD-07). */
const TYPICAL_RANGE_UNSTATED = "TYPICAL_RANGE_UNSTATED";

/** One stored line, in the two facts a roll-up is composed of plus the level it was measured on. */
type RolledLine = {
  readonly levelId: string;
  readonly kind: string;
  readonly unit: string;
  readonly coverage: string;
  readonly value: string | null;
  readonly omitted: readonly unknown[];
};

/**
 * The whole reading of one project's stack (test contract: `levelsViewOf`). A project with no
 * campaign open still HAS a stack — a level is project-scoped, not campaign-scoped (L-MEA-07) — so
 * the levels read and only the roll-ups and the index stand empty (R-UI-050).
 */
export async function levelsViewOf(scope: LevelsViewScope): Promise<LevelsView> {
  const levelScope: LevelScope = { tenantId: scope.tenantId, projectId: scope.projectId };
  const open = await campaignsOf(scope);
  const campaign = open[open.length - 1];

  const [stack, lines, unstatedRanges] = await Promise.all([
    levelStackOf(levelScope),
    campaign === undefined ? Promise.resolve<RolledLine[]>([]) : linesOnLevels(scope, campaign.campaignId),
    campaign === undefined ? Promise.resolve<LevelsViewRange[]>([]) : unstatedRangesOf(scope, campaign.setRevisionId),
  ]);

  // The lines are keyed by level in one pass rather than scanned once per level: a campaign holds as
  // many lines as the register holds objects, and a scan per level would price the page in their
  // product (the register workspace's own reading takes the same care).
  const linesByLevel = new Map<string, RolledLine[]>();
  for (const line of lines) {
    const held = linesByLevel.get(line.levelId);
    if (held === undefined) linesByLevel.set(line.levelId, [line]);
    else held.push(line);
  }

  const composed = await Promise.all(stack.map(async (level) => levelOf(levelScope, level, linesByLevel.get(level.levelId) ?? [])));
  return { projectId: scope.projectId, stack: composed, unstatedRanges };
}

/**
 * One level of the reading: what its readings say, how they stand, and what its lines amount to.
 *
 * The reading history is the store's own append order, and `superseded` is a property of the KEY
 * rather than of a row — the earlier reading under a re-affirmed key is the superseded one, which is
 * exactly what the core answers (`storeyHeightStanding`, B-17).
 */
async function levelOf(scope: LevelScope, level: StackLevel, lines: readonly RolledLine[]): Promise<LevelsViewLevel> {
  const history = await readingsOf(scope, level.levelId);
  const superseded = new Set(level.height.superseded.map((reading) => reading.readingKey));
  return {
    levelId: level.levelId,
    label: level.label,
    ordinal: level.ordinal,
    standing: level.height.standing,
    code: codeOfStanding(level.height.refusal),
    canonicalMetres: level.height.canonicalMetres,
    readings: history.map((reading, at) => readingOf(reading, superseded.has(reading.readingKey) && history.slice(at + 1).some((later) => later.readingKey === reading.readingKey))),
    rollups: rollupsOf(lines),
  };
}

/** One stored reading, as the inspector shows one. */
function readingOf(row: StoreyHeightReadingRow, superseded: boolean): LevelsViewReading {
  return {
    readingKey: row.readingKey,
    actorId: row.actorId,
    basis: row.basis,
    sourceKey: row.sourceKey,
    valueAsWritten: row.valueAsWritten,
    unitAsWritten: row.unitAsWritten,
    canonicalMetres: row.canonicalMetres,
    superseded,
  };
}

/**
 * The two codes a level's height stands under (L-MEA-07). The standing's refusal is a member of the
 * whole closed taxonomy; the view's slot names the two a HEIGHT can answer with, so anything else
 * would be another rule's code carried onto this row and reads as none.
 */
function codeOfStanding(refusal: RefusalCode | null): LevelsViewLevel["code"] {
  if (refusal === "STOREY_HEIGHT_CONTESTED" || refusal === "STOREY_HEIGHT_UNSTATED") return refusal;
  return null;
}

/**
 * One roll-up cell per kind the level's stored lines bear, in the kind's own order. Weakest-wins over
 * the level's lines of that kind: one PARTIAL_DECLARED line makes the cell partial, and the code is
 * the one that line declared its omission under — read off the record, never derived from the
 * level's standing (L-QTY-02, I-241, settled reading).
 */
function rollupsOf(lines: readonly RolledLine[]): LevelsViewRollup[] {
  const byKind = new Map<string, RolledLine[]>();
  for (const line of lines) {
    const held = byKind.get(line.kind);
    if (held === undefined) byKind.set(line.kind, [line]);
    else held.push(line);
  }
  return [...byKind.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([kind, held]) => {
      const partial = held.filter((line) => line.coverage !== COMPLETE);
      const complete = held.filter((line) => line.coverage === COMPLETE && line.value !== null);
      // A partial roll-up carries no figure at all: L-QTY-02's rule about a row, applied to the cell
      // that sums them — a sum over the COMPLETE half would print an under-measured total as a fact.
      const value = partial.length > 0 || complete.length === 0 ? null : complete.reduce((total, line) => total.add(exact(line.value as string)), exact("0")).toString();
      return {
        kind,
        unit: held[0]?.unit ?? "",
        lines: held.length,
        value,
        coverage: partial.length > 0 ? PARTIAL_DECLARED : COMPLETE,
        code: firstOmissionCode(partial),
      };
    });
}

/**
 * The code the level's weakest line of this kind declared its omission under — the first one it
 * enumerated, as L-QTY-02 makes it enumerate every omitted component on the row. A partial line that
 * enumerated none carries no code, which the cell states as none rather than inventing one.
 */
function firstOmissionCode(partial: readonly RolledLine[]): RefusalCode | null {
  for (const line of partial) {
    for (const omission of line.omitted) {
      const code = (omission as { code?: unknown } | null)?.code;
      if (typeof code === "string") return code as RefusalCode;
    }
  }
  return null;
}

/**
 * Every line the campaign published, with the level the register object it was measured off stands
 * on. A line is keyed on that object and the level is the register's reading of it (L-REG-04), so
 * the level comes from the register row rather than from a column of the line — the join
 * `@/core/acts/level-effects` makes for the acts, made here for the reading.
 */
async function linesOnLevels(scope: LevelsViewScope, campaignId: string): Promise<RolledLine[]> {
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select({
        levelId: registerObjects.levelId,
        kind: quantityLines.kind,
        unit: quantityLines.unit,
        coverage: quantityLines.coverage,
        value: quantityLines.value,
        omitted: quantityLines.omitted,
      })
      .from(quantityLines)
      .innerJoin(
        registerObjects,
        and(
          eq(registerObjects.tenantId, quantityLines.tenantId),
          eq(registerObjects.setRevisionId, quantityLines.setRevisionId),
          eq(registerObjects.objectKey, quantityLines.objectKey),
        ),
      )
      .where(and(eq(quantityLines.tenantId, scope.tenantId), eq(quantityLines.campaignId, campaignId)))
      .orderBy(asc(quantityLines.publishedAt), asc(quantityLines.lineId)),
  );
  return rows
    .filter((row): row is typeof row & { levelId: string } => row.levelId !== null)
    .map((row) => ({ levelId: row.levelId, kind: row.kind, unit: row.unit, coverage: row.coverage, value: row.value, omitted: row.omitted }));
}

/**
 * The views of the pinned revision's drawings whose caption stated no typical range (L-CAD-07) — the
 * campaign's index for this screen (I-240). The caption is the partition's own reading of the view,
 * so a deferral whose view the partition no longer holds names itself by key and nothing more.
 */
async function unstatedRangesOf(scope: LevelsViewScope, setRevisionId: string): Promise<LevelsViewRange[]> {
  const drawingIds = await drawingsOfRevision(scope.tenantId, setRevisionId);
  const perDrawing = await Promise.all(
    drawingIds.map(async (drawingId) => {
      const viewsScope = { tenantId: scope.tenantId, projectId: scope.projectId, drawingId };
      const [deferrals, views] = await Promise.all([expansionDeferralsOf(viewsScope), viewsOf(viewsScope)]);
      const captions = new Map(views.map((view) => [view.viewKey, view.caption]));
      return (deferrals ?? [])
        .filter((deferral) => deferral.reason === TYPICAL_RANGE_UNSTATED)
        .map((deferral): LevelsViewRange => ({ viewKey: deferral.viewKey, drawingId, caption: captions.get(deferral.viewKey) ?? deferral.viewKey, code: TYPICAL_RANGE_UNSTATED }));
    }),
  );
  return perDrawing.flat().sort((left, right) => (left.viewKey < right.viewKey ? -1 : left.viewKey > right.viewKey ? 1 : 0));
}

/** The drawings the pinned revision names, as the pin recorded them (L-REG-06). */
async function drawingsOfRevision(tenantId: string, setRevisionId: string): Promise<string[]> {
  const held = await forTenant({ tenantId }).transaction((tx) =>
    tx
      .select({ manifest: drawingSetRevisions.manifest })
      .from(drawingSetRevisions)
      .where(and(eq(drawingSetRevisions.tenantId, tenantId), eq(drawingSetRevisions.setRevisionId, setRevisionId)))
      .limit(1),
  );
  return (held[0]?.manifest ?? []).map((member) => member.drawingId);
}
