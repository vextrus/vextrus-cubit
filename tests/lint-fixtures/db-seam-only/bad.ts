// FIXTURE: cubit/db-seam-only MUST report on this file.
// SEAM-TENANT: driver and schema imports are lint-banned outside src/core/db.ts.

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@/../db/schema';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL_APP });
export const db = drizzle(pool, { schema });
