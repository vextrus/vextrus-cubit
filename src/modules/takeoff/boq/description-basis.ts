// Where a group's description came from, as a value both faces of the draft may hold (I-298).
//
// A LEAF, on purpose: the screen says where each description came from, and a screen may not pull
// the model seam — which reaches the store — into the browser behind one word (ARCH-01, AS-01). So
// the basis vocabulary, the group key and the shape the reading takes live here, with no import of
// their own, and `./descriptions` (which asks the question) re-exports them.
export const INTERPRETED = "INTERPRETED";
export const DEFAULTED = "DEFAULTED";

/** One of the two bases a description wears, drawn from R-UI-002's own basis palette. */
export type DescriptionBasis = typeof INTERPRETED | typeof DEFAULTED;

/** One group's description as the draft carries it: what it reads, how it was arrived at, and from which call. */
export type GroupDescription = {
  /** The chosen catalogue sentence, or `null` where the plain description stands (L-BD-01). */
  readonly text: string | null;
  readonly basis: DescriptionBasis;
  /** The ledger row the reading came from, or `null` where no call was made (L-AI-01). */
  readonly callId: string | null;
};

/** group key (`<class> <kind>`) → what stands for it. The key the emission and the screen both use. */
export type GroupDescriptions = ReadonlyMap<string, GroupDescription>;

/** The key one group is carried under, by the two things that make it one group. */
export function groupKeyOf(klass: string, kind: string): string {
  return `${klass} ${kind}`;
}
