// SEAM-TENANT fixture: a driver and the schema, reached outside src/core/db.ts.
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { invoices } from '@/db/schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function allInvoices() {
  return drizzle(pool).select().from(invoices);
}
