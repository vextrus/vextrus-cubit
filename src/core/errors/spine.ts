/**
 * The spine module's refusals — the ones the platform itself raises, before any domain does.
 *
 * Both codes below are already spelled by `src/core/db.ts` (SEAM-TENANT). Registering them
 * here is what closes the taxonomy over them: the seam keeps its own literals — rewiring it
 * to import from the registry is not this increment's work — and the register test (Q-07)
 * proves the two spellings are the same code.
 */
import { registry } from './types';

export const SPINE_REFUSALS = registry({
  SYSTEM_REASON_REQUIRED: {
    code: 'SYSTEM_REASON_REQUIRED',
    message: 'An unscoped database handle was taken without a reason for leaving tenant scope.',
    remedy: 'Pass runAsSystem a short reason describing the work that is genuinely not a tenant’s.',
    severity: 'block',
    surface: 'log',
  },
  TENANT_ID_INVALID: {
    code: 'TENANT_ID_INVALID',
    message: 'The tenant id given to the database seam is not a uuid, so no scope could be set.',
    remedy: 'Pass forTenant the tenant’s uuid, or the empty id when the scope is deliberately none.',
    severity: 'block',
    surface: 'log',
  },
});
