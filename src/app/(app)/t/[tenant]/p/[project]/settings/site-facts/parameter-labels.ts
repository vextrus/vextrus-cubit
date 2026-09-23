// What the Site facts panel calls the four facts the pinned edition may state (the site-facts
// Decision's I-438): each is an edition PARAMETER, and a parameter has one name in the settings
// area — `parameterLabel`, s-settings-ruleset-author I-268 — so the panel's row reads exactly what the
// Rule set screen one nav row away reads. "Working allowance" and "Earthwork working allowance" on
// neighbouring screens were two spellings of one fact (B-17).
//
// It is built HERE, on the server, and handed down as data. The pairing of fact and parameter has one
// home, the rail's `EDITION_PARAMETER_OF`, and that module reaches the store's schema through the
// offer contract — a value import of it into the client screen would carry the rail into the browser,
// which the panel's own type-only import of the edition map exists to prevent. ARCH-01 bars the panel
// (src/modules) from `parameterLabel` (src/app), so the one file that may reach both builds the words.
import { EDITION_PARAMETER_OF, type DerivableSiteFact } from "@/modules/takeoff/rails/foundations/read";
import type { SiteFactParameterLabels } from "@/modules/takeoff/site-facts-ui/strings";
import { parameterLabel } from "../strings";

/**
 * The settings area's words for each parameter a site fact stands in for, keyed by the fact. Read off
 * the rail's pairing itself, so a fact the rail learns to take from the edition is named here the day
 * it does, by the words the Rule set screen already shows for its parameter (B-19).
 */
export function siteFactParameterLabels(): SiteFactParameterLabels {
  const labels: Partial<Record<DerivableSiteFact, string>> = {};
  for (const [fact, key] of Object.entries(EDITION_PARAMETER_OF) as [DerivableSiteFact, string][]) labels[fact] = parameterLabel(key);
  return Object.freeze(labels as Record<DerivableSiteFact, string>);
}
