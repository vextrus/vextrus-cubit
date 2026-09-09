// L-MEA-01's seed rule set, `IS1200_IN @ 2026.09`, as the tree's one statement of it: the migration
// that mints it seeds exactly this content, and the digest it stores is `editionDigest` over what is
// written here — so the values a measurement reads and the values written here cannot drift apart
// unnoticed.
//
// The version string names India because Bangladesh has no measurement authority for these values.
//
// An edition is immutable, so a method landing in the tree is a NEW edition rather than an edit to
// the standing one: 2026.08 stands untouched as the row the campaigns opened under it measured
// against, and 2026.09 is minted beside it as the head every later pin forks (B-20, L-REG-07).
import type { EditionContent, EditionIdentity } from "../editions/content";
import { enumerateMethods } from "../methods/registry";

/** The identity of the platform edition: the head of every lineage in the product (L-REG-07). */
export const SEED_EDITION_IDENTITY: EditionIdentity = { scope: "platform", name: "IS1200_IN", version: "2026.09" };

/**
 * The seed's content: L-MEA-01's seventeen parameter values, and the (rule id, version) pairs of the
 * methods in force. "In force" is the shards' own roster — `enumerateMethods()` — and never a second
 * list beside it: a method landed with its manifest is cited with no edit here, and an edition that
 * omitted one would key a pair the tree computes yet no campaign could cite (B-19, riskNotes (1)).
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
  methods: enumerateMethods(),
};
