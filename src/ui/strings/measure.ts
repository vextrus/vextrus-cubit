// R-SPINE-060: the measurement's own table. R-UI-024's timeline names every kind SEAM-JOBS runs, so
// the kind that measures a campaign owes the word a person reads it as — a step that named no work
// would be a process somebody is watching without being told what it is.
//
// S-Measure's words follow, block by block in the order its slices land them, fixed verbatim by
// docs/design/s-measure.md § 4: the armed tools (S4) first. Figures and units arrive through the
// format seam; the unit glyph a figure is read in stands beside the slot, as the snapping readout's
// "{metres} m" does.
export const measure = {
  job_step_measure: "Measure the pinned drawings",

  // S4 — the tool row's menu, the preconditions said before the first click, the stage and the
  // status line's measure cell, and the hidden line's announcements (s-measure § 2.1–2.4, § 3).
  measure_tool_rectangle: "Rectangle",
  measure_tool_cutout: "Cut out",
  measure_tool_perimeter: "Perimeter",
  measure_tool_volume: "Volume",
  measure_tool_typical: "Typical ×n",
  measure_tool_pitch: "Pitch multiplier",
  measure_tool_layer_region: "Select on layer in region",
  measure_tool_fill: "Fill a closed region",
  measure_tool_freehand: "Freehand",
  measure_tool_not_yet: "Arrives with the rest of the manual toolset",
  measure_tools_offline: "You are offline. You can draw, and confirm when the connection returns.",
  measure_tools_permission: "Measuring needs the Measure permission. A project principal can give you a role that carries it.",
  viewer_status_measure: "Measure",
  measure_status_tool: "{tool} · {points} points",
  measure_status_tool_one: "{tool} · 1 point",
  measure_status_pick_in_select: "Distances are picked in Select: press V, then Alt+click.",
  measure_status_finish_first: "Finish or discard this outline first (Enter or Escape)",
  measure_status_cutout_outside: "A cut-out must stand inside the outline and clear of the other cut-outs",
  measure_status_too_few: "{tool} needs {count} points before it can be finished.",
  measure_status_degenerate: "This outline encloses nothing: it crosses itself, or its points stand in one line.",
  measure_status_repeated: "A point already stands there.",
  measure_status_unrecorded: "Measured, not recorded: no condition is picked.",
  measure_view_unscaled: "This view has no scale of record. Affirm its scale in the Scale tab, then measure here.",
  measure_figure_uncalibrated: "drawing units: this view has no scale of record",
  measure_figure_windowed: "sheet units: this shape does not stand inside one viewport",
  measure_figure_unrecorded: "sheet units: a two-point scale is not carried through a viewport",
  measure_figure_length: "L {value} m",
  measure_figure_area: "A {value} m²",
  measure_figure_segment: "+ {value} m",
  measure_figure_count: "N {value}",
  measure_figure_length_units: "L {value}",
  measure_figure_area_units: "A {value}",
  measure_figure_segment_units: "+ {value}",
  measure_point_placed: "Point {n} placed, {basis}.",
  measure_point_removed: "Last point removed.",
  measure_shape_finished: "{tool} finished: {figure}.",
  measure_shape_reopened: "Open again: add points, or press Enter to close it.",
  measure_cutout_started: "Cutting out: place the cut-out's points inside the outline, then press Enter.",
  measure_cutout_finished: "Cut out: {figure} remains.",
  measure_cutout_discarded: "Cut-out discarded. The outline stands.",
  measure_draft_kept: "Nothing was committed. Your outline is still on the sheet: press Enter to open it again, or Escape to discard it.",
  measure_draft_discarded: "Measurement discarded.",
  // R-UI-060: the keyboard way to a measurement, named beside the sheet with the camera's keys.
  measure_canvas_keys:
    "L, A and C arm Linear, Area and Count. Space places a point at the cursor the arrow keys move, Enter finishes, Backspace removes the last point, X cuts out and Escape discards.",
} as const;
