/**
 * AC-1 — the notes grammar is deterministic, and it reads F-RCC6-BNBC's own general notes
 * (R-TO-034, L-CAD-08, L-MEA-01).
 *
 * The roster is the fixture's: every sentence the grammar is graded on is proved to be a string
 * F-RCC6-BNBC's committed corpus carries verbatim, so a drawing nobody drew cannot be what the
 * product is held to (B-19). The grammar itself is pure — no store, no clock, no model — so this
 * suite opens no database: `proposeNotes` is handed texts and answers readings.
 */
import { describe, expect, test } from "vitest";
import {
  BNBC_CORPUS,
  BNBC_GENERAL_NOTES,
  BNBC_PILE_NOTE,
  BNBC_SILENT_NOTES,
  EXPECTED_PROPOSALS,
  FC,
  NOTES_GRAMMAR_MODULE,
  NOTES_LAW_MODULE,
  NOTE_KINDS_VOCABULARY,
  TRANSCRIBED,
  VOCABULARY_MODULE,
  corpusRawStrings,
  expectedFacts,
  type SheetText,
} from "./support/bnbc-notes";
import { grammarSeam, notesLaw, productModule, proposalFacts } from "./support/notes-doors";

/** The five kinds AC-1 states, in the order it states them. */
const KINDS_AS_STATED: readonly string[] = ["FY", "FC", "LAP", "HOOK", "HOOK_MIN"];

/** One foreign or law-owned closed set, as `transport-vocabulary.ts` declares one. */
type VocabularyLine = { vocabulary?: unknown; codes?: unknown };

describe("AC-1: the notes grammar reads F-RCC6-BNBC's general notes, and nothing it was not told", () => {
  test("AC-1: every sentence the grammar is graded on is a string the fixture's corpus carries verbatim", () => {
    const raws = corpusRawStrings();
    for (const note of [...BNBC_GENERAL_NOTES, BNBC_PILE_NOTE, ...BNBC_SILENT_NOTES]) {
      expect(raws, `${BNBC_CORPUS} carries ${JSON.stringify(note.text)} as a string of the drawing`).toContain(note.text);
    }
  });

  test("AC-1: the five kinds are the law's closed roster, declared once as a vocabulary line", async () => {
    const law = await notesLaw();
    expect([...law.NOTE_KINDS], `${NOTES_LAW_MODULE} closes the note kinds at the five R-TO-034 names`).toEqual([...KINDS_AS_STATED]);
    expect([...law.NOTE_ACCEPTANCES], "and the two verdicts a reading is judged under").toEqual(["ACCEPTED", "EDITED"]);
    expect(law.NOTE_BASIS, "a note reading is read off the drawing's text, so its basis is transcribed (L-QTY-01)").toBe(TRANSCRIBED);

    const vocabulary = await productModule<{ TRANSPORT_VOCABULARY: readonly VocabularyLine[] }>(VOCABULARY_MODULE);
    const line = vocabulary.TRANSPORT_VOCABULARY.find((entry) => String(entry.vocabulary) === NOTE_KINDS_VOCABULARY);
    expect(line, `${VOCABULARY_MODULE} declares the line ${JSON.stringify(NOTE_KINDS_VOCABULARY)} (interfaces)`).toBeTruthy();
    expect([...((line as VocabularyLine).codes as readonly string[])], "and declares the law's own roster rather than a second copy of it").toEqual([...law.NOTE_KINDS]);
  });

  test("AC-1: the four notes propose exactly five readings, each as the drawing wrote it", async () => {
    const law = await notesLaw();
    const grammar = await grammarSeam();

    const proposed = grammar.proposeNotes(BNBC_GENERAL_NOTES).map(proposalFacts);
    expect(proposed, `${NOTES_GRAMMAR_MODULE} reads the grade, the strength, the lap and the two hook figures — and nothing else`).toEqual(
      expectedFacts(law.NOTE_KINDS),
    );
  });

  test("AC-1: the same texts in reverse answer the same list — the order is the reading's, never the input's", async () => {
    const grammar = await grammarSeam();

    const forwards = grammar.proposeNotes(BNBC_GENERAL_NOTES).map(proposalFacts);
    const backwards = grammar.proposeNotes([...BNBC_GENERAL_NOTES].reverse()).map(proposalFacts);
    expect(backwards, "sorted by source key, then by the law's own order of kinds (AC-1)").toEqual(forwards);
  });

  test("AC-1: the grammar is a function of its texts alone — the same texts read twice answer the same thing", async () => {
    const grammar = await grammarSeam();
    const once = grammar.proposeNotes(BNBC_GENERAL_NOTES).map(proposalFacts);
    const again = grammar.proposeNotes(BNBC_GENERAL_NOTES).map(proposalFacts);
    expect(again, "a deterministic grammar carries no state between two readings (L-CAD-08)").toEqual(once);
  });

  test("AC-1: a sentence that states no figure proposes nothing, and an empty sheet proposes nothing", async () => {
    const grammar = await grammarSeam();
    expect(grammar.proposeNotes(BNBC_SILENT_NOTES).map(proposalFacts), "a standard's name, a heading and a label state no reinforcement figure").toEqual([]);
    expect(grammar.proposeNotes([]), "and a sheet with no text at all proposes nothing").toEqual([]);
  });

  test("AC-1: the pile note states one concrete strength, and the grammar reads that and no more", async () => {
    const grammar = await grammarSeam();
    const proposed = grammar.proposeNotes([BNBC_PILE_NOTE]).map(proposalFacts);
    expect(proposed, "one FC reading, as the note wrote it, keyed on the text it was read from").toEqual([
      { kind: FC, sourceKey: BNBC_PILE_NOTE.sourceKey, text: BNBC_PILE_NOTE.text, valueAsWritten: "3000 psi", unitAsWritten: "psi", canonical: "3000" },
    ]);
  });

  test("AC-1: each reading cites the sentence it was read from, and quotes it as written", async () => {
    const grammar = await grammarSeam();
    const proposed = grammar.proposeNotes(BNBC_GENERAL_NOTES).map(proposalFacts);

    for (const expected of EXPECTED_PROPOSALS) {
      const read = proposed.find((one) => one.kind === expected.kind);
      expect(read, `the grammar proposes a ${expected.kind} reading: ${JSON.stringify(proposed.map((one) => one.kind))}`).toBeTruthy();
      const facts = read as { sourceKey: string; text: string; valueAsWritten: string };
      const from: SheetText = expected.from;
      expect(facts.sourceKey, `${expected.kind} cites the text entity it was read from`).toBe(from.sourceKey);
      expect(facts.text, "and carries that text, whole").toBe(from.text);
      expect(from.text, `and ${JSON.stringify(facts.valueAsWritten)} is the substring the drawing wrote`).toContain(facts.valueAsWritten);
    }
  });
});
