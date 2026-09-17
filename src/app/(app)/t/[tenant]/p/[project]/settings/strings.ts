// The project settings frame's own copy: the words that name the nav and the two areas whose
// labels have no other home in the tree. The Rule set and Participants rows read their words from
// the screens that already carry them, so they are not repeated here (B-17).
export const projectSettingsStrings = {
  project_settings_nav_label: "Project settings",
  project_settings_area_site_facts: "Site facts",
  project_settings_area_ruleset_author: "Author edition",
} as const;

/** One key of this frame's copy. */
export type ProjectSettingsStringKey = keyof typeof projectSettingsStrings;
