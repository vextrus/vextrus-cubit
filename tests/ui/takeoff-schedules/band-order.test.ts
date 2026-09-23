/**
 * I-353 (a) — a family's bands are listed the way a quantity surveyor reads a column schedule: from
 * the ground up (docs/design/s-schedules.md §0 I-353, I-sch-1(c); R-UI-084's reading order).
 *
 * The store keeps a family's variants in the order its keys sort, which put F-RCC6-BNBC's C1 bands
 * as `3RD & 4TH`, `5TH TO 6TH`, `GF TO 2ND`, `ROOF-SRR` — the ground floor third. The bands here are
 * read by the notation grammar's OWN reader (`parseFloorZone`), never typed as the ends it would
 * return, so the order is proved over the spellings the registry in fact stores (B-17, B-19).
 *
 * Nothing here opens a database and nothing here measures time (AM-10 §3).
 */
import { describe, expect, test } from "vitest";
import { parseFloorZone } from "@/modules/takeoff/partition/notation";
import { MARK_ORDER, storeyRankOf, variantsInStoreyOrder } from "@/modules/takeoff/schedules-ui/order";

/** One variant as the registry stores it: the band's words, and its two ends as the grammar read them. */
function banded(bandText: string): { bandText: string; bandFrom: string | null; bandTo: string | null } {
  const band = parseFloorZone(bandText);
  return { bandText, bandFrom: band?.from ?? null, bandTo: band?.to ?? null };
}

describe("I-353: a family's bands stand from the ground up", () => {
  test("F-RCC6-BNBC's C1 bands, in the store's key order, read GF first and the roof last", () => {
    const stored = ["3RD & 4TH", "5TH TO 6TH", "GF TO 2ND", "ROOF-SRR"].map(banded);
    for (const variant of stored) expect(variant.bandFrom, `the grammar reads a band out of "${variant.bandText}" — the test stands on what the registry stores`).not.toBeNull();

    expect(variantsInStoreyOrder(stored).map((variant) => variant.bandText)).toEqual(["GF TO 2ND", "3RD & 4TH", "5TH TO 6TH", "ROOF-SRR"]);
  });

  test("the two counted spellings rank as one count, and the named levels stand where a building has them", () => {
    const bottomUp = ["FDN", "BSMT", "GF", "MEZZ", "1F", "2ND", "3RD", "9TH", "10F", "ROOF", "SRR"];
    const ranks = bottomUp.map((level) => storeyRankOf(level));
    expect([...ranks].sort((left, right) => left - right), `ranked bottom to top: ${bottomUp.join(" < ")}`).toEqual(ranks);
    expect(new Set(ranks).size, "and no two different storeys share a rank").toBe(ranks.length);
    expect(storeyRankOf("3F"), "3F and 3RD are one storey (the grammar's `sameStorey`)").toBe(storeyRankOf("3RD"));
  });

  test("a band that starts on the same storey orders by where it ends, then by its words", () => {
    const stored = ["GF TO 5TH", "GF", "GF TO 2ND"].map(banded);
    expect(variantsInStoreyOrder(stored).map((variant) => variant.bandText)).toEqual(["GF", "GF TO 2ND", "GF TO 5TH"]);
  });

  test("a variant whose schedule states no band of floors stands after every banded one, in the store's own order", () => {
    const stored = [
      { bandText: "SIZE", bandFrom: null, bandTo: null },
      ...["5TH TO 6TH", "GF TO 2ND"].map(banded),
      { bandText: "DEPTH", bandFrom: null, bandTo: null },
    ];
    expect(variantsInStoreyOrder(stored).map((variant) => variant.bandText)).toEqual(["GF TO 2ND", "5TH TO 6TH", "SIZE", "DEPTH"]);
  });

  test("the order is a copy: the store's own list is never moved", () => {
    const stored = ["ROOF", "GF"].map(banded);
    const before = stored.map((variant) => variant.bandText);
    variantsInStoreyOrder(stored);
    expect(stored.map((variant) => variant.bandText)).toEqual(before);
  });
});

describe("I-353: marks stand in natural order — the one comparison the lane reads marks by", () => {
  test("a run of digits compares as the number it is", () => {
    const marks = ["RB10", "RB2", "C10", "C2", "C1", "RB1"];
    expect([...marks].sort(MARK_ORDER.compare)).toEqual(["C1", "C2", "C10", "RB1", "RB2", "RB10"]);
  });
});
