// The project's settings areas, as one ordered roster (sub-navigation I-259). An entry's
// availability is read off its `route`: a builder makes an `<a>`, `null` makes the disabled row that
// shows a promise the product has not kept — shown, never hidden.
//
// The order is what the nav renders, and it is what the areas mean: what the project reads, who
// reads it, what it is told, then what mints the next edition.
import { rulesetRoute } from "../home/areas";
import { participantsRoute } from "./participants/route-address";
import { rulesetAuthorRoute } from "./ruleset-author/route-address";
import { PROJECT_SETTINGS_PAGES, type ProjectSettingsArea } from "@/ui/shell/routes";

/** Where an area answers, or null while no screen of this tree answers for it. */
export type ProjectSettingsRoute = ((tenantId: string, projectId: string) => string) | null;

/** One row of the section nav: the area, the words it is read by, and where it stands — or nowhere. */
export interface ProjectSettingsAreaEntry {
  readonly area: ProjectSettingsArea;
  readonly label: string;
  readonly route: ProjectSettingsRoute;
}

export const PROJECT_SETTINGS_AREAS: readonly ProjectSettingsAreaEntry[] = Object.freeze([
  Object.freeze({ area: "ruleset", label: PROJECT_SETTINGS_PAGES.ruleset, route: rulesetRoute }),
  Object.freeze({ area: "participants", label: PROJECT_SETTINGS_PAGES.participants, route: participantsRoute }),
  // inc-304b gives this one its address; here it ships with none, and the nav says so rather than
  // leaving the reader to wonder whether the product has forgotten it (I-259).
  Object.freeze({ area: "site-facts", label: PROJECT_SETTINGS_PAGES["site-facts"], route: null }),
  Object.freeze({ area: "ruleset-author", label: PROJECT_SETTINGS_PAGES["ruleset-author"], route: rulesetAuthorRoute }),
] as const);
