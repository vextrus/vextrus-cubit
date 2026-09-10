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
  /* The other end of a Trace address that no longer names anything. A drawing this project does not
     hold is not a drawing waiting to be read, and it is not told it is: the address is wrong, and
     the reader is told where the drawings this project does hold are (R-UI-050 separates empty from
     not-found; the sibling `trace_missing` says the same about a line). */
  trace_drawing_unknown_heading: "This project holds no drawing at that address",
  trace_drawing_unknown_body:
    "The address names a drawing this project does not hold — it may have been removed, or it may belong to another project. Open the project's drawings to pick one it holds.",
} as const;
