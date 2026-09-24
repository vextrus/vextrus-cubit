// @vitest-environment node
/**
 * S-Ask's closed rosters, held by enumeration (docs/design/s-ask.md §1.2, §6, B-19): one query per
 * intent, assembled from a list and refusing a second claim on one intent; every class, kind and note
 * kind of the catalogue with the words a question names it by; no phrase naming two members of one
 * roster; the intent spellings the refusal scan is told are foreign equal to the roster; and the five
 * `ASK_*` refusals registered as the Decision's §3 table states them.
 */
import { describe, expect, test } from "vitest";
import { ELEMENT_TYPES } from "@/core/catalogue/classes";
import { KINDS } from "@/core/catalogue/kinds";
import { REFUSALS } from "@/core/errors";
import { TRANSPORT_VOCABULARY } from "@/core/errors/transport-vocabulary";
import { NOTE_KINDS } from "@/core/notes/law";
import { ASK_INTENTS, ASK_REFUSAL_CODES } from "@/modules/takeoff/ask/law";
import { ASK_QUERIES, ASK_QUERY_LIST, queryFor, registryOf } from "@/modules/takeoff/ask/queries/registry";
import { CLASS_WORDS, INTENT_CUES, KEYED_ROSTERS, KIND_WORDS, NOTE_KIND_WORDS } from "@/modules/takeoff/ask/vocabulary";

describe("the query registry: one query per intent (the duplicate-key test)", () => {
  test("every intent of the roster has exactly one query, and the registry is the list's", () => {
    const intents = ASK_QUERY_LIST.map((query) => query.intent);
    expect(new Set(intents).size, "no intent is claimed twice").toBe(intents.length);
    expect([...intents].sort()).toEqual([...ASK_INTENTS].sort());
    for (const intent of ASK_INTENTS) expect(queryFor(intent).intent, intent).toBe(intent);
    expect(Object.keys(ASK_QUERIES).sort()).toEqual([...ASK_INTENTS].sort());
  });

  test("a second query claiming one intent throws where the roster is assembled, naming the intent", () => {
    const [first] = ASK_QUERY_LIST;
    if (first === undefined) return expect.fail("the roster holds queries");
    expect(() => registryOf([...ASK_QUERY_LIST, { ...first }])).toThrow(first.intent);
  });

  test("an intent no query answers throws too: the roster is closed", () => {
    expect(() => registryOf(ASK_QUERY_LIST.filter((query) => query.intent !== "NOTE"))).toThrow("NOTE");
  });

  test("each query reads through the register's readers or their siblings, and says which", () => {
    for (const query of ASK_QUERY_LIST) {
      expect(["REGISTER", "SCHEDULES", "NOTES", "LEVELS", "TEXT", "SHEETS"], query.intent).toContain(query.basis);
    }
  });
});

describe("every member of the catalogue's rosters has its words (B-19)", () => {
  test("classes, kinds, note kinds and disciplines: the word tables are keyed by exactly the roster", () => {
    for (const [name, { roster, words }] of Object.entries(KEYED_ROSTERS)) {
      expect(Object.keys(words).sort(), `${name}: one entry per member`).toEqual([...roster].sort());
    }
    for (const klass of ELEMENT_TYPES) expect(CLASS_WORDS[klass].length, `${klass} has words`).toBeGreaterThan(0);
    for (const kind of KINDS) expect(KIND_WORDS[kind].length, `${kind} has words`).toBeGreaterThan(0);
    for (const noteKind of NOTE_KINDS) expect(NOTE_KIND_WORDS[noteKind].length, `${noteKind} has words`).toBeGreaterThan(0);
    for (const intent of ASK_INTENTS) expect(INTENT_CUES[intent].length, `${intent} has cues`).toBeGreaterThan(0);
  });

  test("no phrase names two members of one roster", () => {
    for (const [name, { words }] of Object.entries(KEYED_ROSTERS)) {
      const phrases = Object.values(words as Record<string, readonly string[]>).flat();
      expect(new Set(phrases).size, `${name}: a phrase names one member`).toBe(phrases.length);
    }
  });
});

describe("the intents are declared foreign to the refusal scan, spelled as the roster spells them (Q-07)", () => {
  test("the declared spellings are the roster", () => {
    const declared = TRANSPORT_VOCABULARY.find((vocabulary) => vocabulary.vocabulary.startsWith("S-Ask intents"));
    expect(declared?.codes).toEqual([...ASK_INTENTS]);
  });
});

describe("the ask area's refusals (§3's table)", () => {
  test("the five codes are registered, info and inline — refusing a question is not a fault", () => {
    const codes = Object.values(ASK_REFUSAL_CODES);
    expect([...codes].sort()).toEqual(["ASK_ESTIMATE_NOT_BUILT", "ASK_JUDGEMENT_NOT_OFFERED", "ASK_NOT_MEASURED", "ASK_NOT_UNDERSTOOD", "ASK_SUBJECT_UNKNOWN"]);
    for (const code of codes) {
      expect(REFUSALS[code]).toMatchObject({ code, severity: "info", surface: "inline" });
    }
  });

  test("each says what the Decision's table says", () => {
    expect(REFUSALS.ASK_NOT_UNDERSTOOD.message).toBe("This question could not be read as one the register, the schedules, the notes or the sheet text can answer.");
    expect(REFUSALS.ASK_SUBJECT_UNKNOWN.remedy).toBe("Ask again with one they hold — they are listed beneath this answer.");
    expect(REFUSALS.ASK_NOT_MEASURED.message).toBe("Nothing is measured for what this question asks about: the campaign holds no line for it.");
    expect(REFUSALS.ASK_ESTIMATE_NOT_BUILT.message).toBe("Rates, prices and costs are not part of this product yet, so there is no figure to give.");
    expect(REFUSALS.ASK_JUDGEMENT_NOT_OFFERED.message).toBe("Whether a design is adequate, safe or compliant is the engineer's judgement, and the product does not offer one.");
  });
});
