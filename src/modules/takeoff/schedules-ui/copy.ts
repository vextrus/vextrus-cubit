// The sentences S-Schedules says, mirrored from their home in the registry (docs/design/s-schedules.md §3).
//
// `src/modules` imports core and its own module only (ARCH-01), and the string registry is
// `src/ui/strings` — so a workspace that lives in this module cannot read its copy from the table
// that owns it. The tree's answer to that boundary is a mirror pinned by a test rather than an
// improvisation at the render site, exactly as `src/modules/takeoff/levels-ui/copy.ts` and
// `src/modules/takeoff/register-ui/copy.ts` already mirror theirs (B-17, C-13).
//
// Every value below is `src/ui/strings/schedules.ts` verbatim. The cure — a copy home both layers may
// read — is recorded with its owner in docs/design/s-schedules.md §8, never as a promise in this tree.

/** The keys of the registry this workspace renders. */
export type SchedulesCopyKey = keyof typeof SCHEDULES_COPY;

export const SCHEDULES_COPY = Object.freeze({
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
} as const);

/**
 * A mirrored string with its named slots filled, the registry's own substitution rule: a slot the
 * caller has no value for is left standing as itself rather than becoming the word "undefined" on a
 * screen (R-SPINE-060, mirrored here for the same reason the table above is).
 */
export function fillCopy(key: SchedulesCopyKey, values: Readonly<Record<string, string>>): string {
  return SCHEDULES_COPY[key].replace(/\{(\w+)\}/gu, (slot, name: string) => values[name] ?? slot);
}
