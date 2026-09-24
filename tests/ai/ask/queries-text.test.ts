/**
 * ASK-3 — the two sheet-text questions (docs/design/s-ask.md §1.2, I-676…c): SCHEDULE_SHEET over
 * the schedules the pinned revision's reading reconstructed, each placed by its caption; FIND_TEXT
 * over SRCH-1's text index. The grammar reads both by their shape, before any subject.
 *
 * The register, the stack and the schedules are the F-RCC6-BNBC read-back's own (`./support/readback`);
 * where a caption stands and what the sheets say is staged here in the shapes the server hands them
 * (`entityAt`, a `TextIndex`), because the unit lane opens no store and runs no extractor — the index's
 * own reading of the real drawing is `tests/takeoff/sheets/text-index.test.ts`'s.
 */
import { describe, expect, test } from "vitest";
import { answerStatement } from "@/modules/takeoff/ask/answer";
import { openIntentOf, readQuestion } from "@/modules/takeoff/ask/grammar";
import { textFinderOf } from "@/modules/takeoff/ask";
import { ASK_REFUSAL_CODES, type AskAnswer, type AskEntity, type AskReading, type AskSources } from "@/modules/takeoff/ask/law";
import { captionKeyOf } from "@/modules/takeoff/ask/queries/schedule-sheet";
import { vocabularyOf } from "@/modules/takeoff/ask/vocabulary";
import { paragraphsOf, wordsOf, type IndexedText, type TextIndex } from "@/modules/takeoff/sheets/text-index";
import { breakdownOf, plain, rowsTablesOf, statementRows, type Links } from "@/app/(app)/t/[tenant]/p/[project]/takeoff/ask/present";
import { fill, strings } from "@/ui/strings";
import { BNBC_DRAWING, READ_BACK, linesOf, objectsOf, readBackSources } from "./support/readback";
import { GOLDEN_ASK, GOLDEN_ASK_STOREY } from "./golden-questions";
import Decimal from "decimal.js";

const SOURCES = readBackSources();
const VOCABULARY = vocabularyOf(SOURCES);

/** What the grammar makes of one question, read on its own or after a previous reading. */
function read(question: string, previous: AskReading | null = null) {
  return readQuestion(question, VOCABULARY, previous);
}

/** The reading a question is read as — failing with what it became where it is no reading. */
function readingOf(question: string, previous: AskReading | null = null): AskReading {
  const outcome = read(question, previous);
  if (outcome.outcome !== "READ") return expect.fail(`"${question}" was read as ${JSON.stringify(outcome)}`);
  return outcome.reading;
}

