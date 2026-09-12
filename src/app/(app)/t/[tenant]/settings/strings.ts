// The settings template's own copy (R-SPINE-060, the `membersStrings` precedent): the words the
// two-pane frame says — the section nav's areas, the name the nav is announced under, and the
// sentence an area that is not built yet carries instead of a silent dead row.
//
// The nav names areas, and an area's name is one word in one place (B-17): the three areas that
// ARE built read their own screen's heading back from the screens themselves where the import is
// free (`shell_nav_books` is the shell's, and the workspace's Books area is the shell's own), and
// the three that are not built yet are named here because nothing else in the tree names them.
export const settingsStrings = {
  settings_nav_label: "Settings sections",
  settings_nav_general: "General",
  settings_nav_ruleset: "Rule set",
  settings_nav_taxonomy: "Taxonomy",
  settings_nav_tax: "Tax",
  // An area with no screen behind it is shown, disabled, with the reason under the pointer and
  // under the keyboard: a row that vanished would teach a reader that the product has less in it
  // than it has planned, and a row that navigated nowhere would teach them that it is broken.
  settings_nav_unbuilt: "Not built yet.",

  settings_general_heading: "General",
  settings_general_about: "What this workspace is called, and how its tables are drawn for you.",
  settings_about_label: "About this screen",
  settings_density_heading: "Display",

  // The mirror (the `members_empty_reader` discipline): the sentence the R-UI-050 matrix says for
  // this screen's empty cell, committed here byte-identical to `state_empty_workspace_named` in
  // `src/ui/strings/screen-states.ts`. `src/ui` may never import a route table (ARCH-01), so the
  // matrix keeps its own spelling and the screen's own committed original lives where C-13 puts a
  // screen's copy — re-wording one without the other is the drift C-13 forbids.
  settings_empty_workspace_name: "A workspace always has a name, so this screen has nothing to be empty of.",
} as const;
