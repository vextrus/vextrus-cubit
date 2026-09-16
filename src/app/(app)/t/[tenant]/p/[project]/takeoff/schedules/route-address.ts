// The schedules workspace's own address, spelled once (B-17): the address the takeoff lane's nav
// links, and the address this screen answers at (docs/design/s-schedules.md §7).
export function schedulesRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/takeoff/schedules`;
}
