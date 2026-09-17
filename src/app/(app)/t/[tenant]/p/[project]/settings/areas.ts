// What a project's settings hold, and where each of it stands. The roster is stated once here and
// the layout above it renders whatever it declares: an area's availability is READ off its `route`,
// never written beside it, so the day an area's screen lands the row becomes a link by gaining an
// address and nothing else moves (B-17, R-UI-031 — the law `home/areas.ts` already carries).
//
// An address that already has a home is imported from it rather than respelled, and so is every
// label: the words that name the Rule set area are the workspace settings nav's own words, and the
// words that name Participants are the participants screen's heading (B-17).
import { strings } from "@/ui/strings";
import { settingsStrings } from "@/app/(app)/t/[tenant]/settings/strings";
import { rulesetRoute } from "../home/areas";
import { participantsRoute } from "./participants/route-address";
import { rulesetAuthorRoute } from "./ruleset-author/route-address";
import { projectSettingsStrings } from "./strings";

/** One settings area of a project: the key it is addressed by, its words, and where it stands. */
export interface ProjectSettingsArea {
  readonly key: string;
  readonly label: string;
  /** The address the area answers at, or null while no screen of this tree answers for it. */
  readonly route: ((tenantId: string, projectId: string) => string) | null;
}

/**
 * The four areas, in the order a reader meets them: what the project measures by, who is on it,
 * what the site itself says, and the door that mints the next rule-set edition.
 *
 * `site-facts` carries no address: the screen is not built, and a promise the product keeps visible
 * is shown disabled with its reason rather than hidden (R-SPINE-006). inc-304b gives it one and
 * changes nothing else here.
 */
export const PROJECT_SETTINGS_AREAS: readonly ProjectSettingsArea[] = Object.freeze([
  { key: "ruleset", label: settingsStrings.settings_nav_ruleset, route: rulesetRoute },
  { key: "participants", label: strings.spine_participants_heading, route: participantsRoute },
  { key: "site-facts", label: projectSettingsStrings.project_settings_area_site_facts, route: null },
  { key: "ruleset-author", label: projectSettingsStrings.project_settings_area_ruleset_author, route: rulesetAuthorRoute },
]);
