// The project's Site facts screen (AM-06 §1, L-MEA-06): what the site says where the drawings are
// silent. The frame — the settings nav and the content pane — is the layout's, so this route renders
// its panel and no frame.
//
// R-SPINE-006: the screen renders for every reader who can see the project. Whether THIS reader may
// enter a fact is asked here, through the one guard (AM-11), and answered on the screen by a shut
// door beside a standing PERMISSION_NOT_HELD — never by hiding the screen.
import { authorize } from "@/server/authorize";
import { authorizePage } from "@/server/authorize-page";
import { editionStatedFactsOf, siteFactActorsOf, siteFactsOf } from "@/modules/takeoff/site-facts-ui/server";
// The copy is taken from the table itself rather than through the module's barrel: the barrel is a
// client module (it publishes the panel), and a value imported from one into a server file is a
// client reference — a `metadata.title` built from one renders no <title> at all (AM-09: a document
// states what it is).
import { siteFactsStrings } from "@/modules/takeoff/site-facts-ui/strings";
import { siteFactParameterLabels } from "./parameter-labels";
import { SiteFactsScreen } from "./site-facts-screen";
import { participantsRoute } from "../participants/route-address";
import { rulesetRoute } from "../../home/areas";
import { peopleOf, rosterOf } from "../../roster";
import { siteFactEntrants } from "./entrants";

export const metadata = { title: siteFactsStrings.site_facts_heading };

export default async function ProjectSiteFacts({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  const { tenantId, userId } = await authorizePage({ tenant, project });
  // The pin is read beside the ledger: a fact the pinned edition states is what the earthwork rail
  // reads where nobody entered it, so the panel shows that figure rather than a deferral the rail
  // never makes (L-MEA-06, the Decision's I-327).
  const [standing, editionStated, door] = await Promise.all([
    siteFactsOf({ tenantId, projectId: project }),
    editionStatedFactsOf({ tenantId, projectId: project }),
    authorize({ userId, projectId: project, permission: "AUTHOR_PROJECT_FACT", actType: "AUTHOR_SITE_FACT" }),
  ]);
  // I-527: "Entered by" is a person. Who performed each entry's act is the act log's; what that
  // person is CALLED is the project roster's, read once through the participants module's own guarded
  // door (the S-Audit, S-Project and Documents read, B-17). A roster that refuses this reader names
  // nobody, and each cell then shows the recorded act's chip; nothing else on the screen is withheld.
  const [actors, roster] = await Promise.all([
    siteFactActorsOf({ tenantId, projectId: project }, standing),
    rosterOf({ tenantId, userId, actorKind: "human" }, project),
  ]);

  return (
    <SiteFactsScreen
      tenantId={tenantId}
      projectId={project}
      standing={standing}
      editionStated={editionStated}
      // A fact the edition may state is named as the Rule set screen names its parameter (I-438):
      // built here, beside the read of the pin, because the pairing's home is the rail.
      parameterLabels={siteFactParameterLabels()}
      mayAuthor={door.authorized}
      enteredBy={siteFactEntrants(actors, peopleOf(roster), userId)}
      rulesetHref={rulesetRoute(tenantId, project)}
      participantsHref={participantsRoute(tenantId, project)}
    />
  );
}
