/**
 * I-534 — the bill of bars states each mark ONCE per floor, with its number of members (the owner's
 * ruling Q3, BS 8666; docs/design/s-bbs.md §0). What is graded here is the door's own grouping,
 * `scheduleOf`, which `bbsOf` answers its lines through.
 *
 * Over F-RCC6-BNBC's whole golden roster — never a frozen list: every member is counted once and only
 * once, a line counts only members of its own floor, class and mark, a line's count and masses are its
 * members' stored figures summed exactly, the schedule's totals are the bill's totals, no two entries
 * of one mark on one floor hold the same bars, and a member alone is its stored rows verbatim. Then
 * the three cases the golden cannot reach: two members whose bars match but were read off different
 * cells stand as two entries (a line cites what it was read from, L-QTY-03), two floors never merge,
 * and a member whose bars differ is its own entry.
 *
 * EVERY EXPECTATION IS DERIVED FROM THE FIXTURE (B-19). Nothing here opens a database and nothing
 * here measures time (AM-10 §3).
 */
import { describe, expect, test } from "vitest";
import { exact } from "@/core/units/canon";
import { barRowKeyOf, type BarRow } from "@/modules/takeoff/rebar/bars";
import { scheduleOf, type BbsLine } from "@/modules/takeoff/rebar/store";
import { bbsGoldenDocument, type BbsGoldenRow } from "../../golden/support/golden-fixture";
import { BBS_FIXTURE } from "./support/golden-document";

/** A golden row as the store holds a bar row: renamed field for field, and nothing reckoned. */
function storedOf(row: BbsGoldenRow, sequence: number): BarRow {
  return {
    barKey: barRowKeyOf({ objectKey: row.member, role: row.role as BarRow["role"], diameterMm: row.dia_mm, sequence }),
    objectKey: row.member,
    class: row.class as BarRow["class"],
    level: row.level,
    mark: row.mark,
    barMark: row.bar_mark,
    role: row.role as BarRow["role"],
    diameterMm: row.dia_mm,
    shape: row.shape,
    dimsMm: row.dims_mm,
    cuttingRawMm: row.cutting_raw_mm,
    cuttingRoundedMm: row.cutting_rounded_mm,
    cuttingIsAdditiveMm: row.cutting_is_additive_mm,
    piecesPerBar: row.pieces_per_bar,
    lapMm: row.lap_mm,
    lapsPerBar: row.laps_per_bar,
    barsPerUnit: row.bars_per_unit,
    parentCount: row.parent_count,
    bars: row.bars,
    // The golden records no rate, no citation and no edition: one for all of them, so the evidence
    // the grouping reads is the same for every member and only the BARS decide.
    kgPerMetre: "0",
    kgNet: row.kg_net,
    kgLap: row.kg_lap,
    kg: row.kg,
    sourceKeys: [],
    detailingSourceKeys: [],
    editionDigest: "golden",
    semantic: `${row.member}|${String(sequence)}`,
  };
}

/** The golden roster as the store would hold it, in the file's own order (members stand together). */
const stored: readonly BarRow[] = bbsGoldenDocument(BBS_FIXTURE).rows.map((row, at) => storedOf(row, at));

/** Each member's own stored rows, in the order they were handed. */
function rowsByMember(rows: readonly BarRow[]): Map<string, BarRow[]> {
  const byMember = new Map<string, BarRow[]>();
  for (const row of rows) byMember.set(row.objectKey, [...(byMember.get(row.objectKey) ?? []), row]);
  return byMember;
}

/** The entries of a schedule: its lines gathered under the entry each belongs to (its first member). */
function entriesOf(lines: readonly BbsLine[]): Map<string, BbsLine[]> {
  const byEntry = new Map<string, BbsLine[]>();
  for (const line of lines) byEntry.set(line.objectKey, [...(byEntry.get(line.objectKey) ?? []), line]);
  return byEntry;
}

