/**
 * AC-1 — the kind enum is closed, and its names are lawful (L-MEA-04).
 *
 * "A kind names a trade and material only": never a dimension, never a unit or a unit abbreviation,
 * never an element class, never a pricing role, never a book or chapter code. `offendingTokens` is
 * where that is decided, and this file is its consumer.
 *
 * Nothing here carries a vocabulary of its own (B-19). The offending words are read out of
 * `DIMENSIONS`, `UNITS`, `PACKAGING_UNITS`, `UNIT_ABBREVIATIONS`, `ELEMENT_TYPES`, `PRICING_ROLES`
 * and `BOOK_PUBLISHERS` themselves, so a word added to any of those rosters tomorrow is demanded of
 * the law here with no edit — and the six probes AC-1 names are asserted on top of that sweep,
 * because those six are what the criterion fixes by name.
 *
 * Where a word belongs to two rosters at once — `VOLUME` is both a dimension and a unit
 * abbreviation — the sweep asks only that the word offends, never which of the two vocabularies is
 * named for it: that choice is the law's, and the criterion fixes it only for the probes.
 */
import { describe, expect, test } from "vitest";
import { byCodePoint, canon, named, productModule, setOf } from "../units/support/canon";

/** The five vocabularies a kind name may not borrow from (`KindVocabulary`). */
type Vocabulary = "dimension" | "unit" | "element" | "pricing-role" | "book-code";

/** One offence: the word the name borrowed, and the vocabulary it was borrowed from. */
type Offence = { readonly token: string; readonly vocabulary: Vocabulary };

const KINDS_FILE = "src/core/catalogue/kinds.ts";
const CLASSES_FILE = "src/core/catalogue/classes.ts";
const KIND_LAW_FILE = "src/core/catalogue/kind-law.ts";
const UNITS_HOME = "src/core/units";

type Law = {
  readonly KINDS: readonly string[];
  readonly isKind: (value: unknown) => boolean;
  readonly offendingTokens: (name: string) => readonly Offence[];
  readonly vocabularies: readonly { readonly label: Vocabulary; readonly members: readonly string[] }[];
};

let loading: Promise<Law> | undefined;

/** The law, loaded once for the file — every case awaits it, so a missing module is the finding. */
const law = (): Promise<Law> =>
  (loading ??= (async () => {
    const kinds = await productModule(KINDS_FILE);
    const classes = await productModule(CLASSES_FILE);
    const kindLaw = await productModule(KIND_LAW_FILE);
    const units = await canon();
    const abbreviations = named<readonly string[]>(kindLaw, "UNIT_ABBREVIATIONS", KIND_LAW_FILE);
    return {
      KINDS: named<readonly string[]>(kinds, "KINDS", KINDS_FILE),
      isKind: named<(value: unknown) => boolean>(kinds, "isKind", KINDS_FILE),
      offendingTokens: named<(name: string) => readonly Offence[]>(kindLaw, "offendingTokens", KIND_LAW_FILE),
      vocabularies: [
        { label: "dimension", members: named<readonly string[]>(units, "DIMENSIONS", UNITS_HOME) },
        {
          label: "unit",
          members: [
            ...named<readonly string[]>(units, "UNITS", UNITS_HOME),
            ...named<readonly string[]>(units, "PACKAGING_UNITS", UNITS_HOME),
            ...abbreviations,
          ],
        },
        { label: "element", members: named<readonly string[]>(classes, "ELEMENT_TYPES", CLASSES_FILE) },
        { label: "pricing-role", members: named<readonly string[]>(kindLaw, "PRICING_ROLES", KIND_LAW_FILE) },
        { label: "book-code", members: named<readonly string[]>(kindLaw, "BOOK_PUBLISHERS", KIND_LAW_FILE) },
      ],
    };
  })());

/** The two fields an offence is judged by, so an implementation may carry more and still be read. */
const asOffence = (found: Offence): Offence => ({ token: found.token, vocabulary: found.vocabulary });

/** The six probes AC-1 fixes by name, each with the word it borrows and the roster it borrows from. */
const PROBES: readonly { readonly name: string; readonly token: string; readonly vocabulary: Vocabulary }[] = [
  { name: "volume.rcc", token: "volume", vocabulary: "dimension" },
  { name: "rcc.cum", token: "cum", vocabulary: "unit" },
  { name: "column.concrete", token: "column", vocabulary: "element" },
  { name: "labour.concrete", token: "labour", vocabulary: "pricing-role" },
  { name: "pwd.concrete", token: "pwd", vocabulary: "book-code" },
  { name: "07.concrete", token: "07", vocabulary: "book-code" },
];

/** The member the increment lands, named once and asserted wherever it is spoken (B-19). */
const RCC_CONCRETE = "rcc.concrete";

