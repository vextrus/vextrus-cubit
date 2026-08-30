// Who is asking, and of which workspace — the shape every door of this module takes first, as the
// act seam's `ActorCtx` does (SEAM-ACT). It is the same three facts, so a caller already holding an
// actor context may hand it straight over.
import type { ActorKind } from "../../../core/acts";

export interface ProjectsCtx {
  readonly tenantId: string;
  readonly userId: string;
  readonly actorKind?: ActorKind;
}
