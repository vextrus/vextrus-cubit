// R-UI-033's SAMPLE offer, seam side: the projects empty state teaches the next action and offers
// the clearly-labelled SAMPLE project, and this is the one place that offer is answered.
//
// The synthetic fixture set the offer would seed is not part of the shipped product, so the honest
// answer is that it is unavailable — an absence the screen states in words (R-UI-050's empty leg),
// never a fault and never a refusal: nothing was refused of the person and nothing broke.

/** What the offer answers with: the seeded project to go to, or the absence of the fixture set. */
export type SampleSeedAnswer = { seeded: true; goTo: string } | { available: false };

/** The offer's answer. Seeding the fixture set is what turns this into the `seeded` arm. */
export async function sampleSeed(): Promise<SampleSeedAnswer> {
  return { available: false };
}
