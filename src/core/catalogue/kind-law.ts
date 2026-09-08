// L-MEA-04's token test, as a function: "a kind names a trade and material only — never a dimension
// or unit, never an element class or member type, never a pricing role, never a book or chapter
// code". This is the one place that decides whether a name borrows a word from a vocabulary it may
// not borrow from (B-17), and every roster it judges against is read from that vocabulary's own home
// rather than copied here (B-19) — a word added to the canon or to the element classes tomorrow is
// refused in a kind name with no edit.
//
// Two of the five vocabularies have no home of their own yet: pricing roles arrive with the book
// (M5) and publishers with the rate books, so their rosters stand here beside the law that is their
// only reader at M2, and move to that home when it lands.
import { DIMENSIONS, PACKAGING_UNITS, UNITS } from "../units/canon";
import { ELEMENT_TYPES } from "./classes";

/**
 * The unit abbreviations a Bangladeshi bill of quantities is written in (L-MEA-04 names CUM, SQM,
 * RFT, NR among them), plus the dimension words a schedule spells as though they were units. None of
 * them is a unit of the canon — they are how a document writes one — and none may name a kind.
 */
export const UNIT_ABBREVIATIONS = ["CUM", "SQM", "RFT", "NR", "SFT", "CFT", "RM", "NOS", "KG", "MT", "LS", "AREA", "LENGTH", "COUNT", "WEIGHT", "VOLUME"] as const;

/** The roles a rate is broken into (L-BOK's build-up). A role is what a price is FOR, never a kind. */
export const PRICING_ROLES = ["material", "labour", "equipment", "carriage", "sundry", "overhead", "profit"] as const;

/** The books a rate is quoted from. A publisher names a document, never a trade. */
export const BOOK_PUBLISHERS = ["PWD", "LGED", "RHD", "CUSTOM", "UNIFIED"] as const;

/** The five vocabularies a kind name may not borrow a word from. */
export type KindVocabulary = "dimension" | "unit" | "element" | "pricing-role" | "book-code";

/** One objection: the word the name borrowed, and the vocabulary it was borrowed from. */
export type KindOffence = { readonly token: string; readonly vocabulary: KindVocabulary };

/**
 * The vocabularies in the order a name is judged against them. Where a word stands in two rosters —
 * VOLUME is both a dimension and the abbreviation a schedule writes for cubic metres — the name
 * offends both, and the first is the one the objection reads most naturally as.
 */
const VOCABULARIES: readonly { readonly label: KindVocabulary; readonly words: ReadonlySet<string> }[] = Object.freeze([
  { label: "dimension" as const, words: wordsOf(DIMENSIONS) },
  { label: "unit" as const, words: wordsOf([...UNITS, ...PACKAGING_UNITS, ...UNIT_ABBREVIATIONS]) },
  { label: "element" as const, words: wordsOf(ELEMENT_TYPES) },
  { label: "pricing-role" as const, words: wordsOf(PRICING_ROLES) },
  { label: "book-code" as const, words: wordsOf(BOOK_PUBLISHERS) },
]);

/** A roster as the law compares it: one lower-case spelling per word, so `CUM` and `cum` are one. */
function wordsOf(members: readonly string[]): ReadonlySet<string> {
  return new Set(members.map((member) => member.toLowerCase()));
}

/** A segment that is nothing but digits is a chapter or book code — `07` names no trade (L-MEA-04). */
const ALL_DIGITS = /^[0-9]+$/;

/**
 * The words a name is judged by: each dot-separated segment, and — where a segment joins words with
 * `_` or `-` — the words it joins. `shear_wall` is judged whole, because that is how the element
 * roster spells it, and `pile` inside `pile_cap` is judged too, because a borrowed word does not
 * stop being one by taking a companion.
 */
function tokensOf(name: string): readonly string[] {
  const tokens: string[] = [];
  for (const segment of name.split(".")) {
    for (const token of [segment, ...segment.split(/[_-]/)]) {
      const word = token.trim().toLowerCase();
      if (word !== "" && !tokens.includes(word)) tokens.push(word);
    }
  }
  return tokens;
}

/**
 * Every word of a kind name that is borrowed from a vocabulary a kind may not borrow from, with the
 * vocabulary each was borrowed from. An empty answer is a lawful name: it says a trade and its
 * material and nothing else (L-MEA-04).
 */
export function offendingTokens(name: string): readonly KindOffence[] {
  const offences: KindOffence[] = [];
  for (const token of tokensOf(name)) {
    if (ALL_DIGITS.test(token)) offences.push({ token, vocabulary: "book-code" });
    for (const { label, words } of VOCABULARIES) {
      if (words.has(token)) offences.push({ token, vocabulary: label });
    }
  }
  return offences;
}
