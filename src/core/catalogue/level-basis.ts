// L-CAD-07's level basis, by class: "foundation classes take the lawful-null level basis". A footing,
// a pile cap, a pile and a tie beam stand under the building rather than on a storey of it, so they
// stand in the FOUNDATION slot (L-REG-04) whatever a caption or a person says.
//
// It stands in core because two readers must agree on it: the partition's placement, which stands a
// drawn member in the slot, and the manual measurement act, which stands a hand measurement there
// (docs/design/s-measure.md I-377). A hand footing keyed on a storey would never meet the machine's
// footing in the FOUNDATION slot, and one scope could be counted twice (L-QTY-04) — so the roster has
// one home, reachable from both (B-17, ARCH-01).
import type { ElementType } from "./classes";

/** L-CAD-07's foundation classes — "foundation classes take the lawful-null level basis". */
export const FOUNDATION_CLASSES: readonly ElementType[] = Object.freeze(["footing", "pile_cap", "pile", "tie_beam"] satisfies ElementType[]);

/** Does a member of this class stand in the lawful-null FOUNDATION slot (L-CAD-07, L-REG-04)? */
export function isFoundationClass(type: ElementType): boolean {
  return FOUNDATION_CLASSES.includes(type);
}
