/**
 * Public acceptance for L-MEA-04's closed kind enum: AC-1 — the token test.
 *
 * A kind names a trade and material only. What it may never name is not a list written here: it is
 * derived from the tree's own three rosters — the physical dimensions, the unit abbreviations and
 * the element classes — so a dimension, an abbreviation or an element class a later increment adds
 * forbids its own token from that moment on (B-19). The only literals spelled below are the ones
 * L-MEA-04 and AC-1 spell themselves: the abbreviations the law names as forbidden must actually be
 * in the abbreviation roster, or the derived ban is smaller than the law's.
 */
import { describe, expect, test } from "vitest";
import { carriesTokenRun, loadCanon, loadElementTypes, loadKinds, stringRoster, tokensOf } from "./support/wire";

/** The abbreviations L-MEA-04 names in its own parenthesis, which UNIT_ABBREVIATIONS must carry. */
const NAMED_ABBREVIATIONS = ["CUM", "SQM", "RFT", "NR", "CFT", "SFT", "MT", "KG"] as const;

/** The three rosters the forbidden set is built from, each asserted non-empty at its source. */
async function forbiddenSources(): Promise<{ dimensions: readonly string[]; abbreviations: readonly string[]; elementTypes: readonly string[] }> {
  const canon = await loadCanon();
  const elements = await loadElementTypes();
  return {
    dimensions: stringRoster(canon.DIMENSIONS, "DIMENSIONS"),
    abbreviations: stringRoster(canon.UNIT_ABBREVIATIONS, "UNIT_ABBREVIATIONS"),
    elementTypes: stringRoster(elements.ELEMENT_TYPES, "ELEMENT_TYPES"),
  };
}

describe("AC-1: the kind enum is closed, and no kind name carries a forbidden token", () => {
  test("AC-1: KINDS is a non-empty roster of distinct names", async () => {
    const { KINDS } = await loadKinds();
    const kinds = stringRoster(KINDS, "KINDS");
    expect(new Set(kinds).size, `KINDS carries a repeated name: ${kinds.join(", ")}`).toBe(kinds.length);
  });

  test("AC-1: ELEMENT_TYPES is a non-empty roster of distinct element classes", async () => {
    const { ELEMENT_TYPES } = await loadElementTypes();
    const types = stringRoster(ELEMENT_TYPES, "ELEMENT_TYPES");
    expect(new Set(types).size, `ELEMENT_TYPES carries a repeated class: ${types.join(", ")}`).toBe(types.length);
  });

  test("AC-1: every forbidden source is non-empty, so the ban below is not vacuous", async () => {
    const sources = await forbiddenSources();
    expect(sources.dimensions.length, "DIMENSIONS must not be empty").toBeGreaterThan(0);
    expect(sources.abbreviations.length, "UNIT_ABBREVIATIONS must not be empty").toBeGreaterThan(0);
    expect(sources.elementTypes.length, "ELEMENT_TYPES must not be empty").toBeGreaterThan(0);
  });

  test("AC-1: UNIT_ABBREVIATIONS carries every abbreviation L-MEA-04 names as forbidden", async () => {
    const { abbreviations } = await forbiddenSources();
    const held = new Set(abbreviations.map((abbreviation) => abbreviation.toUpperCase()));
    for (const named of NAMED_ABBREVIATIONS) {
      expect(held.has(named), `UNIT_ABBREVIATIONS must carry ${named} — L-MEA-04 names it among the abbreviations a kind may never be called`).toBe(true);
    }
  });

  test("AC-1: no kind name carries a dimension, a unit abbreviation or an element class as a token", async () => {
    const { KINDS } = await loadKinds();
    const sources = await forbiddenSources();
    const forbidden = [
      ...sources.dimensions.map((name) => ({ name, why: "a physical dimension" })),
      ...sources.abbreviations.map((name) => ({ name, why: "a unit abbreviation" })),
      ...sources.elementTypes.map((name) => ({ name, why: "an element class" })),
    ].map((entry) => ({ ...entry, tokens: tokensOf(entry.name) }));

    const offences: string[] = [];
    for (const kind of stringRoster(KINDS, "KINDS")) {
      const tokens = tokensOf(kind);
      expect(tokens.length, `${kind} tokenises to nothing — a kind name carries at least one word`).toBeGreaterThan(0);
      for (const entry of forbidden) {
        if (entry.tokens.length > 0 && carriesTokenRun(tokens, entry.tokens)) {
          offences.push(`${kind} carries "${entry.name}" (${entry.why}) — L-MEA-04: a kind names a trade and material only`);
        }
      }
    }
    expect(offences, offences.join("\n")).toEqual([]);
  });
});
