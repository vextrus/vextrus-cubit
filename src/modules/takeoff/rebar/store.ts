// The bill of bars, stored and read back: the ONE door a campaign's bar rows go through.
//
// The rows are content-keyed (L-REG-04), so a campaign's bill is REPLACED whole on every
// measurement — delete, then insert, in one transaction. That is why `bar_rows` grants DELETE and
// INSERT and no UPDATE: an unchanged campaign re-measures to the identical key multiset and the
// identical content, and a changed one is simply the new bill. Nothing is amended in place.
//
// Every figure the document totals is summed from the UNROUNDED row figures and rounded nowhere: a
// figure is rounded once, where it is printed (L-QTY-05, B-07).
import { and, barRows, eq, forTenant } from "@/core/db";
import { writeInBatches } from "@/core/db/batch";
import { isShapeCode, type ShapeCode } from "@/core/rulesets/methods/rebar/bs8666";
import { cuttingStockOf, stockSplitOf, type CuttingStockAnswer } from "@/core/rulesets/methods/rebar/stock";
import { exact } from "@/core/units/canon";
import type { BarRow } from "./bars";
import { REBAR_EDITION } from "./bars";

/** Which campaign's bill of bars, over which pinned revision, in which tenant's data (SEAM-TENANT). */
export type BarRowScope = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly campaignId: string;
  readonly setRevisionId: string;
};

/** Which campaign's bill of bars a reader is asking for. */
export type BbsScope = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly campaignId: string;
};

/**
 * One campaign's bill of bars as a reader reads it: every row, the totals by diameter and by mark,
 * and what the cutting stock comes to for each diameter.
 *
 * The stock bar and the rounding are stated ON the document because a schedule that does not say
 * what it was cut from says nothing a buyer can check (AM-01, L-FRM-05).
 */
export type BbsDocument = {
  readonly campaignId: string;
  readonly stockMm: string;
  readonly roundingMm: number;
  readonly rows: readonly BarRow[];
  readonly perDiameterKg: Readonly<Record<string, string>>;
  readonly perMarkKg: Readonly<Record<string, string>>;
  readonly cuttingStock: Readonly<Record<string, CuttingStockAnswer>>;
  readonly grandTotalKg: string;
};

/**
 * The shape a row stands under, as the store's own closed roster spells it. A synthesised row always
 * carries one of `SHAPE_CODES` — the guard is here so the column's closed type is reached by reading
 * the roster rather than by asserting past it (B-19).
 */
function asShape(value: string): ShapeCode {
  if (!isShapeCode(value)) throw new Error(`bar row shape ${value} stands in no BS 8666 shape this tree holds`);
  return value;
}

/** The one rounded surface BS 8666 admits: up to the next 25 mm, and nowhere else (AM-01). */
const ROUNDING_MM = 25;

/**
 * Replace a campaign's bill of bars with the rows just synthesised.
 *
 * The delete and the insert are one transaction, so a reader never sees half a bill; and because the
 * keys are content-derived, re-measuring an unchanged campaign writes back what it took away
 * (L-REG-04). A campaign with no bars at all clears its rows and stores none — an empty bill is a
 * statement, not an absence of one.
 */
export async function writeBarRows(scope: BarRowScope, rows: readonly BarRow[]): Promise<number> {
  const values = rows.map((row) => ({
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    campaignId: scope.campaignId,
    setRevisionId: scope.setRevisionId,
    objectKey: row.objectKey,
    barKey: row.barKey,
    class: row.class,
    level: row.level,
    mark: row.mark,
    barMark: row.barMark,
    role: row.role,
    diameterMm: row.diameterMm,
    shape: asShape(row.shape),
    dimsMm: { ...row.dimsMm },
    cuttingRawMm: row.cuttingRawMm,
    cuttingRoundedMm: row.cuttingRoundedMm,
    cuttingIsAdditiveMm: row.cuttingIsAdditiveMm,
    piecesPerBar: row.piecesPerBar,
    lapMm: row.lapMm,
    lapsPerBar: row.lapsPerBar,
    barsPerUnit: row.barsPerUnit,
    parentCount: row.parentCount,
    bars: row.bars,
    kgPerMetre: row.kgPerMetre,
    kgNet: row.kgNet,
    kgLap: row.kgLap,
    kg: row.kg,
    sourceKeys: [...row.sourceKeys],
    detailingSourceKeys: [...row.detailingSourceKeys],
    editionDigest: row.editionDigest,
    semantic: row.semantic,
  }));
  await forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    await tx.delete(barRows).where(and(eq(barRows.tenantId, scope.tenantId), eq(barRows.campaignId, scope.campaignId)));
    await writeInBatches(values, (chunk) => tx.insert(barRows).values([...chunk]));
  });
  return values.length;
}

