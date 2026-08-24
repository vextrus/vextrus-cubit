#!/usr/bin/env node
// `pnpm seed` — loads the demonstration data. The schema it would seed does not exist yet, so
// today the command records that skip and stops (B-23). An armed run refuses loudly rather than
// pretending it seeded anything.
import { resolve } from "node:path";
import { DB_INPUT_ROOT, rootExists, skipLine } from "./lanes.mjs";

const rootDir = resolve(process.cwd());

if (!rootExists(rootDir, DB_INPUT_ROOT)) {
  process.stdout.write(`${skipLine("seed", DB_INPUT_ROOT)}\n`);
  process.exit(0);
}

process.stderr.write(`seed: ${DB_INPUT_ROOT} exists but no seed loader is built yet\n`);
process.exit(1);
