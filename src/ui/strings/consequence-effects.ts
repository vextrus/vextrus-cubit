// R-SPINE-060: the ConsequenceDialog's effect slots, as docs/design/consequence-dialog.md § 3 fixes
// them verbatim. Pattern chrome, act-agnostic: an act whose Consequence carries `effects` shows what
// would re-derive and what would void under these three lines, and every act that carries none shows
// no slot at all (I-161).
//
// They stand in a file of their own beside `consequence-dialog.ts` rather than inside it: a table
// already shipped belongs to the increment that wrote it, and R-SPINE-060 asks only that every key
// reach the one aggregated table — which the line in `index.ts` is what does.
export const consequenceEffects = {
  consequence_dialog_effects_heading: "What follows from this",
  consequence_dialog_effects_lines: "Lines that re-derive",
  consequence_dialog_effects_signatures: "Signatures that void",
} as const;

// The per-module convention publishes a table under the identifier `index.ts` aggregates it by and
// under its own basename, which is not an identifier. One table, two names for it.
export { consequenceEffects as "consequence-effects" };
