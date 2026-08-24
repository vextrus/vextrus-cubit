#!/usr/bin/env node
// `pnpm verify` — the gate the whole contract hangs on (V-VERIFY). It walks the V-VERIFY lanes in
// order, printing one recorded line per lane before it acts on it: `RUN <lane>` for a lane whose
// input roots exist, `SKIP <lane>: input root <path> absent` for one whose inputs the tree does not
// have yet (B-23). Armed lanes run fail-fast; the wall time is printed; the exit code is the whole
// contract. Which lanes are armed is never decided here — scripts/lanes.mjs probes the tree.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { LANE_COMMANDS, deriveLaneRoster, rosterLine } from "./lanes.mjs";

const rootDir = resolve(process.cwd());

/** A lane's tool, preferring the workspace's own pinned copy over whatever the PATH offers. */
function binary(command) {
  const local = join(rootDir, "node_modules", ".bin", command);
  return existsSync(local) ? local : command;
}

function runLane(lane) {
  for (const [command, args] of LANE_COMMANDS[lane] ?? []) {
    const result = spawnSync(binary(command), args, { cwd: rootDir, stdio: "inherit" });
    if (result.error) {
      process.stderr.write(`${lane}: cannot run ${command} — ${result.error.message}\n`);
      return 1;
    }
    if (result.signal) return 1;
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

const started = process.hrtime.bigint();
const elapsed = () => (Number(process.hrtime.bigint() - started) / 1e9).toFixed(1);

let failure = 0;
for (const entry of deriveLaneRoster(rootDir)) {
  process.stdout.write(`${rosterLine(entry, rootDir)}\n`);
  if (!entry.armed) continue;
  failure = runLane(entry.lane);
  if (failure !== 0) break;
}

process.stdout.write(`verify: ${failure === 0 ? "ok" : "fail"} in ${elapsed()}s\n`);
process.exit(failure);
