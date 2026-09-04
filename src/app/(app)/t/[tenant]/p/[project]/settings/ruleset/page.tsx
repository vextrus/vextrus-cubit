// The project's rule-set settings (R-SPINE-012), read straight through the module: the screen shows
// what a project pinned, so it asks the store and renders the answer. The two address segments are
// passed on as they arrive — the view answers the no-pin shape for anything that names no pin, a
// segment that is not a uuid included, so a mistyped address is an honest absence and never a fault
// (I-28).
import { projectRulesetView } from "../../../../../../../../core/rulesets/editions";
import { RulesetSettingsSection } from "./ruleset-settings-section";
import { rulesetStrings } from "./strings";

export const metadata = { title: rulesetStrings.ruleset_heading };

export default async function ProjectRulesetSettings({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  return <RulesetSettingsSection view={await projectRulesetView({ tenantId: tenant, projectId: project })} />;
}