describe("the grammar reads a sheet-text question by its shape (I-676)", () => {
  test("a schedule asked after with a sheet word is SCHEDULE_SHEET, named by the words before `schedule`", () => {
    expect(readingOf("Which sheet has the column schedule?")).toMatchObject({ intent: "SCHEDULE_SHEET", text: "COLUMN SCHEDULE" });
    expect(readingOf("Which sheets carry the pile cap schedule?")).toMatchObject({ intent: "SCHEDULE_SHEET", text: "PILE CAP SCHEDULE" });
    expect(readingOf("where is the door schedule")).toMatchObject({ intent: "SCHEDULE_SHEET", text: "DOOR SCHEDULE" });
  });

  test("a schedule's entry for a mark is still the member's type — no sheet word, no where", () => {
    expect(readingOf("What size is C4 in the column schedule?").intent).toBe("MEMBER_TYPE");
    expect(readingOf("What are the main bars of C2 in the column schedule?").intent).toBe("MEMBER_TYPE");
  });

  test("a find, a where-question and 'which sheets mention' search the words after the opening", () => {
    expect(readingOf("Find TENSION 50d")).toMatchObject({ intent: "FIND_TEXT", text: "TENSION 50D" });
    expect(readingOf("Where is the lift core shown?")).toMatchObject({ intent: "FIND_TEXT", text: "LIFT CORE" });
    expect(readingOf("which sheets mention the lift core")).toMatchObject({ intent: "FIND_TEXT", text: "LIFT CORE" });
    expect(readingOf('please search for "LAP 50d" on the sheets')).toMatchObject({ intent: "FIND_TEXT", text: "LAP 50D" });
  });

  test("walk-2: 'where is C7 drawn?' after a rebar answer is a find of C7, never that rebar carried over", () => {
    const previous: AskReading = { ...readingOf("How much rebar is in the GF columns?") };
    expect(previous).toMatchObject({ intent: "QUANTITY", class: "column", level: "GF" });
    expect(previous.kind).toMatch(/rebar/u);
    const outcome = read("where is C7 drawn?", previous);
    expect(outcome).toEqual({ outcome: "READ", reading: expect.objectContaining({ intent: "FIND_TEXT", text: "C7", kind: null, level: null }), followUp: false });
  });

  test("a mark asked after with only its class beside it is searched as the mark the plan writes", () => {
    expect(readingOf("where are the C3 columns?")).toMatchObject({ intent: "FIND_TEXT", text: "C3" });
  });

  test("a where-question that speaks of measurement asks after it, not the sheets' text; quoted, it is searched", () => {
    expect(readingOf("Where are the columns not measured?")).toMatchObject({ intent: "WHY_NOT_MEASURED", class: "column" });
    expect(readingOf("where are the GF beams without a figure?")).toMatchObject({ intent: "WHY_NOT_MEASURED", class: "beam", level: "GF" });
    expect(readingOf('where is "not measured" written?')).toMatchObject({ intent: "FIND_TEXT", text: "NOT MEASURED" });
  });

  test("the words searched are free text: a mark the register does not hold is searched, never refused as unknown", () => {
    expect(readingOf("Where is C99 drawn?")).toMatchObject({ intent: "FIND_TEXT", text: "C99" });
  });

  test("a find that names nothing to find is not understood, by name, and the machine is not asked it", () => {
    expect(read("find")).toMatchObject({ outcome: "REFUSED", code: ASK_REFUSAL_CODES.notUnderstood });
    expect(openIntentOf("Where is C7 drawn?", VOCABULARY)).toBeNull();
  });

  test("a cost is refused before any shape is read", () => {
    expect(read("find the rate for the column concrete")).toMatchObject({ outcome: "REFUSED", code: ASK_REFUSAL_CODES.estimateNotBuilt });
  });
});

describe("a second question the roster cannot read is never dropped in silence (walk-2, I-678)", () => {
  const COMPOUND = "how much steel goes into the ground floor columns, and what diameters?";

  test("the steel is not answered on its own: the question is not understood, by name, and no machine is asked", () => {
    expect(read(COMPOUND)).toMatchObject({ outcome: "REFUSED", code: ASK_REFUSAL_CODES.notUnderstood });
    expect(openIntentOf(COMPOUND, VOCABULARY)).toBeNull();
    expect(readingOf("how much steel goes into the ground floor columns?")).toMatchObject({ intent: "QUANTITY", class: "column", level: "GF" });
  });

  test("a second question the roster does read stays a compound clarify; a follow-up's 'and what about' stays a follow-up", () => {
    expect(read("how many C3 columns are on 5F, and what is their concrete?")).toMatchObject({ outcome: "CLARIFY", lead: "COMPOUND" });
    expect(read("and what about 6F?", readingOf("How many C3 columns are on 5F?"))).toMatchObject({ outcome: "READ", followUp: true, reading: { level: "6F" } });
  });
});

/* ------------------------------------------------------------------------------ SCHEDULE_SHEET */

/** The column schedule's caption, as the read-back names its view. */
const COLUMN_SCHEDULE = READ_BACK.schedules.find((schedule) => schedule.title === "COLUMN SCHEDULE");
if (COLUMN_SCHEDULE === undefined) throw new Error("the read-back holds the column schedule");
const CAPTION = captionKeyOf(COLUMN_SCHEDULE.viewKey);

