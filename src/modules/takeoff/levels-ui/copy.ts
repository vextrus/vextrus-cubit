// The sentences S-Levels says, mirrored from their home in the registry (docs/design/s-levels.md §3).
//
// `src/modules` imports core and its own module only (ARCH-01), and the string registry is
// `src/ui/strings` — so a workspace that lives in this module cannot read its copy from the table
// that owns it. The tree's answer to that boundary is a mirror pinned by a test rather than an
// improvisation at the render site, exactly as `src/modules/takeoff/register-ui/copy.ts` and
// `src/modules/takeoff/viewer-partition-overlay/copy.ts` already mirror theirs (B-17, C-13).
//
// Every value below is `src/ui/strings/levels.ts` verbatim. The cure — a copy home both layers may
// read — is recorded with its owner in docs/design/s-levels.md §8, never as a promise in this tree.

/** The keys of the registry this workspace renders. */
export type LevelsCopyKey = keyof typeof LEVELS_COPY;

export const LEVELS_COPY = Object.freeze({
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
  levels_denied_evidence: "Open the participants screen",
});

/**
 * A mirrored string with its named slots filled, the registry's own substitution rule: a slot the
 * caller has no value for is left standing as itself rather than becoming the word "undefined" on a
 * screen (R-SPINE-060, mirrored here for the same reason the table above is).
 */
export function fillCopy(key: LevelsCopyKey, values: Readonly<Record<string, string>>): string {
  return LEVELS_COPY[key].replace(/\{(\w+)\}/gu, (slot, name: string) => values[name] ?? slot);
}
