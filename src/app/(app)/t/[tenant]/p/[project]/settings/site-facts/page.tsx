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
import { siteFactsStrings } from "@/modules/takeoff/site-facts-ui";
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
