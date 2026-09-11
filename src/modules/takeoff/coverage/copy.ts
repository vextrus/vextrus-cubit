// S-Coverage's words, verbatim from the Decision § 3.2 — the coverage module's own table (I-197).
//
// The takeoff lane's shared string table is another node's file, so every key this screen needs
// lives here, the nav entry's included, and the app layer reads it from here. One home for the
// screen's copy, and no second spelling of a sentence to drift from (B-17).
//
// The causes' own words are NOT here: a cause's message and remedy are the registry's, read from
// `@/core/errors` wherever they are shown, never paraphrased into a screen's table (R-SPINE-062,
// I-191). What stands here is only what this screen itself says.

/** Every key this screen spells. A key without a sentence, or a sentence without a key, is a hole. */
export type CoverageCopyKey = keyof typeof COVERAGE_COPY;

export const COVERAGE_COPY = Object.freeze({
  takeoff_nav_coverage: "Coverage",
  takeoff_coverage_heading: "Coverage",
  takeoff_coverage_caption:
    "What this campaign measured, what it did not, and why — one cell for every kind a sighted class bears, on every level it was sighted.",
  takeoff_coverage_revision_label: "Pinned revision",
  takeoff_coverage_grid_label: "Kinds by class and level",
  takeoff_coverage_measured_note: "A filled mark is a cell with published quantity.",
  takeoff_coverage_legend_heading: "What each mark means",
  takeoff_coverage_partial_note:
    "Some work items bear no cell in this grid. They stand at the head of it, each with the reason it bears none.",
  takeoff_coverage_kind_label: "Kind",
  takeoff_coverage_class_label: "Class",
  takeoff_coverage_level_label: "Level",
  takeoff_coverage_kind_grain_label: "Every class and level",
  takeoff_coverage_cause_heading: "Why this cell reads as it does",
  takeoff_coverage_declared_label: "Declared by act",
  takeoff_coverage_contradicted_note:
    "Lines have been published for this cell since this declaration was made, so the published quantity stands and the declaration is not printed on the certificate.",
  takeoff_coverage_sightings_heading: "Sighted in",
  takeoff_coverage_channel_label: "Channel",
  takeoff_coverage_drawing_label: "Drawing",
  takeoff_coverage_view_label: "View",
  takeoff_coverage_source_label: "Read at",
  takeoff_coverage_sightings_none: "No channel sighted this class on this level.",
  takeoff_coverage_observations_heading: "What the rails observed",
  takeoff_coverage_observations_hint: "An observation is evidence for the reader, never the cause on the certificate.",
  takeoff_coverage_observations_none: "Nothing was observed for this cell.",
  takeoff_coverage_doors_hint: "Each door opens a preview of exactly what it changes. Nothing is committed until you confirm.",
  takeoff_coverage_hold_out: "Hold out of this bill",
  takeoff_coverage_declare_out_of_scope: "Declare out of project scope",
  takeoff_coverage_inspector_idle_heading: "No cell selected",
  takeoff_coverage_inspector_idle_body:
    "Choose a cell in the grid to read what was sighted for it, what the rails observed, and why it stands as it does.",
  takeoff_coverage_certificate_heading: "Certificate preview",
  takeoff_coverage_certificate_hint:
    "The two boundary statements as they will print: each an enumeration, in the certificate's own order, without counts.",
  takeoff_coverage_statement_measurement_title: "Statement of the measurement boundary",
  takeoff_coverage_statement_measurement_hint: "Every kind, class and level this campaign did not measure, and the reason each stands unmeasured.",
  takeoff_coverage_statement_measurement_none: "This campaign measured every kind borne by every class it sighted, on every level.",
  takeoff_coverage_statement_bill_title: "Statement of the bill boundary",
  takeoff_coverage_statement_bill_hint: "Every kind, class and level a person held out of this bill.",
  takeoff_coverage_statement_bill_none: "Nothing has been held out of this bill.",
  takeoff_coverage_cell_label: "{kind} on {class}, {level}: {cause}",
  takeoff_coverage_cell_label_kind_grain: "{kind}, every class and level: {cause}",
  takeoff_coverage_cell_label_measured: "Quantity is published for this cell.",
  takeoff_coverage_cell_label_held: "Held out of this bill.",
  takeoff_coverage_cell_label_contradicted: "A declaration over this cell is contradicted by published lines.",
  takeoff_coverage_empty_heading: "No campaign is open on this project",
  takeoff_coverage_empty_body: "Coverage is read from a pinned drawing set revision. Pin one, and every cell it bears appears here.",
  takeoff_coverage_empty_action: "Browse drawing sets",
  takeoff_coverage_empty_campaign_heading: "This campaign has sighted nothing yet",
  takeoff_coverage_empty_campaign_body:
    "No class has been sighted in the pinned revision, so the grid bears no cell. Run a measure run from the register, and the cells appear as the rails publish.",
  takeoff_coverage_empty_campaign_action: "Open the register",
  takeoff_coverage_error_heading: "Coverage could not be read",
  takeoff_coverage_error_body: "Nothing was changed. Try again, and quote the report id if it keeps happening.",
  takeoff_coverage_report_label: "Report id",
  takeoff_coverage_retry: "Try again",
  takeoff_coverage_offline:
    "You are offline. Coverage reads as it stood when this page loaded, and nothing can be committed until the connection returns.",
  takeoff_coverage_denied_permission:
    "Holding a kind out of this bill and declaring one out of the project scope each need the SET_BILL_BOUNDARY permission on this project.",
  takeoff_coverage_denied_holder: "A project principal can grant it on the participants screen.",
});

/** The slot grammar the labels above are written in — one home for filling a sentence's holes. */
const SLOT = /\{(\w+)\}/gu;

/**
 * One sentence with its slots filled by model values. A slot nothing is given for is left standing
 * rather than blanked: a label that silently loses a word is worse than one that shows its own hole.
 */
export function fillCoverageCopy(key: CoverageCopyKey, values: Readonly<Record<string, string>>): string {
  return COVERAGE_COPY[key].replace(SLOT, (slot, name: string) => values[name] ?? slot);
}
