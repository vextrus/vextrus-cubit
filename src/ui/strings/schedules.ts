// R-SPINE-060: S-Schedules' sentences, in the one table this screen reads every string from
// (docs/design/s-schedules.md §3, verbatim).
//
// The lane's fourth tab is named here rather than in the takeoff table beside `takeoff_nav_register`:
// the entry belongs to the surface it opens, which is the precedent the coverage and levels tabs
// already set. `src/modules/takeoff/schedules-ui/copy.ts` mirrors this table word for word, because
// ARCH-01 bars a module from reading `src/ui` and B-17 bars a second spelling of a sentence.
export const schedules = {
  takeoff_nav_schedules: "Schedules",
  schedules_sheets_heading: "Sheets",
  schedules_sheet_holds_schedule: "Schedule",
  schedules_sheet_holds_notes: "Notes",
  schedules_sheet_holds_deferral: "Deferred",
  schedules_tables_heading: "Reconstructed schedules",
  schedules_table_rows: "{count} rows",
  schedules_registry_heading: "Member types",
  schedules_registry_mark: "Mark",
  schedules_registry_band: "Band",
  schedules_registry_section: "Section",
  schedules_registry_zone: "Zone",
  schedules_registry_none: "No mark family was named by this sheet's schedules.",
  schedules_notes_heading: "General notes",
  schedules_standing_heading: "Applied values",
  schedules_readings_heading: "Readings on this sheet",
  schedules_proposals_heading: "Read from this sheet",
  schedules_proposal_written_label: "As written",
  schedules_proposal_value_label: "Value",
  schedules_proposal_already_read: "Already read at this figure.",
  schedules_transcribe: "Preview these readings",
  schedules_reading_accepted: "Accepted as proposed",
  schedules_reading_edited: "Edited",
  schedules_reading_superseded: "Superseded by a later reading under the same source.",
  schedules_inspector_cell_heading: "Schedule cell",
  schedules_inspector_reading_heading: "Note reading",
  schedules_inspector_sources_label: "Read from",
  schedules_empty_heading: "No drawing has been read yet",
  schedules_empty_body:
    "A schedule and its general notes are reconstructed from a sheet's own text once its drawing is partitioned. Add a structural drawing, and its sheets appear here.",
  schedules_empty_action: "Go to drawings",
  schedules_error_heading: "The schedules could not be read",
  schedules_error_body: "Nothing was changed. Try again, and quote the report id if it keeps happening.",
  schedules_report_label: "Report id",
  schedules_retry: "Try again",
  schedules_offline: "You are offline. The sheets read as they stood when this page loaded, and nothing can be committed until the connection returns.",
  schedules_denied_transcribe: "Recording a note reading needs the MEASURE permission on this project.",
  schedules_denied_holder: "A project principal can grant it on the participants screen.",
} as const;
