#!/usr/bin/env node
// `pnpm db:migrate` — applies the ledger's migrations. The schema it would migrate does not exist
// yet, so today the command records that skip and stops (B-23). When the schema lands, the
// increment that brings it brings the migration runner with it; until then an armed run refuses
// loudly rather than passing silently.
import { resolve } from "node:path";
import { DB_INPUT_ROOT, rootExists, skipLine } from "./lanes.mjs";

const rootDir = resolve(process.cwd());

if (!rootExists(rootDir, DB_INPUT_ROOT)) {
  process.stdout.write(`${skipLine("db-migrate", DB_INPUT_ROOT)}\n`);
  process.exit(0);
}

process.stderr.write(`db-migrate: ${DB_INPUT_ROOT} exists but no migration runner is built yet\n`);
process.exit(1);
