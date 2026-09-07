// The `?` sheet's chrome and the words every documented key is named by (docs/design/
// shortcut-sheet.md §3). One table, one home: a key reads identically in the palette and in the
// sheet because both take its label from here through `SHORTCUTS` (R-SPINE-060, B-17).
export const shortcuts = {
  shortcut_sheet_label: "Keyboard shortcuts",
  shortcut_sheet_heading: "Keyboard shortcuts",
  shortcut_sheet_hint: "Every key this workspace binds, and where each one works.",

  shortcut_scope_global: "Anywhere in the workspace",
  shortcut_scope_viewer: "In the viewer",
  shortcut_scope_table: "In a table",

  shortcut_palette: "Open the command palette",
  shortcut_shortcut_sheet: "Show keyboard shortcuts",
  shortcut_go_projects: "Go to Projects",
  shortcut_go_drawings: "Go to Drawings",
  shortcut_go_takeoff: "Go to Takeoff",
  shortcut_go_estimate: "Go to Estimate",
  shortcut_go_bid: "Go to Bid",
  shortcut_viewer_select: "Select tool",
  shortcut_viewer_pan: "Pan tool",
  shortcut_viewer_measure: "Open the measure menu",
  shortcut_viewer_count: "Count tool",
  shortcut_viewer_linear: "Linear measurement",
  shortcut_viewer_area: "Area measurement",
  shortcut_viewer_snap: "Toggle snapping",
  shortcut_viewer_fit: "Fit the sheet to the view",
  shortcut_viewer_escape: "Cancel the current tool",
  shortcut_table_move: "Move to the next row",
  shortcut_table_edit: "Edit the focused cell",
  shortcut_table_next: "Move to the next cell",
} as const;
