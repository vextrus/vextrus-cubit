// Which SHEET of a record a partition view stands on (R-TO-021, L-CAD-05).
//
// A record is one drawing file and may carry several paper layouts; a view is drawn in exactly one
// of them. Pure — the spaces, the frames and the sheets are read by the index and handed here, so
// the reading itself opens no store and is the same wherever it is asked (B-17).
import type { Box } from "../viewer/projection";
import type { ScaleStateView } from "./scale-state";

/** As far as this reading looks at a sheet: its layout's name, and which space that layout is. */
type SheetOfRecord = { readonly layoutName: string; readonly kind: string };

/** The layout kind model space stands under, as the artifact's own inventory spells it (L-CAD-05). */
const MODEL = "model";

/**
 * What a record's geometry says about where its views were drawn: one window per projectable
 * viewport — the sheet it is drawn on and the piece of model space it frames, read through the
 * shipped `windowOf` (B-17) — and where each model-space entity stands.
 *
 * Handed in rather than read here, because this file opens nothing: the index has the artifact.
 */
export type RecordFrames = {
  readonly windows: readonly { readonly layoutName: string; readonly model: Box }[];
  readonly standing: ReadonlyMap<string, readonly [number, number]>;
};

/** A record whose frames nobody read: every view of it stands where its anchor was drawn, as before. */
export const NO_FRAMES: RecordFrames = Object.freeze({ windows: Object.freeze([]), standing: new Map() });

/**
 * The layout one view stands on.
 *
 * A view anchored on a PAPER entity stands on that entity's own sheet: the caption was drawn there.
 * A view anchored on a MODEL entity stands on the sheet whose window SHOWS that entity — "a viewport
 * frames what is drawn" (L-CAD-05), and a plan captioned in model space is on the sheet that frames
 * it, not on the model sheet which is merely where the draughtsman kept it. Where two windows show
 * the same anchor the record does not say which sheet the view is drawn on, so neither does this.
 *
 * A view NO frame shows — and a view no caption anchors at all, which was not read off a
 * title-blocked sheet but is the whole of the space the extractor found it in — stands on the
 * record's model sheet, which is that space. A key the artifact does not name is the same absence
 * and is read the same way, rather than counted on every sheet of the record at once (R-UI-050).
 */
export function sheetOfView(view: ScaleStateView, spaces: ReadonlyMap<string, string>, sheets: readonly SheetOfRecord[], frames: RecordFrames): string | null {
  const anchorKey = view.anchorKey ?? undefined;
  const modelSheet = sheets.find((sheet) => sheet.kind === MODEL)?.layoutName ?? null;
  if (anchorKey === undefined) return modelSheet;

  const space = spaces.get(anchorKey);
  if (space === undefined) return modelSheet;
  if (space !== modelSheet) return space;

  const at = frames.standing.get(anchorKey);
  if (at === undefined) return space;
  const showing = frames.windows.filter((window) => inside(window.model, at));
  return showing.length === 1 ? (showing[0] as { layoutName: string }).layoutName : space;
}

/** Every view of the record that stands on this sheet, in the order the record answered them. */
export function viewsOnSheet(
  views: readonly ScaleStateView[],
  sheet: SheetOfRecord,
  spaces: ReadonlyMap<string, string>,
  sheets: readonly SheetOfRecord[],
  frames: RecordFrames,
): ScaleStateView[] {
  return views.filter((view) => sheetOfView(view, spaces, sheets, frames) === sheet.layoutName);
}

/** Whether a point stands in a box, edges included — the same reading the projection frames by. */
function inside(box: Box, at: readonly [number, number]): boolean {
  return at[0] >= box[0] && at[0] <= box[2] && at[1] >= box[1] && at[1] <= box[3];
}
