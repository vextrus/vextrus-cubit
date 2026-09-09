// The register's closed rosters (L-REG-03, R-TO-051): the two vocabularies a register row is written
// in. They stand in core beside the key grammars because the store, the door and every later reader
// must draw them from one home — a roster spelled twice is two laws that part company (B-17).
//
// What a standing or a basis MEANS is the law's; this file only says which words there are.

/**
 * How a sighting's geometry came to be (L-REG-03): MEASURED is scope somebody's drawing really
 * carries; DERIVED is scope a level expansion stood up. A measured sighting landing where a derived
 * one stands is a promotion rather than a refusal, which is why the two are told apart at all.
 */
export const SIGHTING_STANDINGS = ["MEASURED", "DERIVED"] as const;

/** One sighting standing, drawn from the closed roster above. */
export type SightingStanding = (typeof SIGHTING_STANDINGS)[number];

/**
 * Where a reading came from (R-TO-051): TRANSCRIBED is what a drawing says, read off it; ENTERED is
 * what a person typed. The basis is part of the reading, never a judgement of it — a transcription
 * and an entry compete on declared precedence and on nothing else.
 */
export const OBSERVATION_BASES = ["TRANSCRIBED", "ENTERED"] as const;

/** One observation basis, drawn from the closed roster above. */
export type ObservationBasis = (typeof OBSERVATION_BASES)[number];
