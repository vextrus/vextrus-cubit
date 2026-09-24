// S-Coverage's words, verbatim from the Decision § 3.2 — the coverage module's own table (I-197).
//
// The takeoff lane's shared string table is another node's file, so every key this screen needs
// lives here, the nav entry's included, and the app layer reads it from here. One home for the
// screen's copy, and no second spelling of a sentence to drift from (B-17).
//
// The causes' own words are NOT here: a cause's message and remedy are the registry's, read from
// `@/core/errors` wherever they are shown, never paraphrased into a screen's table (R-SPINE-062,
// I-191). What stands here is only what this screen itself says.
import { formatUserFigure } from "@/core/format";

/** Every key this screen spells. A key without a sentence, or a sentence without a key, is a hole. */
export type CoverageCopyKey = keyof typeof COVERAGE_COPY;

export const COVERAGE_COPY = Object.freeze({
  takeoff_nav_coverage: "Coverage",
  takeoff_coverage_heading: "Coverage",
  takeoff_coverage_revision_label: "Pinned revision",
  takeoff_coverage_grid_label: "Kinds by class and level",
  takeoff_coverage_measured_note: "A filled mark is a cell with published quantity.",
  takeoff_coverage_legend_heading: "What each mark means",
  // §3.5's one 28 px key line: the WORD a mark is read by stands beside its glyph, and the
  // registry's whole sentence arrives on hover. Seven words, one per mark (§4.3's table).
  takeoff_coverage_mark_published: "Published",
  takeoff_coverage_mark_partial: "Partial",
  takeoff_coverage_mark_absent: "Not measured",
  takeoff_coverage_mark_out_of_scope: "Out of scope",
  takeoff_coverage_mark_held: "Held",
  takeoff_coverage_mark_no_class: "No class",
  takeoff_coverage_mark_catalogue: "Catalogue only",
  // The same seven, as the footer tallies them: "31 published", not "31 Published" (§6).
  takeoff_coverage_tally_published: "published",
  takeoff_coverage_tally_partial: "partial",
  takeoff_coverage_tally_absent: "not measured",
  takeoff_coverage_tally_out_of_scope: "out of scope",
  takeoff_coverage_tally_held: "held",
  takeoff_coverage_tally_no_class: "no class",
  takeoff_coverage_tally_catalogue: "catalogue only",
  // The 28 px footer: the count of cells, then one tally per mark that stands in this reading.
  takeoff_coverage_footer_cells_one: "{count} cell",
  takeoff_coverage_footer_cells_other: "{count} cells",
  takeoff_coverage_footer_tally: "{count} {mark}",
  takeoff_coverage_footer_label: "Counts by mark",
  // The 32 px tool row (§3.5): what a reader does to the screen, never inside the work surface.
  takeoff_coverage_tools_label: "Coverage tools",
  takeoff_coverage_certificate_show: "Preview certificate",
  takeoff_coverage_certificate_hide: "Hide certificate",
  // The grid's own two headers, named so a reader who cannot see the matrix still meets its axes.
  takeoff_coverage_kind_column: "Kind",
  takeoff_coverage_column_label: "{class} · {level}",
  takeoff_coverage_kind_share: "{count} of {total} measured",
  takeoff_coverage_level_label: "Level",
  // A column whose class was sighted on no level of the stack (a foundation filed under a lawful-null
  // slot, a placement no storey reads) SAYS so rather than standing as a blank header (I-cov-3).
  takeoff_coverage_level_none: "No level",
  takeoff_coverage_kind_grain_label: "Every class and level",
  takeoff_coverage_cause_heading: "Why this cell reads as it does",
  takeoff_coverage_declared_label: "Declared by act",
  takeoff_coverage_contradicted_note:
    "Lines have been published for this cell since this declaration was made, so the published quantity stands and the declaration is not printed on the certificate.",
  takeoff_coverage_sightings_heading: "Sighted in",
  takeoff_coverage_channel_label: "Channel",
  takeoff_coverage_view_label: "View",
  takeoff_coverage_source_label: "Read at",
  takeoff_coverage_sightings_none: "No channel sighted this class on this level.",
  // R-UI-020: a remedy carries a link. One cause names the rule set; every other names the register.
  takeoff_coverage_remedy_ruleset: "Open the rule set",
  takeoff_coverage_observations_heading: "What the measure run reported",
  takeoff_coverage_observations_none: "The measure run reported nothing for this cell.",
  // s-coverage I-480..g (session 8, HONEST-SCOPE): every unmeasured cell says WHY, in the
  // registry's words for its reason; a partly published cell says what its lines left out; a column on
  // no storey says where its members stand; a position no class bears is keyed; the doors go where
  // the fix is made.
  takeoff_coverage_level_foundation: "Foundation",
  takeoff_coverage_level_unplaced: "Not placed",
  takeoff_coverage_absent_meaning: "Nothing was published for this cell. Open it for the reason and what to do.",
  takeoff_coverage_mark_void: "Not borne",
  takeoff_coverage_void_meaning: "This class does not bear this kind, so nothing is measured or owed here.",
  takeoff_coverage_cell_label_void: "{kind} on {class}, {level}: this class does not bear this kind.",
  takeoff_coverage_reason_views_label: "On the drawings",
  takeoff_coverage_partial_all: "Declared partial: {members} {things}, {reasons}.",
  takeoff_coverage_partial_some: "Declared partial: {count} of {total} lines carry no quantity — {members} {things}, {reasons}.",
  takeoff_coverage_remedy_sheet: "Open the sheet",
  takeoff_coverage_remedy_drawings: "Open the drawings",
  takeoff_coverage_sightings_summary_one: "{count} sighting on {sheets}",
  takeoff_coverage_sightings_summary_other: "{count} sightings on {sheets}",
  takeoff_coverage_sightings_nowhere: "no sheet named",
  takeoff_coverage_observation_count: "{count} ×",
  takeoff_coverage_statement_partial_label: "Declared partial",
  // I-613: a beam the plan draws and no mark names, as the measurement boundary names it.
  takeoff_coverage_statement_unnamed_label: "Beam drawn, not named",
  takeoff_coverage_statement_unnamed_grid: "Grid {grid}",
  // I-297: a boundary a model proposed, stated as a proposal and never as a reading. The block is
  // absent where nothing was proposed — there is no idle panel and no idle sentence on this screen
  // (§1) — so no key here says "nothing was proposed". The CAUSE's own words stay the registry's:
  // what the certificate would state is `REFUSALS[cause].message`, chosen by code (I-191).
  takeoff_coverage_proposed_heading: "A boundary this cell may stand under",
  takeoff_coverage_proposed_note: "A model read this cell's evidence and proposes this boundary. Nothing is declared until you carry the act.",
  takeoff_coverage_proposed_sentence_label: "The certificate would state",
  takeoff_coverage_proposed_carry: "Declare this boundary",
  takeoff_coverage_hold_out: "Hold out of this bill",
  takeoff_coverage_declare_out_of_scope: "Declare out of project scope",
  takeoff_coverage_certificate_heading: "Certificate preview",
  takeoff_coverage_statement_measurement_title: "Statement of the measurement boundary",
  takeoff_coverage_statement_measurement_none: "This campaign measured every kind borne by every class it sighted, on every level.",
  takeoff_coverage_statement_bill_title: "Statement of the bill boundary",
  takeoff_coverage_statement_bill_none: "Nothing has been held out of this bill.",
  // A statement empty because there is no campaign to state one over says THAT, and never that a
  // campaign nobody pinned measured everything: the boundary is unstated, not settled (X-3, L-QTY-07).
  takeoff_coverage_statement_measurement_none_unpinned: "No campaign is open, so there is no measurement boundary to state yet.",
  takeoff_coverage_statement_bill_none_unpinned: "No campaign is open, so there is no bill to hold anything out of yet.",
  takeoff_coverage_cell_label: "{kind} on {class}, {level}: {cause}",
  takeoff_coverage_cell_label_kind_grain: "{kind}, every class and level: {cause}",
  takeoff_coverage_cell_label_measured: "Quantity is published for this cell.",
  // I-cov-1: a published cell whose lines were kept with no quantity is partial, and says how much.
  takeoff_coverage_cell_label_declared: "{count} of its {total} lines carry no quantity: each names what the drawing did not state.",
  takeoff_coverage_cell_label_held: "Held out of this bill.",
  takeoff_coverage_cell_label_contradicted: "A declaration over this cell is contradicted by published lines.",
  takeoff_coverage_empty_heading: "No campaign is open on this project",
  takeoff_coverage_empty_body: "Coverage is read from a pinned drawing set revision. Pin one, and every cell it bears appears here.",
  takeoff_coverage_empty_action: "Browse drawing sets",
  takeoff_coverage_empty_campaign_heading: "This campaign has sighted nothing yet",
  takeoff_coverage_empty_campaign_body:
    "No class has been sighted in the pinned revision, so the grid bears no cell. Run a measure run from the register, and the cells appear as the rails publish.",
  takeoff_coverage_empty_campaign_action: "Open the register",
  takeoff_coverage_loading: "Reading what this campaign measured, and what it did not.",
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

/**
 * One sentence in the form its count takes. The "1 sheets" bug ends by asking the count, not by
 * hoping (§6): a key's singular form is the key with `_one`, its plural the key with `_other`, and
 * the count fills the slot in either.
 */
export function countCoverageCopy(
  key: "takeoff_coverage_footer_cells" | "takeoff_coverage_sightings_summary",
  count: number,
  values: Readonly<Record<string, string>> = {},
): string {
  const form = (count === 1 ? `${key}_one` : `${key}_other`) as CoverageCopyKey;
  return fillCoverageCopy(form, { count: countWords(count), ...values });
}

/** A count as this screen writes it — through the one format seam, lakh grouping and all (L-FMT-01). */
export function countWords(count: number): string {
  return formatUserFigure(String(count));
}
