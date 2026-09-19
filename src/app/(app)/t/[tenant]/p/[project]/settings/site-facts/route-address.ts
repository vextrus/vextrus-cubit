// Where this screen answers, spelled once: the nav row, a deferral's evidence and the act's
// revalidation all name the same address rather than three string templates that can drift (B-17).
export function siteFactsRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/settings/site-facts`;
}