/** Where each caption stands, as core's resolver would answer: the column schedule's on S-11, the rest on none. */
function placedCaptions(): AskSources["entityAt"] {
  return (drawingId, key): AskEntity | null =>
    key === CAPTION && (drawingId === null || drawingId === BNBC_DRAWING) ? { drawingId: BNBC_DRAWING, text: "COLUMN SCHEDULE", layoutName: "S-11 COLUMN SCHEDULE", sheetLabel: "S-11" } : null;
}

const LINKS: Links = { tenantId: "t-1", projectId: "p-1", answerId: "a-1", anyPlace: true };

function answered(answer: AskAnswer): Extract<AskAnswer, { outcome: "ANSWERED" }> {
  if (answer.outcome !== "ANSWERED") return expect.fail(`answered as ${JSON.stringify(answer)}`);
  return answer;
}

describe("SCHEDULE_SHEET: the reconstructed schedules, each placed by its caption", () => {
  const sources = readBackSources({ entityAt: placedCaptions() });

  test("“COLUMN SCHEDULE” is on S-11, the sheet an EvidenceLink selecting the caption", () => {
    const answer = answered(answerStatement({ question: "Which sheet has the column schedule?" }, sources));
    expect(answer.facts.basis).toBe("SCHEDULES");
    expect(answer.facts.statement).toEqual({
      intent: "SCHEDULE_SHEET",
      schedules: [{ scheduleKey: COLUMN_SCHEDULE.scheduleKey, title: "COLUMN SCHEDULE", drawingId: BNBC_DRAWING, captionKey: CAPTION, place: { drawingId: BNBC_DRAWING, layoutName: "S-11 COLUMN SCHEDULE", sheetLabel: "S-11", keys: [CAPTION] } }],
    });
    const [row] = statementRows(answer, LINKS);
    expect(plain(row ?? [])).toBe(fill(strings.ask_schedule_sheet, { title: "COLUMN SCHEDULE", sheets: "S-11" }));
    expect(row?.find((seg) => seg.t === "link")).toMatchObject({ t: "link", label: "S-11", code: true, href: expect.stringContaining(encodeURIComponent(CAPTION)) });
  });

  test("the words are matched whole and adjacent: a pile schedule is never the pile cap schedule", () => {
    const answer = answered(answerStatement({ question: "which sheet has the pile schedule?" }, sources));
    const statement = answer.facts.statement;
    if (statement.intent !== "SCHEDULE_SHEET") return expect.fail(statement.intent);
    expect(statement.schedules.map((schedule) => schedule.title)).toEqual(READ_BACK.schedules.filter((schedule) => /^PILE SCHEDULE\b/u.test(schedule.title)).map((schedule) => schedule.title));
    expect(statement.schedules.length).toBeGreaterThan(0);
  });

  test("a caption no sheet holds is said to stand in model space, with no link", () => {
    const answer = answered(answerStatement({ question: "which sheet has the pile schedule?" }, sources));
    const [row] = statementRows(answer, LINKS);
    expect(row?.some((seg) => seg.t === "link")).toBe(false);
    expect(plain(row ?? [])).toContain(strings.ask_show_model);
  });

  test("a schedule the sheets do not hold is refused by name, beneath the schedules they do", () => {
    const answer = answerStatement({ question: "Which sheet has the door schedule?" }, sources);
    expect(answer).toMatchObject({ outcome: "REFUSED", code: ASK_REFUSAL_CODES.subjectUnknown, held: { subject: "SCHEDULES" } });
    if (answer.outcome !== "REFUSED") return;
    expect(answer.held?.items).toEqual([...new Set(READ_BACK.schedules.map((schedule) => schedule.title))]);
  });
});

/* ----------------------------------------------------------------------------------- FIND_TEXT */

/** One text of a staged index: its key, what it says, and the sheet core's resolver stands it on. */
type Staged = { key: string; text: string; layoutName: string | null; sheetLabel: string | null; sheetRank: number };

