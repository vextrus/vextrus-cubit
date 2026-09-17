// Authoring a project's next rule-set edition (R-SPINE-012, AM-04), read straight through the
// module: the screen shows the edition the project reads today and forks it, so it asks the store
// and hands the answer down. The frame is `settings/layout.tsx`'s, so this page renders the section
// alone.
//
// The door is AM-11's one `authorizePage`: reading what a project is pinned to is a participant's
// daily work, so the read asks for participation. The PERMISSION the act needs — AUTHOR_RULE_SET —
// is checked where the act is carried out (`actions.ts`), because R-SPINE-006 shows the whole
// screen to a reader who cannot walk through the door and says why in place (I-266).
import { authorizePage } from "@/server/authorize-page";
import { projectRulesetView } from "@/core/rulesets/editions";
import { RulesetAuthorSection } from "./ruleset-author-section";
import { rulesetAuthorStrings } from "@/modules/spine/ruleset-authoring/strings";

export const metadata = { title: rulesetAuthorStrings.ruleset_author_heading };

export default async function ProjectRulesetAuthor({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  const { tenantId } = await authorizePage({ tenant, project, participation: true });
  return <RulesetAuthorSection tenantId={tenant} projectId={project} view={await projectRulesetView({ tenantId, projectId: project })} />;
}
