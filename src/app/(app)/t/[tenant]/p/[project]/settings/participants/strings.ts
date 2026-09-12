// The participants screen's own copy for what the v22 rebuild added, and nothing else
// (R-SPINE-060, the `membersStrings` precedent). The screen's committed copy lives in
// `src/ui/strings/participants.ts` under `spine_participants_…`, which is where every sentence this
// screen already said is read from; the column the record grew when it became a 28 px grid is named
// here, in the route directory C-13 puts a screen's own copy in, because the shared table is
// another node's file this pass and a heading is copy like any other sentence.
export const participantsScreenStrings = {
  participants_col_recorded: "Recorded",

  // The mirror (the `members_empty_reader` discipline): the sentence the R-UI-050 matrix says for
  // this screen's empty cell, committed here byte-identical to `state_empty_project_principal` in
  // `src/ui/strings/screen-states.ts`. `src/ui` may never import a route table (ARCH-01), so the
  // matrix keeps its own spelling and the screen's own committed original lives where C-13 puts a
  // screen's copy — re-wording one without the other is the drift C-13 forbids.
  participants_empty_principal: "A project holds at least one principal at every moment, so this list always has a row.",
} as const;
