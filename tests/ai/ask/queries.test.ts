// @vitest-environment node
/**
 * S-Ask's queries over the F-RCC6-BNBC read-back's own figures (ASK-1a's proof, docs/design/s-ask.md
 * §6): C3 on 5F is 6 and cites the six members of the one typical plan (view 20B6), with the facts the
 * typical-plan statement is written from; column concrete states 93.893 m³; PC1–PC5 are 4 / 14 / 5 / 2 /
 * 1; blinding states 4.692 m³ from 12 COMPLETE lines with the 14 PARTIAL ones counted and none summed.
 *
 * Every expectation is read off the read-back document itself — the lines are summed here by an
 * addition of this file's own (whole integers of the fraction, no float) and compared with the engine's
 * — and the three faces the proof names are held beside them, so a register move shows up as a
 * figure that moved, not as a test that quietly followed it.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import { viewKey, viewRefOf } from "@/core/identity";
import { blankReading } from "@/modules/takeoff/ask/grammar";
import type { AskAnswer, AskFacts, AskReading, AskSources, AskStatementFacts } from "@/modules/takeoff/ask/law";
import { queryFor } from "@/modules/takeoff/ask/queries/registry";
import { statedAt } from "@/modules/takeoff/bbs-ui/present";
import { READ_BACK, linesOf, objectsOf, readBackSources } from "./support/readback";

const SOURCES = readBackSources();

/** A decimal string's exact sum, by this file's own addition: the fraction scaled to whole integers. */
function sumExactly(values: readonly string[]): string {
  const scale = Math.max(0, ...values.map((value) => (value.split(".")[1] ?? "").length));
  const total = values.reduce((held, value) => {
    const [whole = "0", fraction = ""] = value.split(".");
    return held + BigInt(`${whole}${fraction.padEnd(scale, "0")}`);
  }, 0n);
  const digits = total.toString().padStart(scale + 1, "0");
  const fixed = scale === 0 ? digits : `${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`;
  return fixed.includes(".") ? fixed.replace(/0+$/u, "").replace(/\.$/u, "") : fixed;
}

/** The number a figure is stated as, through the format seam at its places (I-398). */
function face(figure: { value: string; places: number } | null | undefined): string {
  if (figure === null || figure === undefined) return expect.fail("no figure was stated");
  return formatUserFigure(statedAt(figure.value, figure.places));
}

/** A query's facts over a reading, failing with the refusal where it refused. */
function factsOf(reading: AskReading, sources: AskSources = SOURCES): AskFacts {
  const answered = queryFor(reading.intent).answer(reading, sources);
  if ("outcome" in answered) return expect.fail(`the ${reading.intent} query refused: ${JSON.stringify(answered)}`);
  return answered;
}

/** The statement of one intent. */
function statementOf<I extends AskStatementFacts["intent"]>(facts: AskFacts, intent: I): Extract<AskStatementFacts, { intent: I }> {
  expect(facts.statement.intent).toBe(intent);
  return facts.statement as Extract<AskStatementFacts, { intent: I }>;
}

/** The refusal a reading earns. */
function refusedOf(reading: AskReading, sources: AskSources = SOURCES): Extract<AskAnswer, { outcome: "REFUSED" }> {
  const answered = queryFor(reading.intent).answer(reading, sources);
  if (!("outcome" in answered)) return expect.fail(`the ${reading.intent} query answered where it must refuse: ${JSON.stringify(answered.statement)}`);
  return answered;
}

const LINES = linesOf();
const complete = (klass: string, kind: string) => LINES.filter((line) => line.class === klass && line.kind === kind && line.coverage === "COMPLETE");

