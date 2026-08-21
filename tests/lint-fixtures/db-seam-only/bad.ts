/**
 * Fires: cubit/db-seam-only (SEAM-TENANT).
 * A pool built outside src/core/db.ts is a handle nobody scoped to a tenant, and the
 * schema imported beside it is the second half of the same mistake.
 */
import { Pool } from 'pg';

export const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

export async function loadSchema(): Promise<unknown> {
  return import('@/db/schema');
}
