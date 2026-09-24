// @vitest-environment node
/**
 * S-Ask's presenter (docs/design/s-ask.md §1.1, §3, I-398, I-404): the engine's own answers to the
 * F-RCC6-BNBC read-back, written in the string table's words. Nothing is transcribed twice: every
 * expected sentence is the table's template filled with the read-back's own figures, and every
 * figure's face is the format seam's answer at the places the facts carry.
 */
import { describe, expect, test } from "vitest";
import { ELEMENT_TYPES } from "@/core/catalogue/classes";
import { KINDS } from "@/core/catalogue/kinds";
import { formatUserFigure } from "@/core/format";
import { NOTE_KINDS } from "@/core/notes/law";
import { answerStatement } from "@/modules/takeoff/ask/answer";
import { ASK_INTENTS, type AskAnswer, type AskFigure } from "@/modules/takeoff/ask/law";
import { statedAt } from "@/modules/takeoff/bbs-ui/present";
import { selectionAddress } from "@/modules/takeoff/trace/address";
import { fill, strings } from "@/ui/strings";
import {
  breakdownOf,
  composeLine,
  figureHref,
  heldLine,
  intentWord,
  keyed,
  linelessMarks,
  partialRowsOf,
  plain,
  readingWords,
  refusalEvidence,
  rowsTablesOf,
  statementRows,
  type Links,
  type Seg,
} from "../../../src/app/(app)/t/[tenant]/p/[project]/takeoff/ask/present";
import { linesOf, objectsOf, readBackSources } from "../../ai/ask/support/readback";

const SOURCES = readBackSources();
const TENANT = "tenant-1";
const PROJECT = "project-1";

function answered(question: string): Extract<AskAnswer, { outcome: "ANSWERED" }> {
  const answer = answerStatement({ question }, SOURCES);
  if (answer.outcome !== "ANSWERED") return expect.fail(`"${question}" must be answered, and it was ${JSON.stringify(answer)}`);
  return answer;
}

function linksOf(answer: Extract<AskAnswer, { outcome: "ANSWERED" }>): Links {
  return { tenantId: TENANT, projectId: PROJECT, answerId: "answer-1", anyPlace: answer.facts.places.length > 0 };
}

const table = strings as unknown as Readonly<Record<string, string | undefined>>;

describe("every roster member has its words (§3, enumerated — a member with none fails here)", () => {
  test("each class has its singular and plural, each kind its phrase and its trade, each note kind and intent its word", () => {
    for (const klass of ELEMENT_TYPES) {
      expect(table[`ask_class_${klass}_one`], `class ${klass}, singular`).toBeTruthy();
      expect(table[`ask_class_${klass}_other`], `class ${klass}, plural`).toBeTruthy();
    }
    for (const kind of KINDS) {
      expect(table[`ask_kind_${keyed(kind)}`], `kind ${kind}'s (class, kind) phrase`).toBeTruthy();
      expect(table[`ask_trade_${keyed(kind)}`], `kind ${kind}'s trade words`).toBeTruthy();
    }
    for (const noteKind of NOTE_KINDS) expect(table[`ask_note_kind_${keyed(noteKind)}`], `note kind ${noteKind}`).toBeTruthy();
    for (const intent of ASK_INTENTS) expect(intentWord(intent), `intent ${intent} reads as a word, never its code`).not.toBe(intent);
    expect(new Set(KINDS.map(keyed)).size, "no two kinds flatten to one key").toBe(KINDS.length);
  });

  test("ARCH-2's opening class and its three finishes read as words (the grammar already names them)", () => {
    expect(table["ask_class_opening_other"]).toBe("openings");
    for (const kind of ["finish.flooring", "finish.tiling", "finish.skirting"]) {
      expect(fill(table[`ask_kind_${keyed(kind)}`] ?? "", { class: "surface", classes: "surfaces" }), kind).not.toContain("{");
    }
  });
});

describe("a statement is composed from the table, a fragment not called for taken out cleanly", () => {
  test("an omitted fragment leaves no doubled space and no space before the stop, and the first letter is capitalised", () => {
    const line = composeLine(strings.ask_count, { count: [{ t: "text", text: "3" }], class: [{ t: "text", text: "columns" }], marked: [], where: [] });
    expect(plain(line)).toBe("3 columns.");
    const phrase = composeLine(strings.ask_quantity_none, { phrase: [{ t: "text", text: "column concrete" }], where: [] });
    expect(plain(phrase)).toBe("Column concrete: no figure. Every line stands without one.");
  });
});

