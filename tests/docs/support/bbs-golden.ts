/**
 * The bar schedule's golden roster, as this lane reaches it (AM-01).
 *
 * The reading itself belongs to the golden lane's published support — `bbsGoldenDocument()` is the
 * ONE home for "what does `fixtures/<id>/bbs.golden.json` say" (CLAUDE.md: a golden is read through
 * the fixture support, never by a second parser). This module only names the fixture this lane's
 * document is composed from, so the suite beside it asks its own lane for the roster rather than
 * reaching across into another lane's tree.
 */
import { bbsGoldenDocument, type BbsGoldenDocument, type BbsGoldenRow } from "../../golden/support/golden-fixture";

export type { BbsGoldenDocument, BbsGoldenRow };

/** The fixture whose detailing model the schedule is proved against (AM-01, the increment's goal). */
export const BBS_FIXTURE = "rcc6-bnbc";

/** Every golden row of that fixture, in the file's own order. */
export function bbsGoldenRows(fixtureId: string = BBS_FIXTURE): BbsGoldenRow[] {
  return bbsGoldenDocument(fixtureId).rows;
}
