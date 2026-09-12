// Who a sheet may be served to. The layer feed is addressed by drawing rather than by workspace —
// a sheet is one drawing's — so the address the drawing really stands at has to be established
// before any tenant handle is opened, and the guard is then asked about that address rather than
// about one the caller wrote (R-SPINE-004, the shape every named-workspace door is guarded with).
//
// The PROJECT travels beside the workspace because the workspace alone cannot carry the named
// permission: `authorize()` reads what a person holds ON A PROJECT (L-ACT-03), and a feed that knew
// only the tenant could ask nothing but membership — which is how this door admitted every member
// of a workspace to every sheet in it, whatever they held on the project the sheet belongs to.
import { drawings, eq, isUuid, runAsSystem } from "@/core/db";

/** Why a system handle is opened: to learn which address a drawing belongs to, and nothing else. */
const OWNING_TENANT_REASON = "R-UI-040 viewer feed: the workspace and project a named drawing belongs to, before any tenant handle is opened";

/** Where a drawing really stands: one workspace, one project of it. */
export type DrawingAddress = { readonly tenantId: string; readonly projectId: string };

/** The address this drawing stands at, or null when no drawing stands under that id. */
export async function drawingAddress(drawingId: string): Promise<DrawingAddress | null> {
  if (!isUuid(drawingId)) return null;
  const owning = await runAsSystem(OWNING_TENANT_REASON)
    .select({ tenantId: drawings.tenantId, projectId: drawings.projectId })
    .from(drawings)
    .where(eq(drawings.drawingId, drawingId))
    .limit(1);
  const held = owning[0];
  return held === undefined ? null : { tenantId: held.tenantId, projectId: held.projectId };
}