/** A bar as a site cuts it and a schedule bills it — every field but whose it is. */
function barFacts(row: BarRow): string {
  return JSON.stringify([
    row.barMark,
    row.role,
    row.diameterMm,
    row.shape,
    Object.entries(row.dimsMm).sort(([one], [other]) => (one < other ? -1 : one > other ? 1 : 0)),
    row.cuttingRawMm,
    row.cuttingRoundedMm,
    row.cuttingIsAdditiveMm,
    row.piecesPerBar,
    row.lapMm,
    row.lapsPerBar,
    row.barsPerUnit,
    row.kgPerMetre,
    row.kgNet,
    row.kgLap,
    row.kg,
    row.sourceKeys,
    row.detailingSourceKeys,
    row.editionDigest,
  ]);
}

/** The first few disagreements, so a failure names members rather than printing a thousand. */
const firstFew = (wrong: readonly string[]): string[] => wrong.slice(0, 4);

/** An exact sum of decimal strings, as the door sums them. */
const sum = (values: readonly string[]): string => values.reduce((total, value) => total.add(exact(value)), exact(0)).toString();

describe("I-534: each mark is stated once per floor, with its number of members", () => {
  const lines = scheduleOf(stored);
  const members = rowsByMember(stored);

  test("the golden roster groups: fewer lines than stored rows, and a line that counts more than one member", () => {
    expect(stored.length, `fixtures/${BBS_FIXTURE}/bbs.golden.json carries a roster to group (AM-01)`).toBeGreaterThan(0);
    expect(lines.length, "a schedule of identical members states each of their bars once, so it holds fewer lines than the store holds rows").toBeLessThan(stored.length);
    expect(Math.max(...lines.map((line) => line.members.length)), "and at least one mark stands on a floor more than once with the same bars").toBeGreaterThan(1);
  });

  test("every member is counted by exactly one entry, and an entry counts only members of its own floor, class and mark", () => {
    const counted = new Map<string, number>();
    const wrong: string[] = [];
    for (const [entry, held] of entriesOf(lines)) {
      const first = held[0] as BbsLine;
      expect(first.members[0], `${entry}: an entry is named by its first member`).toBe(entry);
      for (const line of held) {
        if (JSON.stringify(line.members) !== JSON.stringify(first.members)) wrong.push(`${entry}: ${line.barMark} counts ${line.members.join(", ")} where its entry counts ${first.members.join(", ")}`);
      }
      for (const member of first.members) {
        counted.set(member, (counted.get(member) ?? 0) + 1);
        const own = members.get(member)?.[0];
        if (own === undefined) wrong.push(`${entry} counts ${member}, which the bill holds no row for`);
        else if (own.level !== first.level || own.class !== first.class || own.mark !== first.mark) {
          wrong.push(`${entry} (${String(first.level)} ${first.class} ${first.mark}) counts ${member}, which stands at ${String(own.level)} ${own.class} ${own.mark}`);
        }
      }
    }
    expect(firstFew(wrong), `an entry is one mark on one floor — ${wrong.length} do not`).toEqual([]);
    expect([...members.keys()].filter((member) => counted.get(member) !== 1), "and every member the bill holds is counted by exactly one entry").toEqual([]);
  });

  test("a line's count and masses are its members' own stored figures, summed exactly — never rounded", () => {
    const wrong: string[] = [];
    for (const [entry, held] of entriesOf(lines)) {
      held.forEach((line, at) => {
        const own = line.members.map((member) => members.get(member)?.[at] as BarRow);
        if (own.some((row) => row === undefined || barFacts(row) !== barFacts(own[0] as BarRow))) {
          wrong.push(`${entry} line ${at} (${line.barMark}): its members do not hold the same bar at that place`);
          return;
        }
        const owed = {
          parentCount: sum(own.map((row) => row.parentCount)),
          bars: sum(own.map((row) => row.bars)),
          kgNet: sum(own.map((row) => row.kgNet)),
          kgLap: sum(own.map((row) => row.kgLap)),
          kg: sum(own.map((row) => row.kg)),
        };
        const said = { parentCount: line.parentCount, bars: line.bars, kgNet: line.kgNet, kgLap: line.kgLap, kg: line.kg };
        const exactly = Object.entries(owed).every(([field, value]) => exact(said[field as keyof typeof said]).eq(exact(value)));
        if (!exactly) wrong.push(`${entry} ${line.barMark}: states ${JSON.stringify(said)} where its ${String(own.length)} member(s) sum to ${JSON.stringify(owed)}`);
        // The rail writes every row at one member (`parentCount` 1), so a line of such rows counts
        // exactly the members it names; the golden also carries rows already counted over parents
        // (a lintel mark over its openings), which the sum above carries as they were stated.
        if (own.every((row) => row.parentCount === "1") && !exact(line.parentCount).eq(exact(line.members.length))) {
          wrong.push(`${entry} ${line.barMark}: counts ${line.parentCount} members and names ${String(line.members.length)}`);
        }
        if (!exact(line.bars).eq(exact(line.barsPerUnit).mul(exact(line.parentCount)))) wrong.push(`${entry} ${line.barMark}: ${line.bars} bars is not ${String(line.barsPerUnit)} in each × ${line.parentCount} members (BS 8666)`);
        if (barFacts(line) !== barFacts(own[0] as BarRow) && line.members.length === 1) wrong.push(`${entry} ${line.barMark}: a member alone is not carried as stored`);
      });
      const first = held[0] as BbsLine;
      if (held.length !== (members.get(first.objectKey)?.length ?? -1)) wrong.push(`${entry}: states ${String(held.length)} lines where its member holds ${String(members.get(first.objectKey)?.length)} bars`);
    }
    expect(firstFew(wrong), `every line is its members' own bars counted — ${wrong.length} are not`).toEqual([]);
  });

  test("the schedule's totals are the bill's: the same mass per diameter and in all, to the last digit", () => {
    const byDiameter = (rows: readonly BarRow[]): Record<string, string> => {
      const totals: Record<string, string[]> = {};
      for (const row of rows) (totals[String(row.diameterMm)] ??= []).push(row.kg);
      return Object.fromEntries(Object.entries(totals).map(([diameter, masses]) => [diameter, exact(sum(masses)).toFixed()]));
    };
    expect(byDiameter(lines), "grouping moves no kilogramme between diameters").toEqual(byDiameter(stored));
    expect(exact(sum(lines.map((line) => line.kg))).eq(exact(sum(stored.map((row) => row.kg)))), "and none in all").toBe(true);
  });

  test("the grouping is whole: no two entries of one mark on one floor hold the same bars", () => {
    const seen = new Map<string, string>();
    const wrong: string[] = [];
    for (const [entry, held] of entriesOf(lines)) {
      const first = held[0] as BbsLine;
      const bars = (members.get(entry) ?? []).map((row) => barFacts(row)).join("\n");
      const key = JSON.stringify([first.level, first.class, first.mark, bars]);
      const twin = seen.get(key);
      if (twin !== undefined) wrong.push(`${entry} and ${twin} are one mark on one floor with the same bars, stated twice`);
      seen.set(key, entry);
    }
    expect(firstFew(wrong), `a mark is stated once per floor for each bar set — ${wrong.length} are stated again`).toEqual([]);
  });

  test("entries stand where their first members stood, and a line's identity is its first member's", () => {
    const firstSeen: string[] = [];
    for (const row of stored) if (!firstSeen.includes(row.objectKey)) firstSeen.push(row.objectKey);
    const entryOrder = [...entriesOf(lines).keys()];
    expect(entryOrder, "the schedule sorts nothing: its entries read in the bill's own order").toEqual(firstSeen.filter((member) => entryOrder.includes(member)));
    const keys = lines.map((line) => line.barKey);
    expect(new Set(keys).size, "and every line keeps a bar key of its own — its first member's").toBe(keys.length);
  });
});

