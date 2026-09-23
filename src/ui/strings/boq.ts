// R-SPINE-060: S-BOQ's sentences, in the one table this screen reads every string from
// (docs/design/s-boq.md §3, verbatim).
//
// The lane's fifth tab is named here rather than in the takeoff table beside `takeoff_nav_register`:
// the entry belongs to the surface it opens, which is the precedent the coverage, levels and
// schedules tabs already set. `src/modules/takeoff/boq/copy.ts` mirrors this table word for word,
// because ARCH-01 bars a module from reading `src/ui` and B-17 bars a second spelling of a sentence.
//
// AM-05 and I-265 bind every word below: an unsigned draft is never called by the name the law
// reserves for the signed thing. The screen says SECTION, DRAFT and LINE; the reserved word appears
// in no value here, in no key, and in no class name.
export const boq = {
  takeoff_nav_boq: "Draft BOQ",
  boq_revision_label: "Pinned revision",
  boq_taxonomy_label: "Taxonomy",
  boq_draft_standing: "Draft — unsigned",
  boq_export: "Export the draft",
  // How an item's figure is made, and why no figure is stated for the project (I-268, I-528).
  boq_coverage_incomplete:
    "Each item is the register's sum for its description, rounded once. Coverage is incomplete: what this draft does not measure is listed where it closes, and no figure is stated for the project.",
  boq_coverage_complete: "Each item is the register's sum for its description, rounded once.",
  boq_grid_label: "Draft items by section",
  boq_col_item: "Item",
  boq_col_description: "Description",
  boq_col_level: "Level",
  boq_col_quantity: "Quantity",
  boq_col_unit: "Unit",
  boq_col_basis: "Basis",
  boq_col_coverage: "Coverage",
  boq_quantity_unmeasured: "Not measured",
  boq_coverage_partial: "Partly declared",
  boq_export_quantities: "Quantities",
  boq_export_format_xlsx: "XLSX",
  boq_export_format_csv: "CSV",
  boq_section_substructure: "Substructure",
  boq_section_superstructure: "Superstructure",
  boq_section_finishes: "Finishes",
  boq_section_electrical: "Electrical",
  boq_section_plumbing: "Plumbing",
  boq_section_external: "External",
  boq_section_unclassified: "Unclassified",
  boq_not_measured_heading: "Not measured in this draft",
  boq_provisional_sum: "Provisional sum",
  boq_reason_no_taxonomy_row: "No taxonomy row places this kind.",
  boq_reason_level_not_in_stack: "This line's level is not in the level stack.",
  boq_jobs_heading: "Rendering the draft",

  // The step's own word inside the shipped timeline (job-timeline I-107): the pattern reads
  // `job_step_<kind>` for every registered kind, and the area that owns the kind authors the word —
  // the precedent `job_step_measure` and `job_step_partition` set. The key carries the kind's own
  // spelling, hyphen and all, because it IS the kind's name.
  "job_step_boq-render-draft": "Render the draft",
  boq_document_link: "Open the issued draft",
  boq_empty_heading: "Nothing published yet",
  boq_empty_body:
    "A draft lists every published line of the pinned campaign, grouped into sections by the project's taxonomy. Pin a drawing set revision, measure from the takeoff register, and the sections appear here.",

  // The first step of that chain, in the word the two screens next door already say it in
  // (`takeoff_register_empty_action`, `takeoff_coverage_empty_action`): a reader who meets the same
  // emptiness on three surfaces of one lane is offered it by one name, leading to one address.
  boq_empty_action: "Browse drawing sets",

  // A campaign is pinned and Measure published nothing: the empty state leads where the reason is —
  // the register's Deferred and refused list, which names each sheet with no scale of record and
  // each storey with no height, with a door to each fix (MEASURE-REFUSE, walk-0).
  boq_empty_unmeasured_heading: "Nothing measured yet",
  boq_empty_unmeasured_body:
    "Measure has published no line for the pinned campaign. The takeoff register lists what it deferred and why — a sheet with no scale of record, a storey with no height — and links to each fix.",

  // A refused draft is resolved where the lines come from, which is NOT where the empty state sends
  // a reader — so it is its own sentence. One sentence, one destination (R-UI-020's evidence).
  boq_register_link: "Go to the takeoff register",
  boq_error_heading: "The draft could not be read",
  boq_error_body: "Nothing was changed. Try again, and quote the report id if it keeps happening.",
  boq_retry: "Try again",
  boq_offline: "You are offline. The sections read as they stood when this page loaded, and nothing can be exported until the connection returns.",
  boq_denied_export: "Exporting the draft needs the MEASURE permission on this project.",
  boq_denied_holder: "A project principal can grant it on the participants screen.",

  // S-Documents reads a kind as words by key (`documents_kind_<kind>`, s-documents I-260). The one
  // label this increment adds to that screen stands HERE, in the table of the surface that issues the
  // document, because a string table belongs to the module whose screen authored the words.
  documents_kind_boq_draft: "Draft BOQ",
} as const;
