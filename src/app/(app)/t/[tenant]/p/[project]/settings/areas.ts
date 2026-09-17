// What a project's settings hold, and where each of it stands. The roster below is the ONE place
// that is stated: an area's availability is READ off its `route` and never written beside it, so the
// day an area's screen lands the row becomes a link by gaining an address and nothing else changes
// (the home/areas.ts law, B-17, R-UI-031).
//
// `site-facts` ships with `route: null`: L-MEA-06's site facts are a screen this tree does not have
// yet, and an area a reader cannot see is an area they cannot plan around — it is shown disabled
// with its reason, never hidden (R-SPINE-006). inc-304b makes it live by giving it an address and
// changes nothing else here.
//
// An address that already has a home is imported from it rather than respelled, and so is a label:
// the rule-set row reads the workspace settings table's own `settings_nav_ruleset`, and the
// participants row the shell's own heading.
import { settingsStrings } from "@/app/(app)/t/[tenant]/settings/strings";
import { strings } from "@/ui/strings";
import { rulesetRoute } from "../home/areas";
import { participantsRoute } from "./participants/route-address";
import { rulesetAuthorRoute } from "./ruleset-author/route-address";
import { projectSettingsStrings } from "./strings";

/** One area of a project's settings: the key it is read by, its words, and where it leads — or nowhere. */
export interface ProjectSettingsArea {
  /** The key the nav row publishes as `data-area`, and the roster is addressed by. */
  readonly key: string;
  readonly label: string;
  /** Where it leads, or `null` for an area this tree has no screen for yet. */
  readonly route: ((tenantId: string, projectId: string) => string) | null;
}

/** The project's settings areas, in the order the nav renders them. */
export const PROJECT_SETTINGS_AREAS: readonly ProjectSettingsArea[] = Object.freeze([
  { key: "ruleset", label: settingsStrings.settings_nav_ruleset, route: rulesetRoute },
  { key: "participants", label: strings.spine_participants_heading, route: participantsRoute },
  { key: "site-facts", label: projectSettingsStrings.project_settings_area_site_facts, route: null },
  { key: "ruleset-author", label: projectSettingsStrings.project_settings_area_ruleset_author, route: rulesetAuthorRoute },
]);
