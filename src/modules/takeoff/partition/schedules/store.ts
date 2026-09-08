// R-TO-031's stored half: the tables one ingest record's schedules reconstructed to, the member
// types folded out of them, and the views that deferred — written and read back.
//
// Written inside the partition's ONE transaction (`../store`), never in one of its own: the
// schedules are a stage of a partition that is REBUILT, so their rows are deleted and re-derived
// with the views they were read off — a run that fails leaves the schedules that stood before it
// rather than half of a new set (L-REG-04, R-TO-030). That is why this file takes a transaction
// rather than opening a handle.
import { and, eq, forTenant, memberTypeVariants, memberTypes, rebarZones, scheduleCells, scheduleDeferrals, schedules, type TenantTx } from "@/core/db";
import type { MemberFamily } from "./registry";
import type { ScheduleCell, ScheduleDeferralRow, ScheduleTable } from "./reconstruct";

/** What the schedules stage derived: the views it examined, and what it read in them. */
export type DetectedSchedules = {
  readonly views: number;
  readonly tables: readonly ScheduleTable[];
  readonly registry: readonly MemberFamily[];
  readonly deferrals: readonly ScheduleDeferralRow[];
};

/** One stored table, with the cells beneath it (AC-3). */
export type StoredSchedule = {
  readonly viewKey: string;
  readonly scheduleKey: string;
  readonly title: string;
  readonly pitch: number;
  readonly cells: ScheduleCell[];
};

/** One record's stored schedules: what was reconstructed, and which views deferred. */
export type StoredSchedules = {
  readonly ingestId: string;
  readonly schedules: StoredSchedule[];
  readonly deferrals: ScheduleDeferralRow[];
};

/** One record's stored registry: the families placement and the rails read (R-TO-031). */
export type StoredMemberTypes = {
  readonly ingestId: string;
  readonly families: MemberFamily[];
};

/** One record's schedules, as a rebuild hands them over to be written. */
export type ScheduleWrite = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
  readonly ingestId: string;
  /** What the schedules stage derived, or null where the stage list ran no such stage. */
  readonly schedules: DetectedSchedules | null;
};

/** The six tables of this stage, as one type — every one of them scoped and rewritten together. */
type ScheduleTableOf = typeof schedules | typeof scheduleCells | typeof memberTypes | typeof memberTypeVariants | typeof rebarZones | typeof scheduleDeferrals;

/**
 * Rewrite one record's schedule rows inside the partition's transaction. All six tables are cleared
 * first, so a rebuild that now reads fewer tables — or a deferral where a table stood — leaves
 * exactly what it derived and nothing of what it replaced.
 */
