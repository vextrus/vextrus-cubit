// The order the takeoff lane READS its marks and its bands in (s-schedules I-sch-1(c), I-353;
// s-bbs I-354). Presentation, and nothing else: what a family, a band or a bar row SAYS is its
// store's, and an order never moves a figure. A leaf file with no import at all, so the schedules
// screen's reading and the bar schedule's door ask one comparison rather than keeping two (B-17).

/**
 * The natural order of marks: a run of digits in a mark compares as the number it is, every other
 * run as text — RB2 before RB10, C2 before C10. Written out on the text rather than through a
 * collator, because the format seam is this tree's one caller of `Intl` (LAW-FMT) and a mark is not
 * a figure to format. Two marks that tie on every run but differ in length order the shorter first,
 * so the order is total.
 */
export const MARK_ORDER = Object.freeze({
  compare(left: string, right: string): number {
    const runs = (mark: string): string[] => mark.match(/\d+|\D+/g) ?? [];
    const one = runs(left);
    const other = runs(right);
    for (let at = 0; at < Math.min(one.length, other.length); at += 1) {
      const a = one[at] as string;
      const b = other[at] as string;
      const numeric = /^\d/.test(a) && /^\d/.test(b);
      const order = numeric ? Number(a) - Number(b) || a.length - b.length : a < b ? -1 : a > b ? 1 : 0;
      if (order !== 0) return order;
    }
    return one.length - other.length;
  },
});

/**
 * Where one end of a schedule's band stands, bottom to top, as the notation grammar SPELLS it once it
 * has read the band (`parseFloorZone`): the named levels folded to `FDN`, `BSMT`, `GF`, `MEZZ` and
 * `ROOF`, the counted ones kept as the drawing wrote them (`3RD`, `5F`), and a building's own label
 * (`SRR`) kept verbatim.
 *
 * The rank is the vertical order a reader walks a column schedule in — the foundation, the basement,
 * the ground, the mezzanine, the counted floors, the roof — and a label no reading places stands
 * above the roof, where F-RCC6-BNBC's `ROOF-SRR` puts its stair-roof room; ties inside one rank are
 * broken by the caller. It places nothing on the building: where a
 * band's floors physically stand is the project's level stack's answer (L-MEA-07), and this is only
 * the order the drawing's own words are listed in (I-353).
 */
const NAMED_RANK: Readonly<Record<string, number>> = Object.freeze({ FDN: -2, BSMT: -1, GF: 0, MEZZ: 0.5 });

/** A counted floor, in either spelling the grammar keeps: `3RD`, `5TH`, `5F`. */
const COUNTED = /^(\d+)(?:ST|ND|RD|TH|F)$/;

/** The roof stands above every counted floor, and an unplaced label above the roof. */
const ROOF_RANK = Number.MAX_SAFE_INTEGER - 1;
const LABEL_RANK = Number.MAX_SAFE_INTEGER;

/** The rank one end of a band stands at (see `NAMED_RANK`). */
export function storeyRankOf(level: string): number {
  const named = NAMED_RANK[level];
  if (named !== undefined) return named;
  if (level === "ROOF") return ROOF_RANK;
  const counted = COUNTED.exec(level);
  return counted === null ? LABEL_RANK : Number(counted[1]);
}

/** What a variant's band is read by: its two ends as the grammar spelled them, and its words. */
export type BandedVariant = { readonly bandFrom: string | null; readonly bandTo: string | null; readonly bandText: string };

/**
 * A family's variants in the order a quantity surveyor reads a column schedule — from the ground up
 * (I-353). A banded variant ranks by where its band STARTS, then where it ends, then by its words in
 * natural order; a variant whose schedule states no band of floors at all (a beam schedule's) stands
 * after every banded one, in the store's own order. A copy: the store's list is never moved.
 */
export function variantsInStoreyOrder<V extends BandedVariant>(variants: readonly V[]): V[] {
  const rank = (end: string | null): number => (end === null ? LABEL_RANK : storeyRankOf(end));
  return variants
    .map((variant, at) => ({ variant, at }))
    .sort((left, right) => {
      const one = left.variant;
      const other = right.variant;
      const banded = Number(one.bandFrom === null) - Number(other.bandFrom === null);
      if (banded !== 0) return banded;
      if (one.bandFrom === null || other.bandFrom === null) return left.at - right.at;
      return (
        rank(one.bandFrom) - rank(other.bandFrom) ||
        rank(one.bandTo) - rank(other.bandTo) ||
        MARK_ORDER.compare(one.bandText, other.bandText) ||
        left.at - right.at
      );
    })
    .map(({ variant }) => variant);
}
