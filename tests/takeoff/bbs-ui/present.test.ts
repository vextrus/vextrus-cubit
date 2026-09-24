/**
 * AC-3 — the presenter over F-RCC6-BNBC's whole golden roster, never a frozen list (R-TO-054,
 * AM-01, AM-03(a)(b)(e), L-FRM-05, R-UI-083, I-bbs-2, I-bbs-3, I-bbs-4).
 *
 * The screen COMPUTES NOTHING. Every figure it shows is a stored string of `bbsOf`'s document, so
 * what this suite grades is a rename and an arrangement: one NET row per stored bar row, its strings
 * carried verbatim; one LAP row beside it wherever the bar laps, carrying the lap's own mass; and a
 * summary that is the door's own totals per diameter, in ascending numeric order, closed by the
 * grand total the door answered — not by a sum this screen made (the two differ in the fixture's own
 * third decimal, which is exactly what a re-summing screen would print).
 *
 * EVERY EXPECTATION IS DERIVED FROM THE FIXTURE. No bar mark, shape, length, count or mass is typed
 * here: the roster is read through `goldenBbsDocument()` and the expectation is built from it row by
 * row, so a fixture that grows grows this suite with it (B-19). Nothing here opens a database and
 * nothing here measures time (AM-10 §3).
 */
import { describe, expect, it } from "vitest";
import { formatUserFigure } from "../../../src/core/format";
import {
  goldenBbsDocument,
  presentModule,
  type BbsDocumentShape,
  type BbsGridRowShape,
  type BarRowShape,
} from "./support/golden-document";

/** The document under the presenter, read once: the roster is four thousand rows. */
const document_: BbsDocumentShape = goldenBbsDocument();

/** The rows the presenter answers, awaited once per process. */
let presenting: Promise<readonly BbsGridRowShape[]> | undefined;
const gridRows = (): Promise<readonly BbsGridRowShape[]> =>
  (presenting ??= (async () => {
    const { bbsRowsOf } = await presentModule();
    return bbsRowsOf(document_);
  })());

/** What a NET row owes its stored bar row: its own strings, carried over and never re-reckoned. */
function netFacts(row: BbsGridRowShape | BarRowShape): string {
  return JSON.stringify([
    row.objectKey,
    row.barKey,
    row.barMark,
    row.role,
    row.diameterMm,
    row.shape,
    row.dimsMm,
    row.cuttingRawMm,
    row.cuttingRoundedMm,
    row.cuttingIsAdditiveMm,
    row.piecesPerBar,
    row.bars,
  ]);
}

/** The stored rows in the order the grid draws them: `document.rows`, grouped by member. */
function grouped(rows: readonly BarRowShape[]): BarRowShape[] {
  const byMember = new Map<string, BarRowShape[]>();
  for (const row of rows) {
    const held = byMember.get(row.objectKey);
    if (held === undefined) byMember.set(row.objectKey, [row]);
    else held.push(row);
  }
  return [...byMember.values()].flat();
}

/** The first few disagreements, so a failure names rows rather than printing four thousand. */
function firstFew(mismatches: readonly string[]): string[] {
  return mismatches.slice(0, 3);
}

