// L-CAD-07's placements, stored: the members one ingest record's layout plans place, written and
// read back.
//
// Written inside the partition's ONE transaction (`../store`), never in one of its own, for the
// reason the grid's rows are: a placement is a stage of a partition that is REBUILT, so its rows are
// deleted and re-derived with the views they were read off — a run that fails leaves the placements
// that stood before it rather than half of a new one (L-REG-04, R-TO-030).
import { and, asc, eq, forTenant, placementOutlines, placementRuns, placements, type TenantTx } from "@/core/db";
import type { ViewRef } from "@/core/identity";
import type { QuantityBasis } from "@/core/offers/law";
import type { DetectedPlacements, OutlineRow, PlacementNote, PlacementRow, RunReading } from "./rows";


/** One stored placement, whole — every column the store holds, as it holds it. */
export type StoredPlacement = typeof placements.$inferSelect;

/** One reading of a run as the door answers one — the value, its unit, its basis and its evidence. */
export type SideReading = RunReading;

/**
 * One placement's run as the door answers one (L-MEA-09): the clear axis, and
 * what adjoins each of its two sides. Each is null where the drawing said nothing to read — a run
 * nobody could read is stored as unread, never as a zero (L-QTY-02).
 */
export type StoredRun = {
  readonly placementKey: string;
  readonly clear: SideReading | null;
  readonly sides: readonly [SideReading | null, SideReading | null];
};

/** One record's placements, as a rebuild hands them over to be written. */
export type PlacementWrite = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
  readonly ingestId: string;
  /** What the placement stage detected, or null where the stage list ran no such stage. */
  readonly placements: DetectedPlacements | null;
};

/**
 * Rewrite one record's placements inside the partition's transaction. The table is cleared first, so
 * a rebuild that now reads fewer members — or none where members stood — leaves exactly what it
 * derived and nothing of what it replaced (L-REG-04).
 */
export async function rewritePlacementRows(tx: TenantTx, write: PlacementWrite): Promise<void> {
  await tx.delete(placementRuns).where(and(eq(placementRuns.tenantId, write.tenantId), eq(placementRuns.ingestId, write.ingestId)));
  await tx.delete(placementOutlines).where(and(eq(placementOutlines.tenantId, write.tenantId), eq(placementOutlines.ingestId, write.ingestId)));
  await tx.delete(placements).where(and(eq(placements.tenantId, write.tenantId), eq(placements.ingestId, write.ingestId)));
  const detected = write.placements;
  if (detected === null || detected.placements.length === 0) return;

  const stamp = { tenantId: write.tenantId, projectId: write.projectId, drawingId: write.drawingId, ingestId: write.ingestId };
  await tx.insert(placements).values(
    detected.placements.map((row) => ({
      ...stamp,
      placementKey: row.placementKey,
      viewKey: row.viewKey,
      mark: row.mark,
      markText: row.markText,
      elementType: row.elementType,
      x: row.x,
      y: row.y,
      gridLetter: row.gridLetter,
      gridNumeral: row.gridNumeral,
      outlineKey: row.outlineKey,
      markKey: row.markKey,
      // The note this member was read under, spread across its own columns (I-303). A row with no
      // note writes five nulls, which is what "one of the plan's typical" looks like in the store:
      // the presence of `note_key` IS the whole discriminator, so there is no flag beside it for a
      // reader to disagree with (`@/core/db`'s `placements`).
      noteKey: row.note?.sourceKey ?? null,
      noteText: row.note?.text ?? null,
      noteFromLabel: row.note?.band?.from ?? null,
      noteToLabel: row.note?.band?.to ?? null,
      noteShape: row.note?.shape ?? null,
      memberFamily: row.memberFamily,
    })),
  );

  // The plans land with the placements their rings were read for, in the same transaction, for the
  // reason the runs do (I-333, L-REG-04): a plan keyed to a placement the store no longer holds is a
  // reading of nothing.
  const outlines = detected.outlines ?? [];
  if (outlines.length > 0) {
    await tx.insert(placementOutlines).values(
      outlines.map((outline) => ({
        ...stamp,
        placementKey: outline.placementKey,
        sourceKey: outline.sourceKey,
        unitSourceKey: outline.unitSourceKey,
        geometry: outline.geometry,
        unit: outline.unit,
        areaUnit: outline.areaUnit,
        area: outline.area,
        perimeter: outline.perimeter,
        length: outline.length,
        breadth: outline.breadth,
      })),
    );
  }

  // The runs land with the placements they were read for, in the same transaction: a run keyed to a
  // placement the store no longer holds is a reading of nothing (L-REG-04, R-TO-030).
  const runs = detected.runs ?? [];
  if (runs.length === 0) return;
  await tx.insert(placementRuns).values(
    runs.map((run) => ({
      ...stamp,
      placementKey: run.placementKey,
      clearValue: run.clear?.value ?? null,
      clearUnit: run.clear?.unit ?? null,
      clearBasis: run.clear?.basis ?? null,
      clearSourceKeys: run.clear?.sourceKeys ?? null,
      sideAValue: run.sides[0]?.value ?? null,
      sideAUnit: run.sides[0]?.unit ?? null,
      sideABasis: run.sides[0]?.basis ?? null,
      sideASourceKeys: run.sides[0]?.sourceKeys ?? null,
      sideBValue: run.sides[1]?.value ?? null,
      sideBUnit: run.sides[1]?.unit ?? null,
      sideBBasis: run.sides[1]?.basis ?? null,
      sideBSourceKeys: run.sides[1]?.sourceKeys ?? null,
    })),
  );
}

