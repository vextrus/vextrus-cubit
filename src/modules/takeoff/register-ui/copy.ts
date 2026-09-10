// The sentences the register workspace says, mirrored from their home in the registry.
//
// `src/modules` imports core and its own module only (ARCH-01), and the string registry is
// `src/ui/strings` — so a workspace that lives in this module cannot read its copy from the table
// that owns it. The tree's answer to that boundary is a mirror pinned by a test rather than an
// improvisation at the render site: `src/modules/takeoff/viewer-inspector/copy.ts` mirrors its own
// table the same way, and `src/ui/screen-states/refusal-entries.ts` mirrors the refusal register for
// the same reason. Every value below is `src/ui/strings/takeoff.ts` verbatim, and
// tests/takeoff/register-ui/copy-mirror.test.ts fails the build if the two ever differ (B-17, C-13).
//
// The cure — a copy home both layers may read — is recorded with its owner in
// docs/design/s-takeoff.md § 8, never as a promise left in this tree (B-17, Q-17).

/** The keys of the registry this workspace renders. */
export type RegisterCopyKey =
  | "takeoff_nav_label"
  | "takeoff_nav_register"
  | "takeoff_register_heading"
  | "takeoff_register_caption"
  | "takeoff_register_campaign_label"
  | "takeoff_register_measure"
  | "takeoff_register_measure_hint"
  | "takeoff_register_timeline_heading"
  | "takeoff_register_filter_class"
  | "takeoff_register_filter_kind"
  | "takeoff_register_filter_level"
  | "takeoff_register_filter_basis"
  | "takeoff_register_filter_coverage"
  | "takeoff_register_filter_any_class"
  | "takeoff_register_filter_any_kind"
  | "takeoff_register_filter_any_level"
  | "takeoff_register_filter_any_basis"
  | "takeoff_register_filter_any_coverage"
  | "takeoff_register_lines_count"
  | "takeoff_register_tree_label"
  | "takeoff_register_repudiated_count"
  | "takeoff_register_col_kind"
  | "takeoff_register_col_value"
  | "takeoff_register_col_unit"
  | "takeoff_register_col_formula"
  | "takeoff_register_col_variables"
  | "takeoff_register_col_bases"
  | "takeoff_register_col_coverage"
  | "takeoff_register_col_calibration"
  | "takeoff_register_col_engine"
  | "takeoff_register_col_source"
  | "takeoff_register_repudiated_note"
  | "takeoff_register_lines_none"
  | "takeoff_register_object_key_label"
  | "takeoff_register_basis_label"
  | "takeoff_register_role_label"
  | "takeoff_register_corroboration_label"
  | "takeoff_register_source_label"
  | "takeoff_register_attributes_label"
  | "takeoff_register_competing_label"
  | "takeoff_register_overruled_label"
  | "takeoff_register_no_readings"
  | "takeoff_register_suspended_note"
  | "takeoff_register_inspector_idle_heading"
  | "takeoff_register_inspector_idle_body"
  | "takeoff_register_corroborate"
  | "takeoff_register_corroborate_value"
  | "takeoff_register_corroborate_unit"
  | "takeoff_register_corroborate_precedence"
  | "takeoff_register_corroborate_precedence_hint"
  | "takeoff_register_corroborate_preview"
  | "takeoff_register_repudiate"
  | "takeoff_register_refusals_heading"
  | "takeoff_register_refusals_hint"
  | "takeoff_register_refusal_object_label"
  | "takeoff_register_refusal_kind_label"
  | "takeoff_register_evidence"
  | "takeoff_register_level_stack_heading"
  | "takeoff_register_level_stack_hint"
  | "takeoff_register_level_stack_label"
  | "takeoff_register_level_stack_count"
  | "takeoff_register_empty_heading"
  | "takeoff_register_empty_body"
  | "takeoff_register_empty_action"
  | "takeoff_register_empty_campaign_heading"
  | "takeoff_register_empty_campaign_body"
  | "takeoff_register_error_heading"
  | "takeoff_register_error_body"
  | "takeoff_register_report_label"
  | "takeoff_register_retry"
  | "takeoff_register_offline"
  | "takeoff_register_denied_permission"
  | "takeoff_register_denied_holder"
  | "takeoff_delegated_to_register";

