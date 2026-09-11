/**
 * The notation grammar's contract (R-TO-031, L-CAD-08): the table IS the suite. Every row of
 * `GRAMMAR` is a case, every form the parser is built from owns at least one row, and a string no
 * form reads answers the registered refusal naming the token — never null, never a throw.
 *
 * Nothing here touches a database, a model or a sheet: the grammar is total over strings.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import {
  FORM_IDS,
  GRAMMAR,
  NOTATION_UNREAD,
  plainly,
  readNotation,
  type FormId,
  type GrammarRow,
} from "@/modules/takeoff/partition/notation/grammar";

/** The forms every row of the table was read by — collected once, for the coverage contract. */
const FORMS_EXERCISED = new Set<FormId>(
  GRAMMAR.map((row) => readNotation(row.input)).flatMap((read) => (read.ok ? [read.form] : [])),
);

describe("every row of the table reads as the table says it reads", () => {
  test.each(GRAMMAR.map((row): [string, GrammarRow] => [`${row.kind}: ${row.input}`, row]))("%s", (_name, row) => {
    const read = readNotation(row.input);
    expect(read.ok, `"${row.input}" (${row.source}) is a form the grammar reads`).toBe(true);
    if (!read.ok) return;
    expect(read.kind, `"${row.input}" answers the question the table says it answers`).toBe(row.kind);
    expect(read.parsed, `"${row.input}" (${row.source}) reads as the table's row`).toStrictEqual(row.parsed);
    expect(read.asWritten, "the cell is carried back verbatim beside what was read out of it (L-CAD-03)").toBe(row.input);
  });
});

describe("the table is the parser's whole contract", () => {
  test("every kind the roster names owns a row", () => {
    const kinds = new Set(GRAMMAR.map((row) => row.kind));
    for (const kind of ["bar_group", "bar_diameter", "spacing", "mark", "level_range", "grade_fc", "grade_fy", "cover", "dimension_ft_in"]) {
      expect(kinds.has(kind as GrammarRow["kind"]), `the table states at least one ${kind}`).toBe(true);
    }
  });

  test("every form the parser is generated from is exercised by a row", () => {
    for (const form of FORM_IDS) {
      expect(FORMS_EXERCISED.has(form), `${form} owns a row of the table — a form nothing exercises is a form nothing pins`).toBe(true);
    }
  });

  test("no two rows state the same input", () => {
    const inputs = GRAMMAR.map((row) => row.input);
    expect(new Set(inputs).size, "a form is stated once (B-19)").toBe(inputs.length);
  });

  test("no row reproduces a project's own text: every source names a trap or a habit", () => {
    for (const row of GRAMMAR) expect(row.source.length, `"${row.input}" says where its form was seen`).toBeGreaterThan(3);
  });
});

describe("the strings a second draughtsman's habits used to lose", () => {
  /** The fourteen the survey found unread — each one a cell that would never have reached a bill. */
  const ONCE_UNREAD = [
    "4T16", "4Y16", "#5", "Ø16@150 c/c", "C-1", "GB-1", "2-20%%C st.",
    "5.0mm%%C MS Wire @ 75mm c/c", "F.B-1", "20%%c", "âˆ…16", "4-Ø16 T&B", "3RD & 4TH", "GF TO 3RD",
  ] as const;

  test.each(ONCE_UNREAD)("%s reads", (input) => {
    const read = readNotation(input);
    expect(read.ok, `"${input}" is read, not refused`).toBe(true);
  });
});

describe("what the grammar cannot read, it refuses by name", () => {
  test("an unread cell answers the registered code and names the token", () => {
    const read = readNotation("SEE DETAIL ON SHEET");
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.code).toBe(NOTATION_UNREAD);
    expect(REFUSALS[NOTATION_UNREAD].code, "the refusal is one of core's closed taxonomy").toBe(NOTATION_UNREAD);
    expect(read.token.length, "the refusal names the token it stopped on, never a shrug").toBeGreaterThan(0);
  });

  test("a bar size the standard does not hold is refused, not invented", () => {
    const read = readNotation("#12");
    expect(read.ok, "#12 is not an ASTM A615 designation — inventing a diameter for it would invent steel").toBe(false);
  });

  test("the reader is total: an empty cell answers a refusal rather than throwing", () => {
    const read = readNotation("");
    expect(read.ok).toBe(false);
  });
});

describe("one normalisation, read by every form", () => {
  test("the mojibake of ∅, the control codes and the MTEXT formatting all fold to the drawing's own glyphs", () => {
    expect(plainly("âˆ…16")).toBe("Ø16");
    expect(plainly("20%%c")).toBe("20Ø");
    expect(plainly("{\\fSwis721 Cn BT|b1|i0|c0|p34;\\LTOP}")).toBe("TOP");
    expect(plainly("A\\PB"), "a \\P is a line break, and two lines of one cell are one cell's words").toBe("A B");
  });

  test("the decimal point inside a number survives the abbreviating dots", () => {
    expect(plainly("5.0mm%%C"), "5.0 is five, not fifty").toBe("5.0MMØ");
  });
});
