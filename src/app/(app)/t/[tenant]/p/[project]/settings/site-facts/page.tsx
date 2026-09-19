// The project's Site facts screen (AM-06 §1, L-MEA-06): what the site says where the drawings are
// silent. The frame — the settings nav and the content pane — is the layout's, so this route renders
// its panel and no frame.
//
// R-SPINE-006: the screen renders for every reader who can see the project. Whether THIS reader may
// enter a fact is asked here, through the one guard (AM-11), and answered on the screen by a shut
// door beside a standing PERMISSION_NOT_HELD — never by hiding the screen.
import { authorize } from "@/server/authorize";
import { authorizePage } from "@/server/authorize-page";
import { siteFactsOf } from "@/modules/takeoff/site-facts-ui/server";
// The copy is taken from the table itself rather than through the module's barrel: the barrel is a
// client module (it publishes the panel), and a value imported from one into a server file is a
// client reference — a `metadata.title` built from one renders no <title> at all (AM-09: a document
// states what it is).
import { siteFactsStrings } from "@/modules/takeoff/site-facts-ui/strings";
import { SiteFactsScreen } from "./site-facts-screen";
import { participantsRoute } from "../participants/route-address";
import { rulesetRoute } from "../../home/areas";

export const metadata = { title: siteFactsStrings.site_facts_heading };

export default async function ProjectSiteFacts({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  const { tenantId, userId } = await authorizePage({ tenant, project });
  const [standing, door] = await Promise.all([
    siteFactsOf({ tenantId, projectId: project }),
    authorize({ userId, projectId: project, permission: "AUTHOR_PROJECT_FACT", actType: "AUTHOR_SITE_FACT" }),
  ]);

  return (
    <SiteFactsScreen
      tenantId={tenantId}
      projectId={project}
      standing={standing}
      mayAuthor={door.authorized}
      rulesetHref={rulesetRoute(tenantId, project)}
      participantsHref={participantsRoute(tenantId, project)}
    />
  );
}
