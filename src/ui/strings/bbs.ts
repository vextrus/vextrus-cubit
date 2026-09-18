// R-SPINE-060: S-BBS's sentences, in the one table this screen reads every string from
// (docs/design/s-bbs.md §3, verbatim).
//
// The lane's sixth tab is named here rather than in the takeoff table beside `takeoff_nav_register`:
// the entry belongs to the surface it opens, which is the precedent the coverage, levels, schedules
// and draft-BOQ tabs already set. `src/modules/takeoff/bbs-ui/copy.ts` mirrors this table word for
// word, because ARCH-01 bars a module from reading `src/ui` and B-17 bars a second spelling.
//
// AM-05 binds the document this screen's figures are also printed in: it is a DRAFT, it is unsigned,
// and no word here calls it by the name the law reserves for the signed thing. A shape code is
// printed as its BS 8666 code (I-bbs-6), so no English is invented for `11`, `51` or `SP`.
export const bbs = {
  takeoff_nav_bbs: "Bar schedule",
  bbs_revision_label: "Pinned revision",
  bbs_stock_label: "Stock bar",
  bbs_stock_rounding_label: "rounded",
  bbs_unit_mm: "mm",
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
  bbs_stock_note_label: "About cutting stock",
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
  bbs_denied_holder: "Open the participants screen",
} as const;
