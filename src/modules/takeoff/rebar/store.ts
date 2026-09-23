// The bill of bars, stored and read back: the ONE door a campaign's bar rows go through.
//
// The rows are content-keyed (L-REG-04), so a campaign's bill is REPLACED whole on every
// measurement — delete, then insert, in one transaction. That is why `bar_rows` grants DELETE and
// INSERT and no UPDATE: an unchanged campaign re-measures to the identical key multiset and the
// identical content, and a changed one is simply the new bill. Nothing is amended in place.
//
// Every figure the document totals is summed from the UNROUNDED row figures and rounded nowhere: a
// figure is rounded once, where it is printed (L-QTY-05, B-07).
import { ELEMENT_TYPES } from "@/core/catalogue/classes";
import { and, barRows, eq, forTenant } from "@/core/db";
import { writeInBatches } from "@/core/db/batch";
import { compareCanonical } from "@/core/identity";
import { liveLevelsOf } from "@/core/levels/store";
import { repudiatedObjectsIn } from "@/core/register/store";
import { isShapeCode, type ShapeCode } from "@/core/rulesets/methods/rebar/bs8666";
import { cuttingStockOf, stockSplitOf, type CuttingStockAnswer } from "@/core/rulesets/methods/rebar/stock";
import { BAR_ROLES } from "@/core/rulesets/methods/rebar/synthesis";
import { exact } from "@/core/units/canon";
import { MARK_ORDER } from "@/modules/takeoff/schedules-ui/order";
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

/** One level of the live stack, as the reading order asks it: what it is called, where it stands. */
type StackedLabel = { readonly label: string; readonly ordinal: number };

/** Where a closed roster puts a value; a value the roster does not hold stands after all of it. */
function rosterAt(roster: readonly string[], value: string): number {
  const at = roster.indexOf(value);
  return at < 0 ? roster.length : at;
}

/**
 * The order a bar schedule is READ in (I-354; s-bbs §1's wireframe, GF first; L-REG-04 — the one
 * order a bill is read in): member by member from the bottom of the building up, and bar by bar
 * inside each member. Presentation, and only that — no figure moves, and every row stays the row it
 * was.
 *
 *   1. Where the member stands. A member on NO level of the stack — its register object stands in a
 *      lawful-null slot, which for a member the rail bills is the foundation's (a bar row states no
 *      slot, and an UNRESOLVED one is not told apart without reading the key, which this never
 *      does) — comes first, below every storey; then the levels by the live stack's own ORDINAL,
 *      which is physical (L-MEA-07) — never by label, where `GF` sorts after `5F`; then a label the
 *      live stack no longer holds (an unregistered placeholder's), in natural order, last.
 *   2. What it is — its class in the catalogue's own roster order (`ELEMENT_TYPES`).
 *   3. Its mark, in natural order: C2 before C10 (`MARK_ORDER`, the lane's one spelling of it).
 *   4. Which member of that mark — its object key, which is where the member is placed; the key is
 *      compared whole and never read apart (L-REG-02).
 *   5. Inside the member: the bar's role in BS 8666's own roster order (`BAR_ROLES` — main bars before
 *      ties), then its diameter as the number it is, then its bar mark in natural order, and last its
 *      key, so the order is total and two readings of one bill are one document.
 */
export function readingOrder(stack: readonly StackedLabel[]): (one: BarRow, other: BarRow) => number {
  const ordinalOf = new Map(stack.map((level) => [level.label, level.ordinal]));
  const standing = (level: string | null): readonly [number, number] => {
    if (level === null) return [0, 0];
    const ordinal = ordinalOf.get(level);
    return ordinal === undefined ? [2, 0] : [1, ordinal];
  };
  return (one, other) => {
    const [oneBand, oneOrdinal] = standing(one.level);
    const [otherBand, otherOrdinal] = standing(other.level);
    return (
      oneBand - otherBand ||
      oneOrdinal - otherOrdinal ||
      MARK_ORDER.compare(one.level ?? "", other.level ?? "") ||
      rosterAt(ELEMENT_TYPES, one.class) - rosterAt(ELEMENT_TYPES, other.class) ||
      MARK_ORDER.compare(one.mark, other.mark) ||
      compareCanonical(one.objectKey, other.objectKey) ||
      rosterAt(BAR_ROLES, one.role) - rosterAt(BAR_ROLES, other.role) ||
      one.diameterMm - other.diameterMm ||
      MARK_ORDER.compare(one.barMark, other.barMark) ||
      compareCanonical(one.barKey, other.barKey)
    );
  };
}

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
  // The rows, and the project's live level stack beside them in the SAME transaction — the stack is
  // read for the one question of what order the members stand in, bottom to top (I-354), and a stack
  // read in a second transaction could order one bill by a stack it was never measured against.
  //
  // A member a person has STRUCK is read past (I-173, I-449): its bar rows stay in the store as
  // the measurement left them (L-ACT-01) and no schedule, total or cutting list reads them, because
  // nothing is cut for an object the register itself says is nothing. Which objects stand struck is
  // the register's own answer, asked of each revision the rows were measured under, in this
  // transaction — never a second reckoning beside it.
  const { stored, stack } = await forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const held = await tx
      .select()
      .from(barRows)
      .where(and(eq(barRows.tenantId, scope.tenantId), eq(barRows.campaignId, scope.campaignId)));
    const struck = new Set<string>();
    for (const setRevisionId of new Set(held.map((row) => row.setRevisionId))) {
      for (const row of await repudiatedObjectsIn(tx, { tenantId: scope.tenantId, projectId: scope.projectId, setRevisionId })) struck.add(row.objectKey);
    }
    const live = await liveLevelsOf(tx, { tenantId: scope.tenantId, projectId: scope.projectId });
    return { stored: held.filter((row) => !struck.has(row.objectKey)), stack: live };
  });
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
  // The order a bill is read in is the bill's own, and it is TOTAL — the store has no insertion order
  // to hand back, and a document that shuffled would not be the same document twice (L-REG-04). It
  // was the bar's key alone, which is an opaque key: its members came out 5F, 2F, 1F, 3F, GF … and a
  // reader could not find a column's bars (I-354). It is now the order a bar schedule is read in.
  rows.sort(readingOrder(stack));

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
