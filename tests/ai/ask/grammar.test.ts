// @vitest-environment node
/**
 * S-Ask's grammar over a register shaped as F-RCC6-BNBC reads back (docs/design/s-ask.md I-396,
 * I-400, §1.2, §6): the vocabulary is THIS project's — its marks, its stack — and the words are read
 * whole, so `C3` is never matched inside `PC3`; "level 5" is a clarify offering `5F` and `4F`, never a
 * silent alias; an alias resolves only to a label the stack holds; and the two refusal cue sets outrank
 * every answer. Every outcome here is reached with no model call.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import { heldLevels, readQuestion, resolveReading, wordsOf, type GrammarOutcome } from "@/modules/takeoff/ask/grammar";
import type { AskReading } from "@/modules/takeoff/ask/law";
import { vocabularyOf } from "@/modules/takeoff/ask/vocabulary";
import { objectsOf, readBackSources } from "./support/readback";

const VOCABULARY = vocabularyOf(readBackSources());

/** The reading a question is read as — failing, with what it was read as instead, where it is no reading. */
function readingOf(question: string, previous: AskReading | null = null): AskReading & { followUp: boolean } {
  const read = readQuestion(question, VOCABULARY, previous);
  if (read.outcome !== "READ") expect.fail(`"${question}" must be read, and it was ${JSON.stringify(read)}`);
  return { ...read.reading, followUp: read.followUp };
}

/** The refusal a question earns, by its registered code. */
function refusalOf(question: string): Extract<GrammarOutcome, { outcome: "REFUSED" }> {
  const read = readQuestion(question, VOCABULARY);
  if (read.outcome !== "REFUSED") expect.fail(`"${question}" must be refused, and it was ${JSON.stringify(read)}`);
  return read;
}

/** The readings a clarify offers. */
function clarifyOf(question: string, previous: AskReading | null = null): Extract<GrammarOutcome, { outcome: "CLARIFY" }> {
  const read = readQuestion(question, VOCABULARY, previous);
  if (read.outcome !== "CLARIFY") expect.fail(`"${question}" must be a clarify, and it was ${JSON.stringify(read)}`);
  return read;
}

describe("the vocabulary is the project's own", () => {
  test("the marks and the stack are read off the read-back, the stack from the ground up", () => {
    expect(VOCABULARY.levels, "the live stack, by ordinal").toEqual(["FDN", "GF", "1F", "2F", "3F", "4F", "5F", "6F", "ROOF"]);
    expect([...VOCABULARY.marks.keys()].filter((mark) => /^PC\d$/u.test(mark)), "the pile-cap marks in the order a QS counts them").toEqual(["PC1", "PC2", "PC3", "PC4", "PC5"]);
    expect(VOCABULARY.marks.get("C3"), "C3 is a column's mark").toEqual(["column"]);
    expect(VOCABULARY.foundationSlot, "piles and caps are filed in the foundation slot").toBe(true);
  });

  test("the question is read as whole words: a possessive dropped, punctuation a gap", () => {
    expect(wordsOf("What are C4's main bars?")).toEqual(["what", "are", "c4", "main", "bars"]);
    expect(wordsOf("G.F. floor-to-floor")).toEqual(["g", "f", "floor", "to", "floor"]);
    expect(wordsOf("What's f’c?")).toEqual(["what's", "f'c"]);
  });
});

