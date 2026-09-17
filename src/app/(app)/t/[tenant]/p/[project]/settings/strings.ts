// R-SPINE-060: the project settings FRAME's own copy — the words the sub-navigation is read by, and
// nothing else. Every area's label that already has a home is imported from it rather than respelled
// (B-17); only the two areas this frame is the first to name are worded here.
export const projectSettingsStrings = {
  /** What the section nav is announced as — a project's settings, not the workspace's. */
  project_settings_nav_label: "Project settings",
  /** inc-304b gives this area an address; it is a promise the nav keeps visible until then. */
  project_settings_area_site_facts: "Site facts",
  project_settings_area_ruleset_author: "Author edition",
} as const;
