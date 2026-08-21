/**
 * The two refusals SEAM-TENANT raises, exercised by name (Q-07, L-QTY-04).
 *
 * Both are refusals the seam makes *before* it borrows a connection — an id that could never
 * be a uuid has no scope to set, and an unscoped handle taken without a reason is
 * indistinguishable from a forgotten scope. So neither needs a database to fire, and this
 * suite runs in the plain vitest stage beside the module rather than in the db lane.
 *
 * Q-07 counts a code as exercised when a test names it. These tests name each code and then
 * make it fire, which is the same thing done honestly: the assertion fails if the seam ever
 * stops refusing, or starts refusing under a different name.
 */
import { describe, expect, it } from 'vitest';
import { forTenant, runAsSystem } from '../db';
import { REFUSAL_CODES } from '../errors';

describe('SEAM-TENANT refusals (R-SPINE-062, Q-07)', () => {
  it('refuses a tenant id that could never be a uuid, as TENANT_ID_INVALID', () => {
    expect(() => forTenant({ tenantId: 'not-a-uuid' })).toThrow(/TENANT_ID_INVALID/);
    // The code the seam spells is the code the taxonomy knows — that is the whole of Q-07's
    // "no orphan codes" for this refusal.
    expect(REFUSAL_CODES).toContain('TENANT_ID_INVALID');
  });

  it('takes the empty id, which the policies read as no scope at all', () => {
    // A blank id is left alone on purpose: it becomes NULL in the policy, which fails closed.
    // Refusing it here would turn a designed no-op into an error.
    expect(() => forTenant({ tenantId: '' })).not.toThrow();
  });

  it('refuses an unscoped handle taken with no reason, as SYSTEM_REASON_REQUIRED', () => {
    expect(() => runAsSystem('')).toThrow(/SYSTEM_REASON_REQUIRED/);
    expect(() => runAsSystem('   ')).toThrow(/SYSTEM_REASON_REQUIRED/);
    expect(REFUSAL_CODES).toContain('SYSTEM_REASON_REQUIRED');
  });

  it('takes an unscoped handle when the reason is given', () => {
    expect(() => runAsSystem('seeding the founding tenant row')).not.toThrow();
  });
});
