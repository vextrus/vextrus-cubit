/**
 * The clause reading, over F-RCC6-BNBC's own general notes (R-TO-034, L-AI-03, T-MTEXT-CODES).
 *
 * The roster is the fixture's: every string this suite reads is proved to be one the committed
 * corpus carries verbatim, the way `./grammar.test.ts` proves its own — a drawing nobody drew
 * cannot be what the product is held to (B-19). Nothing here opens a database and nothing here asks
 * a model: `clausesOf`, `figuresIn`, `lapTableHeadingsOn` and `askedClausesOf` are pure over the
 * sheet's own text, and the asked set is a function of the text and of the grammar's own reading of
 * it.
 *
 * THE ORDER IS THE LAW'S (L-AI-03): a clause standing on an entity the grammar read a kind off is
 * never asked for a class. The one exception is the clause that has to be RANKED against a table
 * printed beside it (AM-03(e)), and that clause's class is not offerable either — `classifiable` is
 * false, and only its Noul is read.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { askedClausesOf, clausesOf, figuresIn, lapTableHeadingsOn } from "@/core/notes/clauses";
import { proposeNotes, readFigure, type SheetText } from "@/core/notes/grammar";
import { NOTE_KINDS } from "@/core/notes/law";

/** F-RCC6-BNBC's committed notation corpus: every string of the drawing, by sheet and handle. */
const BNBC_CORPUS = "fixtures/rcc6-bnbc/notation.corpus.json";
const BNBC_FIXTURE = "F-RCC6-BNBC";

/** The two sheets whose general notes this product reads (the J-032 leg's own). */
const S01 = "S-01";
const S02 = "S-02";

/** How the corpus spells one string of the drawing. */
type CorpusString = { sheet: string; handle: string; kind: string; raw: string; view: string };

/** The space a sheet's own words stand in: general notes are PRINTED, so they stand on paper. */
const PAPER = "paper";

function corpusStrings(): CorpusString[] {
  const path = join(process.cwd(), BNBC_CORPUS);
  assert.ok(existsSync(path), `${BNBC_CORPUS} is ${BNBC_FIXTURE}'s committed notation corpus, and the checkout does not carry it`);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { fixture?: unknown; strings?: unknown };
  assert.equal(String(parsed.fixture), BNBC_FIXTURE, `${BNBC_CORPUS} is the corpus of ${String(parsed.fixture)}, not of ${BNBC_FIXTURE}`);
  assert.ok(Array.isArray(parsed.strings), `${BNBC_CORPUS} carries no strings`);
  return (parsed.strings as Record<string, unknown>[]).map((entry) => ({
    sheet: String(entry["sheet"]),
    handle: String(entry["handle"]),
    kind: String(entry["kind"]),
    raw: String(entry["raw"]),
    view: String(entry["view"]),
  }));
}

/**
 * The texts of one sheet, as `sheetTextsOn` hands them to the grammar: the ORIGINAL text entities,
 * keyed by the handle the artifact names them by. A block attribute carries no key of its own and
 * is no atom a reading could cite (L-CAD-03), so it is not a text of the sheet here either.
 */
function textsOf(sheet: string): SheetText[] {
  return corpusStrings()
    .filter((held) => held.sheet === sheet && held.kind !== "ATTRIB" && held.view === PAPER)
    .map((held) => ({ sourceKey: `DXF_HANDLE:${held.handle}`, text: held.raw }));
}

/** The raw string of one handle, as the corpus carries it. */
function rawOf(handle: string): string {
  const held = corpusStrings().find((entry) => entry.handle === handle);
  assert.ok(held !== undefined, `${BNBC_CORPUS} carries no string of handle ${handle}`);
  return held.raw;
}

/** The asked clauses of one sheet, keyed by `<handle>#<ordinal>` for a reader of a failure. */
function askedOn(sheet: string): Map<string, { clause: string; classifiable: boolean; figures: readonly string[] }> {
  const asked = askedClausesOf(textsOf(sheet));
  return new Map(asked.map((one) => [`${one.sourceKey.replace("DXF_HANDLE:", "")}#${one.ordinal}`, { clause: one.clause, classifiable: one.classifiable, figures: one.figures }]));
}

