// The register workspace's own address, spelled once (B-17): the address the takeoff lane's nav
// links, the address `takeoff/page.tsx` redirects to, and the address a reader lands on when the
// project home's Takeoff tab is followed (docs/design/s-takeoff.md § 7).
//
// The Trace stamps and links this same address with an origin row on it (`?line=`), so the spelling
// now has one home for both: `originAddress(tenantId, projectId, null)` is this path (I-180, B-17).
import { originAddress } from "@/modules/takeoff/trace";

export function registerRoute(tenantId: string, projectId: string): string {
  return originAddress(tenantId, projectId, null);
}
