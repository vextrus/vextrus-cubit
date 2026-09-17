// S-BBS's sentences, as the module that renders them may read them (R-SPINE-060, ARCH-01).
//
// `src/ui/strings/bbs.ts` is the product's one string table for this screen and a module may not
// import `src/ui`, so the words stand here too — word for word, in the same keys, mirrored by hand
// exactly as `boq/copy.ts`, `coverage/copy.ts` and `schedules-ui/copy.ts` already mirror theirs. The
// Decision's §3 is the authority for both files; a sentence that differs between them is a defect of
// this file.
export const BBS_COPY = {
  takeoff_nav_bbs: "Bar schedule",
  bbs_revision_label: "Pinned revision",
  bbs_stock_label: "Stock bar",
  bbs_stock_rounding_label: "rounded",
  bbs_grid_label: "Bars by member and mark",
  bbs_col_mark: "Bar mark",
  bbs_col_role: "Role",
  bbs_col_shape: "Shape",
  bbs_col_diameter: "Diameter (mm)",
  bbs_col_dims: "Dimensions",
  bbs_col_cutting_raw: "Cutting length (mm)",
  bbs_col_cutting_rounded: "Rounded (mm)",
  bbs_col_cutting_is: "IS additive (mm)",
  bbs_col_bars: "Bars",
  bbs_col_kg: "Mass (kg)",
  bbs_lap_label: "Lap",
  bbs_lap_tooltip: "A lap is scheduled as its own row beside the net bar, never as a percentage of it.",
  bbs_summary_heading: "Cutting stock by diameter",
  bbs_stock_note:
    "Stock bars, pieces and offcut describe what a site cuts from a stock bar. They are informational and are never billed.",
  bbs_summary_col_diameter: "Diameter (mm)",
  bbs_summary_col_kg: "Mass (kg)",
  bbs_summary_col_stock_bars: "Stock bars",
  bbs_summary_col_pieces: "Pieces",
  bbs_summary_col_offcut: "Offcut (mm)",
  bbs_summary_total: "Total mass",
  bbs_partial: "Some rebar lines are partly declared, so their bars stand here as they read.",
  bbs_complete: "Every bar of the pinned campaign is scheduled, with laps as their own rows.",
  bbs_empty_heading: "No bars scheduled yet",
  bbs_empty_body:
    "A bar schedule lists every bar of the pinned campaign by member and mark, with its shape, its cutting lengths and its mass. Measure the campaign from the takeoff register and the schedule appears here.",
  bbs_empty_action: "Go to the takeoff register",
  bbs_error_heading: "The bar schedule could not be read",
  bbs_error_body: "Nothing was changed. Try again, and quote the report id if it keeps happening.",
  bbs_retry: "Try again",
  bbs_offline: "You are offline. The schedule reads as it stood when this page loaded.",
  bbs_denied_body: "Reading the bar schedule needs the MEASURE permission on this project.",
  bbs_denied_holder: "A project principal can grant it on the participants screen.",
} as const;
