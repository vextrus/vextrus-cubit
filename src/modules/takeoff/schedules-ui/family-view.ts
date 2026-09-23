// One stored mark family as the registry pane shows it, and what its Band cell says (s-schedules
// I-353, I-sch-1(c), I-436, I-343; L-CAD-08, I-251).
//
// The store keeps a variant's band text byte for byte: a column schedule's band cell (`GF TO 2ND`),
// and — for a long-section strip family — the whole title of the sheet the strips stand on
// (`TYPICAL FLOOR BEAM LONG SECTIONS (2ND TO 6TH FLOOR)`), because that is the text the band was read
// at (`partition/schedules/strips.ts`). Printed under a column headed Band, the second put a clipped
// sheet title on F-RCC6-BNBC's 106 strip-family rows. Which of the two a text is, is the NOTATION's
// answer and nobody else's: the text is a band where `parseFloorZone` reads it as one. No second
// level-word classifier is kept here (B-17), and no stored text moves (placement reads it too).
//
// Pure and server-side: it reads the notation module, which the workspace's client graph never does,
// and it reaches no store — `server.ts` asks the store and hands each family through here.
import { parseFloorZone } from "@/modules/takeoff/partition/notation";
import type { MemberFamily } from "@/modules/takeoff/partition";
import { variantsInStoreyOrder } from "./order";
import type { BandFace, FamilyView } from "./view";

/** What a variant's band is said from: its stored text, and the two ends the grammar read it at. */
export type BandedText = { readonly bandText: string; readonly bandFrom: string | null; readonly bandTo: string | null };

/**
 * The band face of one variant, or null where the schedule states no band of floors for it (a beam
 * schedule files its section column's header there, I-sch-1(c)). A text the notation reads as a band
 * is said verbatim; any other text is said by the band's two ends as the store holds them.
 */
export function bandFaceOf(variant: BandedText): BandFace | null {
  if (variant.bandFrom === null) return null;
  if (parseFloorZone(variant.bandText) !== null) return { written: variant.bandText };
  return { from: variant.bandFrom, to: variant.bandTo ?? variant.bandFrom };
}

/**
 * One stored mark family, verbatim — its mark as the schedule wrote it, and never a count (I-251).
 * Its variants stand in the order a column schedule is read, from the ground up (I-353): the store
 * keeps them in whatever order its key sorts, which put `3RD & 4TH` before `GF TO 2ND`.
 */
export function familyViewOf(family: MemberFamily): FamilyView {
  return {
    family: family.family,
    markText: family.markText,
    sourceKeys: family.sourceKeys,
    variants: variantsInStoreyOrder(family.variants).map((variant) => ({
      variantKey: variant.variantKey,
      bandText: variant.bandText,
      banded: variant.bandFrom !== null,
      // What the Band cell says: the band as written where the notation reads the text as one, else
      // the band's two ends — a strip sheet's title is the text its band was read AT, not a band
      // (I-436). The stored text itself is unchanged and rides beside it.
      bandFace: bandFaceOf(variant),
      sectionText: variant.sectionText,
      sourceKeys: variant.sourceKeys,
      zones: variant.zones.map((zone) => ({ zone: zone.zone, text: zone.text, sourceKeys: zone.sourceKeys })),
    })),
  };
}