/**
 * A campaign's bill of bars, read back through the one door (L-FRM-05, R-TO-032).
 *
 * The totals are derived here rather than stored, because a total is a VIEW of the rows and a stored
 * copy of it is a second home for the same fact (B-17). The cutting stock is the stock method's own
 * packing over the rounded piece lengths — this file packs nothing itself.
 */
export async function bbsOf(scope: BbsScope): Promise<BbsDocument> {
  const stored = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select()
      .from(barRows)
      .where(and(eq(barRows.tenantId, scope.tenantId), eq(barRows.campaignId, scope.campaignId))),
  );
  const rows: BarRow[] = stored.map((row) => ({
    barKey: row.barKey,
    objectKey: row.objectKey,
    class: row.class,
    level: row.level,
    mark: row.mark,
    barMark: row.barMark,
    role: row.role,
    diameterMm: row.diameterMm,
    shape: row.shape,
    dimsMm: row.dimsMm,
    cuttingRawMm: row.cuttingRawMm,
    cuttingRoundedMm: row.cuttingRoundedMm,
    cuttingIsAdditiveMm: row.cuttingIsAdditiveMm,
    piecesPerBar: row.piecesPerBar,
    lapMm: row.lapMm,
    lapsPerBar: row.lapsPerBar,
    barsPerUnit: row.barsPerUnit,
    parentCount: row.parentCount,
    bars: row.bars,
    kgPerMetre: row.kgPerMetre,
    kgNet: row.kgNet,
    kgLap: row.kgLap,
    kg: row.kg,
    sourceKeys: row.sourceKeys,
    detailingSourceKeys: row.detailingSourceKeys,
    editionDigest: row.editionDigest,
    semantic: row.semantic,
  }));
  // The order a bill is read in is the bill's own: the member, then the role, then the bar's key —
  // the store has no insertion order to hand back, and a document that shuffled would not be the
  // same document twice (L-REG-04).
  rows.sort((one, other) => (one.barKey < other.barKey ? -1 : one.barKey > other.barKey ? 1 : 0));

  const perDiameterKg: Record<string, string> = {};
  const perMarkKg: Record<string, string> = {};
  let grand = exact(0);
  for (const row of rows) {
    const diameter = String(row.diameterMm);
    perDiameterKg[diameter] = exact(perDiameterKg[diameter] ?? 0).add(exact(row.kg)).toString();
    perMarkKg[row.barMark] = exact(perMarkKg[row.barMark] ?? 0).add(exact(row.kg)).toString();
    grand = grand.add(exact(row.kg));
  }
  // What is packed onto a stock bar is what a site CUTS, and a spliced bar is never cut at its own
  // length: a 22 m pile bar leaves the yard as two pieces of the split's own length, and packing the
  // 22 m would ask for a stock bar nobody sells (AM-03(e)). The split is asked for it here rather
  // than recomputed — `stockSplitOf` is the one home of how a bar comes out of stock (B-17).
  const stockMm = String(REBAR_EDITION.STOCK_BAR_MM);
  const pieces = rows.map((row) => {
    const split = stockSplitOf({ lengthMm: row.cuttingRawMm, lapMm: row.lapMm, stockMm });
    return {
      diameterMm: row.diameterMm,
      roundedMm: split.ok ? split.pieceRoundedMm : row.cuttingRoundedMm,
      count: Number(row.bars) * row.piecesPerBar,
    };
  });
  return {
    campaignId: scope.campaignId,
    stockMm: String(REBAR_EDITION.STOCK_BAR_MM),
    roundingMm: ROUNDING_MM,
    rows,
    perDiameterKg,
    perMarkKg,
    cuttingStock: cuttingStockOf(pieces, String(REBAR_EDITION.STOCK_BAR_MM)),
    grandTotalKg: grand.toString(),
  };
}
