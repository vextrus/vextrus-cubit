// R-TO-020's `effects` for the three acts that move a level: which stored quantity lines will
// re-derive because the level their register object stands on moved (L-ACT-02, L-MEA-07).
//
// A line is keyed on the object it was measured off, and the level that object stands on is the
// register's reading of it (L-REG-04) — so the level comes from the register row rather than from a
// column of the line. Nothing here re-derives a figure: it names the lines a later campaign will
// measure again, because a height reaches a line only through the gate (L-MEA-07).
//
// The list is code-point sorted so one state digests one way (L-ACT-02).
import { and, eq, inArray, quantityLines, registerObjects, type TenantTx } from "../db";

/** Which project's lines are named, in whose workspace. */
export type LevelEffectsScope = { readonly tenantId: string; readonly projectId: string };

/**
 * Every quantity line of the project whose register object stands on one of these levels, code-point
 * sorted. An act that moves no level names nothing, and the read is skipped rather than asked with an
 * empty `in ()`.
 */
export async function linesRederivingOn(tx: TenantTx, scope: LevelEffectsScope, levelIds: readonly string[]): Promise<string[]> {
  const wanted = [...new Set(levelIds)];
  if (wanted.length === 0) return [];
  const rows = await tx
    .select({ lineId: quantityLines.lineId })
    .from(quantityLines)
    .innerJoin(
      registerObjects,
      and(
        eq(registerObjects.tenantId, quantityLines.tenantId),
        eq(registerObjects.setRevisionId, quantityLines.setRevisionId),
        eq(registerObjects.objectKey, quantityLines.objectKey),
      ),
    )
    .where(and(eq(quantityLines.tenantId, scope.tenantId), eq(quantityLines.projectId, scope.projectId), inArray(registerObjects.levelId, wanted)));
  return rows.map((row) => row.lineId).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}