describe("one general-notes entity is many clauses (T-MTEXT-CODES)", () => {
  test("the MTEXT drawing codes go and the drawing's own words stay, with the paragraph mark as the break", () => {
    const clauses = clausesOf(rawOf("1F3E"));
    expect(clauses[0], "the heading of the block is its first clause, without its font run or its underline toggle").toBe("GENERAL NOTES");
    expect(clauses[1]).toBe(
      "1. THESE DRAWINGS SHALL BE READ WITH THE ARCHITECTURAL AND MEP DRAWINGS. ANY DISCREPANCY SHALL BE REFERRED TO THE ENGINEER BEFORE WORK PROCEEDS.",
    );
    expect(clauses[2]).toBe("2. DESIGN CODE: BNBC 2020, ACI 318-19 WHERE THE CODE IS SILENT.");
    expect(clauses.at(-1), "an underlined run inside a clause keeps its words and loses its braces").toBe("5. DO NOT SCALE THIS DRAWING - FIGURED DIMENSIONS GOVERN.");
    expect(clauses, "six paragraphs, and the trailing paragraph mark is no clause at all").toHaveLength(6);
    for (const clause of clauses) {
      expect(clause, `${JSON.stringify(clause)} carries no MTEXT code`).not.toMatch(/\\[A-Za-z]|[{}]/);
    }
  });

  test("a plain text entity is one clause, said as the drawing says it", () => {
    expect(clausesOf(rawOf("1F76"))).toEqual(["LAP 50d TENSION / 40d COMPRESSION U.N.O."]);
  });

  test("the figures of a clause are the drawing's own numbers, in the order it writes them", () => {
    expect(figuresIn("LAP 50d TENSION / 40d COMPRESSION U.N.O.")).toEqual(["50", "40"]);
    expect(figuresIn("fy = 72,500 psi (500 MPa) BDS ISO 6935-2 B500DWR"), "the thousands comma is part of the figure as written").toEqual([
      "72,500",
      "500",
      "6935",
      "2",
      "500",
    ]);
    expect(figuresIn("CLEAR COVER"), "a clause stating no figure states none").toEqual([]);
  });
});

describe("the lap table a general note may govern over (AM-03(e), T-NOTE-OVERRIDE)", () => {
  test("S-02 prints one and S-01 does not, and only the headings are carried", () => {
    const headings = lapTableHeadingsOn(textsOf(S02));
    expect(headings).toEqual([
      "DEVELOPMENT LENGTH ld  -  fy 500 MPa, f'c 3500 psi",
      "ld BOTTOM (mm)",
      "ld TOP (mm)",
      "LAP TENSION (mm)",
      "LAP COMPRESSION (mm)",
    ]);
    expect(lapTableHeadingsOn(textsOf(S01)), "S-01 states a lap too, and prints no table to rank it against").toEqual([]);
  });
});

