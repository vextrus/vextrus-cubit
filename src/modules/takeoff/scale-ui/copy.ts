// The scale panel's copy, verbatim from docs/design/s-scale.md § 3 (I-153: one home, on owned
// ground). The route reads these by key; no sentence of this region is written into JSX.
//
// No refusal message or remedy is spelled here: `SCALE_NO_EVIDENCE`, `SCALE_UNIT_UNMAPPED`,
// `SCALE_OBSERVATION_UNCITED`, `SCALE_OBSERVATION_OBLIQUE`, `SCALE_OBSERVATION_UNVERIFIED`,
// `PARTITION_NOT_AVAILABLE`, `PERMISSION_NOT_HELD`, `SIGNED_OUT` and `CONSEQUENCES_NOT_CARRIED` are
// registry-owned and render as registered (R-SPINE-062).
//
// View keys, captions, source keys, calibration keys, factors, ratios, spans and unit spellings are
// model data and render verbatim in mono as data, never woven into a sentence (I-25, I-159).
export const SCALE_COPY = {
  viewer_scale_tabs_label: "Inspector panels",
  viewer_scale_tab_selection: "Selection",
  viewer_scale_tab_scale: "Scale",
  viewer_scale_heading: "Scale",
  viewer_scale_tolerance_anisotropy: "X and Y may differ by {tolerance}",
  viewer_scale_views_list_label: "Views of this sheet",
  viewer_scale_member_label: "Include {viewKey} in the affirmation",
  viewer_scale_affirmed: "Affirmed at {rank}",
  viewer_scale_calibration_label: "Calibration",
  viewer_scale_factor_label: "Metres per drawing unit",
  viewer_scale_factor_x: "X {factor}",
  viewer_scale_factor_y: "Y {factor}",
  viewer_scale_anisotropy: "Anisotropy {ratio}",
  viewer_scale_placeable: "Placeable",
  viewer_scale_unplaceable: "X and Y disagree beyond the tolerance, so this view cannot be placed",
  viewer_scale_proposals_label: "Scales read from the drawing",
  viewer_scale_evidence_label: "Read from",
  viewer_scale_no_proposals: "Nothing in this drawing offers a scale for this view, so only a two-point calibration can scale it.",
  scale_rank_GRID_SPACING: "Grid spacing",
  scale_rank_DIMENSION_RATIO: "Dimension ratio",
  scale_rank_FILE_UNITS: "File units header",
  scale_rank_QS_TWO_POINT: "Two-point calibration",
  viewer_scale_tool_legend: "Two-point calibration",
  viewer_scale_tool_hint: "Take two picks on one view, standing on one axis, then enter the distance between them.",
  viewer_scale_picks_none: "No picks. Hold Alt and click two points on the sheet, or press Enter with the sheet focused.",
  viewer_scale_pick: "Pick {index}",
  viewer_scale_distance_label: "Distance between the picks",
  viewer_scale_unit_label: "Unit",
  viewer_scale_observe: "Take observation",
  viewer_scale_observations_label: "Observations taken here",
  viewer_scale_observation_axis: "Axis {axis}",
  viewer_scale_observation_drawn: "{drawn} drawing units",
  viewer_scale_verified: "Verified",
  viewer_scale_unverified: "Not verified",
  viewer_scale_check_verification: "An observation is verified when the drawing's own evidence agrees within {tolerance}.",
  viewer_scale_members_count: "{count} of {total} views chosen",
  viewer_scale_affirm: "Affirm at {rank}",
  viewer_scale_loading_label: "Reading the scale of each view.",
  viewer_scale_failed: "The scale of this sheet could not be read.",
  viewer_scale_retry: "Retry",
  viewer_scale_report_id: "Report id {id}",
  viewer_scale_offline: "Nothing was previewed: the connection to the product is gone.",
  viewer_scale_denied_permission: "Affirming a scale needs the MEASURE permission on this project, and your account does not hold it.",
  viewer_scale_denied_holder: "This project's principals and measurers hold it; a principal grants it on the participants screen.",
  viewer_scale_evidence_participants: "Open the project's participants",
  viewer_scale_evidence_drawings: "Open the project's drawings",
  viewer_scale_evidence_reload: "Reload this sheet",
} as const;

/** One key of this panel's table. */
export type ScaleCopyKey = keyof typeof SCALE_COPY;

/**
 * A line with its slots filled. The route's own `fill` lives in `src/ui/strings`, which a module may
 * not reach under ARCH-01, so this table carries the substitution its own keys are written for — the
 * same one-pass rule, and no second dialect of it.
 */
export function fillCopy(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (slot, name: string) => values[name] ?? slot);
}
