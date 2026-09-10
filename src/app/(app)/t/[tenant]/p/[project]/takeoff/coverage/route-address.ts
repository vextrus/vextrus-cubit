// The coverage grid's own address, spelled once (B-17): the address the takeoff lane's nav links,
// and the address a cell widens by naming itself (docs/design/s-coverage.md § 7).
//
// The parameter's name is the screen's own, read from the module that answers at this address rather
// than spelled a second time here — one name, one home.
import { CELL_PARAM } from "@/modules/takeoff/coverage";

export function coverageRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/takeoff/coverage`;
}

/** The same address widened by the cell a reader stands on — `{kind}:{class}:{levelId}` (I-193). */
export function coverageCellRoute(tenantId: string, projectId: string, address: string): string {
  return `${coverageRoute(tenantId, projectId)}?${CELL_PARAM}=${encodeURIComponent(address)}`;
}