describe("COUNT: C3 on 5F is 6, on the one typical plan (view 20B6)", () => {
  const reading: AskReading = { ...blankReading("COUNT"), class: "column", mark: "C3", level: "5F" };

  test("six registered C3 on 5F, as the read-back holds them", () => {
    const expected = objectsOf().filter((object) => object.mark === "C3" && object.level === "5F");
    const facts = factsOf(reading);
    const count = statementOf(facts, "COUNT");
    expect(count.count.value).toBe(String(expected.length));
    expect(count.count.value, "the proof's figure").toBe("6");
    expect(facts.records.objects.map((record) => record.objectKey).sort(), "the figure cites exactly the six objects counted").toEqual(expected.map((object) => object.objectKey).sort());
  });

  test("the six are drawn once, on the typical plan 20B6 that stands for FDN to 6F — the facts say so", () => {
    const count = statementOf(factsOf(reading), "COUNT");
    const plan = viewKey({ viewClass: "LAYOUT_PLAN", captionAnchorSourceKey: "DXF_HANDLE:20B6" });
    expect(count.typical, "the members counted for 5F are the members counted for every storey").not.toBeNull();
    expect(count.typical?.views, "one view, the typical plan").toEqual([plan]);
    expect(count.typical?.members, "six members drawn once").toBe(6);
    expect(count.typical?.levels, "the levels that plan stands for, from the ground up").toEqual(["FDN", "GF", "1F", "2F", "3F", "4F", "5F", "6F"]);
    const records = factsOf(reading).records.objects;
    expect(records.every((record) => viewRefOf(record.sourceKey)?.captionAnchorSourceKey === "DXF_HANDLE:20B6"), "each cited member's placement stands on view 20B6").toBe(true);
    expect(count.struck, "nobody struck a C3").toBe(0);
  });

  test("the piles in the foundation are the 89 filed in the foundation slot", () => {
    const expected = objectsOf().filter((object) => object.class === "pile");
    const count = statementOf(factsOf({ ...blankReading("COUNT"), class: "pile", level: "FDN" }), "COUNT");
    expect(count.count.value).toBe(String(expected.length));
    expect(count.count.value).toBe("89");
    expect(count.typical, "each pile is its own member on its own plan").toBeNull();
  });
});

describe("QUANTITY: column concrete states 93.893 m³ over its COMPLETE lines", () => {
  const reading: AskReading = { ...blankReading("QUANTITY"), class: "column", kind: "rcc.concrete" };

  test("the figure is the exact sum of the 208 COMPLETE lines, stated at the kind's three places", () => {
    const lines = complete("column", "rcc.concrete");
    const facts = factsOf(reading);
    const quantity = statementOf(facts, "QUANTITY");
    expect(quantity.figure?.value, "the exact sum, never rounded before it is stated").toBe(sumExactly(lines.map((line) => line.value as string)));
    expect(quantity.figure).toMatchObject({ unit: "m3", kind: "rcc.concrete", places: 3 });
    expect(quantity.lines).toBe(lines.length);
    expect(quantity.lines, "the proof's line count").toBe(208);
    expect(face(quantity.figure), "the proof's face").toBe("93.893");
    expect(facts.partial, "every column concrete line is COMPLETE, so nothing is left out").toBeNull();
    expect(quantity.apart, "no column holds blinding").toBeNull();
  });

  test("by level, from the ground up, each level's lines summed on its own", () => {
    const quantity = statementOf(factsOf({ ...reading, by: "LEVEL" }), "QUANTITY");
    expect(quantity.breakdown?.map((row) => row.level)).toEqual(["FDN", "GF", "1F", "2F", "3F", "4F", "5F", "6F"]);
    for (const row of quantity.breakdown ?? []) {
      const onLevel = complete("column", "rcc.concrete").filter((line) => line.level === row.level);
      expect(row.figure?.value, `${String(row.level)}'s own sum`).toBe(sumExactly(onLevel.map((line) => line.value as string)));
      expect(row.count).toBe(onLevel.length);
    }
  });

  test("blinding under the caps is 4.692 m³ over 12 of 26 lines: the 14 PARTIAL are counted, never summed", () => {
    const lines = LINES.filter((line) => line.class === "pile_cap" && line.kind === "pcc.blinding");
    const done = lines.filter((line) => line.coverage === "COMPLETE");
    const facts = factsOf({ ...blankReading("QUANTITY"), class: "pile_cap", kind: "pcc.blinding" });
    const quantity = statementOf(facts, "QUANTITY");
    expect(lines.length, "26 blinding lines in the read-back").toBe(26);
    expect(quantity.figure?.value, "the sum of the COMPLETE lines alone").toBe(sumExactly(done.map((line) => line.value as string)));
    expect(face(quantity.figure), "the proof's face").toBe("4.692");
    expect(quantity.lines, "summed over 12 lines").toBe(12);
    expect(facts.partial?.lines, "the other 14 are counted beside the figure").toBe(lines.length - done.length);
    expect(facts.partial?.lines).toBe(14);
    expect(facts.partial?.codes.map((code) => [code.code, code.count]), "and said by the code they omit under").toEqual([[REFUSALS.BLINDING_PLAN_DEFERRED.code, 14]]);
    expect(facts.records.lines, "the Rows hold all 26, partial ones included").toHaveLength(26);
  });

  test("pile cap concrete states blinding apart, never added (§1.2's word two kinds answer to)", () => {
    const quantity = statementOf(factsOf({ ...blankReading("QUANTITY"), class: "pile_cap", kind: "rcc.concrete" }), "QUANTITY");
    expect(face(quantity.figure)).toBe(formatUserFigure(statedAt(sumExactly(complete("pile_cap", "rcc.concrete").map((line) => line.value as string)), 3)));
    expect(quantity.apart).toMatchObject({ kind: "pcc.blinding", lines: 12, classes: ["pile_cap"] });
    expect(face(quantity.apart?.figure)).toBe("4.692");
  });

  test("a class the campaign holds no line for is refused by name: nothing is measured for it", () => {
    expect(refusedOf({ ...blankReading("QUANTITY"), class: "slab", kind: "rcc.concrete" }).code).toBe(REFUSALS.ASK_NOT_MEASURED.code);
  });

  test("with no campaign open, nothing is measured — by name", () => {
    expect(refusedOf(reading, readBackSources({ campaign: null })).code).toBe(REFUSALS.ASK_NOT_MEASURED.code);
  });
});

