/**
 * I-596 — a bar whose shape the product's BS 8666 roster does not hold is DECLARED on the bar
 * schedule by name, its mass kept out of every total and stated as kept out: never billed on a shape
 * nothing here derives, never silently dropped, and never a schema failure of the document
 * (docs/design/s-bbs.md §0 I-596; BAR_SHAPE_NOT_HELD; W-28's circular hoop, shape CH, until R6b/R6c).
 *
 * The door (`bbsDocumentOf`), the export (`bbsPayloadOf`) and the kind's schema are driven with a
 * bill that holds one held bar and one bar at shape CH. Nothing here opens a database and nothing
 * here measures time (AM-10 §3).
 */
import { describe, expect, it } from "vitest";
import { BBS_KIND } from "../../../src/core/documents/kinds/bbs";
import { REFUSALS } from "../../../src/core/errors";
import { SHAPE_CODES, isShapeCode } from "../../../src/core/rulesets/methods/rebar/bs8666";
import { bbsPayloadOf } from "../../../src/modules/takeoff/bbs-ui/emission";
import { barRowKeyOf, type BarRow } from "../../../src/modules/takeoff/rebar/bars";
import { bbsDocumentOf } from "../../../src/modules/takeoff/rebar/store";

/** The shape the regenerated golden bends C7's hoops to, which the roster does not hold (W-28). */
const UNHELD = "CH";

/** One member's bar, stored as the rail stores one, at the shape and mass the case names. */
function bar(objectKey: string, level: string, barMark: string, role: BarRow["role"], diameterMm: number, shape: string, kg: string): BarRow {
  return {
    barKey: barRowKeyOf({ objectKey, role, diameterMm, sequence: 0 }),
    objectKey,
    class: "column",
    level,
    mark: "C7",
    barMark,
    role,
    diameterMm,
    shape,
    dimsMm: shape === UNHELD ? { A: "370.000", B: "100.000", C: "100.000" } : { A: "3352.800" },
    cuttingRawMm: shape === UNHELD ? "1322.389" : "3352.800",
    cuttingRoundedMm: shape === UNHELD ? "1325" : "3375",
    cuttingIsAdditiveMm: shape === UNHELD ? "1302.389" : "3352.800",
    piecesPerBar: 1,
    lapMm: "0",
    lapsPerBar: 0,
    barsPerUnit: 8,
    parentCount: "1",
    bars: "8",
    kgPerMetre: diameterMm === 10 ? "0.616" : "2.466",
    kgNet: kg,
    kgLap: "0",
    kg,
    sourceKeys: [`S-03:C7#${barMark}`],
    detailingSourceKeys: [],
    editionDigest: "edition",
    semantic: `${objectKey}|${barMark}`,
  };
}

const MAIN = bar("COL:C7X@GF", "GF", "C7-v", "MAIN", 20, "00", "66.144");
const HOOP = bar("COL:C7X@GF", "GF", "C7-h", "TIE", 10, UNHELD, "27.696");

const META = {
  title: "Bar bending schedule",
  project: "Sattva Court",
  particulars: {
    code: null,
    client: null,
    site: null,
    drawingSet: "Structural drawings",
    revision: 1,
    pinnedOn: { year: 2026, month: 9, day: 22 },
    issuedOn: { year: 2026, month: 9, day: 24 },
  },
  partial: false,
  omitted: [],
} as const;

