#!/usr/bin/env node
// SessionStart: the checkout's state in a few lines, printed into the session's context. Reads and
// never changes anything. Self-contained, and quiet about what a cloud VM lacks.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.CLAUDE_PROJECT_DIR ?? resolve(fileURLToPath(new URL("../..", import.meta.url)));

const read = (command, args) => {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout: 5_000 });
  return result.status === 0 ? result.stdout.trim() : null;
};

const lines = [];
const branch = read("git", ["branch", "--show-current"]) ?? "?";
const head = read("git", ["log", "-1", "--format=%h %s"]) ?? "?";
lines.push(`git: ${branch} @ ${head.length > 100 ? `${head.slice(0, 97)}...` : head}`);
const status = (read("git", ["status", "--porcelain"]) ?? "").split("\n").filter((line) => line !== "");
const tracked = status.filter((line) => !line.startsWith("??")).length;
lines.push(`tree: ${tracked === 0 ? "clean" : `${tracked} tracked change(s)`} · ${status.length - tracked} untracked`);

const pr = read("gh", ["pr", "view", "--json", "number,title,state", "--jq", '"#\\(.number) \\(.state) \\(.title)"']);
if (pr) lines.push(`pr: ${pr}`);

// PostgreSQL 18 on 5432 is this product's; 5544 is the old product's and never ours (CLAUDE.md).
const port = process.env.PGPORT ?? "5432";
const up = spawnSync("pg_isready", ["-h", "127.0.0.1", "-p", port, "-q"], { timeout: 5_000 }).status === 0;
lines.push(`postgres 18: ${up ? `up on ${port}` : `not answering on ${port}`}`);

lines.push(`real drawings (.private/): ${existsSync(join(ROOT, ".private")) ? "present (local session)" : "absent (cloud session: committed tests only)"}`);

const handoffs = join(ROOT, "docs", "handoff");
if (existsSync(handoffs)) {
  const prompts = readdirSync(handoffs)
    .filter((name) => /^session-\d+-prompt\.md$/.test(name))
    .sort((a, b) => Number(b.match(/\d+/)[0]) - Number(a.match(/\d+/)[0]));
  if (prompts[0] !== undefined) lines.push(`newest brief: docs/handoff/${prompts[0]}`);
}

process.stdout.write(`vextrus state\n${lines.map((line) => `- ${line}`).join("\n")}\n`);
