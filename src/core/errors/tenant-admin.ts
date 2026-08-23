/**
 * Tenant administration's refusals (R-SPINE-003, R-SPINE-062).
 *
 * The three codes the members-and-invitations surface reaches for. Their message and remedy
 * are docs/design/s-settings.md §7 verbatim: §5 renders `REFUSALS[code].message` and
 * `.remedy` on screen without paraphrase, so the register is where the designer's words live
 * and the block is only their reader.
 */
import { registry } from './types';

export const TENANT_ADMIN_REFUSALS = registry({
  NOT_TENANT_ADMIN: {
    code: 'NOT_TENANT_ADMIN',
    message: 'Managing members needs the OWNER or ADMIN role in this workspace.',
    remedy: 'Ask a workspace owner or admin to make the change, or to grant you the role.',
    severity: 'block',
    surface: 'page',
  },
  MEMBER_HAS_ACTS: {
    code: 'MEMBER_HAS_ACTS',
    message: 'This member holds acts on open campaigns and cannot be removed.',
    remedy:
      'Their acts keep them part of the workspace record. Removal becomes available once no act of theirs sits on an open campaign.',
    severity: 'block',
    surface: 'page',
  },
  INVITATION_NOT_PENDING: {
    code: 'INVITATION_NOT_PENDING',
    message: 'This invitation is no longer pending.',
    remedy: 'Only a pending invitation can be resent or revoked. Reload the page to see where it stands.',
    severity: 'block',
    surface: 'page',
  },
});
