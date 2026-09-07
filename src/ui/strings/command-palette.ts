// The command palette's chrome copy (R-SPINE-060, docs/design/command-palette.md § 3). Item and
// group labels arrive in props — a hit's words are the workspace's own data — so what is registered
// here is only what the surface says in its own voice.
export const commandPalette = {
  command_palette_trigger: "Search",
  command_palette_trigger_tooltip: "Search and commands — {keys}",
  command_palette_label: "Search and commands",
  command_palette_input_label: "Search this workspace",
  command_palette_placeholder: "Search projects, drawings, sheets and sets",
  command_palette_list_label: "Results",
  command_palette_group_recent: "Recent",
  command_palette_group_navigate: "Go to",
  command_palette_group_areas: "Project areas",
  command_palette_group_actions: "Actions",
  command_palette_group_shortcuts: "Shortcuts",
  command_palette_empty: "Nothing in this workspace matches what you typed.",
  command_palette_empty_action: "Clear the search",
  command_palette_status_searching: "Searching…",
  command_palette_status_none: "No matches",
  command_palette_status_one: "1 match",
  command_palette_status_many: "{count} matches",
  command_palette_footer_shortcuts: "Keyboard shortcuts",
  command_palette_error: "The search did not complete.",
  command_palette_error_report: "Report id {id}",
  command_palette_error_retry: "Try the search again",
  command_palette_offline: "You are offline. Recent items, areas and shortcuts still work; search needs a connection.",
  command_palette_action_affirm_scale: "Affirm scale…",
  command_palette_action_export_boq: "Export BOQ…",
  command_palette_unavailable: "This is not available in this workspace yet.",
  command_palette_reason_no_project: "Open a project first — areas belong to a project.",
  command_palette_reason_scope_viewer: "This key works in the viewer.",
  command_palette_reason_scope_table: "This key works in a table.",
  command_palette_reason_already_open: "This is the palette you are in.",
} as const;

// R-SPINE-060's per-module convention is that a table file's DESIGNATED export is the one named for
// its basename, and this file's basename is not an identifier. The table is therefore published
// under both names: the identifier `index.ts` aggregates it by, and the basename the convention
// designates. One table, two names for it — never two tables.
export { commandPalette as "command-palette" };
