// What a schedule's reconstruction does with a text that reaches no column of the table (L-CAD-08,
// L-QTY-04): it answers it, rather than letting it fall out of the reading in silence.
//
// The table is drawn here, so what is owed is read off the drawing rather than transcribed (B-19).
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { PartitionedView } from "../views/assign";
import { VIEW_TYPE } from "../views/law";
import { reconstructSchedules } from "./reconstruct";

/** One text of the drawing: what it says, and where the draughtsman put it. */
function text(key: string, said: string, x: number, y: number, height = 1): Record<string, unknown> {
  return { key, type: "TEXT", space: "Model", layer: "S-ANNO", colour: { rgb: [0, 0, 0], source: "explicit" }, text: said, height, points: [[x, y]] };
}

const VIEW_KEY = "SCHEDULE:1";
const CAPTION = text("e:1", "COLUMN SCHEDULE", 0, 100, 5);

/** A header of three columns 100 apart — so a column reaches 50 either side of its own insertion. */
const HEADER = [text("e:2", "MARK", 0, 90), text("e:3", "SIZE", 100, 90), text("e:4", "MAIN BARS", 200, 90)];
const ROW = [text("e:5", "C1", 0, 80), text("e:6", "300x450", 100, 80), text("e:7", "8-16Ø", 200, 80)];

/** The one table the drawn entities reconstruct to. */
function tableOf(entities: readonly Record<string, unknown>[]): { cells: { sourceKeys: string[] }[]; unplaced: readonly { key: string; text: string }[] } {
  const answer = reconstructSchedules({
    graph: { entities } as unknown as EntityGraph,
    views: [{ viewKey: VIEW_KEY, type: VIEW_TYPE.SCHEDULE, reason: null, caption: "COLUMN SCHEDULE", anchorKey: CAPTION["key"] as string } as PartitionedView],
    assignments: new Map(entities.map((entity) => [entity["key"] as string, VIEW_KEY])),
  });
  expect(answer.tables.length, "the drawn schedule reconstructs to one table").toBe(1);
  return answer.tables[0] as never;
}

/** A schedule that stacks a mark's whole statement — the section over the bars over the ties, with
 * the mark written once level with the third of them (F-RCC6-BNBC S-11's own shape). The marks stand
 * 26 apart, so a line further off than 13 is no line of any mark's row. */
const STACKED_CAPTION = text("s:1", "COLUMN SCHEDULE", 0, 100, 5);
const STACKED = [
  text("s:2", "MARK", 0, 90),
  text("s:3", "GF TO 2ND", 100, 90),
  text("s:4", "300x450", 100, 82),
  text("s:5", "8-16Ø", 100, 78),
  text("s:6", "C1", 0, 74),
  text("s:7", "10Ø@100/150 (TIES)", 100, 74),
  text("s:8", "300x600", 100, 56),
  text("s:9", "10-20Ø", 100, 52),
  text("s:10", "C2", 0, 48),
  text("s:11", "10Ø@100/150 (TIES)", 100, 48),
  text("s:12", "ALL COLUMNS 40 mm CLEAR COVER", 0, 30),
];

/** The one table those entities reconstruct to, read through the shipped stage. */
function stackedTableOf(entities: readonly Record<string, unknown>[]): { cells: { rowIndex: number; columnIndex: number; text: string; sourceKeys: string[] }[] } {
  const answer = reconstructSchedules({
    graph: { entities } as unknown as EntityGraph,
    views: [{ viewKey: VIEW_KEY, type: VIEW_TYPE.SCHEDULE, reason: null, caption: "COLUMN SCHEDULE", anchorKey: STACKED_CAPTION["key"] as string } as PartitionedView],
    assignments: new Map(entities.map((entity) => [entity["key"] as string, VIEW_KEY])),
  });
  expect(answer.tables.length, "the drawn schedule reconstructs to one table").toBe(1);
  return answer.tables[0] as never;
}

