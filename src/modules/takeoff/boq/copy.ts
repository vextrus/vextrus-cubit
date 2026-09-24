// S-BOQ's sentences, as the module that renders them may read them (R-SPINE-060, ARCH-01).
//
// `src/ui/strings/boq.ts` is the product's one string table for this screen and a module may not
// import `src/ui`, so the words stand here too — word for word, in the same keys, mirrored by hand
// exactly as `coverage/copy.ts` and `schedules-ui/copy.ts` already mirror theirs. The Decision's §3
// is the authority for both files; a sentence that differs between them is a defect of this file.
//
// AM-05 and I-265 bind every word: an unsigned draft is never called by the name the law reserves
// for the signed thing. The screen says SECTION, DRAFT and LINE.
export const BOQ_COPY = {
  takeoff_nav_boq: "Draft BOQ",
  boq_revision_label: "Pinned revision",
  boq_taxonomy_label: "Taxonomy",
  boq_draft_standing: "Draft — unsigned",
  boq_export: "Export the draft",

  // The two quantity channels beside the primary (R-TO-070, A-BOQ-XLSX). Each says WHAT it hands over
  // rather than what it runs, and neither calls the unsigned draft by the reserved name (AM-05, I-265).
  // One name in two words — the noun, then the artefact's own format — so a narrow tabs row can hide
  // the noun visually and keep it in the accessible name (Decision §1, I-boq-1).
  boq_export_quantities: "Quantities",
  boq_export_format_xlsx: "XLSX",
  boq_export_format_csv: "CSV",
  boq_export_xlsx_hint: "Download the items, and every line behind them with its bases and formula, as a workbook with live formulas.",
  boq_export_csv_hint: "Download the Quantities sheet as CSV.",
  boq_export_link: "Save the file",
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
  // An item none of whose members states a figure is not "partly" anything (I-571).
  boq_coverage_unmeasured: "Not measured",
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
  boq_document_link: "Open the issued draft",
  boq_empty_heading: "Nothing published yet",
  boq_empty_body:
    "A draft lists every published line of the pinned campaign, grouped into sections by the project's taxonomy. Pin a drawing set revision, measure from the takeoff register, and the sections appear here.",
  boq_empty_action: "Browse drawing sets",
  // A campaign is pinned and Measure published nothing: the empty state leads where the reason is —
  // the register's Deferred and refused list, which names each sheet with no scale of record and
  // each storey with no height, with a door to each fix (MEASURE-REFUSE, walk-0).
  boq_empty_unmeasured_heading: "Nothing measured yet",
  boq_empty_unmeasured_body:
    "Measure has published no line for the pinned campaign. The takeoff register lists what it deferred and why — a sheet with no scale of record, a storey with no height — and links to each fix.",
  boq_register_link: "Go to the takeoff register",
  boq_error_heading: "The draft could not be read",
  boq_error_body: "Nothing was changed. Try again, and quote the report id if it keeps happening.",
  boq_retry: "Try again",
  boq_offline:
    "You are offline. The sections read as they stood when this page loaded, and nothing can be exported until the connection returns.",
  boq_denied_export: "Exporting the draft needs the MEASURE permission on this project.",
  boq_denied_holder: "A project principal can grant it on the participants screen.",
} as const;

/** The label a section reads under, by the bill it carries (Decision §3, I-266). */
export const BOQ_SECTION_WORDS: Readonly<Record<string, string>> = Object.freeze({
  SUBSTRUCTURE: BOQ_COPY.boq_section_substructure,
  SUPERSTRUCTURE: BOQ_COPY.boq_section_superstructure,
  FINISHES: BOQ_COPY.boq_section_finishes,
  ELECTRICAL: BOQ_COPY.boq_section_electrical,
  PLUMBING: BOQ_COPY.boq_section_plumbing,
  EXTERNAL: BOQ_COPY.boq_section_external,
  UNCLASSIFIED: BOQ_COPY.boq_section_unclassified,
});

/** Why a line could not be placed, in words (L-BD-08: the reason is stated, never a code alone). */
export const BOQ_REASON_WORDS: Readonly<Record<string, string>> = Object.freeze({
  NO_TAXONOMY_ROW: BOQ_COPY.boq_reason_no_taxonomy_row,
  LEVEL_NOT_IN_STACK: BOQ_COPY.boq_reason_level_not_in_stack,
});
