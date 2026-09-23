/**
 * What a drawing's text SHOWS (`@/core/entitygraph/text`): the one reading the sheet's painter, the
 * viewer's inspector and the schedule views say a drawing's words through (B-17). The strings are
 * F-RCC6-BNBC's own — S-11's bar calls, S-10's C7 and rotated-column notes, S-01's general notes —
 * so a reading that drifts from what the drawing shows is caught on the sentences a QS reads.
 */
import { describe, expect, test } from "vitest";
import { normaliseNotation } from "@/core/entitygraph/notation";
import { MTEXT_LINE_PITCH, displayLines, displayText } from "@/core/entitygraph/text";

describe("a TEXT is drawn with its control codes resolved to the glyphs they stand for", () => {
  test.each([
    ["8-16%%C", "8-16Ø"],
    ["10%%C@100/150 (TIES)", "10Ø@100/150 (TIES)"],
    ["C7 %%C450 PORCH COLUMN", "C7 Ø450 PORCH COLUMN"],
    ["COLUMN ON GRID 1a, ROTATED 45%%D", "COLUMN ON GRID 1a, ROTATED 45°"],
    ["20%%c", "20Ø"],
    ["%%P0.000", "±0.000"],
    ["SLUMP 100 %%p 25 mm", "SLUMP 100 ± 25 mm"],
    ["WASTAGE 3%%%", "WASTAGE 3%"],
    ["%%UUNDERLINED%%U", "UNDERLINED"],
    ["45%%176", "45°"],
    ["L \\U+2212 lap", "L − lap"],
  ])("%s is drawn as %s", (said, shown) => {
    expect(displayLines(said, "TEXT")).toEqual([shown]);
    expect(displayText(said), "a text whose type is not stated reads as a plain TEXT").toBe(shown);
  });

  test("a TEXT keeps what the draughtsman typed: case, spacing, a φ as a φ, a code it does not know as written", () => {
    expect(displayLines("  2-12φ T&B  ", "TEXT")).toEqual(["  2-12φ T&B  "]);
    expect(displayLines("kN/m%%2", "TEXT"), "`%%2` is no code a drawing states, so it is shown as typed").toEqual(["kN/m%%2"]);
    expect(displayLines("A\\PB", "TEXT"), "a plain TEXT draws no paragraph mark: its backslash is a character").toEqual(["A\\PB"]);
  });

  test("the reading of appearance folds nothing: the notation's Ø-lookalike folding stays the notation's", () => {
    expect(displayText("16φ")).toBe("16φ");
    expect(normaliseNotation("16φ"), "while the notation still reads the same text as the one sign").toBe("16Ø");
    expect(normaliseNotation("8-16%%C"), "and resolves the control codes through the same table").toBe(displayText("8-16%%C"));
  });
});

describe("an MTEXT is drawn as its paragraphs, the formatting taken away", () => {
  test("S-01's general note: the font run, the underline toggle and the alignment code go; each paragraph is a line", () => {
    const note =
      "{\\fSwis721 Cn BT|b1|i0|c0|p34;\\LCONCRETE AND REINFORCEMENT}\\P6. SLUMP 100 %%P 25 mm.\\P8. BAR LETTERS (T16 = Y16 = 16%%C).\\P10. ALL HOOKS 135%%D WHERE SHOWN ON S-03.\\P";
    expect(displayLines(note, "MTEXT")).toEqual([
      "CONCRETE AND REINFORCEMENT",
      "6. SLUMP 100 ± 25 mm.",
      "8. BAR LETTERS (T16 = Y16 = 16Ø).",
      "10. ALL HOOKS 135° WHERE SHOWN ON S-03.",
      "",
    ]);
  });

  test("S-06's schedule block: the underlined title and the header are two lines", () => {
    expect(displayLines("\\LPILE CAP SCHEDULE\\l\\PMARK        SIZE", "MTEXT")).toEqual(["PILE CAP SCHEDULE", "MARK        SIZE"]);
  });

  test("a code point escape is drawn as the character, before any code is taken away", () => {
    expect(displayLines("COUNTING: \\U+230a(distance + 0.5 mm)/spacing\\U+230b; n = \\U+2308L\\U+2309", "MTEXT")).toEqual([
      "COUNTING: ⌊(distance + 0.5 mm)/spacing⌋; n = ⌈L⌉",
    ]);
    expect(displayLines("\\U+221a(run\\U+00b2)", "MTEXT")).toEqual(["√(run²)"]);
    expect(displayLines("BAD \\U+D800 ESCAPE", "MTEXT"), "an escape naming no character is shown as written").toEqual(["BAD \\U+D800 ESCAPE"]);
  });

  test("a stacked fraction is said on the line, set apart from the whole number it follows", () => {
    expect(displayLines("FLIGHT WIDTH 3'-6\\S1/2;\"", "MTEXT")).toEqual(["FLIGHT WIDTH 3'-6 1/2\""]);
    expect(displayLines("\\S3#4;\" GAP", "MTEXT")).toEqual(["3/4\" GAP"]);
    expect(displayLines("kN/m\\S2^;", "MTEXT"), "a raised figure with nothing under it is the figure").toEqual(["kN/m2"]);
    expect(displayLines("\\S+0.5^-0.2;", "MTEXT")).toEqual(["+0.5 -0.2"]);
  });

  test("the characters an MTEXT escapes are drawn as themselves, never read as a group or a code", () => {
    expect(displayLines("\\{SEE NOTE\\} C:\\\\DWG", "MTEXT")).toEqual(["{SEE NOTE} C:\\DWG"]);
    expect(displayLines("\\U+007bA\\U+007d", "MTEXT"), "a brace spelled as a code point is a brace too").toEqual(["{A}"]);
  });

  test("a TEXT spelling a brace or a backslash as a code point shows the character, never a private-use stand-in", () => {
    expect(displayLines("\\U+007bA\\U+007d", "TEXT")).toEqual(["{A}"]);
    expect(displayText("C:\\U+005CDWG"), "a backslash spelled as a code point").toBe("C:\\DWG");
    expect(displayText("\\U+007B%%C16\\U+007D"), "beside a control code").toBe("{Ø16}");
  });

  test("a dimension's text above and below the line, and a column break, are lines of their own", () => {
    expect(displayLines("15'-0\"\\XC/C", "MTEXT")).toEqual(["15'-0\"", "C/C"]);
    expect(displayLines("A\\NB", "MTEXT")).toEqual(["A", "B"]);
  });

  test("a hard space is a space, and an MTEXT with no code is one line, itself", () => {
    expect(displayLines("10\\~mm", "MTEXT")).toEqual(["10 mm"]);
    expect(displayLines("PLAIN", "MTEXT")).toEqual(["PLAIN"]);
  });

  test("said as one string, the lines are joined by the break they are drawn with", () => {
    expect(displayText("A\\PB %%C", "MTEXT")).toBe("A\nB Ø");
  });

  test("the line pitch an MTEXT's lines stand at is the DXF default, five thirds of the height", () => {
    expect(MTEXT_LINE_PITCH).toBeCloseTo(5 / 3, 12);
  });
});