describe("L-CAD-08: a row is delimited by the mark cells, not by the bands", () => {
  test("the lines a mark's own row stacks are one cell per column, joined in reading order and citing every text", () => {
    const cells = stackedTableOf([STACKED_CAPTION, ...STACKED]).cells;
    const band = cells.find((cell) => cell.rowIndex === 1 && cell.columnIndex === 1);

    expect(
      cells.filter((cell) => cell.columnIndex === 0).map((cell) => cell.text),
      "a header and one row per mark: read band for band, C1's row would carry the ties string as its section and two rows of the table would name no member at all",
    ).toEqual(["MARK", "C1", "C2", "ALL COLUMNS 40 mm CLEAR COVER"]);
    expect(band?.text, "the three lines of the cell are one cell, joined by the sign two texts of one cell are joined with (AC-2)").toBe("300x450+8-16Ø+10Ø@100/150 (TIES)");
    expect(band?.sourceKeys, "and the cell cites every text it was read from, down the page (L-CAD-03)").toEqual(["s:4", "s:5", "s:7"]);
  });

  test("a note standing further off than half the marks' own spacing is a row of its own", () => {
    const cells = stackedTableOf([STACKED_CAPTION, ...STACKED]).cells;

    expect(
      cells.filter((cell) => cell.rowIndex === 3).map((cell) => cell.text),
      "the note stands 18 below the last mark where the marks stand 26 apart — past the half where one row stops being the nearest, so it is nobody's section (L-QTY-01)",
    ).toEqual(["ALL COLUMNS 40 mm CLEAR COVER"]);
  });

  test("a table no band of which names a member is read band for band, as it always was", () => {
    const noise = [
      text("n:2", "MARK", 0, 90),
      text("n:3", "SIZE", 100, 90),
      text("n:4", "SEE NOTE 3", 0, 82),
      text("n:5", "300x450", 100, 82),
      text("n:6", "-", 0, 78),
      text("n:7", "300x600", 100, 78),
    ];
    const cells = stackedTableOf([STACKED_CAPTION, ...noise]).cells;

    expect(
      [...new Set(cells.map((cell) => cell.rowIndex))],
      "with no mark cell there is no row extent to read, and a table read some other way would be a guess: the bands stand as they were drawn",
    ).toEqual([0, 1, 2]);
  });
});

describe("L-CAD-08: a schedule's texts beyond every column", () => {
  test("a text standing beyond every column's reach is answered in `unplaced`, and reaches no cell", () => {
    const margin = text("e:8", "REV B — SEE NOTE 4", 500, 80);
    const table = tableOf([CAPTION, ...HEADER, ...ROW, margin]);

    expect(
      new Set(table.cells.flatMap((cell) => cell.sourceKeys)).has("e:8"),
      "a note out in the margin is no cell of the row it stands level with: folding it into the nearest column would rewrite that cell (L-CAD-08)",
    ).toBe(false);
    expect(
      table.unplaced.map((one) => ({ key: one.key, text: one.text })),
      "and what the drawing said there is answered with the key it was read from — a reading the drawing carries is never discarded in silence (L-QTY-04)",
    ).toEqual([{ key: "e:8", text: "REV B — SEE NOTE 4" }]);
  });

  test("a table whose every text lands in a column answers an empty list", () => {
    expect(
      tableOf([CAPTION, ...HEADER, ...ROW]).unplaced,
      "an empty list, never an absence a reader has to guess at (R-UI-050)",
    ).toEqual([]);
  });

  test("unplaced texts are answered in reading order, down the page and then across", () => {
    const table = tableOf([CAPTION, ...HEADER, ...ROW, text("e:8", "(TYP)", -200, 70), text("e:9", "REV B", 500, 80)]);
    expect(
      table.unplaced.map((one) => one.text),
      "the page is read down first: the note level with the first row stands before the one beneath it, whatever order the artifact listed them in",
    ).toEqual(["REV B", "(TYP)"]);
  });
});

/* ------------------------------------------------------------------ I-320: a caption on the paper */

