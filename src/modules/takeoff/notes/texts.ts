// The one read of a sheet's own words, as the takeoff lane asks it: every text entity standing on
// one layout of a drawing's current ingest (L-CAD-03, L-CAD-05).
//
// The reading itself is core's (`@/core/notes/texts`), because TRANSCRIBE_SHEET_NOTES checks a
// reading's evidence against the same list and the act seam is core (ARCH-01). This is that reading
// with the app's object store and a transaction around it — the screen and the act see one sheet.
import { forTenant } from "@/core/db";
import type { SheetText } from "@/core/notes/grammar";
import { sheetTextsOn, type SheetTextScope } from "@/core/notes/texts";
import { appStorage } from "@/core/storage/app";

export type { SheetText } from "@/core/notes/grammar";
export type { SheetTextScope } from "@/core/notes/texts";

/** Every text entity of one sheet, in the artifact's own order (test contract: `sheetTextsOf`). */
export async function sheetTextsOf(scope: SheetTextScope, layoutName: string): Promise<SheetText[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => sheetTextsOn(tx, scope, layoutName, { storage: appStorage() }));
}