/* ------------------------------------------------------------------------ the cases around it */

/** Two bars of one member: a main bar and its tie, with the evidence each was read off. */
function member(objectKey: string, at: { level: string | null; mark: string; cells: string; barsPerUnit?: number }): BarRow[] {
  const bar = (role: BarRow["role"], diameterMm: number, sequence: number, kg: string): BarRow => ({
    barKey: barRowKeyOf({ objectKey, role, diameterMm, sequence }),
    objectKey,
    class: "column",
    level: at.level,
    mark: at.mark,
    barMark: `${at.mark}-${role === "MAIN" ? "v" : "t"}`,
    role,
    diameterMm,
    shape: role === "MAIN" ? "00" : "51",
    dimsMm: { A: "3048.000" },
    cuttingRawMm: "3048.000",
    cuttingRoundedMm: "3050",
    cuttingIsAdditiveMm: "3048.000",
    piecesPerBar: 1,
    lapMm: role === "MAIN" ? "1000" : "0",
    lapsPerBar: role === "MAIN" ? 1 : 0,
    barsPerUnit: at.barsPerUnit ?? 8,
    parentCount: "1",
    bars: String(at.barsPerUnit ?? 8),
    kgPerMetre: "2.466",
    kgNet: kg,
    kgLap: role === "MAIN" ? "19.728" : "0",
    kg: role === "MAIN" ? exact(kg).add(exact("19.728")).toString() : kg,
    sourceKeys: [`${at.cells}#main`, `${at.cells}#run`],
    detailingSourceKeys: ["notes#lap"],
    editionDigest: "edition",
    semantic: `${objectKey}|${role}`,
  });
  return [bar("MAIN", 20, 0, "60.131328"), bar("TIE", 10, 0, "7.1234565")];
}

