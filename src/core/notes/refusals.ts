// The refusal the note model answers with, as a constructor (R-SPINE-062, ARCH-03). A refusal is an
// answer rather than a fault (B-21): it carries the registered code, the operator's detail and the
// facts the law says it names, and the person is answered from the closed taxonomy's message and
// remedy through the one renderer.
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";

/** The code this leaf answers with, read off the taxonomy's own union rather than respelled (Q-07). */
const NOTE_SOURCE_NOT_ON_SHEET: RefusalCode = "NOTE_SOURCE_NOT_ON_SHEET";

/**
 * L-CAD-03: a reading is kept only where its evidence is. A reading citing a text entity this sheet
 * does not carry could never be re-read off the drawing, so the act refuses it at the preview —
 * before a Consequence claims a subject nobody could check.
 */
export function noteSourceNotOnSheet(detail: string, facts: { readonly drawingId?: string; readonly layoutName?: string; readonly sourceKey?: string } = {}): Error {
  return refusal(NOTE_SOURCE_NOT_ON_SHEET, detail, facts);
}
