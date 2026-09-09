// L-MEA-07's level model, stored and read back: the levels of a project, the readings of their
// storey heights, and the register objects an authored level carries off its placeholder.
//
// Written by the act seam alone (SEAM-ACT), inside the transaction that writes the act row
// (L-ACT-01), and read on the caller's transaction so a Consequence is judged against the state its
// write lands in (L-ACT-02). The register objects are reached here rather than through
// `@/modules/takeoff/register` because the act seam is core and core imports nothing above it
// (ARCH-01) — what a carry IS stays the identity grammar's (`carryLevel`), and this only moves the
// three columns that grammar names.
import { and, asc, eq, inArray, isNull, levels, registerObjects, storeyHeightReadings, type TenantTx } from "../db";
import { carryLevel, dotlessUpper } from "../identity";
import { declaredOrdinal, type StoreyHeightBasis } from "./law";

/** Which project's levels are being read, in whose workspace — a level is project-scoped (L-MEA-07). */
export type LevelScope = { readonly tenantId: string; readonly projectId: string };

/** One level row, whole, as the store holds it. */
export type LevelRow = typeof levels.$inferSelect;

/** One storey-height reading row, whole, as the store holds it. */
export type StoreyHeightReadingRow = typeof storeyHeightReadings.$inferSelect;

/** One level as an act asks the store to write it: what it is called, and where it stands. */
export type LevelWrite = {
  readonly label: string;
  readonly ordinal: number;
};

/** One reading as an act asks the store to write it — the derivation travels with it (L-REG-01). */
export type ReadingWrite = {
  readonly levelId: string;
  readonly readingKey: string;
  readonly actorId: string;
  readonly basis: StoreyHeightBasis;
  readonly sourceKey: string | null;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonicalMetres: string;
  readonly factor: string;
  readonly factorProvenance: string;
};

/** One register object waiting under a placeholder: where it stands, and what a reader knows it by. */
export type PlaceholderObject = {
  readonly setRevisionId: string;
  readonly objectKey: string;
  readonly levelLabel: string;
  readonly elementType: string;
};

/** Every level the project holds, repudiated ones included, in the order they physically stand. */
export async function levelsOf(tx: TenantTx, scope: LevelScope): Promise<LevelRow[]> {
  return tx
    .select()
    .from(levels)
    .where(and(eq(levels.tenantId, scope.tenantId), eq(levels.projectId, scope.projectId)))
    .orderBy(asc(levels.ordinal), asc(levels.levelId));
}

/**
 * The LIVE stack: the levels no act has repudiated, in ordinal order. A repudiated level renumbers
 * nothing, so a gap in the ordinals here is lawful — the ordinal is physical (L-MEA-07).
 */
export async function liveLevelsOf(tx: TenantTx, scope: LevelScope): Promise<LevelRow[]> {
  return tx
    .select()
    .from(levels)
    .where(and(eq(levels.tenantId, scope.tenantId), eq(levels.projectId, scope.projectId), isNull(levels.repudiatedActId)))
    .orderBy(asc(levels.ordinal), asc(levels.levelId));
}

/** Move one level to the ordinal an insert below it pushed it to (L-MEA-07: ordinals above move). */
export async function moveOrdinal(tx: TenantTx, scope: LevelScope, levelId: string, ordinal: number): Promise<void> {
  await tx
    .update(levels)
    .set({ ordinal: declaredOrdinal(ordinal) })
    .where(and(eq(levels.tenantId, scope.tenantId), eq(levels.levelId, levelId)));
}

/**
 * Write the levels one act inserts, in the order the act proposed them, and answer the surrogate the
 * store minted for each. The id is the store's: a preview cannot name it, which is why a proposed
 * level is a subject of its own index until the act lands (settled reading 3).
 */
export async function insertLevels(tx: TenantTx, scope: LevelScope, actId: string, proposed: readonly LevelWrite[]): Promise<string[]> {
  const minted: string[] = [];
  for (const level of proposed) {
    const written = await tx
      .insert(levels)
      .values({
        tenantId: scope.tenantId,
        projectId: scope.projectId,
        label: level.label,
        ordinal: declaredOrdinal(level.ordinal),
        insertedActId: actId,
      })
      .returning({ levelId: levels.levelId });
    const levelId = written[0]?.levelId;
    if (levelId === undefined) throw new Error(`the store minted no surrogate for the level ${level.label} — a level with no identity is not a level (L-MEA-07)`);
    minted.push(levelId);
  }
  return minted;
}

/** Mark one level repudiated by the act that marked it. The row stays, and so does its ordinal. */
export async function markRepudiated(tx: TenantTx, scope: LevelScope, levelId: string, actId: string): Promise<void> {
  await tx
    .update(levels)
    .set({ repudiatedActId: actId })
    .where(and(eq(levels.tenantId, scope.tenantId), eq(levels.levelId, levelId), isNull(levels.repudiatedActId)));
}

