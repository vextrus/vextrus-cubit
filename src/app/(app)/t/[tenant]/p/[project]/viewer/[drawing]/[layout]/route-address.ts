// S-Viewer's own address, spelled once (B-17): the path the sheet index's door points at, and the
// path this route answers. A layout name is a sheet's own words — `FOUNDATION PLAN` carries a space
// — so it is escaped as one path segment here rather than at each call site (R-UI-031).
export function viewerSheetRoute(tenantId: string, projectId: string, drawingId: string, layoutName: string): string {
  return `/t/${tenantId}/p/${projectId}/viewer/${drawingId}/${encodeURIComponent(layoutName)}`;
}