/** An index in the shape `textIndexOf` builds, over texts staged in the artifact's order. */
function indexOf(texts: readonly Staged[]): TextIndex {
  const entries: IndexedText[] = [];
  const postings = new Map<string, number[]>();
  for (const one of texts) {
    const paragraphs = paragraphsOf("TEXT", one.text);
    const words = paragraphs.map((paragraph) => wordsOf(paragraph));
    const at = entries.length;
    entries.push({ key: one.key, paragraphs, words, layoutName: one.layoutName, sheetLabel: one.sheetLabel, sheetRank: one.sheetRank });
    for (const word of new Set(words.flat())) postings.set(word, [...(postings.get(word) ?? []), at]);
  }
  return { entries, postings };
}

const S10 = { layoutName: "S-10 COLUMN LAYOUT PLAN", sheetLabel: "S-10", sheetRank: 9 };
const S11 = { layoutName: "S-11 COLUMN SCHEDULE", sheetLabel: "S-11", sheetRank: 10 };
const MODEL = { layoutName: null, sheetLabel: null, sheetRank: 99 };
const SECOND_DRAWING = "00000000-0000-4000-8000-0000000000d2";

const INDEXES = [
  {
    drawingId: BNBC_DRAWING,
    index: indexOf([
      { key: "DXF_HANDLE:11", text: "C7", ...S11 },
      { key: "DXF_HANDLE:12", text: "PC7", ...S10 },
      { key: "DXF_HANDLE:13", text: "C7", ...S10 },
      { key: "DXF_HANDLE:14", text: "PORCH COLUMN C7 (SEE NOTE 3)", ...S10 },
      { key: "DXF_HANDLE:15", text: "C7", ...MODEL },
    ]),
  },
  { drawingId: SECOND_DRAWING, index: indexOf([{ key: "DXF_HANDLE:21", text: "c7", ...S10 }]) },
];

describe("FIND_TEXT: SRCH-1's index over the pinned revision's sheets", () => {
  const sources = readBackSources({ findText: textFinderOf(INDEXES) });

  test("the finder answers whole words only, one per (drawing, key), each drawing's sheets in order", () => {
    const hits = textFinderOf(INDEXES)("c7");
    expect(hits.map((hit) => `${hit.drawingId === BNBC_DRAWING ? 1 : 2}:${hit.sourceKey}`)).toEqual(["1:DXF_HANDLE:13", "1:DXF_HANDLE:14", "1:DXF_HANDLE:11", "1:DXF_HANDLE:15", "2:DXF_HANDLE:21"]);
    expect(hits.some((hit) => hit.sourceKey === "DXF_HANDLE:12"), "C7 is never found inside PC7").toBe(false);
  });

  test("the count is a figure; each (drawing, layout) is a place with its own count, selecting every hit there", () => {
    const answer = answered(answerStatement({ question: "Where is C7 drawn?" }, sources));
    expect(answer.facts.basis).toBe("TEXT");
    const statement = answer.facts.statement;
    if (statement.intent !== "FIND_TEXT") return expect.fail(statement.intent);
    expect(statement.text).toBe("C7");
    expect(statement.count.value).toBe("5");
    expect(statement.places.map((one) => [one.place.drawingId === BNBC_DRAWING ? 1 : 2, one.place.sheetLabel, one.place.keys, one.count.value])).toEqual([
      [1, "S-10", ["DXF_HANDLE:13", "DXF_HANDLE:14"], "2"],
      [1, "S-11", ["DXF_HANDLE:11"], "1"],
      [2, "S-10", ["DXF_HANDLE:21"], "1"],
    ]);
    expect(statement.count.at, "the count links to its evidence row: its hits stand on three places").toHaveLength(3);
    expect(answer.facts.records.texts).toHaveLength(5);
  });

  test("the answer reads the count, a Sheet · Count breakdown, and Rows that quote each text — a model-space text by its key, unlinked", () => {
    const answer = answered(answerStatement({ question: "Where is C7 drawn?" }, sources));
    const [row] = statementRows(answer, LINKS);
    expect(plain(row ?? [])).toBe(fill(strings.ask_find_other, { text: "C7", count: "5" }));
    const breakdown = breakdownOf(answer, LINKS);
    expect(breakdown?.tableId).toBe("ask-breakdown-finds");
    expect(breakdown?.rows.map((one) => plain(one.cells["sheet"] ?? []))).toEqual(["S-10", "S-11", "S-10"]);
    const texts = rowsTablesOf(answer.facts, LINKS).find((table) => table.tableId === "ask-rows-texts");
    const model = texts?.rows.find((one) => one.id.endsWith("DXF_HANDLE:15"));
    expect(model?.cells["text"]).toEqual([{ t: "quote", text: "C7", href: null }]);
    expect(model?.cells["source"]).toEqual([{ t: "code", text: "DXF_HANDLE:15" }]);
  });

  test("words the sheets do not say are an answer, never a refusal", () => {
    const answer = answered(answerStatement({ question: "Find TENSION 50d" }, sources));
    const statement = answer.facts.statement;
    if (statement.intent !== "FIND_TEXT") return expect.fail(statement.intent);
    expect(statement.count.value).toBe("0");
    expect(plain(statementRows(answer, LINKS)[0] ?? [])).toBe(fill(strings.ask_find_none, { text: "TENSION 50D" }));
    expect(breakdownOf(answer, LINKS)).toBeNull();
  });

  test("with no campaign pinned there are no sheets to search: not measured, by name", () => {
    const answer = answerStatement({ question: "Where is C7 drawn?" }, readBackSources({ campaign: null, findText: textFinderOf(INDEXES) }));
    expect(answer).toMatchObject({ outcome: "REFUSED", code: ASK_REFUSAL_CODES.notMeasured });
  });
});

