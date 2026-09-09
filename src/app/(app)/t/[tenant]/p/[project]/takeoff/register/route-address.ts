// The register workspace's own address, spelled once (B-17): the address the takeoff lane's nav
// links, the address `takeoff/page.tsx` redirects to, and the address a reader lands on when the
// project home's Takeoff tab is followed (docs/design/s-takeoff.md § 7).
export function registerRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/takeoff/register`;
}