describe("AC-1: the kind enum is closed and lawfully named (L-MEA-04)", () => {
  test("AC-1: KINDS carries rcc.concrete, and isKind admits exactly its members", async () => {
    const { KINDS, isKind } = await law();

    expect(KINDS, "the enum the increment lands carries the concrete kind").toContain(RCC_CONCRETE);
    expect(KINDS.length, "a closed enum with no members is not one").toBeGreaterThan(0);
    expect(byCodePoint(KINDS).length, "the enum names each kind once").toBe(setOf(KINDS).size);

    for (const kind of KINDS) {
      expect(isKind(kind), `isKind admits ${JSON.stringify(kind)}, which KINDS names`).toBe(true);
    }

    // Non-members, derived rather than listed: the unlawful probes, a bare trade, a case variant and
    // the values that are not names at all. Anything KINDS actually holds is filtered back out, so a
    // kind added tomorrow cannot turn this case red by accident.
    const strangers = [...PROBES.map((probe) => probe.name), "rcc", "", " ", RCC_CONCRETE.toUpperCase(), `${RCC_CONCRETE} `].filter(
      (candidate) => !KINDS.includes(candidate),
    );
    for (const stranger of strangers) {
      expect(isKind(stranger), `isKind refuses ${JSON.stringify(stranger)}, which KINDS does not name`).toBe(false);
    }
    for (const notAName of [null, undefined, 42, {}, [], Symbol.iterator]) {
      expect(isKind(notAName), `isKind refuses ${String(notAName)}, which is not a name at all`).toBe(false);
    }
  });

  test("AC-1: every member of KINDS offends no vocabulary", async () => {
    const { KINDS, offendingTokens } = await law();

    for (const kind of KINDS) {
      expect(
        offendingTokens(kind).map(asOffence),
        `${JSON.stringify(kind)} is a member of the enum, so the token test must find nothing to object to in it (L-MEA-04)`,
      ).toEqual([]);
    }
  });

  test("AC-1: each of the six probes is refused, naming the offending token and its vocabulary", async () => {
    const { offendingTokens } = await law();

    for (const probe of PROBES) {
      const answer = offendingTokens(probe.name).map(asOffence);
      expect(answer.length, `${JSON.stringify(probe.name)} borrows ${JSON.stringify(probe.token)}, so it is refused (L-MEA-04)`).toBeGreaterThan(0);
      expect(
        answer,
        `${JSON.stringify(probe.name)} borrows ${JSON.stringify(probe.token)} from the ${probe.vocabulary} vocabulary, and the answer says so`,
      ).toContainEqual({ token: probe.token, vocabulary: probe.vocabulary });
      expect(
        byCodePoint(setOf(answer.map((offence) => offence.token))),
        `only the borrowed word is objected to in ${JSON.stringify(probe.name)} — the trade half of the name is lawful`,
      ).toEqual([probe.token]);
    }
  });

  test("AC-1: every word of every vocabulary, spelled as a segment of a kind name, is refused", async () => {
    const { offendingTokens, vocabularies } = await law();

    // A word that stands in two rosters at once is judged only as an offence, never as one
    // vocabulary rather than the other: which of the two is named is the law's own choice, and the
    // criterion fixes it for the probes alone.
    const occurrences = new Map<string, number>();
    for (const vocabulary of vocabularies) {
      for (const member of vocabulary.members) {
        const word = member.toLowerCase();
        occurrences.set(word, (occurrences.get(word) ?? 0) + 1);
      }
    }

    for (const vocabulary of vocabularies) {
      for (const member of vocabulary.members) {
        const word = member.toLowerCase();
        const name = `${word}.concrete`;
        const answer = offendingTokens(name).map(asOffence);
        expect(
          answer.length,
          `${JSON.stringify(name)} spells ${JSON.stringify(member)}, a ${vocabulary.label} — a kind names a trade and material only (L-MEA-04)`,
        ).toBeGreaterThan(0);
        if ((occurrences.get(word) ?? 0) === 1) {
          expect(
            answer.map((offence) => offence.vocabulary),
            `${JSON.stringify(member)} stands in the ${vocabulary.label} vocabulary alone, so that is the vocabulary the answer names`,
          ).toContain(vocabulary.label);
        }
      }
    }
  });

  test("AC-1: a segment that is all digits is a chapter code, whatever the digits are", async () => {
    const { offendingTokens } = await law();

    for (const digits of ["07", "7", "1", "23", "0000"]) {
      const name = `${digits}.concrete`;
      expect(
        offendingTokens(name).map(asOffence),
        `${JSON.stringify(name)} opens with a bare number, which is a book or chapter code and never a trade (L-MEA-04)`,
      ).toContainEqual({ token: digits, vocabulary: "book-code" });
    }
  });
});