describe("MARKS: PC1–PC5 are 4 / 14 / 5 / 2 / 1", () => {
  test("the caps grouped by mark in counting order, 26 in all", () => {
    const expected = ["PC1", "PC2", "PC3", "PC4", "PC5"].map((mark) => objectsOf().filter((object) => object.class === "pile_cap" && object.mark === mark).length);
    const marks = statementOf(factsOf({ ...blankReading("MARKS"), class: "pile_cap", by: "MARK" }), "MARKS");
    expect(marks.marks.map((row) => row.mark)).toEqual(["PC1", "PC2", "PC3", "PC4", "PC5"]);
    expect(marks.marks.map((row) => row.count)).toEqual(expected);
    expect(marks.marks.map((row) => row.count), "the proof's counts").toEqual([4, 14, 5, 2, 1]);
    expect(marks.total.value).toBe("26");
  });
});

describe("MEASURED_SO_FAR: never a total, and never across kinds (I-399)", () => {
  test("concrete measured so far is the three classes' COMPLETE lines, with the beams and the unmeasured classes named", () => {
    const facts = factsOf({ ...blankReading("MEASURED_SO_FAR"), kind: "rcc.concrete" });
    const soFar = statementOf(facts, "MEASURED_SO_FAR");
    const lines = LINES.filter((line) => line.kind === "rcc.concrete" && line.coverage === "COMPLETE");
    expect(soFar.trades).toHaveLength(1);
    const trade = soFar.trades[0];
    expect(trade?.figure?.value).toBe(sumExactly(lines.map((line) => line.value as string)));
    expect(face(trade?.figure), "column + pile + pile cap concrete").toBe("595.523");
    expect(trade?.classes.map((row) => [row.class, row.count, row.partial])).toEqual([
      ["column", 208, 0],
      ["beam", 0, 172],
      ["pile_cap", 26, 0],
      ["pile", 89, 0],
    ]);
    expect(soFar.without, "the beams stand without a figure").toEqual([{ class: "beam", kind: "rcc.concrete", count: 172 }]);
    expect(trade?.absent, "every class the catalogue measures concrete on that holds no line here").toEqual(expect.arrayContaining(["slab", "tie_beam", "footing", "shear_wall", "stair", "lintel"]));
    expect(soFar.apart?.kind, "blinding is stated apart, never added to concrete").toBe("pcc.blinding");
    expect(face(soFar.apart?.figure)).toBe("4.692");
    expect(facts.partial?.lines, "the 172 beam lines are counted").toBe(172);
  });

  test("every kind measured so far is one trade per kind: no figure adds two kinds", () => {
    const soFar = statementOf(factsOf(blankReading("MEASURED_SO_FAR")), "MEASURED_SO_FAR");
    for (const trade of soFar.trades) {
      const ofKind = LINES.filter((line) => line.kind === trade.kind && line.coverage === "COMPLETE");
      if (trade.figure === null) expect(ofKind).toHaveLength(0);
      else expect(trade.figure.value, `${trade.kind} sums its own lines only`).toBe(sumExactly(ofKind.map((line) => line.value as string)));
      expect(trade.figure === null || trade.figure.kind === trade.kind).toBe(true);
    }
    expect(soFar.trades.map((trade) => trade.kind)).toEqual(["rcc.concrete", "rcc.formwork", "piling.bored", "piling.boring", "earthwork.excavation", "pcc.blinding", "rcc.rebar"]);
  });
});