/**
 * The runs one record stands under, in the key's own order so two reads answer the same list
 * (L-REG-05). An empty list is an answer of its own: a drawing whose plans drew no member as a pair
 * of edge lines is not a drawing nobody partitioned (R-UI-050).
 */
export async function storedRunsOf(tenantId: string, ingestId: string): Promise<StoredRun[]> {
  const rows = await forTenant({ tenantId })
    .select()
    .from(placementRuns)
    .where(and(eq(placementRuns.tenantId, tenantId), eq(placementRuns.ingestId, ingestId)))
    .orderBy(asc(placementRuns.placementKey));
  return rows.map((row) => ({
    placementKey: row.placementKey,
    clear: readingOf(row.clearValue, row.clearUnit, row.clearBasis, row.clearSourceKeys),
    sides: [
      readingOf(row.sideAValue, row.sideAUnit, row.sideABasis, row.sideASourceKeys),
      readingOf(row.sideBValue, row.sideBUnit, row.sideBBasis, row.sideBSourceKeys),
    ] as const,
  }));
}

/** One stored plan, as the door answers one: the row the placement stage wrote, whole (I-333). */
export type StoredOutline = OutlineRow;

/**
 * The plans one record's rings enclose (I-333), in the placement key's own order so two reads answer
 * the same list (L-REG-05). An empty list is an answer of its own: a drawing that placed nothing off a
 * ring — or whose unit nobody stated — has no plan to hand a rail (R-UI-050).
 */
export async function storedOutlinesOf(tenantId: string, ingestId: string): Promise<StoredOutline[]> {
  const rows = await forTenant({ tenantId })
    .select()
    .from(placementOutlines)
    .where(and(eq(placementOutlines.tenantId, tenantId), eq(placementOutlines.ingestId, ingestId)))
    .orderBy(asc(placementOutlines.placementKey));
  return rows.map((row) => ({
    placementKey: row.placementKey,
    sourceKey: row.sourceKey,
    unitSourceKey: row.unitSourceKey,
    geometry: row.geometry,
    unit: row.unit,
    areaUnit: row.areaUnit,
    area: row.area,
    perimeter: row.perimeter,
    length: row.length,
    breadth: row.breadth,
  }));
}

/** One stored reading read back whole, or null where the store holds none — never a part of one (B-07). */
function readingOf(value: string | null, unit: string | null, basis: string | null, sourceKeys: readonly string[] | null): SideReading | null {
  if (value === null || unit === null || basis === null) return null;
  return { value, unit: unit as SideReading["unit"], basis: basis as QuantityBasis, sourceKeys: sourceKeys ?? [] };
}

