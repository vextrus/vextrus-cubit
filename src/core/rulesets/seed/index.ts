// L-MEA-01's seed rule set, `IS1200_IN @ 2026.08`, as the tree's one statement of it: the migration
// seeds exactly this content and the acceptance compares the stored digest against a digest taken
// over it, so the values a measurement reads and the values written here can never drift apart.
//
// The version string names India because Bangladesh has no measurement authority for these values.
import type { EditionContent, EditionIdentity } from "../editions/content";

/** The identity of the platform edition: the head of every lineage in the product (L-REG-07). */
export const SEED_EDITION_IDENTITY: EditionIdentity = { scope: "platform", name: "IS1200_IN", version: "2026.08" };

/**
 * The seed's content: L-MEA-01's seventeen parameter values, and the (rule id, version) pairs of the
 * methods in force. The roster of methods is empty because no method is enumerated in this tree yet
 * — an edition citing a method that does not exist would key content nothing can compute.
 *
 * Every value is a decimal string: B-07 keeps a figure exact from here to the page, and the unit is
 * carried beside it because a unit is edition data, not something a surface derives from a key.
 */
export const SEED_EDITION_CONTENT: EditionContent = {
  parameters: {
    openingDeductionMinM2: { value: "0.1", unit: "m²" },
    memberEndNoDeductMaxCm2: { value: "500", unit: "cm²" },
    embeddedDuctNoDeductMaxCm2: { value: "100", unit: "cm²" },
    finishOpeningDeductionMinM2: { value: "0.1", unit: "m²" },
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
  methods: [],
};