describe("WHY_NOT_MEASURED: the PARTIAL lines and the codes they omit under", () => {
  test("the beams: 344 lines stand without a figure, each under SLAB_THICKNESS_UNSTATED", () => {
    const beams = LINES.filter((line) => line.class === "beam");
    const facts = factsOf({ ...blankReading("WHY_NOT_MEASURED"), class: "beam" });
    const why = statementOf(facts, "WHY_NOT_MEASURED");
    expect(why.lines).toBe(beams.filter((line) => line.coverage !== "COMPLETE").length);
    expect(why.lines).toBe(344);
    expect(why.complete).toBe(0);
    expect(facts.partial?.codes.map((code) => [code.code, code.count, [...code.variables].sort()]), "a line omitting two variables under one code is one line under it").toEqual([
      [REFUSALS.SLAB_THICKNESS_UNSTATED.code, 344, ["t", "t_left", "t_right"]],
    ]);
  });

  test("column rebar: 208 lines, under the codes the lines themselves enumerate", () => {
    const rebar = LINES.filter((line) => line.class === "column" && line.kind === "rcc.rebar");
    const expected = new Map<string, number>();
    for (const line of rebar) for (const code of new Set((line.omitted ?? []).map((one) => one.code))) expected.set(code, (expected.get(code) ?? 0) + 1);
    const facts = factsOf({ ...blankReading("WHY_NOT_MEASURED"), class: "column", kind: "rcc.rebar" });
    expect(statementOf(facts, "WHY_NOT_MEASURED").lines).toBe(208);
    expect(new Map(facts.partial?.codes.map((code) => [code.code, code.count]))).toEqual(expected);
  });

  test("a subject the campaign holds nothing under is refused by name", () => {
    expect(refusedOf({ ...blankReading("WHY_NOT_MEASURED"), class: "slab" }).code).toBe(REFUSALS.ASK_NOT_MEASURED.code);
  });
});

describe("MEMBER_TYPE: the schedule rows naming the mark, quoted as drawn", () => {
  test("C4 is the COLUMN SCHEDULE's row, every cell under its header, verbatim", () => {
    const schedule = READ_BACK.schedules.find((one) => one.title === "COLUMN SCHEDULE");
    const row = schedule?.cells.filter((cell) => cell[2] === "C4").map((cell) => cell[0])[0];
    const drawn = schedule?.cells.filter((cell) => cell[0] === row) ?? [];
    const member = statementOf(factsOf({ ...blankReading("MEMBER_TYPE"), class: "column", mark: "C4" }), "MEMBER_TYPE");
    expect(member.rows).toHaveLength(1);
    expect(member.rows[0]?.schedule).toBe("COLUMN SCHEDULE");
    expect(member.rows[0]?.cells.map((cell) => cell.text), "each cell as drawn").toEqual(drawn.map((cell) => cell[2]));
    expect(member.rows[0]?.cells.map((cell) => cell.column)).toEqual(["MARK", "GF TO 2ND", "3RD & 4TH", "5TH TO 6TH", "ROOF-SRR"]);
    expect(member.rows[0]?.cells[1]?.sourceKeys, "each cell cites the texts it was read off").toEqual(drawn[1]?.[3]);
  });

  test("a remark row naming the mark is the schedule's word about it too: C2 has two rows", () => {
    const member = statementOf(factsOf({ ...blankReading("MEMBER_TYPE"), class: "column", mark: "C2" }), "MEMBER_TYPE");
    expect(member.rows.map((row) => row.cells[0]?.text)).toEqual(["C2", "C2 GF TO 2ND:"]);
  });

  test("PC3's row is PC3's, never C3's", () => {
    const member = statementOf(factsOf({ ...blankReading("MEMBER_TYPE"), class: "column", mark: "C3" }), "MEMBER_TYPE");
    expect(member.rows.map((row) => row.schedule)).toEqual(["COLUMN SCHEDULE"]);
  });
});

