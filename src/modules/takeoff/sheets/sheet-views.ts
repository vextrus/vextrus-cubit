// Which SHEET of a record a partition view stands on (R-TO-021, L-CAD-05).
//
// A record is one drawing file and may carry several paper layouts; a view is drawn in exactly one
// of them. Which sheet one KEY stands on is core's one reading (`@/core/sheets/frames`, `sheetOfKey`):
// a view stands where its caption anchor does, so what this file adds is only the index's question —
// which of a record's views stand on this sheet. Pure — the spaces, the frames and the sheets are
// read by the index and handed here, so the reading opens no store (B-17).
import { sheetOfKey, type RecordFrames, type SheetOfRecord } from "@/core/sheets/frames";
import type { ScaleStateView } from "./scale-state";

/** Every view of the record that stands on this sheet, in the order the record answered them. */
export function viewsOnSheet(
  views: readonly ScaleStateView[],
  sheet: SheetOfRecord,
  spaces: ReadonlyMap<string, string>,
  sheets: readonly SheetOfRecord[],
  frames: RecordFrames,
): ScaleStateView[] {
  return views.filter((view) => sheetOfKey(view.anchorKey, spaces, sheets, frames) === sheet.layoutName);
}
