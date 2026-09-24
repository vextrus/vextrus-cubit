// R-SPINE-060: S-Ask's sentences, in the one table this screen reads every string from
// (docs/design/s-ask.md §3, verbatim).
//
// The lane's seventh tab is named here rather than in the takeoff table beside `takeoff_nav_register`:
// the entry belongs to the surface it opens, the precedent every elder tab set. The engine answers
// FACTS and never a sentence (I-398), so this table is the one home of every word an answer says —
// there is no mirror of it in `src/modules`.
//
// Placeholders are filled by `fill`; `{count}`, `{figure}` and `{lines}` are figures through the
// format seam, each an EvidenceLink where §1.1 says so. A plural pair is `_one` / `_other`. The
// class, kind, trade and note-kind families are one entry per member of their catalogue roster,
// keyed by the member with its dot as an underscore; `tests/ui/ask/strings.test.ts` enumerates them.
export const ask = {
  /* ---------------------------------------------------------------- frame and band */
  takeoff_nav_ask: "Ask",
  ask_revision_label: "Pinned revision",
  ask_field_label: "Ask the drawings",
  ask_field_placeholder: "Ask how many, how much, what the notes state, or where something is drawn",
  ask_submit: "Ask",
  ask_clear: "Clear the conversation",
  ask_clear_hint: "Answers are kept in this tab until you clear them or close it.",
  ask_thread_label: "Answers, newest first",
  ask_thread_cap: "The last 20 answers are kept in this tab.",

  /* ---------------------------------------------------------------- an answer's rows */
  ask_asked_label: "Asked",
  ask_understood_label: "Understood as",
  ask_understood_machine: "the machine's reading",
  ask_understood_machine_hint: "A proposal, not a certainty. If it is not what you asked, ask again in other words.",
  ask_understood_chosen: "your choice",
  ask_understood_follow_up: "following the previous answer",
  ask_understood_unit: "answered in {unit}, the unit the register measures this in",
  ask_show_label: "Show on the drawing",
  ask_show_model: "Model space",
  ask_rows: "Rows ({count})",
  ask_open_in_register: "Open in the register",
  ask_stale: "The drawings or the register have changed since this was answered.",
  ask_again: "Ask again",
  ask_answering: "Answering",

  /* ---------------------------------------------------------------- the intent words */
  ask_intent_count: "Count",
  ask_intent_marks: "Marks",
  ask_intent_quantity: "Quantity",
  ask_intent_measured_so_far: "Measured so far",
  ask_intent_why_not_measured: "Why not measured",
  ask_intent_member_type: "Member type",
  ask_intent_note: "General note",
  ask_intent_level_height: "Storey height",
  ask_intent_sheet_list: "Sheets in the set",
  // The two sheet-text intents join the roster with the text index they read (ASK-3); their words
  // stand here now so the Decision's copy and this table are one text.
  ask_intent_schedule_sheet: "Which sheet",
  ask_intent_find_text: "Find on the sheets",
  ask_by_level: "by level",
  ask_by_mark: "by mark",

  /* ---------------------------------------------------------------- classes, in words */
  ask_class_column_one: "column",
  ask_class_column_other: "columns",
  ask_class_beam_one: "beam",
  ask_class_beam_other: "beams",
  ask_class_slab_one: "slab",
  ask_class_slab_other: "slabs",
  ask_class_footing_one: "footing",
  ask_class_footing_other: "footings",
  ask_class_pile_cap_one: "pile cap",
  ask_class_pile_cap_other: "pile caps",
  ask_class_pile_one: "pile",
  ask_class_pile_other: "piles",
  ask_class_tie_beam_one: "tie beam",
  ask_class_tie_beam_other: "tie beams",
  ask_class_shear_wall_one: "shear wall",
  ask_class_shear_wall_other: "shear walls",
  ask_class_stair_one: "stair",
  ask_class_stair_other: "stairs",
  ask_class_lintel_one: "lintel",
  ask_class_lintel_other: "lintels",
  ask_class_brick_wall_one: "brick wall",
  ask_class_brick_wall_other: "brick walls",
  ask_class_surface_one: "surface",
  ask_class_surface_other: "surfaces",
  // F-ARCH's opening class — a door or a window is an opening of the wall it stands in (ARCH-2).
  ask_class_opening_one: "opening",
  ask_class_opening_other: "openings",

  /* ---------------------------------------------------------------- a (class, kind), in words */
  ask_kind_rcc_concrete: "{class} concrete",
  ask_kind_rcc_formwork: "{class} formwork",
  ask_kind_rcc_rebar: "{class} reinforcement",
  ask_kind_piling_bored: "bored {classes}",
  ask_kind_piling_boring: "{class} boring",
  ask_kind_earthwork_excavation: "excavation for {classes}",
  ask_kind_pcc_blinding: "blinding under {classes}",
  ask_kind_masonry_brickwork: "brickwork in {classes}",
  ask_kind_finish_plaster: "plaster on {classes}",
  ask_kind_finish_paint: "paint on {classes}",
  // ARCH-2's three finishes (I-541): the floor finish laid on a surface, tile fixed to a wall's face,
  // and the band run along a wall's foot.
  ask_kind_finish_flooring: "flooring on {classes}",
  ask_kind_finish_tiling: "tiling on {classes}",
  ask_kind_finish_skirting: "skirting along {classes}",

  /* ---------------------------------------------------------------- a kind across classes */
  ask_trade_rcc_concrete: "reinforced concrete (RCC)",
  ask_trade_rcc_formwork: "formwork",
  ask_trade_rcc_rebar: "reinforcement",
  ask_trade_piling_bored: "bored piles",
  ask_trade_piling_boring: "pile boring",
  ask_trade_earthwork_excavation: "excavation",
  ask_trade_pcc_blinding: "blinding (PCC)",
  ask_trade_masonry_brickwork: "brickwork",
  ask_trade_finish_plaster: "plaster",
  ask_trade_finish_paint: "paint",
  ask_trade_finish_flooring: "floor finish",
  ask_trade_finish_tiling: "wall tiling",
  ask_trade_finish_skirting: "skirting",

  /* ---------------------------------------------------------------- note kinds, in words */
  ask_note_kind_fc: "concrete strength",
  ask_note_kind_fy: "reinforcement yield strength",
  ask_note_kind_lap: "lap length",
  ask_note_kind_hook: "hook length",
  ask_note_kind_hook_min: "minimum hook length",

  /* ---------------------------------------------------------------- statements */
  ask_where_level: "on {level}",
  ask_where_foundation: "in the foundation",
  ask_marked: "marked {mark}",
  ask_lines_one: "1 complete line",
  ask_lines_other: "{lines} complete lines",

  ask_count: "{count} {class} {marked} {where}.",
  ask_count_none: "No {classes} {marked} {where} in the register.",
  ask_count_typical: "They are drawn once, on a typical plan that stands for {levels}.",
  ask_levels_range: "{first} to {last}",
  ask_count_struck_one: "Not counted: 1 {class} a person struck from the register.",
  ask_count_struck_other: "Not counted: {count} {classes} a person struck from the register.",

  ask_marks: "{classes} by mark: {count} in all.",

  ask_quantity: "{phrase} {where}: {figure} {unit}, from {lines}.",
  ask_quantity_none: "{phrase} {where}: no figure. Every line stands without one.",

  ask_so_far: "Measured so far: {trade}, {figure} {unit}, from {lines}.",
  ask_so_far_all: "Measured so far, by trade:",
  ask_so_far_not_total: "This is not a total for the building.",
  ask_so_far_without: "Without a figure: {groups}.",
  ask_so_far_absent: "No line in this campaign: {list}.",
  ask_group_count: "{phrase} ({count})",
  ask_so_far_apart: "Stated apart and not added: {phrase}, {figure} {unit}, from {lines}.",

  ask_why_one: "{subject} {where}: 1 line stands without a figure.",
  ask_why_other: "{subject} {where}: {count} lines stand without a figure.",
  ask_why_none: "{subject} {where}: every line has a figure, and every registered {class} has its lines.",

  ask_partial_lines_one: "1 more line stands without a figure:",
  ask_partial_lines_other: "{count} more lines stand without a figure:",
  ask_partial_objects_one: "1 more {class} is registered with no line:",
  ask_partial_objects_other: "{count} more {classes} are registered with no line:",
  ask_partial_row: "{count} · {message}",
  ask_partial_unrecorded: "no reason was recorded",

  ask_member_type: "The schedules state {mark} as:",
  ask_note: "The general notes state the {note}:",
  ask_note_disagree: "They state {count} different values, and none is chosen here.",
  ask_level_height: "{level}: {figure} {unit} floor to floor.",
  ask_level_height_suspended: "{level}: the drawings state {count} heights, so none stands.",
  ask_level_height_none: "{level}: no storey height is stated.",
  ask_schedule_sheet: "“{title}” is on {sheets}.",
  ask_find_one: "“{text}” appears once on the sheets:",
  ask_find_other: "“{text}” appears {count} times on the sheets:",
  ask_find_none: "“{text}” does not appear on the sheets of the pinned revision.",
  ask_sheets_one: "The pinned revision holds 1 sheet:",
  ask_sheets_other: "The pinned revision holds {count} sheets:",

  ask_basis_register: "From the register",
  ask_basis_schedules: "From the schedules on the sheets",
  ask_basis_notes: "From the general notes",
  ask_basis_levels: "From the level stack",
  ask_basis_text: "From the text on the sheets",
  ask_basis_sheets: "From the sheets of the pinned revision",

  ask_held_marks: "{classes} in the register: {list}",
  ask_held_levels: "Levels in the stack: {list}",
  ask_held_sheets: "Sheets in the set: {list}",
  ask_held_schedules: "Schedules on the sheets: {list}",
  ask_held_notes: "The general notes state: {list}",
  ask_held_marks_any: "Marks in the register: {list}",

  /* ---------------------------------------------------------------- breakdown and rows columns */
  ask_col_level: "Level",
  ask_col_class: "Class",
  ask_col_mark: "Mark",
  ask_col_count: "Count",
  ask_col_lines: "Lines",
  ask_col_kind: "Kind",
  ask_col_value: "Value",
  ask_col_source: "Source",
  ask_col_register: "Register",
  ask_col_sheet: "Sheet",
  ask_col_what: "What",
  ask_col_clause: "Clause",
  ask_col_schedule: "Schedule",
  ask_col_row: "Row",
  ask_col_column: "Column",
  ask_col_text: "Text",
  ask_col_title: "Title",
  ask_col_discipline: "Discipline",
  ask_value_unstated: "{variables} unstated",

  /* ---------------------------------------------------------------- clarify */
  ask_clarify_lead: "This could mean more than one thing. Choose the one you meant:",
  ask_clarify_two: "This asks two things. Choose one to answer first:",
  ask_reading_none: "None of these",
  ask_level_reading_floor: "{label} — level {n} counted above the ground floor",
  ask_level_reading_storey: "{label} — level {n} counted with the ground floor as level 1",

  /* ---------------------------------------------------------------- screen states */
  ask_empty_heading: "Ask the drawings",
  ask_empty_body:
    "Ask how many, how much, what the notes state or where something is drawn. Every figure in an answer links back to what it was read from on the drawings.",
  ask_example_count: "How many {classes} marked {mark} are on {level}?",
  ask_example_sheets: "Which sheets are in the set?",
  ask_empty_no_campaign_heading: "No campaign is open on this project",
  ask_empty_no_campaign_body: "Answers are read from the pinned revision's register and sheets. Pin a drawing set revision, and ask.",
  ask_empty_no_campaign_action: "Browse drawing sets",
  ask_error_heading: "The drawings could not be read",
  ask_error_body: "Nothing was changed. Try again, and quote the report id if it keeps happening.",
  ask_retry: "Try again",
  ask_failed_heading: "This question could not be answered",
  ask_failed_body: "Nothing was changed. Ask again, and quote the report id if it keeps happening.",
  ask_offline: "You are offline. The answers read as they stood, and no question can be asked until the connection returns.",
  ask_denied_permission: "Asking the drawings needs you to be a participant on this project.",
  ask_denied_holder: "A project principal can add you on the participants screen.",
  ask_denied_evidence: "Open the participants",

  /* ---------------------------------------------------------------- the refusals' evidence links */
  ask_evidence_register: "Open the register",
  ask_evidence_coverage: "Open the coverage",
  ask_evidence_boq: "Open the draft BOQ",
  ask_evidence_schedules: "Open the schedules",
} as const;