/**
 * A sheet that titles a schedule's window on its PAPER, beneath the frame — F-RCC6-BNBC's PILE
 * SCHEDULE is drawn that way: the caption `PILE SCHEDULE  SCALE 1:50` stands on S-05's paper under
 * the viewport, and model space holds only a note, the header band and the rows, ABOVE any caption.
 * The partition assigns no paper text to a view (L-CAD-06), so the view's anchor is none of its own
 * texts. Drawn here at the pile schedule's own spacing (header 700 above the row), never read out of
 * the fixture (B-19).
 */
const MODEL = "Model";
const PAPER = "S-05";
const LAYOUTS = [
  { name: MODEL, kind: "model" },
  { name: PAPER, kind: "paper" },
];

/** A text written on the sheet's paper rather than in model space. */
function onPaper(key: string, said: string, x: number, y: number, height = 5): Record<string, unknown> {
  return { ...text(key, said, x, y, height), space: PAPER };
}

const PAPER_CAPTION = onPaper("p:1", "PILE SCHEDULE  SCALE 1:50", 10, 5);
const PILE_NOTE = text("p:2", "BORED CAST-IN-SITU PILES, f'c = 3000 psi", 0, 1890, 260);
const PILE_HEADER = [text("p:3", "MARK", 0, 700, 240), text("p:4", "DIA (mm)", 1400, 700, 240), text("p:5", "LENGTH (mm)", 3000, 700, 240), text("p:6", "NOS", 10600, 700, 240)];
const PILE_ROW = [text("p:7", "P", 0, 0, 240), text("p:8", "500", 1400, 0, 240), text("p:9", "21336", 3000, 0, 240), text("p:10", "89", 10600, 0, 240)];

/** What the stage answers for one SCHEDULE view anchored on `anchor`, over the model texts drawn. */
function readUnder(anchor: string, entities: readonly Record<string, unknown>[], layouts: readonly unknown[] | null = LAYOUTS) {
  const model = entities.filter((entity) => entity["space"] === MODEL);
  return reconstructSchedules({
    graph: (layouts === null ? { entities } : { entities, layouts }) as unknown as EntityGraph,
    views: [{ viewKey: VIEW_KEY, type: VIEW_TYPE.SCHEDULE, reason: null, caption: "PILE SCHEDULE  SCALE 1:50", anchorKey: anchor } as PartitionedView],
    // Model space only: a paper text is assigned to no view, exactly as the views stage leaves it.
    assignments: new Map(model.map((entity) => [entity["key"] as string, VIEW_KEY])),
  });
}

