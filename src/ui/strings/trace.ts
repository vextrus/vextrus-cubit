// R-SPINE-060: the Trace's own copy — the block the viewer inspector's selection tab gains when an
// address names the line a number was traced from (R-UI-022, X-2), and the Cited-by block that
// answers the other direction.
//
// The registry is the home; `src/modules/takeoff/viewer-inspector/copy.ts` mirrors these values
// because ARCH-01 bars a module from reading `src/ui`, and a test pins the mirror to this table.
export const trace = {
  trace_heading: "Trace",
  trace_formula_label: "Formula",
  trace_variables_label: "Variables",
  trace_origin: "Back to the register line",
  trace_missing: "This project holds no line by that id.",
  trace_failed: "The line could not be read.",
  trace_retry: "Read again",
  trace_cited_heading: "Cited by",
  trace_cited_count: "{count} lines cite this selection",
  trace_cited_none: "No published line cites this selection.",
  trace_cited_failed: "The lines citing this selection could not be read.",
} as const;