describe("AC-3: the bar schedule the screen draws is the door's own answer, row for row", () => {
  it("AC-3: one NET row per stored bar row, in document order grouped by member, every string verbatim", async () => {
    const rows = await gridRows();
    const stored = grouped(document_.rows);
    expect(stored.length, "the fixture's golden schedule carries bar rows to present (AM-01)").toBeGreaterThan(0);

    const net = rows.filter((row) => row.component === "NET");
    expect(net.length, "every stored bar row stands as exactly one NET row — none dropped, none doubled").toBe(stored.length);

    const wrong: string[] = [];
    for (const [at, row] of net.entries()) {
      const owed = stored[at] as BarRowShape;
      if (netFacts(row) !== netFacts(owed)) wrong.push(`row ${at} (${owed.barMark}): ${netFacts(row)} against the stored ${netFacts(owed)}`);
      else if (row.kg !== owed.kgNet) wrong.push(`row ${at} (${owed.barMark}): the NET row carries ${row.kg} kg where the stored net mass is ${owed.kgNet} (AM-03(a): a lap is never inside the bar's own mass)`);
      else if (row.mark !== owed.mark || row.class !== owed.class || row.level !== owed.level) wrong.push(`row ${at} (${owed.barMark}): the member facts the group row is drawn from disagree with the stored row`);
    }
    expect(firstFew(wrong), `the NET rows are the stored rows, in document order grouped by member, carried verbatim — ${wrong.length} disagree`).toEqual([]);
  });

  it("AC-3: a lap is its own row beside the net bar, and only where the bar laps (AM-03(a), L-BD-02)", async () => {
    const rows = await gridRows();
    const stored = grouped(document_.rows);
    const lapping = stored.filter((row) => row.lapsPerBar > 0);
    expect(lapping.length, "the fixture's roster reaches bars that lap, so this rule is graded rather than skipped").toBeGreaterThan(0);

    const laps = rows.filter((row) => row.component === "LAP");
    expect(laps.length, "one LAP row per stored row that laps, and not one more — never a percentage, never a column (AM-03(a))").toBe(lapping.length);

    // The LAP row stands IMMEDIATELY after the NET row it belongs to, sharing its bar key: read down
    // the answer, each stored row is its NET row and then, if and only if it laps, its LAP row.
    const wrong: string[] = [];
    let at = 0;
    for (const owed of stored) {
      const net = rows[at];
      at += 1;
      if (net === undefined || net.component !== "NET" || net.barKey !== owed.barKey) {
        wrong.push(`${owed.barMark}: the answer does not stand its NET row where the document's own order puts it`);
        continue;
      }
      if (owed.lapsPerBar === 0) {
        if (rows[at]?.component === "LAP" && rows[at]?.barKey === owed.barKey) wrong.push(`${owed.barMark}: a bar that laps ${owed.lapsPerBar} times carries a LAP row anyway`);
        continue;
      }
      const lap = rows[at];
      at += 1;
      if (lap === undefined || lap.component !== "LAP" || lap.barKey !== owed.barKey) {
        wrong.push(`${owed.barMark}: its lap stands nowhere beside it (${owed.lapsPerBar} lap(s) of ${owed.lapMm} mm)`);
        continue;
      }
      if (lap.kg !== owed.kgLap) wrong.push(`${owed.barMark}: the LAP row carries ${lap.kg} kg where the stored lap mass is ${owed.kgLap}`);
      if (lap.lapMm !== owed.lapMm || lap.lapsPerBar !== owed.lapsPerBar) wrong.push(`${owed.barMark}: the LAP row states ${lap.lapsPerBar} × ${lap.lapMm} mm where the stored row states ${owed.lapsPerBar} × ${owed.lapMm} mm`);
      if (lap.objectKey !== owed.objectKey) wrong.push(`${owed.barMark}: its LAP row is grouped under ${lap.objectKey} rather than under its own member`);
    }
    expect(firstFew(wrong), `every lap stands as its own row beside its bar — ${wrong.length} do not`).toEqual([]);
    expect(at, "and the answer holds nothing beyond the rows the document gave it").toBe(rows.length);

    // Net of laps and gross of laps are both showable BECAUSE they are two rows (L-BD-02): a NET row
    // whose mass already held its lap would make the pair a double count.
    const doubled = lapping.filter((row) => row.kgNet === row.kg).map((row) => row.barMark);
    expect(firstFew(doubled), "the fixture's own lapping rows state a net mass distinct from their gross — the roster this rule is read against is a roster where a doubling would show").toEqual([]);
  });

  it("I-534: every row carries the member count and the bars in each that the door stated for its line", async () => {
    const { bbsRowsOf } = await presentModule();
    // The golden's own lines each count one member; one of them is restated here as the door states
    // a mark standing three times on its floor, so a presenter that counted rows, or said nothing,
    // shows here rather than passing on a roster of ones.
    const [first, ...rest] = document_.rows as BarRowShape[];
    expect(first, "the golden roster carries a line to restate").toBeDefined();
    const counted: BarRowShape = { ...(first as BarRowShape), members: [(first as BarRowShape).objectKey, "member-b", "member-c"] };
    const rows = bbsRowsOf({ ...document_, rows: [counted, ...rest] });

    const own = rows.filter((row) => row.barKey === counted.barKey);
    expect(own.length, "the restated line stands on the grid").toBeGreaterThan(0);
    for (const row of own) {
      expect(row.members, `${row.barMark} (${row.component}) carries the three members its line counts — the door's count, never re-counted`).toBe(3);
      expect(row.barsPerUnit, "and what one member takes, as the line stated it").toBe(counted.barsPerUnit);
    }
    const wrong = rows.filter((row) => row.barKey !== counted.barKey && row.members !== 1).map((row) => row.barMark);
    expect(firstFew(wrong), "and every other line of the roster says its own count of one").toEqual([]);
  });

  it("AC-3: the summary is the door's own totals, one row per diameter in ascending numeric order", async () => {
    const { bbsSummaryOf } = await presentModule();
    const summary = bbsSummaryOf(document_);

    const diameters = Object.keys(document_.perDiameterKg);
    expect(diameters.length, "the fixture's schedule totals its mass by diameter (R-TO-054)").toBeGreaterThan(0);
    const ascending = [...diameters].map(Number).sort((left, right) => left - right);
    expect(
      summary.rows.map((row) => row.diameterMm),
      "one summary row per diameter the document totals, in ascending numeric order — 8 before 10, never the string order that puts 10 first",
    ).toEqual(ascending);

    const wrong: string[] = [];
    for (const row of summary.rows) {
      const owed = document_.perDiameterKg[String(row.diameterMm)];
      const stock = document_.cuttingStock[String(row.diameterMm)];
      if (row.kg !== owed) wrong.push(`${row.diameterMm} mm: the summary states ${row.kg} kg where the door answered ${String(owed)}`);
      if (stock === undefined) {
        wrong.push(`${row.diameterMm} mm: the document packed no cutting stock for this diameter`);
        continue;
      }
      if (row.stockBars !== stock.stockBars || row.pieces !== stock.pieces || row.offcutMm !== stock.offcutMm) {
        wrong.push(
          `${row.diameterMm} mm: the summary states ${row.stockBars} bars / ${row.pieces} pieces / ${row.offcutMm} mm offcut where the door answered ${stock.stockBars} / ${stock.pieces} / ${stock.offcutMm} (AM-03(e): informational, and the door's own)`,
        );
      }
    }
    expect(firstFew(wrong), `the summary carries the door's own cutting-stock answer — ${wrong.length} row(s) disagree`).toEqual([]);

    // THE GRAND TOTAL IS THE DOOR'S, NOT A SUM MADE HERE. The fixture's own grand total differs from
    // the sum of its rounded row masses, because a figure is rounded once where it is printed
    // (L-QTY-05) — so a screen that re-summed would print a different number, and this is where it
    // would show (B-17, I-bbs-2).
    expect(summary.grandTotalKg, "the summary closes with the total the document answered").toBe(document_.grandTotalKg);
    expect(summary.stockMm, "and states what it was cut from").toBe(document_.stockMm);
    expect(summary.roundingMm, "and the one surface it rounded to (AM-01)").toBe(document_.roundingMm);
  });

  it("AC-3: the figures are stored strings, and the form a reader reads is formatUserFigure of them", async () => {
    const { bbsSummaryOf } = await presentModule();
    const rows = await gridRows();
    const summary = bbsSummaryOf(document_);

    // A decimal the screen carries is the one the door stored — never re-rounded, never padded, and
    // never already grouped: the attributes carry the string, and the CELL is what is formatted.
    const stored = new Set(document_.rows.flatMap((row) => [row.cuttingRawMm, row.cuttingRoundedMm, row.cuttingIsAdditiveMm, row.kgNet, row.kgLap, row.bars]));
    const regrouped = rows.filter((row) => [row.cuttingRawMm, row.cuttingRoundedMm, row.cuttingIsAdditiveMm, row.kg, row.bars].some((figure) => figure.includes(",")));
    expect(firstFew(regrouped.map((row) => `${row.barMark} (${row.component})`)), "no figure a row carries arrives already grouped: grouping is the CELL's, and an attribute a test reads is the stored decimal").toEqual([]);
    const unknown = rows.filter((row) => row.component === "NET" && !stored.has(row.cuttingRawMm));
    expect(firstFew(unknown.map((row) => row.barMark)), "and every raw cutting length a row carries is one the document stored (L-FRM-05: the raw length is never rounded)").toEqual([]);

    // THE PRESENTER HANDS ON THE STORED STRING; THE CELL IS WHERE IT IS FORMATTED. The grand total
    // the summary carries is the document's own decimal, and a screen that showed it as it stands
    // would show `166626.107` where a reader reads `1,66,626.107` — so the printed form is asserted
    // where it can be seen, on the RENDERED screen, in `tests/e2e/journeys/j-032-schedules-notes.
    // spec.ts` ("the figures a reader reads are formatUserFigure of the figures the rows carry").
    // What belongs here is the half this module owns: the total that reaches the cell is the door's
    // string, ungrouped and unrounded, and the grouped form is not it.
    expect(summary.grandTotalKg, "the summary hands the cell the document's own decimal").toBe(document_.grandTotalKg);
    expect(summary.grandTotalKg.includes(","), `the presenter never formats: ${formatUserFigure(summary.grandTotalKg)} is what the CELL shows, and ${summary.grandTotalKg} is what the attribute carries`).toBe(false);
  });
});