/** Append the readings one act carried. Nothing is ever rewritten: a correction is another row. */
export async function writeReadings(tx: TenantTx, scope: LevelScope, actId: string, readings: readonly ReadingWrite[]): Promise<void> {
  if (readings.length === 0) return;
  await tx.insert(storeyHeightReadings).values(
    readings.map((reading) => ({
      tenantId: scope.tenantId,
      projectId: scope.projectId,
      levelId: reading.levelId,
      readingKey: reading.readingKey,
      actorId: reading.actorId,
      basis: reading.basis,
      sourceKey: reading.sourceKey,
      valueAsWritten: reading.valueAsWritten,
      unitAsWritten: reading.unitAsWritten,
      canonicalMetres: reading.canonicalMetres,
      factor: reading.factor,
      factorProvenance: reading.factorProvenance,
      actId,
    })),
  );
}

/** Every reading of every level of one project, oldest first — the order a standing is derived in. */
export async function readingsOfProject(tx: TenantTx, scope: LevelScope): Promise<StoreyHeightReadingRow[]> {
  return tx
    .select()
    .from(storeyHeightReadings)
    .where(and(eq(storeyHeightReadings.tenantId, scope.tenantId), eq(storeyHeightReadings.projectId, scope.projectId)))
    .orderBy(asc(storeyHeightReadings.readAt), asc(storeyHeightReadings.readingId));
}

/** Every reading of ONE level, oldest first. */
export async function readingsOfLevel(tx: TenantTx, scope: LevelScope, levelId: string): Promise<StoreyHeightReadingRow[]> {
  return tx
    .select()
    .from(storeyHeightReadings)
    .where(and(eq(storeyHeightReadings.tenantId, scope.tenantId), eq(storeyHeightReadings.projectId, scope.projectId), eq(storeyHeightReadings.levelId, levelId)))
    .orderBy(asc(storeyHeightReadings.readAt), asc(storeyHeightReadings.readingId));
}

/**
 * The register objects of one project standing under `@unregistered:<label>` for any of these
 * labels — the rows an insert would carry (L-REG-04's one-hop carry). Across every pinned revision
 * of the project, because a level is project-scoped and the placeholder it stands under is the same
 * placeholder in each.
 *
 * A label is matched in the comparison form the whole product reads labels in (`dotlessUpper`,
 * L-CAD-07) and never as the literal a person happened to type: a drawing states the placeholder
 * `2ND` and a person authors `2nd`, and those are one storey. Comparing them as written left the
 * placeholder standing while the next rebuild registered the same members onto the surrogate as
 * well, so nine drawn columns stood in the register eighteen times (L-REG-03).
 *
 * Both spellings are asked of the column so the narrowing stays in the index: a placeholder label
 * enters the register through the level grammar and is already in comparison form, and the row a
 * looser spelling would have stored is caught by the comparison the answer is filtered by.
 */
export async function objectsUnderPlaceholders(tx: TenantTx, scope: LevelScope, labels: readonly string[]): Promise<PlaceholderObject[]> {
  if (labels.length === 0) return [];
  const wanted = new Set(labels.map((label) => dotlessUpper(label)));
  const spellings = [...new Set([...labels, ...wanted])];
  const held = await tx
    .select({
      setRevisionId: registerObjects.setRevisionId,
      objectKey: registerObjects.objectKey,
      levelLabel: registerObjects.levelLabel,
      elementType: registerObjects.elementType,
    })
    .from(registerObjects)
    .where(and(eq(registerObjects.tenantId, scope.tenantId), eq(registerObjects.projectId, scope.projectId), inArray(registerObjects.levelLabel, spellings)))
    .orderBy(asc(registerObjects.objectKey));
  return held.flatMap((row) => (row.levelLabel !== null && wanted.has(dotlessUpper(row.levelLabel)) ? [{ ...row, levelLabel: row.levelLabel }] : []));
}

/**
 * Carry one register object off its placeholder and onto the level's surrogate: the key moves once,
 * `level_id` takes the surrogate and `level_label` is cleared — a label never keys (L-REG-02).
 *
 * What the key BECOMES is `carryLevel`'s (L-REG-04, one home): a key not standing under this label's
 * placeholder is answered unchanged, and this writes nothing for it. The placeholder hopped off is
 * the object's OWN — the label its key was spelled with — rather than the spelling the level was
 * authored in, which is a comparison and not a key (L-REG-02).
 */
export async function carryObjectOntoLevel(tx: TenantTx, scope: LevelScope, object: PlaceholderObject, levelId: string): Promise<boolean> {
  const carried = carryLevel(object.objectKey, { label: object.levelLabel, levelId });
  if (!carried.carried) return false;
  await tx
    .update(registerObjects)
    .set({ objectKey: carried.key, levelId, levelLabel: null })
    .where(
      and(
        eq(registerObjects.tenantId, scope.tenantId),
        eq(registerObjects.setRevisionId, object.setRevisionId),
        eq(registerObjects.objectKey, object.objectKey),
      ),
    );
  return true;
}
