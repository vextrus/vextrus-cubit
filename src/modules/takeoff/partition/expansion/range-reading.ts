/**
 * `AUTHOR_TYPICAL_RANGE`'s question, answered by the ONE resolver (L-CAD-07, L-REG-04, I-303).
 *
 * The act seam is core and cannot reach this module (ARCH-01), so core declares the question
 * (`@/core/levels/typical-range-reading`) and this file registers the answer when it loads. It is
 * imported by the re-expansion (`./reexpand`), which every door that commits the act already loads —
 * so a process that can commit the act has the answer, and the rows the act writes are exactly the
 * rows the re-expansion right after it derives: it then registers nothing and reports nothing stale.
 *
 * The answer is the resolver's, over the stored partition, with the range a person proposes standing
 * in place of whatever the view had: the schedule's band cut (L-FRM-02), the note's cut (I-303) and
 * the ownership rule between the views of one drawing (L-REG-03) all come from `resolveExpansion`, and
 * none of them is spelled here.
 */
import type { TenantTx } from "@/core/db";
import { placementKey } from "@/core/identity";
import { registerTypicalRangeReading, type TypicalRangeQuestion, type TypicalRangeRow } from "@/core/levels/typical-range-reading";
import { drawingsPlacingIn } from "../placement/store";
import { expansionEvidenceIn } from "./evidence";
import { resolveExpansion } from "./resolve";

/**
 * The rows the resolver derives for one view's level-class members under a proposed range, read on
 * the act's transaction. Every drawing whose current record places members in the view is resolved
 * whole — the other views of a drawing are what the ownership rule reads (`ownedRows`) — and only the
 * view's own rows on a live level are answered.
 */
export async function rowsUnderRange(tx: TenantTx, question: TypicalRangeQuestion): Promise<TypicalRangeRow[]> {
  const scope = { tenantId: question.tenantId, projectId: question.projectId };
  const proposed = { viewKey: question.viewKey, fromLevelId: question.fromLevelId, toLevelId: question.toLevelId };
  const answered: TypicalRangeRow[] = [];

  for (const drawingId of await drawingsPlacingIn(tx, { ...scope, viewKey: question.viewKey })) {
    const read = await expansionEvidenceIn(tx, { ...scope, drawingId });
    if (read === null) continue;
    // The proposed range stands where the view's own would: a range already authored for this view is
    // replaced rather than competed with, because the act is the statement being asked about.
    const expansion = resolveExpansion({ ...read.evidence, ranges: [...read.evidence.ranges.filter((range) => range.viewKey !== question.viewKey), proposed] });

    for (const row of expansion.rows) {
      if (row.placement.viewKey !== question.viewKey || !("levelId" in row.level)) continue;
      answered.push({
        // The placement key as the register spells it (the register door's own `placementKey` over the
        // same four facts), so a placeholder of this member is found by the key it stands on.
        placementKey: placementKey({ view: row.placement.view, mark: row.placement.mark, x: row.placement.x, y: row.placement.y }),
        objectKey: row.objectKey,
        levelId: row.level.levelId,
        standing: row.standing,
      });
    }
  }
  return answered;
}

registerTypicalRangeReading(rowsUnderRange);