describe("COUNT — 'How many C3 columns are on 5F?' reads 6, and the figure selects the six marks (I-404, I-487)", () => {
  test("the sentence, its figure and where the figure links", () => {
    const answer = answered("How many C3 columns are on 5F?");
    const links = linksOf(answer);
    const counted = objectsOf().filter((object) => object.class === "column" && object.mark === "C3" && object.level === "5F").length;
    const [first, second] = statementRows(answer, links);
    expect(plain(first ?? [])).toBe(fill(strings.ask_count, { count: String(counted), class: "columns", marked: "marked C3", where: "on 5F" }));
    const figure = (first ?? []).find((seg): seg is Extract<Seg, { t: "figure" }> => seg.t === "figure");
    expect(figure?.face).toBe(String(counted));
    expect(figure?.figure.value).toBe(String(counted));
    expect(first?.filter((seg) => seg.t === "code").map((seg) => (seg as { text: string }).text), "the mark and the level are the drawing's codes").toEqual(["C3", "5F"]);
    expect(plain(second ?? []), "a typical plan says the levels it stands for").toMatch(/^They are drawn once, on a typical plan that stands for \S+ to \S+\.$/u);
    const places = answer.facts.statement.intent === "COUNT" ? answer.facts.statement.count.at : [];
    if (places.length === 1) {
      const [place] = places;
      expect(figure?.href, "one sheet: the figure opens it, selecting every member counted").toBe(selectionAddress(TENANT, PROJECT, { drawingId: place?.drawingId ?? "", layoutName: place?.layoutName ?? "", sourceKeys: place?.keys ?? [] }));
    }
  });
});

describe("QUANTITY — one figure, the register's face, from the complete lines alone (I-398, I-399)", () => {
  test("'What is the column concrete?' states the footer's face and the lines it was summed from", () => {
    const answer = answered("What is the column concrete?");
    const links = linksOf(answer);
    const complete = linesOf().filter((line) => line.class === "column" && line.kind === "rcc.concrete" && line.coverage === "COMPLETE" && line.value !== null);
    const statement = answer.facts.statement.intent === "QUANTITY" ? answer.facts.statement : expect.fail("a quantity");
    const face = formatUserFigure(statedAt(statement.figure?.value ?? "", 3));
    const [row] = statementRows(answer, links);
    expect(face, "the proof's own face").toBe("93.893");
    expect(plain(row ?? [])).toBe(
      fill(strings.ask_quantity, { phrase: "Column concrete", where: "", figure: face, unit: "m3", lines: fill(strings.ask_lines_other, { lines: formatUserFigure(String(complete.length)) }) }).replace(" :", ":"),
    );
    const unit = (row ?? []).find((seg) => seg.t === "unit");
    expect(unit, "the unit follows the figure as its own badge, never inside the link (L-FMT-02)").toEqual({ t: "unit", unit: "m3" });
  });

  test("every Rows line table row opens the register at its own row, and a PARTIAL line states what is unstated", () => {
    const answer = answered("Why do the beams have no quantity?");
    const [lines] = rowsTablesOf(answer.facts, linksOf(answer));
    expect(lines?.tableId).toBe("ask-rows-lines");
    const first = lines?.rows[0];
    const register = first?.cells["register"]?.[0];
    expect(register?.t === "link" ? register.href : "").toBe(`/t/${TENANT}/p/${PROJECT}/takeoff/register?line=${encodeURIComponent(first?.id ?? "")}`);
    expect(plain(first?.cells["value"] ?? [])).toMatch(/ unstated$/u);
  });
});

describe("what an answer leaves out is said in the registry's words, never its codes (I-399)", () => {
  test("the beams' partial rows carry each code's registered message and remedy", () => {
    const answer = answered("Why do the beams have no quantity?");
    const partial = answer.facts.partial ?? expect.fail("the beams stand without a figure");
    const rows = partialRowsOf(partial, answer.reading, true);
    expect(rows.lines.lead, "the statement already counted the lines").toBeNull();
    for (const row of rows.lines.rows) {
      expect(row.text).not.toMatch(/[A-Z]{3,}_[A-Z_]+/u);
      expect(row.remedy).toBeTruthy();
    }
  });
});