describe("which clauses are asked at all (L-AI-03: the grammar speaks first)", () => {
  test("a clause the grammar read a kind off is not asked for a class", () => {
    const readByGrammar = new Set(proposeNotes(textsOf(S01)).map((proposal) => proposal.sourceKey.replace("DXF_HANDLE:", "")));
    expect([...readByGrammar].sort(), "the five S-01 entities the grammar reads today").toEqual(["1F41", "1F42", "1F43", "1F4E", "1F53"]);
    for (const asked of askedOn(S01).keys()) {
      expect(readByGrammar.has(asked.split("#")[0] as string), `${asked} stands on an entity the grammar already read`).toBe(false);
    }
  });

  test("the one clause the grammar DID read that is still asked is the lap the sheet's own table contests", () => {
    const asked = askedOn(S02);
    const lap = asked.get("1F76#1");
    expect(lap?.clause, "S-02's lap note stands on the only sheet printing a development-length table").toBe("LAP 50d TENSION / 40d COMPRESSION U.N.O.");
    expect(lap?.classifiable, "its class is the grammar's and is never offered — only its Noul is read (L-AI-03)").toBe(false);
    for (const [at, one] of asked) {
      if (at !== "1F76#1") expect(one.classifiable, `${at} is a clause nobody has read, so a class it comes back with may be offered`).toBe(true);
    }
  });

  test("a clause stating no figure, and a figure stated in no words, are never asked", () => {
    const asked = askedOn(S02);
    expect(asked.has("1F77#1"), "'(THIS NOTE GOVERNS OVER THE CODE TABLE)' states no figure of its own").toBe(false);
    expect(asked.has("1F8D#1"), "a cell of the ld table is a number and not a clause").toBe(false);
    expect(asked.has("1F8A#1"), "'LAP TENSION (mm)' is a column heading, which states no figure").toBe(false);
    expect(askedOn(S01).has("1F45#1"), "'CLEAR COVER' is a label over four clauses and states nothing itself").toBe(false);
  });

  test("the four cover clauses ARE asked, and the law has no class for them", () => {
    const asked = askedOn(S01);
    for (const handle of ["1F46", "1F47", "1F48", "1F49"]) {
      expect(asked.get(`${handle}#1`)?.clause, `${handle} is a clause of the notes stating a figure`).toContain("clear cover");
    }
    expect(NOTE_KINDS as readonly string[], "R-TO-034's roster is closed at five, and COVER is not one of them — abstention is the only honest answer").not.toContain("COVER");
  });

  test("the two clauses session 4 taught the grammar to be silent on are asked, and neither is a lap", () => {
    const asked = askedOn(S02);
    expect(asked.get("1F75#2")?.clause).toBe("11. LAPS SHALL BE STAGGERED; NOT MORE THAN 50% OF BARS MAY BE LAPPED AT ONE SECTION. NO LAP WITHIN A BEAM-COLUMN JOINT.");
    expect(asked.get("1F75#4")?.clause).toBe("13. STIRRUP ZONES: 2D FROM EACH SUPPORT FACE AT THE CLOSE SPACING, THE MIDDLE AT THE WIDE SPACING.");
    // The corpus records whether a model falls into the trap the grammar was taught to avoid: both
    // clauses state a figure and neither states a lap or a hook (R-TO-034, L-MEA-01).
    expect(readFigure("LAP", asked.get("1F75#2")?.clause ?? ""), "no clause of it states a multiple of d").toBeNull();
    expect(readFigure("HOOK", asked.get("1F75#4")?.clause ?? ""), "'2D FROM EACH SUPPORT FACE' is a zone and not a hook").toBeNull();
  });

  test("the asked set is the fixture's own, and its size is a fact this suite states", () => {
    const s01 = askedClausesOf(textsOf(S01));
    const s02 = askedClausesOf(textsOf(S02));
    expect(s01.length, "S-01's silent clauses").toBe(34);
    expect(s02.length, "S-02's silent clauses, and the lap its table contests").toBe(8);
    expect(s01.length + s02.length, "what a recording of these two sheets asks").toBe(42);
    for (const clause of [...s01, ...s02]) {
      expect(clause.figures.length, `${clause.sourceKey}#${clause.ordinal} states a figure`).toBeGreaterThan(0);
      expect(clause.clause, `${clause.sourceKey}#${clause.ordinal} is a clause of the drawing's own words`).not.toBe("");
    }
  });

  test("the whole drawing's asked set is a fact this suite states, sheet by sheet", () => {
    // What `record --question note-clause --drawing fixtures/rcc6-bnbc/rcc6-bnbc.dxf` would ask,
    // layout by layout: the recorder walks every paper layout of the drawing, not only the two
    // sheets whose general notes this product reads today (Q-08 — a committed fixture is corpus).
    const sheets = [...new Set(corpusStrings().map((held) => held.sheet))].sort();
    const perSheet = sheets.map((sheet) => [sheet, askedClausesOf(textsOf(sheet)).length] as const);
    expect(Object.fromEntries(perSheet)).toEqual({
      "S-00": 13,
      "S-01": 34,
      "S-02": 8,
      "S-03": 5,
      "S-04": 4,
      "S-05": 5,
      "S-06": 4,
      "S-07": 8,
      "S-08": 4,
      "S-09": 7,
      "S-10": 3,
      "S-11": 1,
      "S-12": 9,
      "S-13": 3,
      "S-14": 3,
      "S-15": 4,
      "S-16": 3,
      "S-17": 3,
      "S-18": 4,
      "S-19": 4,
      "S-20": 4,
      "S-21": 5,
      "S-22": 4,
      "S-23": 5,
      "S-24": 8,
      "S-25": 5,
      "S-26": 3,
    });
    // A detail sheet's PRINTED words are its title block and its revision block, and none of them
    // is a general note: outside S-00 to S-02 every sheet of this set asks at most eight clauses,
    // and most ask three. The word rule is what keeps a recording of a whole drawing affordable —
    // without it S-16's paper alone would ask over a hundred (L-AI-01, I-296).
    expect(
      perSheet.reduce((total, [, count]) => total + count, 0),
      "the whole recording, over every sheet the corpus carries",
    ).toBe(163);
  });

  test("the reading is deterministic: the same sheet read twice is the same asked set", () => {
    expect(askedClausesOf(textsOf(S01))).toEqual(askedClausesOf(textsOf(S01)));
  });
});

describe("the figure of a clause a model classified is the grammar's own (L-AI-03)", () => {
  test("a class the grammar's reader reads nothing for offers nothing at all", () => {
    // S-01's hook clause states a bend and no multiple, so a model answering HOOK offers a class
    // with no figure behind it — and a figure is what a reading is.
    expect(readFigure("HOOK", "10. WELDED HOOKS ARE NOT PERMITTED. ALL HOOKS 135° WHERE SHOWN ON S-03.")).toBeNull();
  });

  test("a class the reader does read is read verbatim, off the clause's own words", () => {
    expect(readFigure("LAP", "LAP 50d TENSION / 40d COMPRESSION U.N.O.")).toEqual({ valueAsWritten: "50d", unitAsWritten: "d", canonical: "50" });
    expect(readFigure("FC", "f'c = 3500 psi (24 MPa) cylinder")).toEqual({ valueAsWritten: "3500 psi", unitAsWritten: "psi", canonical: "3500" });
  });
});
