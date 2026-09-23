// Who entered each site fact, as the Site facts screen names them (s-settings-site-facts I-527): the
// act log's actor for each standing entry, labelled by the project roster's names. One pure step
// between the two reads the page makes and the panel it hands the answer to, so the rule has one
// home and a suite can judge it without a database (B-17).
import type { SiteFactEntrants } from "@/modules/takeoff/site-facts-ui";
import type { SiteFactActors } from "@/modules/takeoff/site-facts-ui/server";
import type { ProjectPeople } from "../../roster";

/**
 * The names the panel shows: for each act the roster can name the performer of, that person's label;
 * and the reader's own label, which names an act the panel carries before a read catches up with it
 * (the reader performed it). An actor the roster does not name — a refused roster, an account with no
 * address, someone who has left — is left out, and the panel shows that act's chip instead of a guess.
 */
export function siteFactEntrants(actors: SiteFactActors, people: ProjectPeople, readerId: string): SiteFactEntrants {
  const byAct: Record<string, string> = {};
  for (const [actId, actorId] of Object.entries(actors)) {
    const label = people[actorId];
    if (label !== undefined) byAct[actId] = label;
  }
  return { byAct: Object.freeze(byAct), reader: people[readerId] ?? null };
}
