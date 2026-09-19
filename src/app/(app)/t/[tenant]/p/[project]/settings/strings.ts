// The project settings frame's copy, and all of it (sub-navigation § 3): the layout carries no
// string literal of its own beyond test ids and fixed attribute values. The keys read
// `project_settings_…` (s-settings-ruleset I-24).
//
// The four area labels ARE the crumb page names, so they are read from `routes.ts` — R-UI-084's one
// home for a screen's crumbs — rather than spelled a second time here (B-17).
import { PROJECT_SETTINGS_PAGES } from "@/ui/shell/routes";
import { rulesetParameterLabel } from "./ruleset/strings";

export const projectSettingsStrings = {
  project_settings_nav_label: "Project settings",
  project_settings_area_ruleset: PROJECT_SETTINGS_PAGES.ruleset,
  project_settings_area_participants: PROJECT_SETTINGS_PAGES.participants,
  project_settings_area_site_facts: PROJECT_SETTINGS_PAGES["site-facts"],
  project_settings_area_ruleset_author: PROJECT_SETTINGS_PAGES["ruleset-author"],
  // The words a row with no address wears. Every area of this roster is a place today — the site
  // facts panel was the last promise and it is kept — so the hint stands for the NEXT area the
  // roster names before its screen lands, and says what is true of the product rather than when a
  // session will ship it (§ 3). Nouns on nav rows, never verbs.
  project_settings_unbuilt: "This settings area is not open yet. It is listed so that what the project can be told is never a secret.",
};

/**
 * The words that name a parameter, for every screen of this settings area (I-268). Both the rule-set
 * screen and the Author edition screen call this, so one parameter is named one way; an unknown key
 * falls back to the key itself, because a parameter with no wording is still shown.
 *
 * Owed: the rule-set screen's own `ruleset_param_*` table is folded into this one home by the node
 * that owns its `strings.ts`. Until then that table is the source this function reads, byte-identical
 * — one table, one reading, no second spelling (B-17).
 */
export function parameterLabel(key: string): string {
  return rulesetParameterLabel(key);
}
