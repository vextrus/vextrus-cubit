// Stock: how a bar longer than the mill length is cut, and how the cut pieces are taken off stock
// bars (L-FRM-05's 12,000 mm stock, R-TO-032's cutting lists and cutting-stock).
//
// Two questions, kept apart because they are answered at different moments. `stockSplitOf` is about
// ONE bar: a 15 m vertical is not a 15 m bar, it is n pieces lapped together, and the laps it needs
// are BILLABLE bar-in-place (L-BD-02) rather than a percentage. `cuttingStockOf` is about the whole
// campaign: the rounded pieces, packed onto stock bars first-fit-decreasing, which is what a site
// orders against.

import { exact } from "../../../units/canon";
import type { RefusalCode } from "../../../errors";
import type { ResolverMethod } from "../law";
import { roundedCuttingLengthOf } from "./bs8666";

/** How one bar is got out of stock, or the code that says the ask is not answerable. */
export type StockSplit =
  | { readonly ok: true; readonly pieces: number; readonly billableMm: string; readonly pieceRoundedMm: string }
  | { readonly ok: false; readonly code: RefusalCode };

/** What a caller asks about one bar: the length it needs, the lap it laps at, and the stock bar. */
export type StockProbe = {
  readonly lengthMm: string;
  readonly lapMm: string;
  readonly stockMm: string;
};

/**
 * How many pieces one bar is cut in, what length is BILLED for it, and what each piece is cut at.
 *
 * A bar within the stock bar is one piece and bills its own length. A longer one is lapped: each
 * joint after the first costs a lap, so n pieces reach L only if n·stock − (n−1)·lap ≥ L, which is
 * the ceiling below. The billable length is L + (n−1)·lap — the laps are steel in place, billed as
 * their own component beside the net (AM-03(a)), never a percentage added to it.
 *
 * A lap at or beyond the stock bar buys no length at all, and no number of pieces reaches L: that is
 * a detail nobody can build, and it is answered rather than looped over.
 */
export function stockSplitOf(probe: StockProbe): StockSplit {
  const length = exact(probe.lengthMm);
  const lap = exact(probe.lapMm);
  const stock = exact(probe.stockMm);
  if (length.lte(stock)) return { ok: true, pieces: 1, billableMm: length.toString(), pieceRoundedMm: roundedCuttingLengthOf(length.toString()) };
  if (lap.gte(stock)) return { ok: false, code: "REBAR_SCHEDULE_UNREAD" };
  const pieces = length.sub(lap).div(stock.sub(lap)).ceil().toNumber();
  const billable = length.add(lap.mul(exact(pieces - 1)));
  // Split bars are cut as EQUAL pieces: the billable length shared out, each piece rounded once.
  return { ok: true, pieces, billableMm: billable.toString(), pieceRoundedMm: roundedCuttingLengthOf(billable.div(exact(pieces)).toString()) };
}

/** One cut piece, as the cutting-stock packing sees it: a length, a diameter, and how many of it. */
export type CutPiece = {
  readonly diameterMm: number;
  readonly roundedMm: string;
  readonly count: number;
};

/** What one diameter's stock comes to: the bars ordered, the pieces cut, and the offcut left. */
export type CuttingStockAnswer = {
  readonly stockBars: number;
  readonly pieces: number;
  readonly offcutMm: string;
  readonly method: string;
};

/** How the pieces were packed, recorded on every answer so a reader knows what produced it. */
const METHOD = "first-fit-decreasing over rounded cutting lengths, 12 m stock, longest first (L-FRM-05)";

/**
 * The cutting-stock result per diameter: first-fit-decreasing over the ROUNDED piece lengths.
 *
 * Longest first, because a long piece that finds no bin later wastes a whole bar. Each group of
 * identical lengths fills the open bins in the order they were opened, taking as many as each will
 * hold, and then opens new bars for whatever is left — a new bar of length L holds ⌊stock/L⌋ of it.
 * The offcut is what the open bins still have room for and nothing will be cut from.
 *
 * It is a heuristic and says so: cutting stock is NP-hard, and a site orders against a plan it can
 * follow rather than an optimum it cannot check.
 */
export function cuttingStockOf(pieces: readonly CutPiece[], stockMm: string): Record<string, CuttingStockAnswer> {
  const byDiameter = new Map<number, CutPiece[]>();
  for (const piece of pieces) byDiameter.set(piece.diameterMm, [...(byDiameter.get(piece.diameterMm) ?? []), piece]);

  const answered: Record<string, CuttingStockAnswer> = {};
  for (const [diameterMm, held] of [...byDiameter.entries()].sort(([left], [right]) => left - right)) {
    const grouped = new Map<string, number>();
    for (const piece of held) grouped.set(piece.roundedMm, (grouped.get(piece.roundedMm) ?? 0) + piece.count);

    const bins: ReturnType<typeof exact>[] = [];
    let cut = 0;
    const stock = exact(stockMm);
    for (const [lengthMm, wanted] of [...grouped.entries()].sort(([left], [right]) => exact(right).cmp(exact(left)))) {
      const length = exact(lengthMm);
      let left = wanted;
      cut += wanted;
      for (let at = 0; at < bins.length && left > 0; at += 1) {
        const capacity = bins[at] as ReturnType<typeof exact>;
        const fits = Math.min(left, capacity.div(length).floor().toNumber());
        if (fits <= 0) continue;
        bins[at] = capacity.sub(length.mul(exact(fits)));
        left -= fits;
      }
      const perBar = stock.div(length).floor().toNumber();
      while (left > 0) {
        const takes = Math.min(left, perBar);
        bins.push(stock.sub(length.mul(exact(takes))));
        left -= takes;
      }
    }
    let offcut = exact(0);
    for (const capacity of bins) offcut = offcut.add(capacity);
    answered[String(diameterMm)] = { stockBars: bins.length, pieces: cut, offcutMm: offcut.toString(), method: METHOD };
  }
  return answered;
}

/** The pair that cuts a campaign's bars out of stock (L-MEA-01). */
export const REBAR_STOCK: ResolverMethod = Object.freeze({
  role: "resolver",
  ruleId: "rcc.rebar.stock",
  version: "1",
  resolve: (pieces: readonly CutPiece[], stockMm: string): Record<string, CuttingStockAnswer> => cuttingStockOf(pieces, stockMm),
});
