// R-SPINE-060: S-Levels' sentences, in the one table this screen reads every string from
// (docs/design/s-levels.md §3, verbatim).
//
// The lane's third tab is named here rather than in the takeoff table beside `takeoff_nav_register`:
// the entry belongs to the surface it opens, which is the precedent the coverage tab already set
// (s-coverage I-197). `src/modules/takeoff/levels-ui/copy.ts` mirrors this table word for word,
// because ARCH-01 bars a module from reading `src/ui` and B-17 bars a second spelling of a sentence.
export const levels = {
  takeoff_nav_levels: "Levels",
  levels_grid_label: "Level stack",
  levels_col_level: "Level",
  levels_col_ordinal: "Ordinal",
  levels_col_standing: "Storey height",
  levels_rollup_lines: "{count} lines",
  levels_insert: "Insert a level",
  levels_insert_label_field: "Label",
  levels_insert_ordinal_field: "Ordinal",
  levels_insert_hint: "The new level takes this ordinal. Every live level at or above it moves up one, and nothing is re-keyed.",
  levels_insert_confirm: "Preview this insert",
  levels_empty_heading: "No level stands on this project",
  levels_empty_body:
    "A level carries the storey height every vertical quantity is measured through. Insert the lowest one, and the rest stack above it.",
  levels_readings_heading: "Height readings",
  levels_reading_basis_label: "Basis",
  levels_reading_source_label: "Read from",
  levels_reading_written_label: "As written",
  levels_reading_metres_label: "Metres",
  levels_reading_superseded: "Superseded by a later reading under the same source.",
  levels_no_readings: "No height has been read for this level. Every quantity measured through it is published as partial until one is.",
  levels_suspended_note:
    "These readings disagree, so this level has no standing height. Read the figure again to settle it — precedence never clears a suspension.",
  levels_height_value_label: "Height",
  levels_height_unit_label: "Unit",
  levels_height_basis_label: "Basis",
  levels_height_source_label: "Source key",
  levels_height_source_hint:
    "The evidence this figure was read from. A later reading under the same source and basis supersedes the earlier one.",
  levels_author_height: "Preview this height",
  levels_repudiate: "Repudiate this level",
  levels_repudiated_note:
    "A person judged this level to be nothing. Nothing was deleted: every reading stays on record, and the lines measured through it re-derive at the next campaign.",
  levels_ranges_heading: "Views with no typical range",
  levels_ranges_hint: "A view that stands for a range of floors states it once. Until it does, nothing it holds expands.",
  levels_ranges_none: "Every view states the floors it stands for.",
  levels_range_from_label: "From ordinal",
  levels_range_to_label: "To ordinal",
  levels_author_range: "Preview this range",
  levels_error_heading: "The level stack could not be read",
  levels_error_body: "Nothing was changed. Try again, and quote the report id if it keeps happening.",
  levels_report_label: "Report id",
  levels_retry: "Try again",
  levels_offline:
    "You are offline. The stack reads as it stood when this page loaded, and nothing can be committed until the connection returns.",
  levels_denied_stack: "Inserting and repudiating a level need the AUTHOR_LEVEL_STACK permission on this project.",
  levels_denied_height: "Recording a storey height needs the AUTHOR_PROJECT_FACT permission on this project.",
  levels_denied_range: "Stating a view's typical range needs the MEASURE permission on this project.",
  levels_denied_holder: "A project principal can grant it on the participants screen.",
  // The denial's evidence link: R-UI-020 gives every refusal a place it is resolved, and the
  // RefusalState takes that place's name — the §3 pair states WHAT is denied and WHO grants it, and
  // neither of those two sentences is the name of a destination (I-247).
  levels_denied_evidence: "Open the participants screen",
} as const;
