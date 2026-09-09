// The level-stack digest: what a stack IS, addressed. A campaign's open snapshots it (inc-209), so
// two campaigns opened over the same stack agree and a campaign opened after the stack moved does
// not — which only holds if the digest is over the identifying facts and nothing else.
//
// L-REG-02 fixes which those are: "a level is referenced by surrogate id; its label, ordinal and
// height never enter a key" — but the ORDINAL is what a level is IN A STACK (L-MEA-07: the ordinal
// is physical and the floor-multiplier scheme keys to it), so the pair (level id, ordinal) is the
// member and a label or a height is not. A stack is a set, so the order somebody listed its members
// in is not part of it either.
import { createHash } from "node:crypto";
import { canonical } from "../acts/consequence";

/** One member of a stack, as the digest reads one: which level, standing at which ordinal. */
export type StackMember = {
  readonly levelId: string;
  readonly ordinal: number;
};

/** Code-point order over the surrogate ids — a total order over a set, so listing order cannot enter. */
function byLevelId(left: StackMember, right: StackMember): number {
  return left.levelId < right.levelId ? -1 : left.levelId > right.levelId ? 1 : 0;
}

/**
 * The digest of a live stack: sha-256 hex over the canonical form of its members' (level id,
 * ordinal) pairs, sorted by surrogate id.
 *
 * `canonical` is the tree's one canonical-JSON home — the same reading a Consequence's digest is
 * taken over (B-17) — so a stack digest and an act digest cannot disagree about what a value says.
 * Hex, 64 characters, like every other content-derived address here (L-REG-04).
 */
export function levelStackDigest(members: readonly StackMember[]): string {
  const judged = members.map((member) => ({ levelId: member.levelId, ordinal: member.ordinal })).sort(byLevelId);
  return createHash("sha256").update(canonical(judged), "utf8").digest("hex");
}
