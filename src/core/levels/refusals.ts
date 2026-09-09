// The three refusals the level model registers, as constructors (R-SPINE-062, ARCH-03). A refusal is
// an answer rather than a fault (B-21): each carries the registered code, the operator's detail and
// the facts the law says that refusal names, and the person is answered from the closed taxonomy's
// message and remedy through the one renderer.
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";

/** The three codes this leaf registers, read off the taxonomy's own union rather than respelled (Q-07). */
const LEVEL_ORDINAL_UNMAPPED: RefusalCode = "LEVEL_ORDINAL_UNMAPPED";
const STOREY_HEIGHT_UNSTATED: RefusalCode = "STOREY_HEIGHT_UNSTATED";
const STOREY_HEIGHT_CONTESTED: RefusalCode = "STOREY_HEIGHT_CONTESTED";

/**
 * L-MEA-07: "a scheme with no row for an ordinal throws `LEVEL_ORDINAL_UNMAPPED`". The scheme itself
 * is a pricing instrument (L-REG-07) and lands elsewhere; this leaf owns the ordinal's own refusal,
 * so the lookup that arrives later answers from the one home rather than spelling a second.
 */
export function levelOrdinalUnmapped(ordinal: number): Error {
  return refusal(LEVEL_ORDINAL_UNMAPPED, `the floor-multiplier scheme holds no row for ordinal ${String(ordinal)}, so nothing at that level can be multiplied`, { ordinal });
}

/**
 * L-MEA-07: a height nobody stated is unstated — never defaulted. Answered for a level no reading
 * stands on, and for an act that would record a height on a basis outside the three a reading may
 * be made on (a DEFAULTED height is not a reading anybody made).
 */
export function storeyHeightUnstated(detail: string, facts: { readonly levelId?: string; readonly basis?: string } = {}): Error {
  return refusal(STOREY_HEIGHT_UNSTATED, detail, facts);
}

/**
 * L-REG-03: "disagreement is declared, never resolved silently". Two current readings of one level's
 * storey height that do not agree on canonical metres suspend it, and the level carries this code
 * instead of a height a line could be priced off.
 */
export function storeyHeightContested(detail: string, facts: { readonly levelId?: string; readonly metres?: readonly string[] } = {}): Error {
  return refusal(STOREY_HEIGHT_CONTESTED, detail, facts);
}