export async function rewriteScheduleRows(tx: TenantTx, write: ScheduleWrite): Promise<void> {
  const ofRecord = (table: ScheduleTableOf) => and(eq(table.tenantId, write.tenantId), eq(table.ingestId, write.ingestId));

  // Cleared beneath first: nothing ever stands for a moment as a variant of a family the store no
  // longer holds.
  await tx.delete(rebarZones).where(ofRecord(rebarZones));
  await tx.delete(memberTypeVariants).where(ofRecord(memberTypeVariants));
  await tx.delete(memberTypes).where(ofRecord(memberTypes));
  await tx.delete(scheduleCells).where(ofRecord(scheduleCells));
  await tx.delete(scheduleDeferrals).where(ofRecord(scheduleDeferrals));
  await tx.delete(schedules).where(ofRecord(schedules));
  if (write.schedules === null) return;

  const stamp = { tenantId: write.tenantId, projectId: write.projectId, drawingId: write.drawingId, ingestId: write.ingestId };
  const tables = write.schedules.tables;

  if (tables.length > 0) {
    await tx.insert(schedules).values(tables.map((table) => ({ ...stamp, viewKey: table.viewKey, scheduleKey: table.scheduleKey, title: table.title, pitch: table.pitch })));
  }

  const cells = tables.flatMap((table) => table.cells.map((cell) => ({ ...stamp, scheduleKey: table.scheduleKey, rowIndex: cell.rowIndex, columnIndex: cell.columnIndex, text: cell.text, sourceKeys: cell.sourceKeys })));
  if (cells.length > 0) await tx.insert(scheduleCells).values(cells);

  const families = write.schedules.registry;
  if (families.length > 0) {
    await tx.insert(memberTypes).values(
      families.map((family) => ({ ...stamp, scheduleKey: family.scheduleKey, family: family.family, markText: family.markText, rowIndex: family.rowIndex, sourceKeys: family.sourceKeys })),
    );
  }

  const variants = families.flatMap((family) =>
    family.variants.map((variant) => ({
      ...stamp,
      scheduleKey: family.scheduleKey,
      family: family.family,
      variantKey: variant.variantKey,
      bandText: variant.bandText,
      bandFrom: variant.bandFrom,
      bandTo: variant.bandTo,
      sectionText: variant.sectionText,
      sectionWidth: variant.sectionWidth,
      sectionDepth: variant.sectionDepth,
      sectionUnit: variant.sectionUnit,
      sourceKeys: variant.sourceKeys,
    })),
  );
  if (variants.length > 0) await tx.insert(memberTypeVariants).values(variants);

  const zones = families.flatMap((family) =>
    family.variants.flatMap((variant) =>
      variant.zones.map((zone) => ({
        ...stamp,
        scheduleKey: family.scheduleKey,
        family: family.family,
        variantKey: variant.variantKey,
        zone: zone.zone,
        text: zone.text,
        bars: zone.bars,
        spacing: zone.spacing,
        spacingUnit: zone.spacingUnit,
        spacingBar: zone.spacingBar,
        sourceKeys: zone.sourceKeys,
      })),
    ),
  );
  if (zones.length > 0) await tx.insert(rebarZones).values(zones);

  const deferrals = write.schedules.deferrals;
  if (deferrals.length > 0) {
    await tx.insert(scheduleDeferrals).values(deferrals.map((deferral) => ({ ...stamp, viewKey: deferral.viewKey, reason: deferral.reason })));
  }
}

/**
 * The schedules one record stands under (R-TO-030: each stage's result is visible). An answer, never
 * an absence: a record whose schedule views all deferred holds no table and says why, and a record
 * with no schedule view at all holds neither — both are things a caller can act on (R-UI-050).
 *
 * Every list is read in the reading's own order — the tables by the caption they are anchored on,
 * the cells by where they stand in the table, the deferrals by the view they stand for — so two
 * reads of one record answer the same lists (L-REG-05).
 */
export async function storedSchedulesOf(tenantId: string, ingestId: string): Promise<StoredSchedules> {
  const scoped = forTenant({ tenantId });

  const tables = await scoped
    .select({ viewKey: schedules.viewKey, scheduleKey: schedules.scheduleKey, title: schedules.title, pitch: schedules.pitch })
    .from(schedules)
    .where(and(eq(schedules.tenantId, tenantId), eq(schedules.ingestId, ingestId)))
    .orderBy(schedules.scheduleKey);

  const cells = await scoped
    .select({ scheduleKey: scheduleCells.scheduleKey, rowIndex: scheduleCells.rowIndex, columnIndex: scheduleCells.columnIndex, text: scheduleCells.text, sourceKeys: scheduleCells.sourceKeys })
    .from(scheduleCells)
    .where(and(eq(scheduleCells.tenantId, tenantId), eq(scheduleCells.ingestId, ingestId)))
    .orderBy(scheduleCells.scheduleKey, scheduleCells.rowIndex, scheduleCells.columnIndex);

  const deferrals = await scoped
    .select({ viewKey: scheduleDeferrals.viewKey, reason: scheduleDeferrals.reason })
    .from(scheduleDeferrals)
    .where(and(eq(scheduleDeferrals.tenantId, tenantId), eq(scheduleDeferrals.ingestId, ingestId)))
    .orderBy(scheduleDeferrals.viewKey);

  return {
    ingestId,
    schedules: tables.map((table) => ({
      ...table,
      cells: cells
        .filter((cell) => cell.scheduleKey === table.scheduleKey)
        .map((cell) => ({ rowIndex: cell.rowIndex, columnIndex: cell.columnIndex, text: cell.text, sourceKeys: cell.sourceKeys })),
    })),
    deferrals,
  };
}