describe("I-534: what never merges", () => {
  test("three members of one mark on one floor with the same bars off the same cells are ONE entry of three", () => {
    const rows = [...member("k:a", { level: "1F", mark: "C2", cells: "S-03:C2" }), ...member("k:b", { level: "1F", mark: "C2", cells: "S-03:C2" }), ...member("k:c", { level: "1F", mark: "C2", cells: "S-03:C2" })];
    const lines = scheduleOf(rows);
    expect(lines.map((line) => [line.barMark, line.members, line.parentCount, line.bars])).toEqual([
      ["C2-v", ["k:a", "k:b", "k:c"], "3", "24"],
      ["C2-t", ["k:a", "k:b", "k:c"], "3", "24"],
    ]);
    const main = lines[0] as BbsLine;
    expect([main.kgNet, main.kgLap, main.kg], "the masses are the three members' own, summed exactly — to the seventh decimal the store kept").toEqual(["180.393984", "59.184", "239.577984"]);
    expect((lines[1] as BbsLine).kg, "the tie's mass too, never rounded on the way").toBe("21.3703695");
  });

  test("the same bars read off DIFFERENT cells stand as two entries of the mark — a line cites what it was read from", () => {
    const rows = [...member("k:a", { level: "1F", mark: "C2", cells: "S-03:C2" }), ...member("k:b", { level: "1F", mark: "C2", cells: "S-04:C2" })];
    const lines = scheduleOf(rows);
    expect(lines.map((line) => line.members), "two members, two readings, two entries").toEqual([["k:a"], ["k:a"], ["k:b"], ["k:b"]]);
    expect(lines.map((line) => line.sourceKeys[0]), "each citing its own cell").toEqual(["S-03:C2#main", "S-03:C2#main", "S-04:C2#main", "S-04:C2#main"]);
  });

  test("two floors never merge, and a member whose bars differ is its own entry — in the order the bill read them", () => {
    const rows = [
      ...member("k:gf", { level: "GF", mark: "C2", cells: "S-03:C2" }),
      ...member("k:1a", { level: "1F", mark: "C2", cells: "S-03:C2" }),
      ...member("k:1b", { level: "1F", mark: "C2", cells: "S-03:C2", barsPerUnit: 10 }),
      ...member("k:1c", { level: "1F", mark: "C2", cells: "S-03:C2" }),
    ];
    const lines = scheduleOf(rows);
    expect([...new Set(lines.map((line) => JSON.stringify([line.level, line.members])))]).toEqual([
      JSON.stringify(["GF", ["k:gf"]]),
      JSON.stringify(["1F", ["k:1a", "k:1c"]]),
      JSON.stringify(["1F", ["k:1b"]]),
    ]);
  });

  test("a member alone is its stored rows exactly, strings and all, with its own name beside them", () => {
    const rows = member("k:alone", { level: "2F", mark: "C5", cells: "S-03:C5" });
    const lines = scheduleOf(rows);
    expect(lines).toEqual(rows.map((row) => ({ ...row, members: ["k:alone"] })));
  });
});
