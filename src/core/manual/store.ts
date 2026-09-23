// The hand measurement's store, read and written inside a transaction the caller already opened: the
// act that records one writes its row beside its act row (L-ACT-01), and reads — on that same
// transaction — every standing hand measurement its guards compare against, every cell the machine
// already measures (I-380 … I-382) and the condition a recipe says it was applied from (I-374). One
// home for the table's reads and its one write (B-17).
import { and, asc, conditions, eq, manualMeasurements, quantityLines, registerObjects, type TenantTx } from "../db";
import type { ElementType } from "../catalogue/classes";
import type { Kind } from "../catalogue/kinds";
import { isLevelSlot, levelSegment, type LevelRef } from "../identity";
import type { RegisterScope } from "../register/store";
import type { GeometryFigure, HandLevel, MeasuredGeometry, Recipe, RecipeKind, RecipeReading } from "./law";

/** One hand measurement, as the store holds it. */
export type ManualMeasurementRow = typeof manualMeasurements.$inferSelect;

/** One hand measurement as its act writes it — every column the row states. */
export type ManualMeasurementWrite = {
  readonly objectKey: string;
  readonly actId: string;
  readonly drawingId: string;
  readonly ingestId: string;
  readonly layoutName: string;
  readonly partitionViewKey: string;
  readonly viewKey: string;
  readonly recipe: Recipe;
  readonly level: HandLevel;
  readonly traced: MeasuredGeometry;
  readonly figure: GeometryFigure;
  readonly drawnUnit: ManualMeasurementRow["drawnUnit"];
  readonly figureUnit: ManualMeasurementRow["figureUnit"];
  readonly calibrationKey: string;
  readonly supersedes: string | null;
};

/**
 * Record one hand measurement, inside the transaction the act's row is written in (L-ACT-01). The
 * store is append-only and owner-proof (0062): this is the only statement that ever writes a row.
 */
export async function recordMeasurementIn(tx: TenantTx, scope: RegisterScope, write: ManualMeasurementWrite): Promise<void> {
  await tx.insert(manualMeasurements).values({
    tenantId: scope.tenantId,
    setRevisionId: scope.setRevisionId,
    objectKey: write.objectKey,
    projectId: scope.projectId,
    actId: write.actId,
    drawingId: write.drawingId,
    ingestId: write.ingestId,
    layoutName: write.layoutName,
    partitionViewKey: write.partitionViewKey,
    viewKey: write.viewKey,
    conditionId: write.recipe.conditionId,
    conditionName: write.recipe.conditionName,
    geometry: write.recipe.geometry,
    elementClass: write.recipe.elementClass,
    kinds: write.recipe.kinds,
    readings: write.recipe.readings,
    levelId: "levelId" in write.level ? write.level.levelId : null,
    levelSlot: "slot" in write.level ? write.level.slot : null,
    traced: write.traced,
    figure: write.figure,
    drawnUnit: write.drawnUnit,
    figureUnit: write.figureUnit,
    calibrationKey: write.calibrationKey,
    supersedes: write.supersedes,
  });
}

/** A stored hand measurement, read back into the shapes the law speaks. */
export type StoredMeasurement = {
  readonly objectKey: string;
  readonly conditionName: string;
  readonly elementClass: ElementType;
  readonly kinds: readonly Kind[];
  readonly recipe: Recipe;
  /** The level segment the row stands at, as its key spells it: `@<surrogate>` or `@FOUNDATION`. */
  readonly level: string;
  readonly viewKey: string;
  readonly space: string;
  readonly traced: MeasuredGeometry;
  readonly supersedes: string | null;
};

/** The level a stored row's columns state — a surrogate or a lawful-null slot — or null where they state neither. */
function levelOfRow(row: { readonly levelId: string | null; readonly levelSlot: string | null }): LevelRef | null {
  if (row.levelId !== null) return { levelId: row.levelId };
  return row.levelSlot !== null && isLevelSlot(row.levelSlot) ? { slot: row.levelSlot } : null;
}

/** Every hand measurement of one pinned revision, standing or not, in the order recorded. */
export async function measurementsIn(tx: TenantTx, scope: RegisterScope): Promise<StoredMeasurement[]> {
  const rows = await tx
    .select()
    .from(manualMeasurements)
    .where(and(eq(manualMeasurements.tenantId, scope.tenantId), eq(manualMeasurements.setRevisionId, scope.setRevisionId)))
    .orderBy(asc(manualMeasurements.recordedAt), asc(manualMeasurements.objectKey));
  return rows.map((row) => {
    const kinds = row.kinds as readonly RecipeKind[];
    const level = levelOfRow(row);
    // The store's CHECK says a row states exactly one of the two; a row that states neither is no row it wrote.
    if (level === null) throw new Error(`hand measurement ${row.objectKey} states no level, which manual_measurements_level_stated_once forbids (I-377)`);
    return {
      objectKey: row.objectKey,
      conditionName: row.conditionName,
      elementClass: row.elementClass,
      kinds: kinds.map((entry) => entry.kind),
      recipe: {
        conditionId: row.conditionId,
        conditionName: row.conditionName,
        geometry: row.geometry,
        elementClass: row.elementClass,
        kinds,
        readings: row.readings as readonly RecipeReading[],
      },
      level: levelSegment(level),
      viewKey: row.viewKey,
      space: row.layoutName,
      traced: row.traced as MeasuredGeometry,
      supersedes: row.supersedes,
    };
  });
}

/** One line of a campaign, with the level its object stands at — what the machine-cell read is made of. */
export type LineOfCell = { readonly objectKey: string; readonly elementClass: string; readonly kind: string; readonly level: string | null };

/**
 * Every line one campaign published, each with the level segment its register object stands at —
 * null for an object standing under a placeholder label, which no cell of a stated level holds. Which
 * of them are the machine's is the caller's to say: a line of a hand measurement's object, or of a
 * repudiated object, claims nothing (I-382).
 */
export async function linesOfCampaignIn(tx: TenantTx, scope: RegisterScope, campaignId: string): Promise<LineOfCell[]> {
  const rows = await tx
    .select({
      objectKey: quantityLines.objectKey,
      elementClass: quantityLines.class,
      kind: quantityLines.kind,
      levelId: registerObjects.levelId,
      levelSlot: registerObjects.levelSlot,
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
    .where(and(eq(quantityLines.tenantId, scope.tenantId), eq(quantityLines.campaignId, campaignId)));
  return rows.map((row) => {
    const level = levelOfRow(row);
    return { objectKey: row.objectKey, elementClass: row.elementClass, kind: row.kind, level: level === null ? null : levelSegment(level) };
  });
}

/** Where a condition a recipe names stands in the chest (I-374): standing, or retired. */
export type ConditionStanding = { readonly conditionId: string; readonly retired: boolean };

/**
 * The condition one project's chest holds under this id, or null where it holds none — a condition of
 * another project or another workspace included, since the read is scoped to both (and a workspace
 * sees only its own rows, SEAM-TENANT).
 */
export async function conditionIn(tx: TenantTx, project: { readonly tenantId: string; readonly projectId: string }, conditionId: string): Promise<ConditionStanding | null> {
  const rows = await tx
    .select({ conditionId: conditions.conditionId, retiredAt: conditions.retiredAt })
    .from(conditions)
    .where(and(eq(conditions.tenantId, project.tenantId), eq(conditions.projectId, project.projectId), eq(conditions.conditionId, conditionId)))
    .limit(1);
  const row = rows[0];
  return row === undefined ? null : { conditionId: row.conditionId, retired: row.retiredAt !== null };
}
