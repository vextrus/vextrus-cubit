#!/usr/bin/env node
// The checkout's state in a dozen lines, for a session starting or resuming (the SessionStart hook
// prints it into context) and for anyone who asks (`node scripts/harness/state.mjs`). It reads and
// never changes anything: git, the three served ports and who holds them, the database, the last
// gate's summary, and where the session's brief is.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { attribution, portState } from "../lib/port-probe.mjs";
import { PORTS } from "../lib/ports.mjs";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

/** @param {string} command @param {string[]} args */
function read(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout: 5_000 });
  return result.status === 0 ? result.stdout.trim() : null;
}

const lines = [];
const branch = read("git", ["branch", "--show-current"]) ?? "?";
const head = read("git", ["log", "-1", "--format=%h %s"]) ?? "?";
const status = (read("git", ["status", "--porcelain"]) ?? "").split("\n").filter((line) => line !== "");
const tracked = status.filter((line) => !line.startsWith("??"));
lines.push(`git: ${branch} @ ${head.length > 110 ? `${head.slice(0, 107)}...` : head}`);
lines.push(`tree: ${tracked.length === 0 ? "clean" : `${tracked.length} tracked change(s)`} · ${status.length - tracked.length} untracked`);

const served = [];
for (const [name, port] of Object.entries(PORTS)) {
  const state = await portState(port);
  served.push(state === "free" ? `${name} ${port} free` : `${name} ${port} HELD by ${attribution(port)}`);
}
lines.push(`served: ${served.join(" · ")}`);
if ((await portState(PORTS.demo)) === "busy") {
  lines.push("  the demo is up: `pnpm demo --stop` before any journey, gate or db lane (its worker takes the journeys' jobs)");
}

const pg = spawnSync("pg_isready", ["-h", "127.0.0.1", "-p", "5544", "-q"], { timeout: 5_000 });
lines.push(`postgres 127.0.0.1:5544: ${pg.status === 0 ? "up" : "DOWN (`pnpm checkup` names the fix)"}`);

const summary = join(ROOT, "node_modules", ".cache", "cubit", "gate", "summary.txt");
if (existsSync(summary)) lines.push(`last gate: ${readFileSync(summary, "utf8").trim().split("\n").join(" · ")}`);

const handoffs = join(ROOT, "docs", "handoff");
if (existsSync(handoffs)) {
  const prompts = readdirSync(handoffs)
    .filter((name) => /^session-\d+-prompt\.md$/.test(name))
    .sort((a, b) => statSync(join(handoffs, b)).mtimeMs - statSync(join(handoffs, a)).mtimeMs);
  if (prompts[0] !== undefined) lines.push(`newest brief: docs/handoff/${prompts[0]}`);
}

process.stdout.write(`cubit state\n${lines.map((line) => `- ${line}`).join("\n")}\n`);
