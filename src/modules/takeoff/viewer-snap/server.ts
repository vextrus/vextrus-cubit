// R-UI-041's calibration door: for one opened sheet, the views a scale of record measures and the
// factors they measure by, so the readout can state metres beside the drawing's own units.
//
// Server-only by what it holds: the stored partition and the affirmation store are both here, and no
// browser bundle reaches this file — the screen asks the viewer feed's `?part=calibration` and the
// feed asks this.
//
// Nothing is re-derived that the store already holds (B-19, B-17): the views and their boxes on this
// sheet come from the overlay's own door, and each view's factors from the affirmations of record —
// the 12-place strings, carried whole. A view nobody has affirmed measures nothing (L-MEA-05), and a
// view whose members stand on no part of this sheet has no box to judge a pick inside.
import { forTenant, type TenantTx } from "@/core/db";
import { affirmationsOfRecord } from "@/core/scale/store";
import { partitionOverlayOfSheet } from "@/modules/takeoff/viewer-partition-overlay/server";
import type { SnapCalibration, SnapCalibrationView } from "./types";

/** Which sheet's calibration is being asked for, in whose workspace. */
export type SnapCalibrationScope = {
  readonly tenantId: string;
  readonly drawingId: string;
  readonly layoutName: string;
};

/**
 * The scale of record over one sheet, or null where nothing has partitioned the drawing yet.
 *
 * The absence is an answer rather than a refusal (R-UI-050, I-150): a drawing waiting on its first
 * partition has no view to affirm a scale over, and the readout goes on measuring in the drawing's
 * own units — which is what R-UI-041 asks for whether or not anything has been calibrated.
 */
export async function snapCalibrationsOfSheet(scope: SnapCalibrationScope): Promise<SnapCalibration | null> {
  const overlay = await partitionOverlayOfSheet(scope);
  if (overlay === null) return null;

  const affirmed = await forTenant({ tenantId: scope.tenantId }).transaction((tx: TenantTx) =>
    affirmationsOfRecord(tx, { tenantId: scope.tenantId, ingestId: overlay.ingestId }),
  );

  const views: SnapCalibrationView[] = [];
  for (const view of overlay.views) {
    const standing = affirmed.get(view.viewKey);
    // Both facts are required and neither stands for the other: a view with no box on this layout is
    // nowhere a pick can fall, and a view no act names has no factors to carry it into metres.
    if (view.box === null || standing === undefined) continue;
    views.push({ viewKey: view.viewKey, box: view.box, factorX: standing.factorX, factorY: standing.factorY });
  }

  return { ingestId: overlay.ingestId, views };
}
