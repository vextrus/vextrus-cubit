// R-SPINE-060: what each binding of `src/ui/shell/shortcuts` is called, and the words the ? sheet
// groups them under. One table, one home (B-17): a key reads identically in the palette's shortcuts
// group and in the sheet, because both render `strings[entry.label]` for the same entry.
//
// A label says what the key DOES, in the product's own nouns — never the key itself, which the
// keycaps beside it already draw (R-UI-032).
export const shortcuts = {
  shortcut_sheet_label: "Keyboard shortcuts",
  shortcut_sheet_scope_global: "Anywhere",
  shortcut_sheet_scope_viewer: "In the viewer",
  shortcut_sheet_scope_table: "In a table",

  shortcut_palette: "Search and commands",
  shortcut_shortcut_sheet: "Show keyboard shortcuts",
  shortcut_go_projects: "Go to projects",
  shortcut_go_drawings: "Go to drawings",
  shortcut_go_takeoff: "Go to takeoff",
  shortcut_go_estimate: "Go to the estimate",
  shortcut_go_bid: "Go to the bid",

  shortcut_viewer_select: "Select",
  shortcut_viewer_pan: "Pan",
  shortcut_viewer_measure: "Measure menu",
  shortcut_viewer_count: "Count",
  shortcut_viewer_linear: "Linear measure",
  shortcut_viewer_area: "Area measure",
  // s-measure I-372: the gesture grammar's own keys, listed so the ? sheet and ⌘K name them.
  shortcut_viewer_measure_finish: "Finish the outline",
  shortcut_viewer_measure_undo: "Remove the last point",
  shortcut_viewer_measure_cutout: "Cut out",
  shortcut_viewer_measure_point: "Place a point at the keyboard cursor",
  shortcut_viewer_condition: "Pick a condition (1 to 9)",
  shortcut_viewer_snap: "Snapping on or off",
  shortcut_viewer_fit: "Fit the sheet to the view",
  shortcut_viewer_escape: "Leave the current tool",

  shortcut_table_move: "Move between cells",
  shortcut_table_edit: "Edit the cell",
  shortcut_table_next: "Move to the next cell",
} as const;
