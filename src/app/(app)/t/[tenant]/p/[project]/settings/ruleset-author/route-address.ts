// This screen's own address, spelled once (B-17): the row the settings nav links, the path the
// commit revalidates, and the route the Design Decision names.
export function rulesetAuthorRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/settings/ruleset-author`;
}
