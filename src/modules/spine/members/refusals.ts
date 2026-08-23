/**
 * How this module refuses (R-SPINE-062, R-UI-020).
 *
 * The three codes are registered in the closed taxonomy (`src/core/errors/tenant-admin.ts`),
 * and a refusal carries its code to the caller two ways at once: as a `code` property, which
 * the screen switches on, and inside the message, which is what a log or a stack trace shows.
 * The words are the register's, never this module's — L-QTY-04 keeps reason codes closed and
 * their prose in one place.
 */
import { REFUSALS } from '../../../core/errors';

/** The codes tenant administration reaches for (docs/design/s-settings.md §7). */
export type TenantAdminCode = 'NOT_TENANT_ADMIN' | 'MEMBER_HAS_ACTS' | 'INVITATION_NOT_PENDING';

export class TenantAdminRefusal extends Error {
  readonly code: TenantAdminCode;

  constructor(code: TenantAdminCode) {
    super(`${code}: ${REFUSALS[code].message}`);
    this.name = 'TenantAdminRefusal';
    this.code = code;
  }
}

/** The refusal, thrown by the caller so the failing line is the line that refused. */
export function refused(code: TenantAdminCode): TenantAdminRefusal {
  return new TenantAdminRefusal(code);
}

/** The code a caught error carried, or null when it was not one of ours. */
export function refusalCodeOf(error: unknown): TenantAdminCode | null {
  if (error instanceof TenantAdminRefusal) return error.code;
  return null;
}
