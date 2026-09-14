// The level stack editor's own address, spelled once (B-17): the address the takeoff lane's nav
// links, and the address this screen answers at (docs/design/s-levels.md §7).
export function levelsRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/takeoff/levels`;
}
