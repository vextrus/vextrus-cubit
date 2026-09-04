// Who a sheet may be served to. The layer feed is addressed by drawing rather than by workspace —
// a sheet is one drawing's — so the workspace that owns the drawing has to be established before any
// tenant handle can be opened, and the asking person's membership of it is what admits the request
// (R-SPINE-004, the shape every named-workspace door is guarded with).
import { drawings, eq, isUuid, runAsSystem } from "../../../core/db";

/** Why a system handle is opened: to learn which workspace an address belongs to, and nothing else. */
const OWNING_TENANT_REASON = "R-UI-040 viewer feed: the workspace a named drawing belongs to, before any tenant handle is opened";

/** The workspace this drawing belongs to, or null when no drawing stands under that id. */
export async function workspaceOfDrawing(drawingId: string): Promise<string | null> {
  if (!isUuid(drawingId)) return null;
  const owning = await runAsSystem(OWNING_TENANT_REASON).select({ tenantId: drawings.tenantId }).from(drawings).where(eq(drawings.drawingId, drawingId)).limit(1);
  return owning[0]?.tenantId ?? null;
}
