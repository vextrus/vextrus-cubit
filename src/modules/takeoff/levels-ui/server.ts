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
// re-derive at the next campaign. Which row a line stands on, and what a row's lines amount to, is
// `./rollups`' one rule (I-433): every line of the campaign lands on exactly one row.
import { campaignsOf } from "@/core/campaigns";
import { and, asc, drawingSetRevisions, eq, forTenant, quantityLines, registerObjects } from "@/core/db";
import type { RefusalCode } from "@/core/errors";
import { viewAddressOf } from "@/core/views";
import { levelStackOf, readingsOf, type LevelScope, type StackLevel, type StoreyHeightReadingRow } from "@/modules/takeoff/levels";
import { expansionDeferralsOf, viewsOf } from "@/modules/takeoff/partition";
import { pinnedRevisionOf } from "@/modules/takeoff/schedules-ui/server";
import { entitySelectionOf, pinnedRecordsOf, selectionAddress, type PinnedRecord } from "@/modules/takeoff/trace";
import { rollupsOf, rowsOfLines, type RolledLine } from "./rollups";
import type { LevelsView, LevelsViewLevel, LevelsViewRange, LevelsViewReading } from "./view";

/** Which project's stack is being read, in which workspace. */
export type LevelsViewScope = { readonly tenantId: string; readonly projectId: string };

/** The code a view whose caption stated no typical range is deferred under (L-CAD-07). */
const TYPICAL_RANGE_UNSTATED = "TYPICAL_RANGE_UNSTATED";

/**
 * The whole reading of one project's stack (test contract: `levelsViewOf`). A project with no
 * campaign open still HAS a stack — a level is project-scoped, not campaign-scoped (L-MEA-07) — so
 * the levels read and only the roll-ups, the rows that are no level and the index stand empty
 * (R-UI-050).
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

  // Every line on the one row it stands on: a live level, the Foundation beneath the stack, or the
  // row of lines that stand on no live level (I-433) — so no roll-up the grid shows leaves a line out.
  const rows = rowsOfLines(stack.map((level) => level.levelId), lines);

  const composed = await Promise.all(stack.map(async (level) => levelOf(levelScope, level, rows.byLevel.get(level.levelId) ?? [])));
  return { projectId: scope.projectId, stack: await withSourceTraces(scope, composed), slots: rows.slots, unstatedRanges };
}

/**
 * Each reading's Trace to the words its height was read from (s-levels I-558). A height is read
 * off a section's level mark or a note before any campaign is open, so the record it is resolved on
 * is the one the reader will see: the drawings of the project's NEWEST pin — the pin the Schedules
 * screen reads the same notes on (`pinnedRevisionOf`) — read once, and only where some reading cites
 * a key at all. The key is placed by the Trace's one reading of a named entity (`entitySelectionOf`,
 * the first drawing that holds it); a key none holds keeps its words and offers no link (I-181).
 */
async function withSourceTraces(scope: LevelsViewScope, levels: readonly LevelsViewLevel[]): Promise<LevelsViewLevel[]> {
  const cited = levels.some((level) => level.readings.some((reading) => reading.sourceKey !== null));
  const pinned = cited ? await pinnedRevisionOf(scope) : null;
  const records: ReadonlyMap<string, PinnedRecord> = pinned === null ? new Map() : await pinnedRecordsOf(scope, pinned.setRevisionId, pinned.drawingIds);
  const hrefOf = (sourceKey: string | null): string | null => {
    if (sourceKey === null) return null;
    const selection = entitySelectionOf(sourceKey, records);
    return selection === null ? null : selectionAddress(scope.tenantId, scope.projectId, selection);
  };
  return levels.map((level) => ({ ...level, readings: level.readings.map((reading) => ({ ...reading, sourceHref: hrefOf(reading.sourceKey) })) }));
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
 * Every line the campaign published, with where the register object it was measured off stands. A
 * line is keyed on that object and the level is the register's reading of it (L-REG-04), so the
 * place comes from the register row rather than from a column of the line — the join
 * `@/core/acts/level-effects` makes for the acts, made here for the reading. All three of the row's
 * level columns are read, and no line is dropped here: one whose object stands in a lawful-null slot
 * or under a placeholder is laid on its own row (I-433), never filtered out of the sum.
 */
async function linesOnLevels(scope: LevelsViewScope, campaignId: string): Promise<RolledLine[]> {
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select({
        levelId: registerObjects.levelId,
        levelSlot: registerObjects.levelSlot,
        levelLabel: registerObjects.levelLabel,
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
  return rows.map((row) => ({
    place: { levelId: row.levelId, levelSlot: row.levelSlot, levelLabel: row.levelLabel },
    kind: row.kind,
    unit: row.unit,
    coverage: row.coverage,
    value: row.value,
    omitted: row.omitted,
  }));
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
      // A deferral names its view by L-REG-04's ADDRESS (`v:`-prefixed, the key a placement row
      // carries), not by the partition's own key the view record is stored under; the captions are
      // keyed by the address, derived by the one function that derives one (B-17). Keyed by the
      // partition's key, every unstated range on F-RCC6-BNBC read as its raw address on the rail.
      const captions = new Map(views.map((view) => [viewAddressOf(view), view.caption]));
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