describe("I-596: a bar in a shape the roster does not hold is declared, excluded from the totals, and said", () => {
  it("the roster itself is not grown to take it — CH joins SHAPE_CODES only with its own method (R6b/R6c)", () => {
    expect(isShapeCode(UNHELD), "the circular hoop is a shape the roster does not hold yet").toBe(false);
    expect([...SHAPE_CODES], "and no declared shape was slipped into the roster").not.toContain(UNHELD);
  });

  it("the door schedules the held bar, declares the CH bar, and keeps its mass out of every total", () => {
    const document_ = bbsDocumentOf("campaign-1", [MAIN, HOOP]);

    expect(document_.rows.map((line) => line.barMark), "the schedule's lines are the held bars only").toEqual(["C7-v"]);
    expect(document_.declared.map((line) => [line.barMark, line.shape, line.kg, line.members.length]), "the CH bar is declared by name with its own mass and members, never dropped").toEqual([
      ["C7-h", UNHELD, "27.696", 1],
    ]);
    expect(document_.declaredKg, "the declared mass is stated").toBe("27.696");
    expect(document_.grandTotalKg, "and the grand total is the held bars' alone").toBe("66.144");
    expect(Object.keys(document_.perDiameterKg), "no per-diameter total reads the declared bar").toEqual(["20"]);
    expect(Object.keys(document_.perMarkKg), "nor any mark total").toEqual(["C7-v"]);
    expect(Object.keys(document_.cuttingStock), "and the stock packs no piece of a shape nobody holds").toEqual(["20"]);
  });

  it("a bill with nothing unheld declares nothing, and its totals are the ones it always had", () => {
    const document_ = bbsDocumentOf("campaign-1", [MAIN]);
    expect(document_.declared, "nothing is declared").toEqual([]);
    expect(document_.declaredKg).toBe("0");
    expect(document_.grandTotalKg).toBe("66.144");
    const payload = bbsPayloadOf(document_, META);
    expect(payload.declared, "and the document says nothing of it").toBeNull();
    expect(BBS_KIND.payloadSchema.safeParse(payload).success, "a bill with nothing declared is a payload the kind takes").toBe(true);
  });

  it("the export carries the declared bar with the registry's own reason and the excluded mass, and the kind takes it", () => {
    const payload = bbsPayloadOf(bbsDocumentOf("campaign-1", [MAIN, HOOP]), META);

    expect(payload.schedule.flatMap((entry) => entry.bars.map((one) => one.shape)), "no scheduled bar carries the unheld shape").toEqual(["00"]);
    expect(payload.declared?.reason, "the reason is the register's own sentence, never one written here (R-SPINE-062)").toBe(REFUSALS.BAR_SHAPE_NOT_HELD.message);
    expect(payload.declared?.kg, "the excluded mass at the document's precision").toBe("27.696");
    expect(payload.declared?.bars, "the bar under its mark, floor and members, at its stated length and mass").toEqual([
      { level: "GF", class: "column", mark: "C7", members: 1, barMark: "C7-h", role: "TIE", diameterMm: 10, shape: UNHELD, cuttingRawMm: "1322.389", bars: "8", kg: "27.696" },
    ]);
    expect(payload.grandTotalKg, "the grand total the page prints excludes it").toBe("66.144");

    const parsed = BBS_KIND.payloadSchema.safeParse(payload);
    expect(parsed.success, `a bill with a declared bar is a payload the kind takes, never a schema failure: ${parsed.success ? "" : JSON.stringify(parsed.error)}`).toBe(true);
  });

  it("the kind keeps both doors closed: an unheld shape on the schedule is refused, and a held shape among the declared is refused", () => {
    const payload = bbsPayloadOf(bbsDocumentOf("campaign-1", [MAIN, HOOP]), META);
    const [entry] = payload.schedule;
    if (entry === undefined || payload.declared === null) throw new Error("the case's bill has an entry and a declared bar");

    const smuggled = { ...payload, schedule: [{ ...entry, bars: entry.bars.map((one) => ({ ...one, shape: UNHELD })) }] };
    expect(BBS_KIND.payloadSchema.safeParse(smuggled).success, "a CH bar on the schedule itself is refused — the schedule draws held shapes only").toBe(false);

    const misdeclared = { ...payload, declared: { ...payload.declared, bars: payload.declared.bars.map((one) => ({ ...one, shape: "51" })) } };
    expect(BBS_KIND.payloadSchema.safeParse(misdeclared).success, "a held shape declared rather than scheduled is refused").toBe(false);

    const emptied = { ...payload, declared: { ...payload.declared, bars: [] } };
    expect(BBS_KIND.payloadSchema.safeParse(emptied).success, "a declaration of no bar is refused — none declared is null").toBe(false);
  });
});
