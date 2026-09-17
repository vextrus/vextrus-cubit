// The Author edition screen (R-SPINE-012, AM-04): the door reads the edition the project holds and
// hands it to the section. The frame is the layout's (settings/layout.tsx), so nothing here draws a
// nav; the two address segments are passed on as they arrive — the view answers the no-pin shape for
// anything that names no pin, a segment that is not a uuid included (I-28).
//
// AM-11: the read goes through the ONE `authorizePage`, which resolves the workspace and the
// participation this screen's read asks for. The PERMISSION the ACT moves is the action's door to
// name, not the page's: R-SPINE-006 shows the screen to every participant and disarms the door
// rather than hiding what a project is measured by (I-266).
import { authorizePage } from "@/server/authorize-page";
import { projectRulesetView } from "@/core/rulesets/editions";
import { rulesetAuthorStrings } from "./strings";
import { RulesetAuthorSection } from "./ruleset-author-section";

export const metadata = { title: rulesetAuthorStrings.ruleset_author_heading };

export default async function ProjectRulesetAuthor({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  const { tenantId } = await authorizePage({ tenant, project, participation: true });
  return <RulesetAuthorSection tenantId={tenantId} projectId={project} view={await projectRulesetView({ tenantId, projectId: project })} />;
}
