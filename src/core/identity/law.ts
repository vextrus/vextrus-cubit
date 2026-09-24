// The register's closed rosters (L-REG-03, R-TO-051): the two vocabularies a register row is written
// in. They stand in core beside the key grammars because the store, the door and every later reader
// must draw them from one home — a roster spelled twice is two laws that part company (B-17).
//
// What a standing or a basis MEANS is the law's; this file only says which words there are.

/**
 * How a sighting's geometry came to be (L-REG-03): MEASURED is scope somebody's drawing really
 * carries; DERIVED is scope a level expansion stood up. A measured sighting landing where a derived
 * one stands is a promotion rather than a refusal, which is why the two are told apart at all.
 * INTERPRETED is scope read off a scan's pixels — a vectoriser's trace, or a person tracing one by
 * hand (L-QTY-01: "never relabelled MEASURED") — which reaches a bill only as AGREED (L-QTY-04,
 * s-takeoff I-685).
 */
export const SIGHTING_STANDINGS = ["MEASURED", "DERIVED", "INTERPRETED"] as const;

/** One sighting standing, drawn from the closed roster above. */
export type SightingStanding = (typeof SIGHTING_STANDINGS)[number];

/**
 * Where a reading came from (R-TO-051): TRANSCRIBED is what a drawing says, read off it; ENTERED is
 * what a person typed; INTERPRETED is what a scan's pixels were read as — the reading the gate files
 * beside an interpreted outline's queue item, which a person's ENTERED restatement corroborates
 * (L-QTY-04, s-takeoff I-685). The basis is part of the reading, never a judgement of it — the
 * readings compete on declared precedence and on nothing else.
 */
export const OBSERVATION_BASES = ["TRANSCRIBED", "ENTERED", "INTERPRETED"] as const;

/** One observation basis, drawn from the closed roster above. */
export type ObservationBasis = (typeof OBSERVATION_BASES)[number];
