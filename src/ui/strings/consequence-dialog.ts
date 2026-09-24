// R-SPINE-060: the ConsequenceDialog pattern's own table. Pattern chrome, plus the one name each act
// is read by: every other act-specific word still arrives in the Consequence's own data, so one
// dialog serves every act without a second table per act (B-17). Copy fixed verbatim by
// docs/design/consequence-dialog.md § 3.
export const consequenceDialog = {
  consequence_dialog_title: "What this act changes",
  consequence_dialog_hint: "Computed from the project as it stands. Confirming commits exactly what is shown and nothing else.",
  consequence_dialog_before_label: "Before",
  consequence_dialog_after_label: "After",
  consequence_dialog_none: "none",
  consequence_dialog_digest_label: "Consequence digest",
  consequence_dialog_stale: "The project changed while you were deciding, so nothing was committed. What is shown below was recomputed just now, and confirming carries the new digest.",
  // I-161: what an act's kind derives, shown only when the seam sent it. Both parts of the Decision
  // place these three here, with the dialog's own chrome, and the Decision is the law (§ 3).
  consequence_dialog_effects_heading: "What follows from this",
  consequence_dialog_effects_lines: "Lines that re-measure",
  consequence_dialog_effects_signatures: "Signatures that void",
  consequence_dialog_confirm: "Confirm",
  consequence_dialog_cancel: "Cancel",
  consequence_dialog_close: "Close",

  // I-444: the overline says which act this is in the words its door uses, never the enum. The
  // enum stays on the wrapper's `data-act-type` and inside the Details disclosure (R-UI-082).
  consequence_dialog_act_assign_participant_role: "Change a participant's role",
  consequence_dialog_act_confirm_discipline: "Confirm disciplines",
  consequence_dialog_act_confirm_view_type: "Confirm view types",
  consequence_dialog_act_pin_drawing_set: "Pin a drawing set",
  consequence_dialog_act_affirm_scale: "Affirm a scale",
  consequence_dialog_act_insert_level: "Insert levels",
  consequence_dialog_act_repudiate_level: "Remove a level",
  consequence_dialog_act_author_storey_height: "Record a storey height",
  consequence_dialog_act_author_typical_range: "State a typical floor range",
  consequence_dialog_act_transcribe_sheet_notes: "Record a sheet's notes",
  consequence_dialog_act_corroborate: "Record a reading",
  consequence_dialog_act_repudiate: "Strike an object",
  consequence_dialog_act_hold_out_of_bill: "Hold out of this bill",
  consequence_dialog_act_declare_not_in_project_scope: "Declare out of project scope",
  consequence_dialog_act_author_ruleset_edition: "Author a ruleset edition",
  consequence_dialog_act_author_site_fact: "Record a site fact",
  consequence_dialog_act_record_manual_measurement: "Record a hand measurement",

  // I-445: a standing, before and after, in the words the level stack says it in.
  consequence_dialog_standing_agreed: "Agreed",
  consequence_dialog_standing_suspended: "Suspended",
  consequence_dialog_standing_none: "Not stated",
  consequence_dialog_standing_readings: "{count} readings",
  consequence_dialog_standing_readings_one: "1 reading",
  consequence_dialog_standing_disagree: "{count} readings do not agree",
  consequence_dialog_standing_unread: "No reading yet",
  consequence_dialog_standing_recorded: "This reading",

  // I-446: the lines that move, counted by class, kind and level.
  consequence_dialog_lines: "{count} lines",
  consequence_dialog_lines_one: "1 line",
  consequence_dialog_lines_total: "{count} lines in all",
  consequence_dialog_signatures: "{count} signatures",
  consequence_dialog_signatures_one: "1 signature",
  consequence_dialog_level_foundation: "Foundation",
  consequence_dialog_level_unresolved: "Level not resolved",
  consequence_dialog_level_none: "No level",

  // I-447: what a person does not need in order to decide, one press away.
  consequence_dialog_details: "Details",
  consequence_dialog_details_act: "Act",
  consequence_dialog_details_lines: "Line ids",
  consequence_dialog_details_signatures: "Signature ids",

  // I-560: a subject's values in the words its vocabulary is read in, and the subjects making one
  // change counted together, each one press away.
  consequence_dialog_discipline_none: "Unassigned",
  consequence_dialog_discipline_structural: "Structural",
  consequence_dialog_discipline_architectural: "Architectural",
  consequence_dialog_discipline_mep: "MEP",
  consequence_dialog_discipline_civil: "Civil",
  consequence_dialog_discipline_other: "Other",
  consequence_dialog_revision: "Revision {ordinal}",
  consequence_dialog_revision_none: "Not cited",
  consequence_dialog_change_sheets: "{count} sheets from {before} to {after}",
  consequence_dialog_same_sheets: "{count} sheets stay {after}",
  consequence_dialog_members_sheets: "Show the {count} sheets",
  consequence_dialog_change_drawings: "{count} drawings from {before} to {after}",
  consequence_dialog_same_drawings: "{count} drawings stay at {after}",
  consequence_dialog_members_drawings: "Show the {count} drawings",
  consequence_dialog_details_values: "Recorded values",

  // I-561: what a pin records, in the set screen's words.
  consequence_dialog_pin_records: "Pins {set} as its revision {revision}, citing {count} drawings at the revision each stands at now.",
  consequence_dialog_pin_records_one: "Pins {set} as its revision {revision}, citing 1 drawing at the revision it stands at now.",
  consequence_dialog_pin_first: "The set has never been pinned before.",
  consequence_dialog_pin_standing: "Revision {revision} stays exactly as it was pinned.",
  consequence_dialog_details_calibrations: "Calibration keys",

  // I-566: a view's scale said as a QS reads one — the rank it stands on and what one drawing
  // unit is — with the calibration key behind Details.
  consequence_dialog_scale_none: "No scale affirmed",
  consequence_dialog_scale_rank_QS_TWO_POINT: "Two-point calibration",
  consequence_dialog_scale_rank_GRID_SPACING: "Grid spacing",
  consequence_dialog_scale_rank_DIMENSION_RATIO: "Dimension ratio",
  consequence_dialog_scale_rank_FILE_UNITS: "File units header",
  consequence_dialog_scale_per_unit: "1 drawing unit is",
  consequence_dialog_scale_axis_x: "X",
  consequence_dialog_scale_axis_y: "Y",

  // S6 (s-measure § 2.5, § 4): the card's MEASUREMENT arm — the condition as applied, each kind's
  // figure with the gate's formula, the scale, and the notes a measurement owes.
  consequence_dialog_measurement_readings: "Readings",
  consequence_dialog_measurement_reading_condition: "From the condition",
  consequence_dialog_measurement_reading_note: "From the note \"{note}\"",
  consequence_dialog_measurement_level: "Level",
  consequence_dialog_measurement_cutout_role: "Cut-out {n}",
  consequence_dialog_measurement_role_opening: "Opening",
  consequence_dialog_measurement_role_member: "Column or wall",
  consequence_dialog_measurement_formula: "Formula",
  consequence_dialog_measurement_scale: "Scale",
  consequence_dialog_measurement_scale_factors: "X {x} · Y {y} m per unit",
  consequence_dialog_measurement_scope: "Counts what you traced and nothing else on {level}.",
  consequence_dialog_measurement_foundation: "Foundation",
  consequence_dialog_measurement_level_pick: "Pick a level",
  consequence_dialog_measurement_cutout: "Cut out",
  consequence_dialog_measurement_demoted: "{count} points did not sit on the drawing where they were snapped, so they count as placed by hand.",
  consequence_dialog_measurement_interpreted: "Traced on a scan: this waits for a second reading and is billed only once agreed.",
  consequence_dialog_measurement_replaces: "Replaces {previous}, which leaves the bill.",
  consequence_dialog_measurement_queued: "Waiting for agreement: {cause}",
  consequence_dialog_measurement_not_offered: "Nothing is measured by hand this way yet.",
} as const;

// R-SPINE-060's per-module convention is that a table file's DESIGNATED export is the one named for
// its basename, and this file's basename is not an identifier. The table is therefore published
// under both names: the identifier `index.ts` aggregates it by, and the basename the convention
// designates. One table, two names for it — never two tables.
export { consequenceDialog as "consequence-dialog" };
