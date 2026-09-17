// The bar schedule's own address, spelled once (B-17): the address the takeoff lane's nav links, and
// the address this screen answers at (docs/design/s-bbs.md §6).
export function bbsRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/takeoff/bbs`;
}
