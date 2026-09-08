// R-SPINE-060: the views/grid region of S-Viewer, as its own module table. Copy fixed verbatim by
// docs/design/s-viewer-partition.md § 3 — the heading, the two switches, the empty and failed cells,
// the offer's sentences, the row lines and the list labels.
//
// No refusal message or remedy is spelled here: CAPTION_UNCLASSIFIABLE, GRID_NO_BUBBLE_EVIDENCE,
// GROUP_NOT_OFFERED, PERMISSION_NOT_HELD and SIGNED_OUT are the register's own and render as
// registered (R-UI-020). View keys, captions, type spellings, families, labels and positions are
// model data: they render verbatim beside these words and never inside a sentence (I-25, I-26).
export const viewerPartition = {
  viewer_partition_heading: "Views and grid",
  viewer_partition_views_toggle: "Views",
  viewer_partition_grid_toggle: "Grid",
  viewer_partition_empty: "No partition has been rebuilt for this drawing yet, so there are no views or grid to show.",
  viewer_partition_failed: "The partition could not be read.",
  viewer_partition_retry: "Retry",
  viewer_partition_report_id: "Report id {id}",
  viewer_partition_groups_heading: "Proposed view types",
  viewer_partition_group_label: "Views of this drawing whose captions the grammar could not read, proposed as {type}",
  viewer_partition_group_count_one: "1 view",
  viewer_partition_group_count_many: "{count} views",
  viewer_partition_off_sheet: "Not on this sheet",
  viewer_partition_entities: "{count} entities",
  viewer_partition_proposed: "Proposed as {type}",
  viewer_partition_confirmed: "Confirmed as {type}",
  viewer_partition_views_list_label: "Views of this drawing",
  viewer_partition_grid_list_label: "Grid axes on this drawing",
  viewer_partition_deferrals_list_label: "Layout plans with no grid to read",
  viewer_partition_axis_reading: "Grid {label}, {family} family, at {position}",
  viewer_partition_loading_label: "Reading the partition.",
  viewer_partition_offline: "Nothing was previewed: the connection to the product is gone.",
  viewer_partition_denied_permission: "Confirming a view's type needs the MEASURE permission on this project, and your account does not hold it.",
  viewer_partition_denied_holder: "This project's principals and measurers hold it; a principal grants it on the participants screen.",
  viewer_partition_evidence_reload: "Reload this sheet",
  viewer_partition_evidence_participants: "Open the project's participants",
} as const;

// The directory's convention is that a table is exported under its file's basename, and this file's
// basename is hyphenated (tests/ui/strings.test.ts).
export { viewerPartition as "viewer-partition" };