/**
 * The member types one record stands under — what placement and the rails read a member's section
 * and rebar off (R-TO-031). Families, the variants beneath them and the zones beneath those, each
 * list in the order its own key stands in.
 */
export async function storedMemberTypesOf(tenantId: string, ingestId: string): Promise<StoredMemberTypes> {
  const scoped = forTenant({ tenantId });

  const families = await scoped
    .select({ scheduleKey: memberTypes.scheduleKey, family: memberTypes.family, markText: memberTypes.markText, rowIndex: memberTypes.rowIndex, sourceKeys: memberTypes.sourceKeys })
    .from(memberTypes)
    .where(and(eq(memberTypes.tenantId, tenantId), eq(memberTypes.ingestId, ingestId)))
    .orderBy(memberTypes.scheduleKey, memberTypes.family);

  const variants = await scoped
    .select({
      scheduleKey: memberTypeVariants.scheduleKey,
      family: memberTypeVariants.family,
      variantKey: memberTypeVariants.variantKey,
      bandText: memberTypeVariants.bandText,
      bandFrom: memberTypeVariants.bandFrom,
      bandTo: memberTypeVariants.bandTo,
      sectionText: memberTypeVariants.sectionText,
      sectionWidth: memberTypeVariants.sectionWidth,
      sectionDepth: memberTypeVariants.sectionDepth,
      sectionUnit: memberTypeVariants.sectionUnit,
      sourceKeys: memberTypeVariants.sourceKeys,
    })
    .from(memberTypeVariants)
    .where(and(eq(memberTypeVariants.tenantId, tenantId), eq(memberTypeVariants.ingestId, ingestId)))
    .orderBy(memberTypeVariants.scheduleKey, memberTypeVariants.family, memberTypeVariants.variantKey);

  const zones = await scoped
    .select({
      scheduleKey: rebarZones.scheduleKey,
      family: rebarZones.family,
      variantKey: rebarZones.variantKey,
      zone: rebarZones.zone,
      text: rebarZones.text,
      bars: rebarZones.bars,
      spacing: rebarZones.spacing,
      spacingUnit: rebarZones.spacingUnit,
      spacingBar: rebarZones.spacingBar,
      sourceKeys: rebarZones.sourceKeys,
    })
    .from(rebarZones)
    .where(and(eq(rebarZones.tenantId, tenantId), eq(rebarZones.ingestId, ingestId)))
    .orderBy(rebarZones.scheduleKey, rebarZones.family, rebarZones.variantKey, rebarZones.zone);

  return {
    ingestId,
    families: families.map((family) => ({
      ...family,
      variants: variants
        .filter((variant) => variant.scheduleKey === family.scheduleKey && variant.family === family.family)
        .map((variant) => ({
          variantKey: variant.variantKey,
          bandText: variant.bandText,
          bandFrom: variant.bandFrom,
          bandTo: variant.bandTo,
          sectionText: variant.sectionText,
          sectionWidth: variant.sectionWidth,
          sectionDepth: variant.sectionDepth,
          sectionUnit: variant.sectionUnit,
          sourceKeys: variant.sourceKeys,
          zones: zones
            .filter((zone) => zone.scheduleKey === family.scheduleKey && zone.family === family.family && zone.variantKey === variant.variantKey)
            .map((zone) => ({
              zone: zone.zone,
              text: zone.text,
              bars: zone.bars === null ? null : [...zone.bars],
              spacing: zone.spacing,
              spacingUnit: zone.spacingUnit,
              spacingBar: zone.spacingBar,
              sourceKeys: zone.sourceKeys,
            })),
        })),
    })),
  };
}
