// The bill of bars, arranged for reading — and reckoned nowhere (R-TO-054, AM-03(a), I-bbs-2).
//
// THIS FILE COMPUTES NOTHING. Every figure it hands on is a stored decimal of `bbsOf`'s document,
// carried across as the string the door stored it as: no length is re-rounded, no mass is re-summed,
// no total is re-derived. A screen that re-summed would print a figure nobody measured, and the
// third decimal of a campaign's grand total is exactly where that would show (B-17, L-QTY-05).
//
// What it DOES is two arrangements the domain itself states:
//   - a lap is its own row beside the net bar, never a column and never a percentage of it — so a
//     bar that laps yields two rows, and a reader can read net-of-laps and gross-of-laps off the
//     same grid (AM-03(a), L-BD-02, I-bbs-3);
//   - the cutting stock is one line per diameter, in ascending numeric order — 8 before 10, which
//     the keys' own string order would not give (R-TO-054, AM-03(e)).
//
// The figures leave here UNGROUPED. Grouping is SEAM-FORMAT's one home (`formatUserFigure`) and it
// happens in the CELL, so the attribute a machine reads stays the stored decimal (R-UI-083).
import type { BbsDocument } from "@/modules/takeoff/rebar";

/**
 * The fraction length this schedule states each kind of figure at: a length to the thousandth of a
 * millimetre because BS 8666's raw length is, the one rounded surface to the whole millimetre, a
 * mass to the gramme, and a count whole (AM-01, L-FMT-02).
 *
 * The `bbs` document kind states the same four, and states them for the payload it parses. They are
 * mirrored here rather than imported because that file reaches the filesystem to find its template
 * and this one is read by a client component — the same reason `copy.ts` mirrors the string table.
 */
export const BBS_PLACES = Object.freeze({ length: 3, rounded: 0, mass: 3, count: 0 });

/**
 * A stored decimal as this schedule STATES it: the same figure, written to the fraction length the
 * document states that kind of figure at (`BBS_PLACES`).
 *
 * The store keeps whatever fraction the arithmetic that made a figure left behind — a mass out of a
 * division chain, a length out of a ceil — and both the schedule and the document it is printed in
 * state a mass to the gramme and a length to the thousandth. Writing the fraction out to that length
 * is FORMATTING: it is done on the text, digit by digit, so no float ever touches a stored figure and
 * nothing here re-sums, re-rounds or re-derives anything (B-07, L-FMT-02, I-bbs-2). What a row
 * publishes on its `data-*` is still the stored string, untouched.
 */
export function statedAt(value: string, places: number): string {
  const [whole = "", fraction = ""] = value.split(".");
  if (whole === "") return value;
  if (places === 0) return whole;
  return `${whole}.${`${fraction}${"0".repeat(places)}`.slice(0, places)}`;
}

/** Which component of a bar a row stands for: the bar itself, or the lap beside it (AM-03(a)). */
export type BbsComponent = "NET" | "LAP";

/**
 * One row of the grid the workspace draws. A NET row is a stored bar row renamed; a LAP row is the
 * same bar's lap, standing on its own beneath it and carrying the lap's own mass.
 *
 * The three cutting lengths are EMPTY on a LAP row: a lap has no cutting length of its own, and
 * repeating the bar's there would print the one surface BS 8666 rounds twice (I-bbs-3, I-bbs-4).
 */
export type BbsGridRow = {
  /** This row's own identity in the grid — one bar yields at most two, so the component is in it. */
  readonly key: string;
  readonly objectKey: string;
  readonly mark: string;
  readonly class: string;
  readonly level: string | null;
  readonly component: BbsComponent;
  readonly barKey: string;
  readonly barMark: string;
  readonly role: string;
  readonly diameterMm: number;
  readonly shape: string;
  readonly dimsMm: Readonly<Record<string, string>>;
  readonly cuttingRawMm: string;
  readonly cuttingRoundedMm: string;
  readonly cuttingIsAdditiveMm: string;
  readonly piecesPerBar: number;
  readonly bars: string;
  readonly lapMm: string;
  readonly lapsPerBar: number;
  /** The mass this component carries: `kgNet` on a NET row, `kgLap` on a LAP row (AM-03(a)). */
  readonly kg: string;
};

/** One line of the cutting-stock summary: a diameter, its mass, and what a site cuts it from. */
export type BbsSummaryRow = {
  readonly diameterMm: number;
  readonly kg: string;
  readonly stockBars: number;
  readonly pieces: number;
  readonly offcutMm: string;
};

