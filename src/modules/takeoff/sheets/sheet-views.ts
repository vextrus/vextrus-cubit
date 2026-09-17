// Which SHEET of a record a partition view stands on (R-TO-021, L-CAD-05).
//
// A record is one drawing file and may carry several paper layouts; a view is drawn in exactly one
// of them. Pure — the spaces and the sheets are read by the index and handed here, so the reading
// itself opens no store and is the same wherever it is asked (B-17).
import type { ScaleStateView } from "./scale-state";

/** As far as this reading looks at a sheet: its layout's name, and which space that layout is. */
type SheetOfRecord = { readonly layoutName: string; readonly kind: string };

/** The layout kind model space stands under, as the artifact's own inventory spells it (L-CAD-05). */
const MODEL = "model";

/**
 * The layout one view stands on: the space its caption anchor was drawn in.
 *
 * A view NO caption anchors was not read off a title-blocked sheet — it is the whole of the space
 * the extractor found it in — and it stands on the record's model sheet, which is that space. A key
 * the artifact does not name is the same absence and is read the same way, rather than counted on
 * every sheet of the record at once (R-UI-050).
 */
export function sheetOfView(view: ScaleStateView, spaces: ReadonlyMap<string, string>, sheets: readonly SheetOfRecord[]): string | null {
  const anchored = view.anchorKey === null || view.anchorKey === undefined ? undefined : spaces.get(view.anchorKey);
  return anchored ?? sheets.find((sheet) => sheet.kind === MODEL)?.layoutName ?? null;
}

/** Every view of the record that stands on this sheet, in the order the record answered them. */
export function viewsOnSheet(
  views: readonly ScaleStateView[],
  sheet: SheetOfRecord,
  spaces: ReadonlyMap<string, string>,
  sheets: readonly SheetOfRecord[],
): ScaleStateView[] {
  return views.filter((view) => sheetOfView(view, spaces, sheets) === sheet.layoutName);
}