describe("marks are matched whole, and only where the register holds them", () => {
  test("How many C3 columns are on the 5th floor? — a count of C3 on 5F, read by the grammar", () => {
    const reading = readingOf("How many C3 columns are on the 5th floor?");
    expect(reading).toMatchObject({ intent: "COUNT", class: "column", mark: "C3", level: "5F", followUp: false });
  });

  test("C3 is never matched inside PC3, and PC3 is never read as C3", () => {
    expect(readingOf("How many PC3 are there?")).toMatchObject({ intent: "COUNT", class: "pile_cap", mark: "PC3" });
    expect(readingOf("How many C3?")).toMatchObject({ intent: "COUNT", class: "column", mark: "C3" });
  });

  test("a mark spelled with a gap or a dash is the register's mark: C-3 and c 3 are C3", () => {
    expect(readingOf("How many C-3 columns on GF?")).toMatchObject({ mark: "C3", level: "GF" });
    expect(readingOf("how many c 3 on gf")).toMatchObject({ mark: "C3", level: "GF" });
  });

  test("a mark the register does not hold is refused by name, the held marks listed beneath it", () => {
    const refused = refusalOf("How many C9 columns are there?");
    expect(refused.code).toBe(REFUSALS.ASK_SUBJECT_UNKNOWN.code);
    expect(refused.held?.subject).toBe("MARKS");
    expect(refused.held?.items, "the column marks the register holds, in counting order").toEqual(["C1", "C2", "C3", "C4", "C5", "C6", "C7"]);
  });
});

describe("level aliases (I-400)", () => {
  test("'level 5' is a clarify offering 5F (counted above the ground floor) and 4F (the ground floor as level 1)", () => {
    const clarify = clarifyOf("How many C3 columns are on level 5?");
    expect(clarify.lead).toBe("AMBIGUOUS");
    expect(clarify.offered.map((offer) => [offer.reading.level, offer.gloss?.count, offer.gloss?.n])).toEqual([
      ["5F", "FLOOR", 5],
      ["4F", "STOREY", 5],
    ]);
    expect(clarify.offered.every((offer) => offer.reading.intent === "COUNT" && offer.reading.mark === "C3"), "each reading keeps the rest of the question").toBe(true);
  });

  test("the stack's own label in any spelling, and the ground, the roof and the foundation by their words", () => {
    expect(readingOf("How many C3 on 5 f?").level).toBe("5F");
    expect(readingOf("How many C3 on G.F.?").level).toBe("GF");
    expect(readingOf("How many C3 on the ground floor?").level).toBe("GF");
    expect(readingOf("How many C3 on the fifth floor?").level).toBe("5F");
    expect(readingOf("How many C3 on floor 6?").level).toBe("6F");
    expect(readingOf("How many piles in the foundation?")).toMatchObject({ class: "pile", level: "FDN" });
    expect(readingOf("How many C3 at fdn?").level).toBe("FDN");
  });

  test("an alias the stack does not hold is refused by name, never moved to a near label", () => {
    const refused = refusalOf("How many C3 columns are on the 9th floor?");
    expect(refused.code).toBe(REFUSALS.ASK_SUBJECT_UNKNOWN.code);
    expect(refused.held).toMatchObject({ subject: "LEVELS" });
    expect(refused.held?.items).toContain("6F");
    expect(refusalOf("How many C3 on level 12?").code, "level 12 counted either way is no level of this stack").toBe(REFUSALS.ASK_SUBJECT_UNKNOWN.code);
  });

  test("a label in the stack's own notation that the stack does not hold is refused, never read as every level", () => {
    // F-RCC6-BNBC's stack stops at 6F: 7F, 9F and 10F are labels a QS types, and none of them is held.
    for (const question of ["What is the column concrete on 9F?", "What is the column concrete on 10F?", "How many C3 columns on 7F?", "How many C3 on 9 f?", "Pile cap formwork on 8fl?"]) {
      const refused = refusalOf(question);
      expect(refused.code, question).toBe(REFUSALS.ASK_SUBJECT_UNKNOWN.code);
      expect(refused.held, `${question} lists the labels the stack holds`).toEqual(heldLevels(VOCABULARY));
    }
    expect(heldLevels(VOCABULARY).items).toEqual(expect.arrayContaining(["FDN", "GF", "1F", "6F", "ROOF"]));
  });

  test("RF is the roof, and 'level 0' is the ground floor counted above it or the level below it counted from it", () => {
    expect(readingOf("How many C3 on RF?").level).toBe("ROOF");
    expect(clarifyOf("How many C3 on level 0?").offered.map((offer) => [offer.reading.level, offer.gloss?.count])).toEqual([
      ["GF", "FLOOR"],
      ["FDN", "STOREY"],
    ]);
  });

  test("'L 1' is a lintel's mark where the register holds L1, and a level only where it does not", () => {
    const lintel = { ...(objectsOf()[0] as ReturnType<typeof objectsOf>[number]), objectKey: "o:lintel-L1", class: "lintel", mark: "L1", level: "1F" };
    const withLintel = vocabularyOf(readBackSources({ objects: [...objectsOf(), lintel] }));
    const read = readQuestion("How many L 1 lintels?", withLintel);
    expect(read).toMatchObject({ outcome: "READ", reading: { intent: "COUNT", class: "lintel", mark: "L1", level: null } });
    expect(clarifyOf("How many L 1 lintels?").offered.map((offer) => offer.reading.level), "no L1 held: `L 1` is a level counted two ways").toEqual(["1F", "GF"]);
  });
});

