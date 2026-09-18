// The Author edition screen (R-SPINE-012, AM-04), read straight through the module: it shows what
// the project reads today and offers the act that mints the next edition. The frame — the settings
// nav and the content pane — is the layout's, so this route renders its section and no frame.
//
// R-SPINE-006: the screen renders for every reader who can see the project. Whether THIS reader may
// carry the act out is asked here, through the one guard (AM-11), and answered on the screen by the
// standing PERMISSION_NOT_HELD beside a shut door — never by hiding the screen (I-266).
import { authorizePage } from "@/server/authorize-page";
import { authorize } from "@/server/authorize";
import { projectRulesetView } from "@/core/rulesets/editions";
import { rulesetAuthorStrings } from "@/modules/spine/ruleset-authoring";
import { RulesetAuthorSection } from "./ruleset-author-section";
import { participantsRoute } from "../participants/route-address";
import { rulesetRoute } from "../../home/areas";
import { commitAuthorEdition, previewAuthorEdition } from "./actions";

export const metadata = { title: rulesetAuthorStrings.ruleset_author_heading };

export default async function ProjectRulesetAuthor({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  const { tenantId, userId } = await authorizePage({ tenant, project });
  const [view, door] = await Promise.all([
    projectRulesetView({ tenantId, projectId: project }),
    authorize({ userId, projectId: project, permission: "AUTHOR_RULE_SET", actType: "AUTHOR_RULESET_EDITION" }),
  ]);

  return (
    <RulesetAuthorSection
      projectId={project}
      parent={view.pinned ? { identity: view.identity, digest: view.digest, parameters: view.parameters } : null}
      rulesetHref={rulesetRoute(tenantId, project)}
      participantsHref={participantsRoute(tenantId, project)}
      mayAuthor={door.authorized}
      preview={previewAuthorEdition}
      commit={commitAuthorEdition}
    />
  );
}
