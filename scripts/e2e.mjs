#!/usr/bin/env node
// `pnpm e2e --journey <J>` — the journey runner. The command exists from day one and it never
// lies: while the app it would drive is absent it records that skip and stops; the moment
// `src/app` exists it runs Playwright instead and the skip is gone (B-23, C-06).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { E2E_INPUT_ROOT, rootExists, skipLine } from "./lanes.mjs";

const rootDir = resolve(process.cwd());

if (!rootExists(rootDir, E2E_INPUT_ROOT)) {
  process.stdout.write(`${skipLine("e2e", E2E_INPUT_ROOT)}\n`);
  process.exit(0);
}

// `--journey <J>` is the harness's vocabulary; Playwright selects the same journey by title.
const args = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === "--journey" && argv[i + 1]) {
    args.push("--grep", argv[i + 1]);
    i += 1;
  } else {
    args.push(argv[i]);
  }
}

process.stdout.write("RUN e2e\n");
const local = join(rootDir, "node_modules", ".bin", "playwright");
const result = spawnSync(existsSync(local) ? local : "playwright", ["test", ...args], {
  cwd: rootDir,
  stdio: "inherit",
});
if (result.error) {
  process.stderr.write(`e2e: cannot run playwright — ${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
