// R-UI-050's matrix for the level stack editor, in the one enumerable place a suite reflects over
// (B-19). The readings below are exactly what `levels-screen[data-state]` can wear, in the order the
// Decision §2 resolves them — first holding wins. A reading the screen can reach and this list does
// not hold, or a reading here the screen can never reach, is the drift the declaration prevents.
export const LEVELS_STATES = ["loading", "denied", "offline", "error", "refused", "empty", "partial", "ready"] as const;

/** One of them. */
export type LevelsState = (typeof LEVELS_STATES)[number];