/**
 * The placements one record stands under (R-TO-030: each stage's result is visible), in the key's own
 * order so two reads of one partition answer the same list (L-REG-05). An empty list is an answer: a
 * drawing whose plans placed nothing is not a drawing nobody partitioned (R-UI-050).
 */
export async function storedPlacementsOf(tenantId: string, ingestId: string): Promise<StoredPlacement[]> {
  return forTenant({ tenantId }).transaction((tx) => storedPlacementsIn(tx, tenantId, ingestId));
}

/** The same list, read on a transaction the caller holds (an act's own, L-ACT-02). */
export async function storedPlacementsIn(tx: TenantTx, tenantId: string, ingestId: string): Promise<StoredPlacement[]> {
  return tx
    .select()
    .from(placements)
    .where(and(eq(placements.tenantId, tenantId), eq(placements.ingestId, ingestId)))
    .orderBy(asc(placements.placementKey));
}

/**
 * The drawings of one project whose stored placements stand in one view (L-REG-04's view key), in the
 * drawing's own order. Any record of the drawing counts here — which record is CURRENT is the ingest
 * seam's question, asked by the caller of each drawing this answers.
 */
export async function drawingsPlacingIn(tx: TenantTx, scope: { readonly tenantId: string; readonly projectId: string; readonly viewKey: string }): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ drawingId: placements.drawingId })
    .from(placements)
    .where(and(eq(placements.tenantId, scope.tenantId), eq(placements.projectId, scope.projectId), eq(placements.viewKey, scope.viewKey)))
    .orderBy(asc(placements.drawingId));
  return rows.map((row) => row.drawingId);
}

/**
 * ONE stored placement as the resolver reads one — the single conversion from a stored row back to
 * the row the placement stage answered in (`./rows`).
 *
 * Published here, and used by BOTH readers of the store, because the divergence it closes is the
 * named defect: the partition job resolves the rows it just DETECTED while the re-expansion resolves
 * the rows it READ BACK, and until this existed the second was a hand-spelled literal beside the
 * first. Every column the stage learns to carry has to be added twice under that shape, and the run
 * that forgets one answers a different set of instance rows for one drawing — a member standing on
 * seven storeys after an ingest and on one after a pin (L-REG-04, B-17, ARCH-02). One conversion,
 * one place to add a column, and no way for the two to part.
 *
 * The view is the CALLER's, because the two readers name it differently and neither may guess: the
 * job holds the reference it placed the member in, and the re-expansion looks it up in the views the
 * store holds under that row's own view key.
 */
export function placementRowOf(stored: StoredPlacement, view: ViewRef): PlacementRow {
  return {
    viewKey: stored.viewKey,
    view,
    placementKey: stored.placementKey,
    mark: stored.mark,
    markText: stored.markText,
    elementType: stored.elementType,
    x: stored.x,
    y: stored.y,
    gridLetter: stored.gridLetter,
    gridNumeral: stored.gridNumeral,
    outlineKey: stored.outlineKey,
    markKey: stored.markKey,
    memberFamily: stored.memberFamily,
    note: storedNoteOf(stored),
  };
}

/**
 * The note a stored row carries, or null where it carries none (I-303). A note is stored WHOLE — the
 * store's own CHECK refuses a key with no words and words with no key — so the key and the text are
 * read together and a row missing either carries no note at all (B-07).
 *
 * BOTH LABELS NULL IS A BAND OF NULL, and that is the reading the whole rule turns on: a note that
 * stated no range says its member stands on the level the plan DRAWS, alone, which is the precise
 * opposite of `bandOpen`'s "covers everything" (`@/core/offers/contract`). Reading two nulls back as
 * an open band would hand the resolver a statement that restores every storey the note took away.
 */
function storedNoteOf(stored: StoredPlacement): PlacementNote | null {
  if (stored.noteKey === null || stored.noteText === null) return null;
  const band = stored.noteFromLabel === null && stored.noteToLabel === null ? null : { from: stored.noteFromLabel, to: stored.noteToLabel };
  return { sourceKey: stored.noteKey, text: stored.noteText, band, shape: stored.noteShape };
}