describe("I-320: a schedule its sheet titles on the PAPER reads its own model texts top-down", () => {
  test("the header is the first band naming the column of marks, the note above it is no row, and the paper caption titles the table", () => {
    const answer = readUnder(PAPER_CAPTION["key"] as string, [PAPER_CAPTION, PILE_NOTE, ...PILE_HEADER, ...PILE_ROW]);
    expect(answer.deferrals, "a table was read, so the view does not defer").toEqual([]);
    const table = answer.tables[0];
    expect(table?.scheduleKey, "the table is keyed by the caption that titles it — the paper text, traced back to the drawing (L-CAD-03)").toBe("p:1");
    expect(table?.title, "and titled by it").toBe("PILE SCHEDULE  SCALE 1:50");
    expect(table?.pitch, "the pitch is the step from the header to the band beneath it").toBe(700);
    expect(
      table?.cells.map((cell) => `${cell.rowIndex}:${cell.columnIndex}=${cell.text}`),
      "the header band and the one row beneath it, cell by cell; the note above the header is in no row",
    ).toEqual(["0:0=MARK", "0:1=DIA (mm)", "0:2=LENGTH (mm)", "0:3=NOS", "1:0=P", "1:1=500", "1:2=21336", "1:3=89"]);
  });

  test("a paper-titled view whose only mark header has nothing beneath it reads no table, and defers", () => {
    // F-RCC6-BNBC's PILE CAP SCHEDULE with its header MTEXT taken away (the MTEXT is read since FND-2,
    // I-330, below): the footer beneath the rows reads as a header (`… NO NOS COLUMN`) with no band
    // under it.
    const footer = text("p:11", "COUNTS ARE TAKEN FROM THE LAYOUT ABOVE THIS OFFICE PRINTS NO NOS COLUMN", 0, -1000, 220);
    const answer = readUnder(PAPER_CAPTION["key"] as string, [PAPER_CAPTION, ...PILE_ROW, footer]);
    expect(answer.tables, "half a table — rows with no header over them — is worse than none (L-QTY-04)").toEqual([]);
    expect(answer.deferrals.map((one) => one.reason)).toEqual(["SCHEDULE_NONE_RECONSTRUCTED"]);
  });

  test("an anchor in MODEL space that its view does not hold still reads nothing — the top-down reading is the paper caption's alone", () => {
    const stray = text("p:12", "PILE SCHEDULE  SCALE 1:50", 0, 5000, 400);
    const held = [PILE_NOTE, ...PILE_HEADER, ...PILE_ROW];
    const answer = reconstructSchedules({
      graph: { entities: [...held, stray], layouts: LAYOUTS } as unknown as EntityGraph,
      views: [{ viewKey: VIEW_KEY, type: VIEW_TYPE.SCHEDULE, reason: null, caption: "PILE SCHEDULE  SCALE 1:50", anchorKey: stray["key"] as string } as PartitionedView],
      // The caption is a model-space text another view was handed: this view holds everything but it.
      assignments: new Map([...held.map((entity) => [entity["key"] as string, VIEW_KEY] as const), [stray["key"] as string, "SCHEDULE:2"]]),
    });
    expect(answer.tables.length, "a caption drawn in model space anchors by where it stands, and one its view does not hold anchors nothing").toBe(0);
  });

  test("an artifact naming no model layout says of no text that it stands on paper, so the reading stands as it always did", () => {
    const answer = readUnder(PAPER_CAPTION["key"] as string, [PAPER_CAPTION, PILE_NOTE, ...PILE_HEADER, ...PILE_ROW], null);
    expect(answer.tables, "no layout says the caption is paper, so nothing anchors the table").toEqual([]);
    expect(answer.deferrals.map((one) => one.reason)).toEqual(["SCHEDULE_NONE_RECONSTRUCTED"]);
  });
});

/* ------------------------------------------------------------------ I-330: an MTEXT, and an un-ruled table */

/**
 * F-RCC6-BNBC's S-06 PILE CAP SCHEDULE, at its own shape: the title and the header typed into ONE
 * MTEXT (`\L…\l` underlines the title, `\P` breaks the line), the header's names spaced apart over
 * rows of TEXTs standing at their own x's with no rule between, and a footer MTEXT beneath the rows
 * whose second line reads like a header (`… NO NOS COLUMN`). Drawn here, never read out of the fixture
 * (B-19). The MTEXT's own height is 260, so its second line stands 5/3 × 260 beneath its first.
 */
function mtext(key: string, said: string, x: number, y: number, height: number): Record<string, unknown> {
  return { ...text(key, said, x, y, height), type: "MTEXT" };
}
const CAP_HEADER = mtext("m:1", "\\LPILE CAP SCHEDULE\\l\\PMARK        SIZE                 DEPTH      PILES", 0, 0, 260);
const CAP_ROWS = [
  ["m:2", "PC1", 0, -900],
  ["m:3", "2000x1000", 2400, -900],
  ["m:4", "1295", 5600, -900],
  ["m:5", "2", 7800, -900],
  ["m:6", "PC2", 0, -1600],
  ["m:7", "2100x1750", 2400, -1600],
  ["m:8", "1295", 5600, -1600],
  ["m:9", "3", 7800, -1600],
].map(([key, said, x, y]) => text(key as string, said as string, x as number, y as number, 240));
const CAP_FOOTER = mtext("m:10", "COUNTS ARE TAKEN FROM THE LAYOUT ABOVE\\PTHIS OFFICE PRINTS NO NOS COLUMN", 0, -2600, 220);

