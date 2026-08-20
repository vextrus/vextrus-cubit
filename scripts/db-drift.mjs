#!/usr/bin/env node
/**
 * pnpm db:drift — AC-08. Generates from the schema into a scratch folder and
 * exits nonzero if drizzle would have written a new migration.
 *
 * The scratch folder lives under `.scratch/` (gitignored) because drizzle-kit
 * resolves `out` relative to the project root and cannot be handed an absolute
 * path. It is removed before this script exits, pass or fail, so `db/migrations`
 * and the working tree are exactly as they were.
 */
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { capture, ROOT } from './lib/run.mjs';

const COMMITTED = path.join(ROOT, 'db/migrations');
const sqlFiles = (dir) => readdirSync(dir).filter((file) => file.endsWith('.sql')).sort();

const before = sqlFiles(COMMITTED);
const relative = path.join('.scratch', `drift-${randomUUID()}`);
const scratch = path.join(ROOT, relative);

/** Runs the probe and reports what it found; the caller does the cleanup. */
async function probe() {
  mkdirSync(scratch, { recursive: true });
  cpSync(COMMITTED, scratch, { recursive: true });

  process.env.DRIZZLE_OUT = relative;
  const output = await capture('pnpm', ['exec', 'drizzle-kit', 'generate', '--name', 'drift_probe']);

  // drizzle-kit could not read the schema at all: a failure, not "no drift"
  if (output === null) return { failed: true, message: 'drizzle-kit could not generate from db/schema' };

  const added = sqlFiles(scratch).filter((file) => !before.includes(file));
  if (added.length === 0) return { failed: false };

  return {
    failed: true,
    message:
      `db/schema is ahead of db/migrations by ${added.length} migration(s): ${added.join(', ')}\n` +
      'Run `pnpm exec drizzle-kit generate --name <what-changed>` and commit the result.',
  };
}

let outcome;
try {
  outcome = await probe();
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (outcome.failed) {
  console.error(`db:drift FAIL — ${outcome.message}`);
  process.exit(1);
}
console.log(`db:drift OK — ${before.length} committed migration(s), schema at head`);