describe("a registered column with no line is named by its mark (J-043: the partial row names it)", () => {
  test("a column sighted and never measured stands beside the figure by mark, never folded into it", () => {
    const [ground] = objectsOf().filter((object) => object.class === "column");
    if (ground === undefined) return expect.fail("the read-back holds columns");
    const sources = readBackSources({ objects: [...objectsOf(), { ...ground, objectKey: `${ground.objectKey}-unmeasured`, mark: "CX9", sourceKey: `${ground.sourceKey}-unmeasured` }] });
    const answer = answerStatement({ question: "What is the column concrete?" }, sources);
    if (answer.outcome !== "ANSWERED" || answer.facts.partial === null) return expect.fail(`the column with no line is left out, and said: ${JSON.stringify(answer).slice(0, 400)}`);
    const rows = partialRowsOf(answer.facts.partial, answer.reading, false, linelessMarks(answer));
    expect(rows.objects.marks).toEqual(["CX9"]);
    expect(rows.objects.lead).toBe(fill(strings.ask_partial_objects_one, { class: "column" }));
    expect(linelessMarks(answered("How many C3 columns are on 5F?")), "a count's objects are what it counted, never what it left out").toEqual([]);
  });
});

describe("a figure links to one sheet, to its evidence row, or to its Rows — never nowhere (I-404)", () => {
  const links: Links = { tenantId: TENANT, projectId: PROJECT, answerId: "a1", anyPlace: true };
  const at = (n: number): AskFigure => ({
    value: "1",
    unit: null,
    kind: null,
    places: 0,
    at: Array.from({ length: n }, (_, i) => ({ drawingId: `d${i}`, layoutName: `L${i}`, sheetLabel: null, keys: [`DXF_HANDLE:${i}`] })),
  });
  test("one place: the viewer, selecting there", () => {
    expect(figureHref(at(1), links)).toBe(selectionAddress(TENANT, PROJECT, { drawingId: "d0", layoutName: "L0", sourceKeys: ["DXF_HANDLE:0"] }));
  });
  test("two places: the answer's own evidence row", () => {
    expect(figureHref(at(2), links)).toBe("#ask-evidence-a1");
  });
  test("no place at all: the answer's Rows", () => {
    expect(figureHref(at(0), { ...links, anyPlace: false })).toBe("#ask-rows-a1");
  });
});

describe("refusals and the Understood row", () => {
  test("a cost is refused by name, and its evidence is the draft BOQ", () => {
    const answer = answerStatement({ question: "What will the column concrete cost?" }, SOURCES);
    expect(answer.outcome === "REFUSED" ? answer.code : null).toBe("ASK_ESTIMATE_NOT_BUILT");
    expect(refusalEvidence("ASK_ESTIMATE_NOT_BUILT", TENANT, PROJECT)).toEqual({ href: `/t/${TENANT}/p/${PROJECT}/takeoff/boq`, label: strings.ask_evidence_boq });
  });

  test("an unknown level lists the levels the stack holds, each as the drawing's code", () => {
    const answer = answerStatement({ question: "How many C3 columns are on 9F?" }, SOURCES);
    if (answer.outcome !== "REFUSED" || answer.held === null) return expect.fail(`9F is not held: ${JSON.stringify(answer)}`);
    const line = heldLine(answer.held);
    expect(plain(line)).toBe(fill(strings.ask_held_levels, { list: answer.held.items.join(" · ") }));
    expect(line.filter((seg) => seg.t === "code").length).toBe(answer.held.items.length);
  });

  test("the reading reads as words and codes: Count · Column · C3 · 5F", () => {
    const answer = answered("How many C3 columns are on 5F?");
    expect(readingWords(answer.reading).map((word) => plain(word))).toEqual([strings.ask_intent_count, "Column", "C3", "5F"]);
  });

  test("a mark breakdown lists each mark with its count as a figure", () => {
    const answer = answered("How many pile caps of each type?");
    const breakdown = breakdownOf(answer, linksOf(answer));
    expect(breakdown?.columns.map((column) => column.id)).toEqual(["mark", "count"]);
    expect(breakdown?.rows.map((row) => plain(row.cells["count"] ?? []))).toEqual(["4", "14", "5", "2", "1"]);
  });
});
