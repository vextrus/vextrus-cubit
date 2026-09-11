// The project's rule-set settings (R-SPINE-012), read straight through the module: the screen shows
// what a project pinned, so it asks the store and renders the answer. The two address segments are
// passed on as they arrive — the view answers the no-pin shape for anything that names no pin, a
// segment that is not a uuid included, so a mistyped address is an honest absence and never a fault
// (I-28).
import { authorizePage } from "@/server/authorize-page";
import { projectRulesetView } from "@/core/rulesets/editions";
import { RulesetSettingsSection } from "./ruleset-settings-section";
import { rulesetStrings } from "./strings";

export const metadata = { title: rulesetStrings.ruleset_heading };

export default async function ProjectRulesetSettings({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  // The emptiest door of the six: it read a workspace's ruleset with a tenant taken from the URL and
  // no session at all. The scope the read runs under is the guard's answer now, never the segment.
  const { tenantId } = await authorizePage({ tenant, project });
  return <RulesetSettingsSection view={await projectRulesetView({ tenantId, projectId: project })} />;
}
