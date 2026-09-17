// The one reading of a STORED basis this screen renders through (B-17, ARCH-02).
//
// A view row carries its basis as text, because that is what the column holds; what the canon admits
// is the canon's own closed roster (L-QTY-01). Asserting the text into the type would have made the
// screen a second answer to what a basis IS — and would have painted a chip for a value nobody
// declared. The roster is asked instead, and a value off it reads as none (R-UI-050).
import { QUANTITY_BASES, type QuantityBasis } from "@/core/offers/law";

/** The stored basis as the canon spells it, or null where the canon admits no such basis. */
export function basisOf(said: string): QuantityBasis | null {
  return QUANTITY_BASES.find((basis) => basis === said) ?? null;
}