describe("two subjects in one slot are two questions, never one answered for both (§1.2, I-494)", () => {
  /** The (slot, value) pairs a compound's two readings differ in. */
  const offeredOf = (question: string, previous: AskReading | null = null): AskReading[] => {
    const clarify = clarifyOf(question, previous);
    expect(clarify.lead, question).toBe("COMPOUND");
    expect(clarify.offered, question).toHaveLength(2);
    return clarify.offered.map((offer) => offer.reading);
  };

  test("two marks: C3 and C4 are each counted and measured, never C3 alone", () => {
    expect(offeredOf("How many C3 and C4 columns are there?").map((reading) => [reading.intent, reading.class, reading.mark])).toEqual([
      ["COUNT", "column", "C3"],
      ["COUNT", "column", "C4"],
    ]);
    expect(offeredOf("What is the C3 and C4 concrete?").map((reading) => [reading.intent, reading.kind, reading.mark])).toEqual([
      ["QUANTITY", "rcc.concrete", "C3"],
      ["QUANTITY", "rcc.concrete", "C4"],
    ]);
    expect(offeredOf("What size are C3 and C4?").map((reading) => [reading.intent, reading.mark])).toEqual([
      ["MEMBER_TYPE", "C3"],
      ["MEMBER_TYPE", "C4"],
    ]);
  });

  test("a mark the register does not hold beside one it does is refused, never dropped", () => {
    const refused = refusalOf("How many C3 and C9 columns?");
    expect(refused.code).toBe(REFUSALS.ASK_SUBJECT_UNKNOWN.code);
    expect(refused.held?.subject).toBe("MARKS");
  });

  test("two levels: 1F and 2F, 5F and 6F, each its own reading — and a number joined to a floor is a floor", () => {
    expect(offeredOf("How many columns are on 1F and 2F?").map((reading) => [reading.intent, reading.class, reading.level])).toEqual([
      ["COUNT", "column", "1F"],
      ["COUNT", "column", "2F"],
    ]);
    expect(offeredOf("What is the column concrete on 5F and 6F?").map((reading) => [reading.intent, reading.kind, reading.level])).toEqual([
      ["QUANTITY", "rcc.concrete", "5F"],
      ["QUANTITY", "rcc.concrete", "6F"],
    ]);
    expect(offeredOf("How many columns on floors 5 and 6?").map((reading) => reading.level)).toEqual(["5F", "6F"]);
    expect(offeredOf("How many columns on the 5th and 6th floor?").map((reading) => reading.level)).toEqual(["5F", "6F"]);
    expect(offeredOf("What are the GF and 1F heights?").map((reading) => [reading.intent, reading.level])).toEqual([
      ["LEVEL_HEIGHT", "GF"],
      ["LEVEL_HEIGHT", "1F"],
    ]);
    expect(refusalOf("How many columns on 5F and 9F?").code, "one of the two not held").toBe(REFUSALS.ASK_SUBJECT_UNKNOWN.code);
    expect(offeredOf("how many c 3 and c 4 on 5F").map((reading) => [reading.mark, reading.level]), "a number completing a held mark is the mark's, not a floor").toEqual([
      ["C3", "5F"],
      ["C4", "5F"],
    ]);
  });

  test("two classes: each class's own reading, never measured so far over every class", () => {
    expect(offeredOf("What is the concrete for columns and pile caps?").map((reading) => [reading.intent, reading.class, reading.kind])).toEqual([
      ["QUANTITY", "column", "rcc.concrete"],
      ["QUANTITY", "pile_cap", "rcc.concrete"],
    ]);
    expect(offeredOf("What is the total concrete for the columns and pile caps?").map((reading) => [reading.intent, reading.class])).toEqual([
      ["QUANTITY", "column"],
      ["QUANTITY", "pile_cap"],
    ]);
    expect(offeredOf("How many columns and pile caps of each type?").map((reading) => [reading.intent, reading.class])).toEqual([
      ["MARKS", "column"],
      ["MARKS", "pile_cap"],
    ]);
    expect(offeredOf("Why are the beams and columns not measured?").map((reading) => [reading.intent, reading.class])).toEqual([
      ["WHY_NOT_MEASURED", "beam"],
      ["WHY_NOT_MEASURED", "column"],
    ]);
    expect(offeredOf("How many walls and columns?").map((reading) => reading.class), "a wall beside a class is its own reading").toEqual(["column", "shear_wall"]);
  });

  test("a mark goes with the class that bears it, and two subjects said in pairs are read in pairs", () => {
    expect(offeredOf("How many C3 columns and pile caps?").map((reading) => [reading.class, reading.mark])).toEqual([
      ["column", "C3"],
      ["pile_cap", null],
    ]);
    expect(offeredOf("How many C3 on 5F and C4 on 6F?").map((reading) => [reading.mark, reading.level])).toEqual([
      ["C3", "5F"],
      ["C4", "6F"],
    ]);
  });

  test("two kinds, two note kinds, two disciplines", () => {
    expect(offeredOf("What is the total concrete and formwork measured so far?").map((reading) => [reading.intent, reading.kind])).toEqual([
      ["MEASURED_SO_FAR", "rcc.concrete"],
      ["MEASURED_SO_FAR", "rcc.formwork"],
    ]);
    expect(offeredOf("What are the lap and hook lengths?").map((reading) => reading.noteKind)).toEqual(["LAP", "HOOK"]);
    expect(offeredOf("List the structural and architectural sheets").map((reading) => reading.discipline)).toEqual(["STRUCTURAL", "ARCHITECTURAL"]);
  });

  test("a follow-up naming two levels is two readings of the previous question", () => {
    const first = readingOf("How many C3 columns are on the 5th floor?");
    expect(offeredOf("and on 5F and 6F?", first).map((reading) => [reading.intent, reading.mark, reading.level])).toEqual([
      ["COUNT", "C3", "5F"],
      ["COUNT", "C3", "6F"],
    ]);
  });

  test("a range of levels, or more choices than two readings hold, is not understood — never one part answered", () => {
    for (const question of [
      "What is the column concrete from GF to 6F?",
      "How many columns on floors 1 to 6?",
      "How many C3 columns on 5F and on level 6?",
      "How many C3 and C4 on level 5?",
      "How much for columns and caps?",
      "How many C3 on level 5, and what is their concrete?",
      "How many columns on floors 2, 3 and 4?",
      "How many columns on floors 1, 2, 3?",
      "How many C1, C3 and C4 columns?",
      "What is the column concrete on GF, 1F and 2F?",
    ]) {
      expect(refusalOf(question).code, question).toBe(REFUSALS.ASK_NOT_UNDERSTOOD.code);
    }
  });
});

