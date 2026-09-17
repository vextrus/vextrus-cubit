// S-Documents' own address, spelled once (B-17, R-UI-031): the quick action on S-Project links it,
// the retry re-requests it, and the journey's page object addresses it — all from here, so the day
// the address moves nothing is left pointing at the old one.
export function documentsRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/documents`;
}
