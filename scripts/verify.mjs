#!/usr/bin/env node
// `pnpm verify` — the gate the whole contract hangs on (V-VERIFY). It walks the V-VERIFY lanes in
// order, printing each lane's recorded line before it acts on that lane: `RUN <lane>` for a lane
// whose input roots exist, `SKIP <lane>: input root <path> absent` for one whose inputs the tree
// does not have yet (B-23). Armed lanes run fail-fast — and the lanes a stopped run never reaches
// still print their line before the verdict, so the roster is nine lines either way, one per lane,
// never a function of the exit code. Wall time is printed; the exit code is the whole
// contract. Which lanes are armed is never decided here — scripts/lanes.mjs probes the tree.
import { spawnSync } from "node:child_process";
import { existsSync, writeSync } from "node:fs";
import { join, resolve } from "node:path";
import { LANE_COMMANDS, deriveLaneRoster, rosterLine } from "./lanes.mjs";

const rootDir = resolve(process.cwd());

/**
 * A contract line, on stdout, in order. Armed lanes inherit this process's stdout, so a line that
 * sat in Node's pipe buffer while a lane ran would surface after that lane's own output and the
 * roster would read out of order. Writing the descriptor directly keeps every line where it was
 * printed (EAGAIN on a full pipe is the one case worth retrying).
 */
function emit(line) {
  const bytes = Buffer.from(`${line}\n`);
  let written = 0;
  while (written < bytes.length) {
    try {
      written += writeSync(1, bytes, written);
    } catch (error) {
      if (error.code === "EAGAIN") continue;
      process.stdout.write(bytes.subarray(written).toString());
      return;
    }
  }
}

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

// The roster is decided before any lane acts, and each lane's recorded line is printed before that
// lane acts — so a lane's own output follows the line that announced it. Fail-fast stops the work
// at the first failing lane, never the roster: the lanes the run no longer reaches still print
// their recorded line before the verdict, so a failing run reports the same nine lines as a passing
// one and the roster is not a function of the exit code (B-23, AC-1).
const roster = deriveLaneRoster(rootDir);

let failure = 0;
let reached = 0;
for (const entry of roster) {
  emit(rosterLine(entry, rootDir));
  reached += 1;
  if (!entry.armed) continue;
  failure = runLane(entry.lane);
  if (failure !== 0) break;
}
for (const entry of roster.slice(reached)) emit(rosterLine(entry, rootDir));

emit(`verify: ${failure === 0 ? "ok" : "fail"} in ${elapsed()}s`);
process.exit(failure);