export const REGISTER_COPY: Readonly<Record<RegisterCopyKey, string>> = Object.freeze({
  takeoff_nav_label: "Takeoff",
  takeoff_nav_register: "Register",

  takeoff_register_heading: "Register",
  takeoff_register_caption: "Every object this campaign registered, the quantity lines measured from it, and what each one rests on.",
  takeoff_register_campaign_label: "Pinned revision",
  takeoff_register_measure: "Measure this campaign",
  takeoff_register_measure_hint: "Queues a measure run over the pinned revision. Lines appear as each rail publishes them.",
  takeoff_register_timeline_heading: "Measure runs",

  takeoff_register_filter_class: "Class",
  takeoff_register_filter_kind: "Kind",
  takeoff_register_filter_level: "Level",
  takeoff_register_filter_basis: "Basis",
  takeoff_register_filter_coverage: "Coverage",
  takeoff_register_filter_any_class: "All classes",
  takeoff_register_filter_any_kind: "All kinds",
  takeoff_register_filter_any_level: "All levels",
  takeoff_register_filter_any_basis: "All bases",
  takeoff_register_filter_any_coverage: "All coverages",
  takeoff_register_lines_count: "{shown} of {total} lines",

  takeoff_register_tree_label: "Objects by discipline, level and class",
  takeoff_register_repudiated_count: "{count} objects repudiated, {lines} lines withheld",

  takeoff_register_col_kind: "Kind",
  takeoff_register_col_value: "Value",
  takeoff_register_col_unit: "Unit",
  takeoff_register_col_formula: "Formula",
  takeoff_register_col_variables: "Variables",
  takeoff_register_col_bases: "Bases",
  takeoff_register_col_coverage: "Coverage",
  takeoff_register_col_calibration: "Calibration",
  takeoff_register_col_engine: "Engine",
  takeoff_register_col_source: "Source",
  takeoff_register_repudiated_note:
    "A person judged this object to be nothing. Nothing was deleted: every reading and every line measured from it stays on record, and its lines are withheld from the table.",
  takeoff_register_lines_none: "No line matches these filters. Every line stays registered — clear a filter to see the rest.",

  takeoff_register_object_key_label: "Object key",
  takeoff_register_basis_label: "Basis",
  takeoff_register_role_label: "Role",
  takeoff_register_corroboration_label: "Corroboration",
  takeoff_register_source_label: "Read from",
  takeoff_register_attributes_label: "Attributes",
  takeoff_register_competing_label: "Competing readings",
  takeoff_register_overruled_label: "Overruled readings",
  takeoff_register_no_readings: "No reading has been recorded for this attribute.",
  takeoff_register_suspended_note: "These readings disagree, so this attribute has no standing value. Record a reading at a precedence that settles it.",
  takeoff_register_inspector_idle_heading: "No object selected",
  takeoff_register_inspector_idle_body: "Choose an object in the tree to read its basis, its role and the readings recorded against it.",

  takeoff_register_corroborate: "Record a reading",
  takeoff_register_corroborate_value: "Value",
  takeoff_register_corroborate_unit: "Unit",
  takeoff_register_corroborate_precedence: "Precedence",
  takeoff_register_corroborate_precedence_hint: "Lower numbers rank first. A reading at the same precedence as another suspends the attribute.",
  takeoff_register_corroborate_preview: "Preview this reading",
  takeoff_register_repudiate: "Repudiate this object",

  takeoff_register_refusals_heading: "Deferred and refused",
  takeoff_register_refusals_hint: "These sightings produced no line. Each says why, and where to resolve it.",
  takeoff_register_refusal_object_label: "Object",
  takeoff_register_refusal_kind_label: "Kind",
  takeoff_register_evidence: "Open the source drawings",

  takeoff_register_level_stack_heading: "Level stacks read from the drawings",
  takeoff_register_level_stack_hint: "Confirming inserts every level in the offer as one act. Nothing is chosen row by row.",
  takeoff_register_level_stack_label: "Level stack proposed from {drawing}",
  takeoff_register_level_stack_count: "{count} levels",

  takeoff_register_empty_heading: "No campaign is open on this project",
  takeoff_register_empty_body: "A register fills once a drawing set revision is pinned. Pin one, and every sighting it produces appears here.",
  takeoff_register_empty_action: "Browse drawing sets",
  takeoff_register_empty_campaign_heading: "This campaign has registered nothing yet",
  takeoff_register_empty_campaign_body: "Queue a measure run above, and every object the rails register appears here as they publish.",

  takeoff_register_error_heading: "The register could not be read",
  takeoff_register_error_body: "Nothing was changed. Try again, and quote the report id if it keeps happening.",
  takeoff_register_report_label: "Report id",
  takeoff_register_retry: "Try again",
  takeoff_register_offline: "You are offline. The register reads as it stood when this page loaded, and nothing can be committed until the connection returns.",
  takeoff_register_denied_permission: "Recording a reading, repudiating an object and queueing a measure run each need the MEASURE permission on this project.",
  takeoff_register_denied_holder: "A project principal can grant it on the participants screen.",

  takeoff_delegated_to_register:
    "This address renders nothing: it carries a reader on to the register workspace one segment below it, which declares and renders every one of these states itself.",
});

/**
 * A mirrored string with its named slots filled, the registry's own substitution rule: a slot the
 * caller has no value for is left standing as itself rather than becoming the word "undefined" on a
 * screen (R-SPINE-060, mirrored here for the same reason the table above is).
 */
export function fillCopy(key: RegisterCopyKey, values: Readonly<Record<string, string>>): string {
  return REGISTER_COPY[key].replace(/\{(\w+)\}/g, (slot, name: string) => values[name] ?? slot);
}