describe("the refusal cues outrank every answer (§1.2)", () => {
  test("a cost, a rate or a time is never answered as a quantity", () => {
    for (const question of ["What will the column concrete cost?", "What is the rate for pile cap formwork?", "How many lakh taka is the building?", "How long will the piling take?", "Why is item 07.9 unpriced?"]) {
      expect(refusalOf(question).code, question).toBe(REFUSALS.ASK_ESTIMATE_NOT_BUILT.code);
    }
  });

  test("whether a design is safe, adequate or compliant is declined by name (L-AI-03)", () => {
    for (const question of ["Is C3 adequate on the ground floor?", "Is the pile cap reinforcement enough?", "Does the lap comply with BNBC?", "Should I increase the column size?"]) {
      expect(refusalOf(question).code, question).toBe(REFUSALS.ASK_JUDGEMENT_NOT_OFFERED.code);
    }
  });

  test("a question naming nothing the grammar reads is not understood — by name", () => {
    expect(refusalOf("Hello there").code).toBe(REFUSALS.ASK_NOT_UNDERSTOOD.code);
    expect(refusalOf("How many are there?").code, "a count of nothing named").toBe(REFUSALS.ASK_NOT_UNDERSTOOD.code);
  });
});

describe("the intents, in the QS's words (§1.2)", () => {
  test("quantities, and a total beside one class is that class's quantity", () => {
    expect(readingOf("What is the column concrete?")).toMatchObject({ intent: "QUANTITY", class: "column", kind: "rcc.concrete", by: null });
    expect(readingOf("Pile cap formwork, floor by floor?")).toMatchObject({ intent: "QUANTITY", class: "pile_cap", kind: "rcc.formwork", by: "LEVEL" });
    expect(readingOf("What is the pile cap blinding?")).toMatchObject({ intent: "QUANTITY", class: "pile_cap", kind: "pcc.blinding" });
    expect(readingOf("total column concrete")).toMatchObject({ intent: "QUANTITY", class: "column", kind: "rcc.concrete" });
    expect(readingOf("What is the total concrete for the building?")).toMatchObject({ intent: "MEASURED_SO_FAR", class: null, kind: "rcc.concrete" });
    expect(readingOf("How much has been measured?")).toMatchObject({ intent: "MEASURED_SO_FAR", kind: null });
    expect(readingOf("How much shuttering do the caps take in cft?")).toMatchObject({ intent: "QUANTITY", class: "pile_cap", kind: "rcc.formwork", unitAsked: "cft" });
  });

  test("why a subject is not measured, and what the schedules and the notes state", () => {
    expect(readingOf("Why do the beams have no quantity?")).toMatchObject({ intent: "WHY_NOT_MEASURED", class: "beam", kind: null });
    expect(readingOf("Why isn't column rebar measured?")).toMatchObject({ intent: "WHY_NOT_MEASURED", class: "column", kind: "rcc.rebar" });
    expect(readingOf("What size is C4?")).toMatchObject({ intent: "MEMBER_TYPE", mark: "C4", class: "column" });
    expect(readingOf("What are C4's main bars?"), "a member-type cue beside a mark outranks the kind word 'bars'").toMatchObject({ intent: "MEMBER_TYPE", mark: "C4", kind: null });
    expect(readingOf("What concrete strength do the notes specify?")).toMatchObject({ intent: "NOTE", noteKind: "FC" });
    expect(readingOf("What lap length?"), "a lap length is the note's, not a quantity").toMatchObject({ intent: "NOTE", noteKind: "LAP" });
    expect(readingOf("What is the steel grade?")).toMatchObject({ intent: "NOTE", noteKind: "FY" });
  });

  test("a strength of nothing named is put to the person: concrete's or steel's", () => {
    const clarify = clarifyOf("What strength do the notes give?");
    expect(clarify.offered.map((offer) => offer.reading.noteKind)).toEqual(["FC", "FY"]);
  });

  test("a length, an area or a volume is the class's kind measured in that unit (I-494)", () => {
    expect(readingOf("What is the pile length?"), "the boring, in metres — never the concrete").toMatchObject({ intent: "QUANTITY", class: "pile", kind: "piling.boring" });
    expect(readingOf("What is the pile volume?")).toMatchObject({ intent: "QUANTITY", class: "pile", kind: "rcc.concrete" });
    expect(readingOf("What is the pile cap area?")).toMatchObject({ intent: "QUANTITY", class: "pile_cap", kind: "rcc.formwork" });
    expect(clarifyOf("What is the pile cap volume?").offered.map((offer) => offer.reading.kind), "only the cubic kinds are offered").toEqual(["rcc.concrete", "earthwork.excavation"]);
    expect(refusalOf("What is the column area?").code, "no column line is measured in square metres").toBe(REFUSALS.ASK_NOT_MEASURED.code);
  });

  test("'grade beams' are tie beams, not a grade of anything", () => {
    expect(readingOf("How many grade beams are there?")).toMatchObject({ intent: "COUNT", class: "tie_beam" });
  });

  test("marks, storey heights and the sheets", () => {
    expect(readingOf("How many pile caps of each type?")).toMatchObject({ intent: "MARKS", class: "pile_cap", by: "MARK" });
    expect(readingOf("What column marks are there?")).toMatchObject({ intent: "MARKS", class: "column" });
    expect(readingOf("What is the ground floor's floor-to-floor height?")).toMatchObject({ intent: "LEVEL_HEIGHT", level: "GF" });
    expect(readingOf("Which sheets are in the set?")).toMatchObject({ intent: "SHEET_LIST", discipline: null });
    expect(readingOf("List the structural sheets")).toMatchObject({ intent: "SHEET_LIST", discipline: "STRUCTURAL" });
  });

  test("a question asking two things is a clarify of the two readings (§1.2's compound questions)", () => {
    const clarify = clarifyOf("How many C3 columns, and what is their concrete?");
    expect(clarify.lead).toBe("COMPOUND");
    expect(clarify.offered.map((offer) => offer.reading.intent)).toEqual(["COUNT", "QUANTITY"]);
  });

  test("a question naming only a subject is read against the previous answer (a follow-up)", () => {
    const read = readQuestion("How many C3 columns are on the 5th floor?", VOCABULARY);
    if (read.outcome !== "READ") return expect.fail("the first question is read");
    const held = read.reading;
    expect(readingOf("and on 6F?", held)).toMatchObject({ intent: "COUNT", mark: "C3", level: "6F", followUp: true });
    expect(readingOf("what about PC2?", held)).toMatchObject({ intent: "COUNT", class: "pile_cap", mark: "PC2", followUp: true });
    expect(refusalOf("and on 6F?").code, "with no previous answer a bare subject is not understood").toBe(REFUSALS.ASK_NOT_UNDERSTOOD.code);
  });
});