/**
 * s-bbs I-655 — an entry's standing is its members' published lines, joined and never inferred.
 * The entries are real `BbsLine` shapes cut down to what the join reads (the key and the members it
 * counts); the lines are handed in their published order, as `bbsViewOf` reads them.
 */
describe("I-655: each entry states the coverage of its members' lines and the codes they left out", () => {
  type Entry = { objectKey: string; members: string[] };
  const entry = (objectKey: string, ...others: string[]): Entry => ({ objectKey, members: [objectKey, ...others] });
  const line = (objectKey: string, coverage: string, ...omitted: [string, string | null][]) => ({ objectKey, coverage, omitted: omitted.map(([code, variable]) => ({ code, variable })) });
  const standing = async (rows: Entry[], lines: ReturnType<typeof line>[]) => {
    const { entryCoverageOf } = await import("../../../src/modules/takeoff/bbs-ui/present");
    return entryCoverageOf({ rows } as unknown as Parameters<typeof entryCoverageOf>[0], lines);
  };

  it("an entry is COMPLETE only where every member it counts published a whole line", async () => {
    const answered = await standing(
      [entry("C1@GF", "C1b@GF"), entry("C1@GF", "C1b@GF"), entry("C6@GF"), entry("C2@GF", "C2b@GF")],
      [line("C1@GF", "COMPLETE"), line("C1b@GF", "COMPLETE"), line("C6@GF", "PARTIAL_DECLARED", ["REBAR_TIE_JOINT_UNREAD", "ties"]), line("C2@GF", "COMPLETE")],
    );
    expect(Object.keys(answered), "one standing per entry, keyed as its group row is named, each once").toEqual(["C1@GF", "C6@GF", "C2@GF"]);
    expect(answered["C1@GF"]).toEqual({ coverage: "COMPLETE", omitted: [] });
    expect(answered["C6@GF"]).toEqual({ coverage: "PARTIAL_DECLARED", omitted: [{ code: "REBAR_TIE_JOINT_UNREAD", components: ["ties"] }] });
    expect(answered["C2@GF"], "a member that published no line is never whole by default, and names nothing it did not state").toEqual({ coverage: "PARTIAL_DECLARED", omitted: [] });
  });

  it("one partly declared member makes its entry partial; codes stand once, in the lines' order, with every component", async () => {
    const answered = await standing(
      [entry("SW1-3@1F", "SW1-4@1F", "SW1-D@1F")],
      [
        line("SW1-4@1F", "PARTIAL_DECLARED", ["REBAR_TIE_ZONE_UNSTATED", "ties"], ["REBAR_STOREY_RUN_UNSTATED", "net"]),
        line("SW1-3@1F", "COMPLETE"),
        line("SW1-D@1F", "PARTIAL_DECLARED", ["REBAR_STOREY_RUN_UNSTATED", "lap"], ["REBAR_TIE_ZONE_UNSTATED", "ties"], ["BBS_NO_BAR_ROW", null]),
        line("OTHER@1F", "PARTIAL_DECLARED", ["BAR_SHAPE_NOT_HELD", "ties"]),
      ],
    );
    expect(answered["SW1-3@1F"]).toEqual({
      coverage: "PARTIAL_DECLARED",
      omitted: [
        { code: "REBAR_TIE_ZONE_UNSTATED", components: ["ties"] },
        { code: "REBAR_STOREY_RUN_UNSTATED", components: ["net", "lap"] },
        { code: "BBS_NO_BAR_ROW", components: [] },
      ],
    });
  });

  it("an entry whose line names no members stands for its own key alone", async () => {
    const answered = await standing([{ objectKey: "C3@2F", members: [] }], [line("C3@2F", "COMPLETE")]);
    expect(answered["C3@2F"]).toEqual({ coverage: "COMPLETE", omitted: [] });
  });
});
