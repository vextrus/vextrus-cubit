/**
 * The note grammar reads a sentence AFTER its MTEXT codes are resolved (Interpretation I-459,
 * R-TO-034, L-CAD-08). A real notes block is one MTEXT of many paragraphs, drawn with font, height and
 * alignment codes, and a code glued to the front of a word — `\Pfy`, `\PLAP` — took the word boundary
 * the grammar reads `fy` and `LAP` by: the figure beside it went unread, and a person saw no offer.
 *
 * Three things are pinned: the glued word reads; a lap figure still belongs to the clause that names
 * the lap once `\P` has become a line break; and a stacked fraction's denominator, now visible, is
 * never taken for a strength or a lap.
 *
 * Nothing here opens a store, a clock or a model: the grammar is total over strings.
 */
import { describe, expect, test } from "vitest";
import { clausesOf } from "@/core/notes/clauses";
import { proposeNotes, readFigure } from "@/core/notes/grammar";

/** What the grammar proposes off one text, as (kind, value as written, canonical figure). */
function proposedOff(text: string): [string, string, string][] {
  return proposeNotes([{ sourceKey: "e:1", text }]).map((one) => [one.kind, one.valueAsWritten, one.canonical]);
}

describe("I-459: a code glued to a note's word no longer hides it", () => {
  test("`fy` after a paragraph mark reads the grade", () => {
    expect(proposedOff("{\\fSwis721 Cn BT|b1|i0|c0|p34;\\LMATERIALS}\\Pfy = 415 MPa")).toEqual([["FY", "415 MPa", "415"]]);
  });

  test("`f'c` after an alignment code reads the strength", () => {
    expect(proposedOff("\\A1;f'c = 3000 psi")).toEqual([["FC", "3000 psi", "3000"]]);
  });

  test("`LAP` after a paragraph mark reads the lap", () => {
    expect(proposedOff("DETAILING\\PLAP 50d IN TENSION")).toEqual([["LAP", "50d", "50"]]);
  });

  test("the sentence a proposal cites is kept verbatim, codes and all (L-CAD-03)", () => {
    const drawn = "GRADES\\Pfy = 500 MPa";
    expect(proposeNotes([{ sourceKey: "e:1", text: drawn }]).map((one) => one.text)).toEqual([drawn]);
  });

  test("readFigure — the figure of a clause a model classified — reads through the same stripper", () => {
    expect(readFigure("FY", "{\\H0.8x;\\Pfy = 415 MPa}")?.canonical).toBe("415");
  });
});

describe("I-459: a lap figure stays in the clause that names the lap", () => {
  test("a paragraph break ends a clause: the stirrup clause's 2d is no lap", () => {
    expect(proposedOff("NO LAP WITHIN A JOINT\\PSTIRRUP ZONES 2d FROM EACH FACE"), "the paragraph mark is a clause boundary once it has become a line break").toEqual([]);
  });

  test("and the lap on its own paragraph still reads", () => {
    expect(proposedOff("STIRRUP ZONES 2d FROM EACH FACE\\PLAPS 45d")).toEqual([["LAP", "45d", "45"]]);
  });
});

describe("I-459: a stacked fraction's denominator is never a note's figure", () => {
  test("f'c = 4½ ksi proposes no strength of 2 ksi", () => {
    expect(proposedOff("f'c = 4\\S1/2; ksi"), "four and a half is not read as a figure here, and two is never read in its place").toEqual([]);
  });

  test("f'c = 4 1/12 ksi proposes no strength of 2 ksi: a figure never starts inside the denominator", () => {
    expect(proposedOff("f'c = 4\\S1/12; ksi")).toEqual([]);
  });

  test("f'c = ½ ksi proposes no strength of 2 ksi: a fraction with no whole number has a denominator too", () => {
    expect(proposedOff("f'c = \\S1/2; ksi")).toEqual([]);
  });

  test("a lap of 40½d proposes no lap of 2d: the fraction's bar is no clause boundary", () => {
    expect(proposedOff("LAP 40\\S1/2;d IN TENSION")).toEqual([]);
    expect(proposedOff("LAPS: 40\\S1/2;d"), "nor where no clause names tension").toEqual([]);
  });

  test("a ratio's second figure is never read alone: 415/500 MPa states two grades, not 500", () => {
    expect(proposedOff("fy = 415/500 MPa")).toEqual([]);
  });

  test("a fraction elsewhere in the block does not stop the figure that is stated whole", () => {
    expect(proposedOff("COVER 1\\S1/2;\"\\Pfy = 415 MPa")).toEqual([["FY", "415 MPa", "415"]]);
  });
});

describe("I-459: a slash after a word still cuts a lap's clauses, and a figure after it still reads", () => {
  test("the tension lap after a slash is read in its own clause", () => {
    expect(proposedOff("LAP 40d IN COMPRESSION / 50d IN TENSION")).toEqual([["LAP", "50d", "50"]]);
    expect(proposedOff("LAP 40d COMPRESSION/50d TENSION")).toEqual([["LAP", "50d", "50"]]);
  });

  test("two laps a slash apart: the one in the clause that names the lap", () => {
    expect(proposedOff("LAP 50d/40d")).toEqual([["LAP", "50d", "50"]]);
  });

  test("a strength after a slash that follows a unit reads", () => {
    expect(proposedOff("fy = 60 ksi/415 MPa")).toEqual([["FY", "415 MPa", "415"]]);
  });
});

describe("I-459: a strength is read in what the note states of it, never beside it", () => {
  test("fy and f'c a paragraph apart: fy is never the f'c's figure before it", () => {
    expect(proposedOff("{\\LNOTES:}\\Pf'c = 3,500 psi\\Pfy = 60,000 psi")).toEqual([
      ["FY", "60,000 psi", "60000"],
      ["FC", "3,500 psi", "3500"],
    ]);
  });

  test("fy and f'c a comma apart: f'c is never the fy's figure before it", () => {
    expect(proposedOff("{\\fArial|b1|i0|c0|p34;\\LLAP LENGTHS (fy=60 ksi, f'c=4.5 ksi):}")).toEqual([
      ["FY", "60 ksi", "60"],
      ["FC", "4.5 ksi", "4.5"],
    ]);
  });

  test("the metric restatement of fy is still the one read, inside fy's own statement", () => {
    expect(proposedOff("f'c = 25 MPa, fy = 60,000 psi (415 MPa)")).toEqual([
      ["FY", "415 MPa", "415"],
      ["FC", "25 MPa", "25"],
    ]);
    expect(proposedOff("fy = 60 ksi, f'c = 25 MPa"), "and fy never takes the MPa figure f'c states after it").toEqual([
      ["FY", "60 ksi", "60"],
      ["FC", "25 MPa", "25"],
    ]);
  });

  test("a clause naming fy with no figure of its own proposes no grade", () => {
    expect(proposedOff("GRADES: fy AS PER BDS\\Pf'c = 3000 psi")).toEqual([["FC", "3000 psi", "3000"]]);
  });
});

describe("I-458: a note's clauses are read once", () => {
  test("an escaped backslash before a P is a backslash and a P — never a second paragraph break", () => {
    expect(clausesOf("SEE C:\\\\PLANS\\PLAP 50d")).toEqual(["SEE C:\\PLANS", "LAP 50d"]);
  });
});
