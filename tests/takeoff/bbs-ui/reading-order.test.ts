/**
 * I-354 (a) — the bill of bars is answered in the order a bar schedule is READ: member by member from
 * the bottom of the building up, bar by bar inside each member (docs/design/s-bbs.md §0 I-354, §1's
 * wireframe — GF first; L-REG-04, "the one order a bill is read in").
 *
 * The door sorted by the bar's key alone, which is opaque, and the vision re-look read the grid's
 * members as 5F, 2F, 1F, 3F, GF, 6F, 4F, 5F … — a reader could not find a column's bars. What is
 * graded here is the door's own comparator, `readingOrder`, over the stack it is handed: the ORDINAL
 * orders a storey and never its label (L-MEA-07), the catalogue's roster orders a class, a mark reads
 * in natural order, a member's bars stay together, and the order is total.
 *
 * The bars are built with the product's own key grammar (`barRowKeyOf`), so a key here is the key the
 * store holds. Nothing here opens a database and nothing here measures time (AM-10 §3).
 */
import { describe, expect, test } from "vitest";
import { barRowKeyOf, type BarRow } from "@/modules/takeoff/rebar/bars";
import { readingOrder } from "@/modules/takeoff/rebar/store";

/** A live stack whose ordinals are NOT the labels' string order: `GF` < `1F` < … < `10F` < `ROOF`. */
const STACK = [
  { label: "10F", ordinal: 10 },
  { label: "1F", ordinal: 1 },
  { label: "2F", ordinal: 2 },
  { label: "5F", ordinal: 5 },
  { label: "GF", ordinal: 0 },
  { label: "ROOF", ordinal: 11 },
] as const;

/** One stored bar row, as far as the reading order reads one — the figures are not its business. */
function aBar(member: { objectKey: string; class: BarRow["class"]; level: string | null; mark: string }, role: BarRow["role"], diameterMm: number, sequence: number): BarRow {
  return {
    barKey: barRowKeyOf({ objectKey: member.objectKey, role, diameterMm, sequence }),
    objectKey: member.objectKey,
    class: member.class,
    level: member.level,
    mark: member.mark,
    barMark: `${member.mark}-${role === "MAIN" ? "v" : "t"}${sequence}`,
    role,
    diameterMm,
    shape: "00",
    dimsMm: {},
    cuttingRawMm: "0",
    cuttingRoundedMm: "0",
    cuttingIsAdditiveMm: "0",
    piecesPerBar: 1,
    lapMm: "0",
    lapsPerBar: 0,
    barsPerUnit: 1,
    parentCount: "1",
    bars: "1",
    kgPerMetre: "0",
    kgNet: "0",
    kgLap: "0",
    kg: "0",
    sourceKeys: [],
    detailingSourceKeys: [],
    editionDigest: "e",
    semantic: "s",
  };
}

/** A member: its key, its class, where it stands and what it is marked. */
const member = (objectKey: string, klass: BarRow["class"], level: string | null, mark: string) => ({ objectKey, class: klass, level, mark });

/** Every member's bars, a main bar and a tie each. */
function barsOf(...members: ReturnType<typeof member>[]): BarRow[] {
  return members.flatMap((one) => [aBar(one, "TIE", 8, 0), aBar(one, "MAIN", 16, 0)]);
}

/** The rows in a scrambled order: reversed, so no case passes by arriving already sorted. */
const scrambled = (rows: readonly BarRow[]): BarRow[] => [...rows].reverse();

describe("I-354: the bill of bars reads from the bottom of the building up", () => {
  test("storeys stand by the stack's ORDINAL — never by their labels, where GF sorts after 5F and 10F before 2F", () => {
    const rows = barsOf(member("k:5F", "column", "5F", "C1"), member("k:2F", "column", "2F", "C1"), member("k:GF", "column", "GF", "C1"), member("k:10F", "column", "10F", "C1"), member("k:1F", "column", "1F", "C1"), member("k:ROOF", "column", "ROOF", "C1"));
    const read = scrambled(rows).sort(readingOrder(STACK));
    expect([...new Set(read.map((row) => row.level))]).toEqual(["GF", "1F", "2F", "5F", "10F", "ROOF"]);
  });

  test("a member on no level of the stack — the foundation's slot — stands first, and a label the stack no longer holds stands last", () => {
    const rows = barsOf(member("k:gone", "column", "MEZZ", "C1"), member("k:GF", "column", "GF", "C1"), member("k:fdn", "column", null, "C1"));
    const read = scrambled(rows).sort(readingOrder(STACK));
    expect([...new Set(read.map((row) => row.level))]).toEqual([null, "GF", "MEZZ"]);
  });

  test("within a storey: the class by the catalogue's roster, then the mark in natural order — C2 before C10", () => {
    const rows = barsOf(member("k:w1", "shear_wall", "GF", "SW1"), member("k:c10", "column", "GF", "C10"), member("k:c2", "column", "GF", "C2"), member("k:c1", "column", "GF", "C1"));
    const read = scrambled(rows).sort(readingOrder(STACK));
    expect([...new Set(read.map((row) => row.mark))]).toEqual(["C1", "C2", "C10", "SW1"]);
  });

  test("every member's bars stand together, main bars before ties, and members of one mark by their own key", () => {
    const rows = barsOf(member("k:b", "column", "GF", "C1"), member("k:a", "column", "GF", "C1"));
    const read = scrambled(rows).sort(readingOrder(STACK));
    expect(read.map((row) => `${row.objectKey} ${row.role}`)).toEqual(["k:a MAIN", "k:a TIE", "k:b MAIN", "k:b TIE"]);
  });

  test("inside a member and a role, diameters read as the numbers they are — 8 before 16, never '16' before '8'", () => {
    const one = member("k:a", "column", "GF", "C1");
    const rows = [aBar(one, "MAIN", 16, 0), aBar(one, "MAIN", 8, 1), aBar(one, "MAIN", 20, 2)];
    expect(scrambled(rows).sort(readingOrder(STACK)).map((row) => row.diameterMm)).toEqual([8, 16, 20]);
  });

  test("the order is total: any arrival order reads as one document (L-REG-04)", () => {
    const rows = barsOf(member("k:5F", "column", "5F", "C1"), member("k:GF", "column", "GF", "C2"), member("k:GF1", "column", "GF", "C1"), member("k:fdn", "column", null, "C1"));
    const once = [...rows].sort(readingOrder(STACK)).map((row) => row.barKey);
    const again = scrambled(rows).sort(readingOrder(STACK)).map((row) => row.barKey);
    const rotated = [...rows.slice(3), ...rows.slice(0, 3)].sort(readingOrder(STACK)).map((row) => row.barKey);
    expect(again).toEqual(once);
    expect(rotated).toEqual(once);
    expect(new Set(once).size, "and no row is lost or doubled").toBe(rows.length);
  });
});