/** The summary beneath the grid, closed by the total the DOOR answered (I-bbs-2). */
export type BbsSummary = {
  readonly rows: readonly BbsSummaryRow[];
  readonly grandTotalKg: string;
  readonly stockMm: string;
  readonly roundingMm: number;
};

/** What a cutting-stock line says where the document packed that diameter; zeroes where it did not. */
const NOTHING_PACKED = Object.freeze({ stockBars: 0, pieces: 0, offcutMm: "0" });

/** A lap's three cutting-length cells: a lap is not cut to a length of its own (I-bbs-3). */
const NO_CUTTING_LENGTH = "";

/**
 * The stored rows in the order the grid draws them: `document.rows`, gathered under the member each
 * belongs to. The members keep the order the document first names them in, and the rows inside a
 * member keep the document's own order — this sorts nothing, because the door already answered in
 * the one order a bill is read in (L-REG-04).
 */
function groupedByMember(document: BbsDocument): BbsDocument["rows"][number][] {
  const byMember = new Map<string, BbsDocument["rows"][number][]>();
  for (const row of document.rows) {
    const held = byMember.get(row.objectKey);
    if (held === undefined) byMember.set(row.objectKey, [row]);
    else held.push(row);
  }
  return [...byMember.values()].flat();
}

/**
 * The grid's rows: one NET row per stored bar row, and — immediately beneath it, and only where the
 * bar in fact laps — one LAP row carrying that lap's own mass (AM-03(a), L-BD-02).
 */
export function bbsRowsOf(document: BbsDocument): readonly BbsGridRow[] {
  const rows: BbsGridRow[] = [];
  for (const bar of groupedByMember(document)) {
    const member = { objectKey: bar.objectKey, mark: bar.mark, class: bar.class as string, level: bar.level };
    rows.push({
      ...member,
      key: `${bar.barKey}|NET`,
      component: "NET",
      barKey: bar.barKey,
      barMark: bar.barMark,
      role: bar.role,
      diameterMm: bar.diameterMm,
      shape: bar.shape,
      dimsMm: bar.dimsMm,
      cuttingRawMm: bar.cuttingRawMm,
      cuttingRoundedMm: bar.cuttingRoundedMm,
      cuttingIsAdditiveMm: bar.cuttingIsAdditiveMm,
      piecesPerBar: bar.piecesPerBar,
      bars: bar.bars,
      lapMm: bar.lapMm,
      lapsPerBar: bar.lapsPerBar,
      // The NET row's mass is the bar's own, LAP EXCLUDED: a net mass that already held its lap
      // would make the pair beneath it a double count (AM-03(a), L-BD-02).
      kg: bar.kgNet,
    });
    if (bar.lapsPerBar <= 0) continue;
    rows.push({
      ...member,
      key: `${bar.barKey}|LAP`,
      component: "LAP",
      barKey: bar.barKey,
      barMark: bar.barMark,
      role: bar.role,
      diameterMm: bar.diameterMm,
      shape: bar.shape,
      dimsMm: bar.dimsMm,
      cuttingRawMm: NO_CUTTING_LENGTH,
      cuttingRoundedMm: NO_CUTTING_LENGTH,
      cuttingIsAdditiveMm: NO_CUTTING_LENGTH,
      piecesPerBar: bar.piecesPerBar,
      // A lap's count is how many laps the bar carries — the Bars cell of a lap row (Decision §1).
      bars: String(bar.lapsPerBar),
      lapMm: bar.lapMm,
      lapsPerBar: bar.lapsPerBar,
      kg: bar.kgLap,
    });
  }
  return rows;
}

/**
 * The cutting-stock summary: one line per diameter the document totals, in ASCENDING NUMERIC order,
 * carrying that diameter's own packing answer and closed by the grand total the door stated.
 *
 * The total is the document's, never a sum made here: a figure is rounded once, where it is printed
 * (L-QTY-05), so a re-summed total and the door's own differ in the last decimal — and the one a
 * reader must be able to check against the bill is the door's (B-17, I-bbs-2).
 */
export function bbsSummaryOf(document: BbsDocument): BbsSummary {
  const rows = Object.keys(document.perDiameterKg)
    .map((diameter) => Number(diameter))
    .sort((left, right) => left - right)
    .map((diameterMm) => {
      const packed = document.cuttingStock[String(diameterMm)] ?? NOTHING_PACKED;
      return {
        diameterMm,
        kg: document.perDiameterKg[String(diameterMm)] ?? "0",
        stockBars: packed.stockBars,
        pieces: packed.pieces,
        offcutMm: packed.offcutMm,
      };
    });
  return { rows, grandTotalKg: document.grandTotalKg, stockMm: document.stockMm, roundingMm: document.roundingMm };
}
