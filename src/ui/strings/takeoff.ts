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
  takeoff_register_measure_hint: "Queues a measure run over the pinned revision. Lines appear here as they are measured.",
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

  takeoff_register_tree_label: "Objects",
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
  // The Bases header's Tooltip (s-takeoff I-466): the pair names neither half on its face, so the
  // header says which is which — and that the second word stands only where the two differ.
  takeoff_register_bases_hint: "The chip is the basis of the figure. A word beside it is the basis of the specification that selects the bill item, shown only where the two differ.",
  // VD-1 (I-425): the Source chip names the sheet a line stands on by its number; a line read in
  // model space that no sheet's window shows stands on no numbered sheet, and says so in words rather
  // than printing the extractor's name for the space (I-179, R-UI-082).
  takeoff_register_source_model_space: "Model space",
  // A line kept with no quantity says why in its own Value cell (L-QTY-02, s-takeoff I-reg-1): the
  // variables it left out, read off the line, or — where it enumerated none — that no figure stands.
  takeoff_register_value_omitted: "{variables} unstated",
  takeoff_register_value_unstated: "No figure",
  takeoff_register_omitted_label: "Left out",
  takeoff_register_repudiated_note:
    "A person judged this object to be nothing. Nothing was deleted: every reading and every line measured from it stays on record, and its lines are withheld from the table.",
  takeoff_register_lines_none: "No line matches these filters. Every line stays registered — clear a filter to see the rest.",
  takeoff_register_lines_unmeasured_heading: "Not measured yet.",
  takeoff_register_lines_unmeasured_body: "The objects are registered and no measure run has published a line over them yet. Measure this campaign reads their quantities; each line stands here with its trace as it is published.",

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

  // What the machine proposed about a deferred outline, held until a person acts (I-299, L-AI-02).
  takeoff_register_corroboration_yes: "The machine reads this outline as the member its mark names, at the size the drawing states for it.",
  takeoff_register_corroboration_unsure: "The machine could not tell whether this outline is the member its mark names.",
  takeoff_register_corroboration_no: "The machine reads this outline as something other than the member its mark names.",
  takeoff_register_corroboration_hint: "A proposal, not a reading. Nothing is corroborated until you record a reading or strike the object.",

  takeoff_register_refusals_heading: "Deferred and refused",
  takeoff_register_refusals_hint: "These sightings produced no line. Each says why, and where to resolve it.",
  takeoff_register_refusal_object_label: "Object",
  takeoff_register_refusal_kind_label: "Kind",
  // s-coverage I-484: what a measure run deferred names the view or the storey itself, and
  // its door goes where the fix is made — the sheet the view stands on, or the level stack.
  takeoff_register_refusal_view_label: "View",
  takeoff_register_refusal_storey_label: "Storey",
  takeoff_register_deferral_open_sheet: "Open the sheet",
  takeoff_register_deferral_open_levels: "Open the levels",
  takeoff_register_evidence: "Open the source drawings",

  takeoff_register_level_stack_heading: "Proposed level stacks",
  takeoff_register_level_stack_hint: "Confirming inserts every level in the offer as one act. Nothing is chosen row by row.",
  takeoff_register_level_stack_label: "Level stack proposed from {drawing}",
  takeoff_register_level_stack_count: "{count} levels",

  takeoff_register_empty_heading: "No campaign is open on this project",
  takeoff_register_empty_body: "A register fills once a drawing set revision is pinned. Pin one, and every sighting it produces appears here.",
  takeoff_register_empty_action: "Browse drawing sets",
  takeoff_register_empty_campaign_heading: "This campaign has registered nothing yet",
  takeoff_register_empty_campaign_body: "Queue a measure run above, and every object it reads from the drawings appears here.",

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
