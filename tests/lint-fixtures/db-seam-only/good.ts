// FIXTURE: cubit/db-seam-only MUST NOT report on this file.
// forTenant / runAsSystem are the only database handles.

import { forTenant, runAsSystem } from '@/core/db';

export function scoped(ctx: { tenantId: string }) {
  return forTenant(ctx);
}

export function system() {
  return runAsSystem('fixture: documented reason');
}
