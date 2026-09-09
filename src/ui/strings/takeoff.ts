// R-SPINE-060: the takeoff lane's nav and S-Takeoff's register workspace, as their own module table.
// Copy fixed verbatim by docs/design/s-takeoff.md § 3 — the lane's navigation, the header and its
// Measure door, the five filters and the count line, the tree and the lines table's ten columns, the
// inspector and its two act doors, the refusal region, the level-stack offer, and the seven states
// R-UI-050 asks this screen for.
//
// Object keys, source keys, marks, disciplines, classes, kinds, units, bases, coverages, engines,
// corroboration states, act types, level ids, job ids and report ids are model data: they render
// verbatim beside these words and never inside a sentence (I-25, I-26).
export const takeoff = {
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
  takeoff_register_repudiated_count: "{count} objects repudiated",

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
  takeoff_register_line_repudiated: "Repudiated",
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

  // R-UI-050's matrix asks the redirect address for seven cells too. It renders nothing and carries
  // a reader on to the register, so each of its cells names that hand-over rather than inventing a
  // surface (docs/design/s-takeoff.md § 2).
  takeoff_delegated_to_register:
    "This address renders nothing: it carries a reader on to the register workspace one segment below it, which declares and renders every one of these states itself.",
} as const;