describe("I-330: an MTEXT is read as the lines it draws, and an un-ruled table's columns are where its rows stand", () => {
  test("the title and the header typed into one MTEXT are two lines; the header names the columns the rows stand at", () => {
    const answer = readUnder(PAPER_CAPTION["key"] as string, [PAPER_CAPTION, CAP_HEADER, ...CAP_ROWS, CAP_FOOTER]);
    const table = answer.tables[0];
    expect(answer.deferrals, "the table reads").toEqual([]);
    expect(table?.columns, "four columns, at the rows' own x's").toEqual([0, 2400, 5600, 7800]);
    expect(table?.pitch, "the header's line stands one MTEXT pitch (5/3 × 260) under the title, and the first row 900 under the MTEXT").toBeCloseTo(900 - (260 * 5) / 3, 9);
    expect(
      table?.cells.map((cell) => `${cell.rowIndex}:${cell.columnIndex}=${cell.text}@${cell.sourceKeys.join(",")}`),
      "the header's names in its own word order, each citing the MTEXT; the rows verbatim; the title is no row",
    ).toEqual([
      "0:0=MARK@m:1",
      "0:1=SIZE@m:1",
      "0:2=DEPTH@m:1",
      "0:3=PILES@m:1",
      "1:0=PC1@m:2",
      "1:1=2000x1000@m:3",
      "1:2=1295@m:4",
      "1:3=2@m:5",
      "2:0=PC2@m:6",
      "2:1=2100x1750@m:7",
      "2:2=1295@m:8",
      "2:3=3@m:9",
    ]);
  });

  test("the footer beneath the rows is neither a header nor a row: a band of one text aligns with no column", () => {
    const table = readUnder(PAPER_CAPTION["key"] as string, [PAPER_CAPTION, CAP_HEADER, ...CAP_ROWS, CAP_FOOTER]).tables[0];
    expect(table?.cells.some((cell) => cell.sourceKeys.includes("m:10")), "no cell cites the footer").toBe(false);
    expect(table?.unplaced, "and it is no unplaced text of the table's rows either — the table ended above it").toEqual([]);
  });

  test("a one-text header whose rows put no mark under its MARK keeps the reading it always had (S-25's lintel schedule)", () => {
    // Four names, and the rows' texts stand at four x's — but the L-rows' marks stand at none the
    // header's MARK is written over: which column is which is not a thing these rows say.
    const header = text("l:1", "MARK        SIZE            BARS                   OPENING (mm)", 0, 0, 240);
    const rows = [text("l:2", "L1", 11400, -900, 240), text("l:3", "OVER 1000 OPENING", 13000, -900, 200), text("l:4", "BW250  BRICK WALL", 0, -2500, 240), text("l:5", "BW250", 7000, -2500, 240)];
    const table = readUnder(PAPER_CAPTION["key"] as string, [PAPER_CAPTION, header, ...rows]).tables[0];
    expect(table?.columns, "the header text's own insertion, one column, as before — the rows' marks stand where the header does not put them").toEqual([0]);
    expect(table?.cells.filter((cell) => cell.rowIndex === 0).map((cell) => cell.text), "and the header is the one text it is").toEqual(["MARK        SIZE            BARS                   OPENING (mm)"]);
  });

  test("a text with no inline code is read exactly as it was drawn, braces and all", () => {
    const braced = [text("b:1", "MARK", 0, 700, 240), text("b:2", "SIZE {TYP}", 1400, 700, 240), text("b:3", "C1", 0, 0, 240), text("b:4", "300x450", 1400, 0, 240)];
    const table = readUnder(PAPER_CAPTION["key"] as string, [PAPER_CAPTION, ...braced]).tables[0];
    expect(table?.cells.map((cell) => cell.text), "only a text carrying an MTEXT code is cut into lines").toEqual(["MARK", "SIZE {TYP}", "C1", "300x450"]);
  });
});