describe("a reading that crossed the wire is resolved again, never trusted (§6)", () => {
  const base: AskReading = { intent: "COUNT", class: "column", kind: null, mark: "C3", level: "4F", by: null, noteKind: null, discipline: null, unitAsked: null, text: null };

  test("a chosen reading the project holds resolves as it was chosen", () => {
    expect(resolveReading(base, VOCABULARY)).toMatchObject({ outcome: "READ", reading: { mark: "C3", level: "4F" } });
  });

  test("a label the project does not hold is refused by name", () => {
    expect(resolveReading({ ...base, mark: "C99" }, VOCABULARY)).toMatchObject({ outcome: "REFUSED", code: REFUSALS.ASK_SUBJECT_UNKNOWN.code });
    expect(resolveReading({ ...base, level: "12F" }, VOCABULARY)).toMatchObject({ outcome: "REFUSED", code: REFUSALS.ASK_SUBJECT_UNKNOWN.code });
    expect(resolveReading({ ...base, class: "beam" }, VOCABULARY), "C3 is no beam's mark").toMatchObject({ outcome: "REFUSED", code: REFUSALS.ASK_SUBJECT_UNKNOWN.code });
  });

  test("a reading outside the rosters is not understood", () => {
    expect(resolveReading({ ...base, intent: "COST" as AskReading["intent"] }, VOCABULARY)).toMatchObject({ outcome: "REFUSED", code: REFUSALS.ASK_NOT_UNDERSTOOD.code });
  });
});
