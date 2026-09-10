// R-UI-050's matrix for the coverage grid, in the one enumerable place a suite reflects over (B-19).
//
// The readings below are exactly what `coverage-screen[data-state]` can wear, in the order the
// Decision § 2 resolves them — first holding wins. A reading the screen can reach and this list does
// not hold, or a reading here the screen can never reach, is the drift the declaration exists to
// prevent.
export const COVERAGE_STATES = ["loading", "denied", "offline", "error", "refused", "empty", "partial", "ready"] as const;

/** One of them. */
export type CoverageState = (typeof COVERAGE_STATES)[number];
