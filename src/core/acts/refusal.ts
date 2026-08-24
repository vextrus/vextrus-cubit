/**
 * The one thing the act seam throws (SEAM-ACT, L-ACT-02, L-ACT-03).
 *
 * A refusal is a value a caller can branch on, not a message it has to read: the class is what
 * says "the seam declined", and `code` is which of the three declinings it was. A plain `Error`
 * whose text happened to contain the code would tell a caller nothing it could act on, and the
 * tRPC layer above turns `code` straight into the transport error's message (the spine.ts
 * convention), so the field is the wire format too.
 *
 * The codes themselves are never spelled here. They are read off the closed taxonomy in
 * `src/core/errors`, which is the only place in `src/` they may be written down (Q-07), and the
 * message a refusal carries is the registered one — so the sentence a human meets is the one
 * R-SPINE-062 filed, not a second copy of it drifting beside the first.
 */
import { REFUSALS } from '../errors';
import type { RefusalCode } from '../errors';
import type { ActType, Permission } from './vocabulary';

/**
 * What a refusal knows beyond its code. L-ACT-03: "`PERMISSION_NOT_HELD` carries the act type
 * and missing permission" — both, so a reader learns what would have to be granted rather than
 * only that something was denied. The other two refusals need neither.
 */
export interface RefusalDetail {
  readonly actType?: ActType;
  readonly missingPermission?: Permission;
}

export class ActSeamRefusal extends Error {
  /** Which of the closed taxonomy's codes this is — the field a caller branches on. */
  readonly code: RefusalCode;
  /** The act that was refused, when the refusal is about an act in particular. */
  readonly actType: ActType | undefined;
  /** The permission the actor's role does not bundle (L-ACT-03). */
  readonly missingPermission: Permission | undefined;

  constructor(code: RefusalCode, detail: RefusalDetail = {}) {
    super(`${code}: ${REFUSALS[code].message}`);
    this.name = ActSeamRefusal.name;
    this.code = code;
    this.actType = detail.actType;
    this.missingPermission = detail.missingPermission;
  }
}

/** The code a refusal carries, or `null` for anything that is not one of the seam's. */
export function refusalCodeOf(error: unknown): RefusalCode | null {
  return error instanceof ActSeamRefusal ? error.code : null;
}
