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
  type PrintedCount,
} from "@/modules/takeoff/partition/notation/grammar";
import { parsePrintedQuantity, parseWholeNumber } from "@/modules/takeoff/partition/notation";

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
    for (const kind of ["bar_group", "bar_diameter", "spacing", "mark", "level_range", "grade_fc", "grade_fy", "cover", "dimension_ft_in", "reference", "span_fraction", "compound"]) {
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

describe("a printed quantity is read one way (B-17, s-schedules I-507)", () => {
  // The schedules' quantity column and the ratchet's F-COUNT once spelled `08 NOS` twice, and the two
  // spellings already differed on a bare `8`. The column is the grammar's count form, plus the bare
  // whole number only a quantity head lets stand — never a third reading of its own.
  const PROBES: readonly string[] = [...new Set([
    ...GRAMMAR.map((row) => row.input),
    "08 NOS", "01 NO", "10 NOS.", "08NOS", "8 no.", "08 Nos", "8", "08", " 12 ",
    "08 NOS PER FLOOR", "NOS", "8 NR", "8 PCS", "4-16%%C", "-", "SEE SCHEDULE", "",
  ])];

  test.each(PROBES.map((text): [string] => [text]))("%j", (text) => {
    const read = readNotation(text);
    const counted = read.ok && read.form === "F-COUNT" ? (read.parsed as PrintedCount).n : null;
    expect(
      parsePrintedQuantity(text),
      `"${text}" reads in a quantity column as the grammar's F-COUNT reads it, or as the bare whole number it is`,
    ).toBe(counted ?? parseWholeNumber(text));
  });

  test("the count form needs its word; only the column's head lets a bare number stand", () => {
    const worded = readNotation("08 NOS");
    expect(worded.ok && worded.form).toBe("F-COUNT");
    const bare = readNotation("08");
    expect(bare.ok && bare.form === "F-COUNT", "a bare 08 is a number some column wrote, not a count the grammar reads").toBe(false);
    expect(parsePrintedQuantity("08"), "under QTY the column's head says what the 08 counts").toBe(8);
    expect(parsePrintedQuantity("08 NOS PER FLOOR"), "a cell that also says something else is not read at all").toBeNull();
  });
});
