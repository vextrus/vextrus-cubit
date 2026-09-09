// R-SPINE-060: S-Viewer's snapping region, as its own module table. Copy fixed verbatim by
// docs/design/s-viewer-snap.md § 3 — the toolbar's three toggles, the six kinds' words, the two
// status cells and the two sentences the hidden live region speaks.
//
// "Snap", "ortho", "angle lock", "endpoint" and "drawing units" are the drawing office's own words.
// Source keys, view keys and figures are model data: they render verbatim beside these words and
// never inside a sentence (I-25, I-26).
export const viewerSnap = {
  viewer_snap_tools_label: "Snapping",
  viewer_snap_toggle: "Snap",
  viewer_snap_ortho: "Ortho",
  viewer_snap_angle: "Angle lock",
  viewer_snap_kind_endpoint: "Endpoint",
  viewer_snap_kind_midpoint: "Midpoint",
  viewer_snap_kind_intersection: "Intersection",
  viewer_snap_kind_perpendicular: "Perpendicular",
  viewer_snap_kind_grid: "Grid intersection",
  viewer_snap_kind_nearest: "Nearest point",
  viewer_status_snap: "Snap",
  viewer_status_snap_none: "Nothing in reach",
  viewer_status_snap_off: "Off",
  viewer_status_distance: "Distance",
  viewer_status_distance_none: "No picks",
  viewer_status_distance_units: "{distance} drawing units",
  viewer_status_distance_metres: "{metres} m",
  viewer_status_distance_uncalibrated: "No affirmed scale here",
  viewer_status_calibration_unread: "The affirmed scale could not be read; reload the sheet.",
  // R-UI-060: the keyboard way to the same measurement the pointer takes, named beside the sheet.
  viewer_snap_canvas_keys: "S turns snapping on and off, Enter takes a pick where the pointer stands, and Escape lets go of the picks.",
  viewer_snap_pick_taken: "Pick {index} at {x}, {y} drawing units.",
  viewer_snap_picks_cleared: "Picks cleared.",
} as const;

// The directory's convention is that a table is exported under its file's basename, and this file's
// basename is hyphenated (tests/ui/strings.test.ts).
export { viewerSnap as "viewer-snap" };
