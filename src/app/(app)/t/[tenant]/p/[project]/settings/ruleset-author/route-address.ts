/** S-Settings-Ruleset-Author's address, spelled once (B-17): the door the settings nav opens. */
export function rulesetAuthorRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/settings/ruleset-author`;
}
