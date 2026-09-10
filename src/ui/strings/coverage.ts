// R-SPINE-060: the coverage grid's sentences as R-UI-050's matrix needs them.
//
// S-Coverage's own copy table is the coverage module's (docs/design/s-coverage.md I-197), and
// `src/ui` may never import a module (ARCH-01) — so the few sentences the declared state cells
// render are mirrored here, word for word, exactly as the sheet index's and the sets browser's are
// mirrored in `screen-states.ts` for the same reason. Nothing else of this screen's copy stands
// here: the grid, the legend, the inspector and the certificate preview all read the module's table.
export const coverage = {
  state_empty_coverage_heading: "No campaign is open on this project",
  state_empty_coverage_body: "Coverage is read from a pinned drawing set revision. Pin one, and every cell it bears appears here.",
  state_empty_coverage_action: "Browse drawing sets",
  state_error_coverage_body: "Nothing was changed. Try again, and quote the report id if it keeps happening.",
  state_partial_coverage: "Some work items bear no cell in this grid. They stand at the head of it, each with the reason it bears none.",
  state_offline_coverage:
    "You are offline. Coverage reads as it stood when this page loaded, and nothing can be committed until the connection returns.",
  state_denied_coverage_permission:
    "Holding a kind out of this bill and declaring one out of the project scope each need the SET_BILL_BOUNDARY permission on this project.",
  state_denied_coverage_holder: "A project principal can grant it on the participants screen.",
} as const;
