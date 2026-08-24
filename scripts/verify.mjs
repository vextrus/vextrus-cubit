#!/usr/bin/env node
// `pnpm verify` — the gate the whole contract hangs on (V-VERIFY). It walks the V-VERIFY lanes in
// order, printing one recorded line per lane — the whole roster — before it acts on any of them:
// `RUN <lane>` for a lane whose input roots exist, `SKIP <lane>: input root <path> absent` for one
// whose inputs the tree does not have yet (B-23). Armed lanes run fail-fast; wall time printed; the
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
  const commands = LANE_COMMANDS[lane];
  if (!commands || commands.length === 0) {
    // An armed lane with nothing to run would be a green verdict nothing proved (B-23).
    process.stderr.write(`${lane}: armed but no command is bound to it\n`);
    return 1;
  }
  for (const [command, args] of commands) {
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

// The roster is decided, and printed whole, before any lane acts — so a failing run reports the
// same nine lines as a passing one. Printing it lane-by-lane would truncate it at the first
// failure, making the roster a function of the exit code (B-23).
const roster = deriveLaneRoster(rootDir);
for (const entry of roster) process.stdout.write(`${rosterLine(entry, rootDir)}\n`);

let failure = 0;
for (const entry of roster) {
  if (!entry.armed) continue;
  failure = runLane(entry.lane);
  if (failure !== 0) break;
}

process.stdout.write(`verify: ${failure === 0 ? "ok" : "fail"} in ${elapsed()}s\n`);
process.exit(failure);
