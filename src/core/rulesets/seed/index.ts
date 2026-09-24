// L-MEA-01's seed rule set, `IS1200_IN @ 2026.09`, as the tree's one statement of it: the migration
// that mints it seeds exactly this content, and the digest it stores is `editionDigest` over what is
// written here — so the values a measurement reads and the values written here cannot drift apart
// unnoticed.
//
// The version string names India because Bangladesh has no measurement authority for these values.
//
// An edition is immutable, so a method landing in the tree is a NEW edition rather than an edit to
// the standing one: every earlier version stands untouched as the row the campaigns opened under it
// measured against, and the version named below is minted beside them as the head every later pin
// forks (B-20, L-REG-07). 2027.06 is that head (OPEN-4, session 9): the roster 2027.05 cited with
// its one rule at two versions narrowed the other way — `rcc.rebar.synthesis@2` (R6b: a column's ties
// derived under D-003 at the joint's never-over bound, and R2's stated lap) in force where 2027.05
// put @1 — so the roster is still fifty-one pairs, one of them a new version of a standing rule
// (I-653). 2027.05 (OPEN-3, migration 0066) minted twelve pairs,
// each a new rule id at version 1 — FND-OWN's seven (each pile cap owned once: its prism and formwork
// less the heads its piles own and the recess cast into it, and the blinding less the piles through
// it), S2's traced blinding and ARCH-2's four finishes — join the thirty-nine 2027.04 cited, so the
// roster is fifty-one pairs. 2027.04 minted the FOUNDATION FORMWORK's two methods —
// `rcc.foundation.formwork_rect@1` and `rcc.foundation.formwork_poly@1`, L-FRM-03's side faces of a
// footing or a pile cap, `count × 2 × (L + B) × D` over a rectangle and `count × P × D` over any other
// plan (I-337) — join the thirty-seven 2027.03 cited, so the roster this edition names is thirty-nine
// pairs. 2027.03 minted the circular column's one method beside the thirty-six of 2027.02. One method
// is enough to owe a version: an edition's version does not measure the size of a leaf, only that the
// roster it cites is no longer the roster the standing row cites, and a re-mint of 2027.03 would be an
// EDIT of a row campaigns have measured against.
//
// A rule the tree computes at TWO versions is cited at ONE (R6b, OPEN-3's deferred selector): the
// gate puts in force the first pair an edition cites for a rule (`versionInForce`), so an edition
// citing both would put in force whichever the roster happened to sort first. `IN_FORCE_VERSIONS`
// names the version each such rule is cited at, explicitly, and `inForce` refuses a roster that
// computes a rule twice with no selection. `rcc.rebar.synthesis@2` (D-003's ties, R2's stated lap) is
// the version 2027.06 selects; 2027.05 and every edition before it keep @1, which the tree still
// computes, so a campaign pinned to one of them writes the bars it always wrote (s-bbs I-658).
import type { EditionContent, EditionIdentity, MethodPair } from "../editions/content";
import { enumerateMethods } from "../methods/registry";

/**
 * The version the seed edition cites for every rule the tree computes at more than one version.
 * Each entry names a version the tree computes; a rule computed at one version needs none.
 */
export const IN_FORCE_VERSIONS: Readonly<Record<string, string>> = Object.freeze({
  // @2 (R6b, D-003) is in force from 2027.06 (OPEN-4); @1 stays computed for the editions citing it.
  "rcc.rebar.synthesis": "2",
});

/**
 * The roster an edition cites: every pair the tree computes, with each rule computed at more than
 * one version narrowed to the version `selected` names. A rule at two versions with no selection, and
 * a selection naming a version the tree does not compute, are refused loudly at build time — an
 * edition must never put a version in force by the order a roster was sorted in (L-MEA-01).
 */
export function inForce(pairs: readonly MethodPair[], selected: Readonly<Record<string, string>>): readonly MethodPair[] {
  const versions = new Map<string, string[]>();
  for (const pair of pairs) versions.set(pair.ruleId, [...(versions.get(pair.ruleId) ?? []), pair.version]);
  for (const [ruleId, held] of versions) {
    if (held.length > 1 && !Object.hasOwn(selected, ruleId)) {
      throw new Error(`the tree computes ${ruleId} at ${held.join(" and ")}, and the seed names no version in force for it (IN_FORCE_VERSIONS)`);
    }
  }
  for (const [ruleId, version] of Object.entries(selected)) {
    if (!(versions.get(ruleId) ?? []).includes(version)) throw new Error(`the seed puts ${ruleId}@${version} in force, which the tree does not compute`);
  }
  return Object.freeze(pairs.filter((pair) => !Object.hasOwn(selected, pair.ruleId) || selected[pair.ruleId] === pair.version));
}

/** The identity of the platform edition: the head of every lineage in the product (L-REG-07). */
export const SEED_EDITION_IDENTITY: EditionIdentity = { scope: "platform", name: "IS1200_IN", version: "2027.06" };

/**
 * The seed's content: L-MEA-01's seventeen parameter values, and the (rule id, version) pairs of the
 * methods in force. "In force" is the shards' own roster — `enumerateMethods()` — and never a second
 * list beside it: a method landed with its manifest is cited with no edit here, and an edition that
 * omitted one would key a pair the tree computes yet no campaign could cite (B-19, riskNotes (1)).
 * The one narrowing is `IN_FORCE_VERSIONS`: a rule computed at two versions is cited at the one it
 * names, so a new version lands computed and uncited until an edition selects it.
 *
 * Every value is a decimal string: B-07 keeps a figure exact from here to the page, and the unit is
 * carried beside it because a unit is edition data, not something a surface derives from a key.
 *
 * The area units are spelled `m2` and `cm2` rather than with U+00B2: an edition's content is what a
 * document renders, and L-FMT-02 refuses CHARACTER_NOT_COVERED for a character the pinned font
 * lacks — src/core/format's covered ranges hold no superscript two, so a squared sign written here
 * would be a stored value no bill could print.
 */
export const SEED_EDITION_CONTENT: EditionContent = {
  parameters: {
    openingDeductionMinM2: { value: "0.1", unit: "m2" },
    memberEndNoDeductMaxCm2: { value: "500", unit: "cm2" },
    embeddedDuctNoDeductMaxCm2: { value: "100", unit: "cm2" },
    finishOpeningDeductionMinM2: { value: "0.1", unit: "m2" },
    finishMinOutlineArea: { value: "0.2", unit: "sft" },
    finishMaxOutlineArea: { value: "20000", unit: "sft" },
    scaleVerificationTolerance: { value: "0.01", unit: "ratio" },
    scaleAnisotropyTolerance: { value: "0.01", unit: "ratio" },
    earthworkWorkingAllowance: { value: "1.5", unit: "ft" },
    earthworkDepthExtra: { value: "0.5", unit: "ft" },
    blindingProjection: { value: "3", unit: "in" },
    blindingThickness: { value: "3", unit: "in" },
    placementContainmentMerge: { value: "0.08", unit: "ratio" },
    placementNearAnchor: { value: "0.9", unit: "ratio" },
    placementFootprintMin: { value: "0.6", unit: "ratio" },
    placementFootprintMax: { value: "2.5", unit: "ratio" },
    placementHumanSnap: { value: "0.5", unit: "ratio" },
  },
  methods: inForce(enumerateMethods(), IN_FORCE_VERSIONS),
};
