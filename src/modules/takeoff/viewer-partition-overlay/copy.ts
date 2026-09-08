// The sentences the views/grid panel says, mirrored from their home in the registry (Decision I-113).
//
// `src/modules` imports core and its own module only (ARCH-01), and the string registry is
// `src/ui/strings` — so a panel that lives in this module cannot read its copy from the table that
// owns it. The tree's answer to that boundary is a mirror rather than an improvisation at the render
// site: `viewer-inspector/copy.ts` mirrors `src/ui/strings/viewer-inspector.ts` the same way, for the
// same reason, and `src/ui/screen-states/refusal-entries.ts` mirrors the refusal register. Every
// value below is `src/ui/strings/viewer-partition.ts` verbatim.
//
// The cure — a copy home both layers may read — is recorded with its owner in
// docs/design/s-viewer-partition.md § 8, never as a promise left in this tree (B-17, Q-17).

/** The keys of the registry this region renders. */
export type PartitionCopyKey =
  | "viewer_partition_heading"
  | "viewer_partition_views_toggle"
  | "viewer_partition_grid_toggle"
  | "viewer_partition_empty"
  | "viewer_partition_failed"
  | "viewer_partition_retry"
  | "viewer_partition_report_id"
  | "viewer_partition_groups_heading"
  | "viewer_partition_group_label"
  | "viewer_partition_group_count_one"
  | "viewer_partition_group_count_many"
  | "viewer_partition_off_sheet"
  | "viewer_partition_entities"
  | "viewer_partition_proposed"
  | "viewer_partition_confirmed"
  | "viewer_partition_views_list_label"
  | "viewer_partition_grid_list_label"
  | "viewer_partition_deferrals_list_label"
  | "viewer_partition_axis_reading"
  | "viewer_partition_loading_label"
  | "viewer_partition_offline"
  | "viewer_partition_denied_permission"
  | "viewer_partition_denied_holder"
  | "viewer_partition_evidence_reload"
  | "viewer_partition_evidence_participants";

export const PARTITION_COPY: Readonly<Record<PartitionCopyKey, string>> = Object.freeze({
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
});

/**
 * A mirrored sentence with its named slots filled — the registry's own `fill`, mirrored beside the
 * table it fills, so a slot the caller has no value for is left standing as itself rather than
 * becoming the word "undefined" on a screen (R-SPINE-060).
 */
export function fillCopy(key: PartitionCopyKey, values: Readonly<Record<string, string>>): string {
  return PARTITION_COPY[key].replace(/\{(\w+)\}/g, (slot, name: string) => values[name] ?? slot);
}