describe("NOTE: every reading of the kind, quoted where the drawing wrote it, none chosen", () => {
  test("f'c: 3500 psi twice and 3000 psi once, two values, each with its clause", () => {
    const note = statementOf(factsOf({ ...blankReading("NOTE"), noteKind: "FC" }), "NOTE");
    const expected = READ_BACK.notes.filter((one) => one.kind === "FC");
    expect(note.groups).toHaveLength(1);
    const group = note.groups[0];
    expect(group?.readings.map((one) => one.quote)).toEqual(expected.map((one) => one.valueAsWritten));
    expect(group?.values, "they state two different values, and no value is chosen").toBe(2);
    expect(group?.readings.map((one) => one.clause)).toEqual(["f'c = 3500 psi (24 MPa) cylinder", "f'c = 3000 psi (BORED PILES)", "DEVELOPMENT LENGTH ld - fy 500 MPa, f'c 3500 psi"]);
    expect(group?.readings.every((one) => one.figure === null), "a quote is the drawing's words, not a figure").toBe(true);
  });

  test("a kind no reading states is refused, the kinds the notes do state listed", () => {
    const refused = refusedOf({ ...blankReading("NOTE"), noteKind: "FC" }, readBackSources({ notes: READ_BACK.notes.filter((one) => one.kind !== "FC") }));
    expect(refused.code).toBe(REFUSALS.ASK_SUBJECT_UNKNOWN.code);
    expect(refused.held).toMatchObject({ subject: "NOTES", items: ["FY", "LAP", "HOOK", "HOOK_MIN"] });
  });
});

describe("LEVEL_HEIGHT and SHEET_LIST", () => {
  test("GF stands at 3.353 m on its two readings, each a figure in its own notation (D-001)", () => {
    const heights = statementOf(factsOf({ ...blankReading("LEVEL_HEIGHT"), level: "GF" }), "LEVEL_HEIGHT");
    const gf = heights.heights[0];
    expect(gf?.standing).toBe("AGREED");
    expect(face(gf?.figure), "the levels grid's millimetre").toBe("3.353");
    expect(gf?.readings.map((one) => [one.figure?.value, one.figure?.unit, one.figure?.places, one.sourceKey, one.quote])).toEqual([
      ["132", "in", 0, "DXF_HANDLE:1D90", null],
      ["3.353", "m", 3, "DXF_HANDLE:1D4C", null],
    ]);
  });

  test("the sheets of the pinned revision, one discipline asked", () => {
    const sheets = [
      { drawingId: "d", layoutName: "S-01 GENERAL NOTES (1 OF 2)", number: "S-01", title: "GENERAL NOTES (1 OF 2)", discipline: "STRUCTURAL" as const },
      { drawingId: "d", layoutName: "A-01", number: "A-01", title: "GROUND FLOOR PLAN", discipline: "ARCHITECTURAL" as const },
    ];
    const list = statementOf(factsOf({ ...blankReading("SHEET_LIST"), discipline: "STRUCTURAL" }, readBackSources({ sheets })), "SHEET_LIST");
    expect(list.sheets.map((sheet) => sheet.number)).toEqual(["S-01"]);
    expect(list.count.value).toBe("1");
  });
});