describe("J-000's m4-ask leg: every question it asks is the grammar's, and answers what the register states (I-680)", () => {
  const sources = readBackSources({ entityAt: placedCaptions() });
  const lines = linesOf();

  test("each question is read by the grammar as the intent the leg expects — no model is asked", () => {
    for (const asked of [GOLDEN_ASK.count, GOLDEN_ASK.storey, GOLDEN_ASK.sheet]) {
      expect(openIntentOf(asked.question, VOCABULARY), asked.question).toBeNull();
      expect(readingOf(asked.question).intent, asked.question).toBe(asked.intent);
    }
    expect(read(GOLDEN_ASK.refused.question)).toMatchObject({ outcome: "REFUSED", code: GOLDEN_ASK.refused.code });
  });

  test("the count is the register's pile caps — one concrete line each, which is what the leg reads the register for", () => {
    const caps = objectsOf().filter((object) => object.class === "pile_cap" && object.corroboration !== "REPUDIATED");
    const capConcrete = lines.filter((line) => line.class === "pile_cap" && line.kind === "rcc.concrete" && !line.repudiated);
    expect(caps.length).toBeGreaterThan(0);
    expect(capConcrete.length, "every registered cap carries one concrete line").toBe(caps.length);
    const answer = answered(answerStatement({ question: GOLDEN_ASK.count.question }, sources));
    expect(answer.facts.statement).toMatchObject({ intent: "COUNT", count: { value: String(caps.length) } });
  });

  test("the storey's quantity is the exact sum of its complete column concrete lines — the register footer's figure on that storey", () => {
    const complete = lines.filter((line) => line.class === "column" && line.kind === "rcc.concrete" && line.level === GOLDEN_ASK_STOREY && line.coverage === "COMPLETE" && line.value !== null && !line.repudiated);
    expect(complete.length).toBeGreaterThan(0);
    const Exact = Decimal.clone({ precision: 60 });
    const sum = complete.reduce((total, line) => total.plus(line.value as string), new Exact(0));
    const answer = answered(answerStatement({ question: GOLDEN_ASK.storey.question }, sources));
    const statement = answer.facts.statement;
    if (statement.intent !== "QUANTITY" || statement.figure === null) return expect.fail(`read as ${JSON.stringify(statement)}`);
    expect(new Decimal(statement.figure.value).equals(sum), `${statement.figure.value} = ${sum.toFixed()}`).toBe(true);
    expect(statement.lines).toBe(complete.length);
  });
});
