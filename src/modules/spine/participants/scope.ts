// Who is asking, and of which workspace — the shape every door of this module takes first, as the
// act seam's `ActorCtx` does (SEAM-ACT). It is the same three facts, so a caller already holding an
// actor context may hand it straight over.
import type { ActorKind } from "../../../core/acts";

export interface ParticipantsCtx {
  readonly tenantId: string;
  readonly userId: string;
  readonly actorKind?: ActorKind;
}

/**
 * A person, as this module names one: the id the store holds them under, and the key `users.email`
 * carries them at. The key is the FOLD's, not an address — `src/server/auth/folded-key.ts` is the
 * one reader that turns it back into the address a person presented (B-17), and this layer neither
 * holds that reader nor spells a second one. A screen folds it; a suite comparing identities uses
 * the id.
 */
export interface MemberIdentity {
  readonly userId: string;
  readonly emailKey: string | null;
}
