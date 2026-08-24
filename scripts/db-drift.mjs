#!/usr/bin/env node
// `pnpm db:drift` — the schema-drift lane of V-VERIFY: generate into scratch, leave the tree
// untouched, fail on a difference. The schema it would compare does not exist yet, so today the
// command records that skip and stops (B-23). An armed run refuses loudly rather than passing
// silently, so the lane can never go green without the comparison having happened.
import { resolve } from "node:path";
import { DB_INPUT_ROOT, rootExists, skipLine } from "./lanes.mjs";

const rootDir = resolve(process.cwd());

if (!rootExists(rootDir, DB_INPUT_ROOT)) {
  process.stdout.write(`${skipLine("db-drift", DB_INPUT_ROOT)}\n`);
  process.exit(0);
}

process.stderr.write(`db-drift: ${DB_INPUT_ROOT} exists but no drift comparison is built yet\n`);
process.exit(1);
