// Acceptance tests for ticket f8 (the status line): docs/specs/factory.md §3.5 "Status line", §4(b), §10 row f8.
// Written by the acceptance-writer before the build; the builder never changes this file.
//
// Run: node --test scripts/factory/tests/acceptance/statusline.test.mjs
//
// Each test spawns `node scripts/factory/statusline.mjs` with a status-line payload on stdin and reads
// its stdout. "Now" is injected through VEXTRUS_NOW (ISO UTC). The status file is
// VEXTRUS_STATUS_FILE, else <stdin.workspace.project_dir>/.private/work/factory/status.json, else
// <cwd>/.private/work/factory/status.json. Values come from f0's sample
// (docs/specs/factory/contracts/status.sample.json), read here, never copied. TOKENS is the literal
// segment list the mod's band test (tools/mod/vextrus-factory/tests/acceptance/band.test.ts, M2)
// carries too; S8 fails when the two lists differ.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const SCRIPT = join(ROOT, "scripts/factory/statusline.mjs");
const SAMPLE_PATH = join(ROOT, "docs/specs/factory/contracts/status.sample.json");
const SCHEMA_PATH = join(ROOT, "docs/specs/factory/contracts/status.schema.json");
const BAND_TEST = join(ROOT, "tools/mod/vextrus-factory/tests/acceptance/band.test.ts");
const STATUS_REL = ".private/work/factory/status.json";

const SAMPLE = JSON.parse(readFileSync(SAMPLE_PATH, "utf8"));
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
const WRITTEN = Date.parse(SAMPLE.written_at);

// prettier-ignore
const TOKENS = /* TOKENS:BEGIN */ ["00:20Z", "3h12/5h30", "lock: post t228 14m (+2 waiting)", "disk 61G swap 0.0G avail 14G", "cloud 4 working, 1 READY, 1 quiet 31m", "local 1", "reviews #250 r1, #251 r2", "G1 main: FAIL ca2e1c4", "status 0m old"] /* TOKENS:END */;

// A status-line payload as Claude Code sends one on stdin (invented values; the shape of the
// documented fields). `rate_limits` is present so S5 can show it is never printed (Unverified 11).
function payload(projectDir, extra = {}) {
  return {
    hook_event_name: "Status",
    session_id: "00000000-0000-4000-8000-000000000001",
    transcript_path: "/tmp/example-transcript.jsonl",
    cwd: projectDir,
    model: { id: "example-model", display_name: "Example" },
    workspace: { current_dir: projectDir, project_dir: projectDir },
    version: "2.1.289",
    output_style: { name: "default" },
    cost: { total_cost_usd: 0.5, total_duration_ms: 60000, total_api_duration_ms: 30000, total_lines_added: 3, total_lines_removed: 1 },
    context_window: { used_percentage: 42, context_window_size: 200000 },
    rate_limits: { five_hour: { used_percentage: 93.7 } },
    ...extra,
  };
}

function scratch(prefix) {
  return mkdtempSync(join(tmpdir(), `f8-statusline-${prefix}-`));
}

function iso(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function hhmmz(ms) {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}Z`;
}

// Runs the script. `stdin` is a string (sent as is) or an object (sent as JSON). `env` holds
// only what the test gives, plus PATH: no VEXTRUS_* leaks in from the caller.
function run({ stdin = "", env = {}, cwd = ROOT } = {}) {
  const input = typeof stdin === "string" ? stdin : JSON.stringify(stdin);
  const started = process.hrtime.bigint();
  const done = spawnSync(process.execPath, [SCRIPT], {
    cwd,
    input,
    env: { PATH: process.env.PATH ?? "", ...env },
    encoding: "utf8",
    timeout: 10_000,
  });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  return { status: done.status, stdout: done.stdout ?? "", stderr: done.stderr ?? "", ms };
}

// One line, one trailing newline, exit 0: every run must look like this.
function oneLine(result, why) {
  assert.equal(result.status, 0, `${why}: exit 0 (stderr: ${result.stderr.slice(0, 300)})`);
  assert.match(result.stdout, /^[^\n]+\n$/, `${why}: exactly one line with one trailing newline, got ${JSON.stringify(result.stdout)}`);
  return result.stdout.slice(0, -1);
}

function withStatus(content, prefix = "status") {
  const dir = scratch(prefix);
  const file = join(dir, "status.json");
  writeFileSync(file, content);
  return file;
}

function missingFile() {
  return join(scratch("missing"), "status.json");
}

// The segment tokens, formatted from the sample by the band's rule (spec §4(b)'s example line),
// so a change to the sample that the literal list does not follow fails loudly.
function tokensFromSample(s, nowMs) {
  const hm = (m) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
  const budget = s.clock.phase ?? s.clock.session;
  const h = s.lock.holder;
  const r = s.resources;
  const c = s.builders.cloud;
  return [
    hhmmz(nowMs),
    `${hm(budget.elapsed_minutes)}/${hm(budget.budget_minutes)}`,
    `lock: ${h.kind} ${h.ticket} ${h.elapsed_minutes}m (+${s.lock.waiters.length} waiting)`,
    `disk ${Math.round(r.disk_free_gb)}G swap ${r.swap_used_gb.toFixed(1)}G avail ${Math.round(r.mem_available_gb)}G`,
    `cloud ${c.working} working, ${c.ready} READY, ${c.quiet} quiet ${c.quiet_max_minutes}m`,
    `local ${s.builders.local.working}`,
    `reviews ${s.reviews.map((x) => `#${x.pr} r${x.round}`).join(", ")}`,
    `G1 main: ${s.g1.main.state} ${s.g1.main.sha.slice(0, 7)}`,
    `status ${Math.floor((nowMs - Date.parse(s.written_at)) / 60000)}m old`,
  ];
}

function bandTokens() {
  const text = readFileSync(BAND_TEST, "utf8");
  const found = /\/\* TOKENS:BEGIN \*\/([\s\S]*?)\/\* TOKENS:END \*\//.exec(text);
  assert.ok(found, "band.test.ts carries a TOKENS:BEGIN … TOKENS:END list");
  return JSON.parse(found[1]);
}

function downLine(nowMs, why, extra = {}) {
  return oneLine(run({ stdin: payload(scratch("proj"), extra), env: { VEXTRUS_NOW: iso(nowMs), VEXTRUS_STATUS_FILE: missingFile() } }), why);
}

test("S1 on the sample at its written_at, one line carries every segment the band carries", () => {
  assert.ok(existsSync(SCRIPT), "scripts/factory/statusline.mjs exists");
  assert.deepEqual(TOKENS, tokensFromSample(SAMPLE, WRITTEN), "the literal TOKENS are the sample formatted by the band's rule");
  const result = run({ stdin: payload(scratch("proj")), env: { VEXTRUS_NOW: SAMPLE.written_at, VEXTRUS_STATUS_FILE: SAMPLE_PATH } });
  const line = oneLine(result, "S1");
  for (const token of TOKENS) assert.ok(line.includes(token), `segment ${JSON.stringify(token)} in ${JSON.stringify(line)}`);
  assert.ok(!line.includes("WATCHER DOWN"), `no WATCHER DOWN on a fresh sample: ${line}`);
  assert.equal(result.stderr, "", "nothing on stderr");
});

test("S2 over 3 min after written_at prints WATCHER DOWN and the clock; under it prints the age; age is written_at, not mtime", () => {
  assert.ok(existsSync(SCRIPT), "scripts/factory/statusline.mjs exists");
  // A copy whose mtime is far in the past: the age still comes from written_at.
  const old = withStatus(JSON.stringify(SAMPLE), "old-mtime");
  utimesSync(old, new Date("2001-01-01T00:00:00Z"), new Date("2001-01-01T00:00:00Z"));
  const fresh = oneLine(run({ stdin: payload(scratch("proj")), env: { VEXTRUS_NOW: iso(WRITTEN + 179_000), VEXTRUS_STATUS_FILE: old } }), "+179 s");
  assert.ok(!fresh.includes("WATCHER DOWN"), `+179 s is not stale: ${fresh}`);
  assert.ok(fresh.includes("status 2m old"), `+179 s reads "status 2m old": ${fresh}`);
  assert.ok(fresh.includes(hhmmz(WRITTEN + 179_000)), `the clock at +179 s: ${fresh}`);
  // A copy whose mtime is the injected now: still stale by written_at.
  const touched = withStatus(JSON.stringify(SAMPLE), "new-mtime");
  utimesSync(touched, new Date(WRITTEN + 181_000), new Date(WRITTEN + 181_000));
  const stale = oneLine(run({ stdin: payload(scratch("proj")), env: { VEXTRUS_NOW: iso(WRITTEN + 181_000), VEXTRUS_STATUS_FILE: touched } }), "+181 s");
  assert.ok(stale.includes("WATCHER DOWN"), `+181 s is stale: ${stale}`);
  assert.ok(stale.includes(hhmmz(WRITTEN + 181_000)), `the clock at +181 s: ${stale}`);
});

test("S3 a missing status file prints the clock and WATCHER DOWN, exit 0, empty stderr", () => {
  assert.ok(existsSync(SCRIPT), "scripts/factory/statusline.mjs exists");
  const result = run({ stdin: payload(scratch("proj")), env: { VEXTRUS_NOW: SAMPLE.written_at, VEXTRUS_STATUS_FILE: missingFile() } });
  const line = oneLine(result, "missing");
  assert.ok(line.includes("WATCHER DOWN"), line);
  assert.ok(line.includes(hhmmz(WRITTEN)), `the clock: ${line}`);
  assert.equal(result.stderr, "", "nothing on stderr");
});

test("S4 an empty, non-JSON, schema-failing or wrongly typed file prints exactly what a missing one does, never a stack trace", () => {
  assert.ok(existsSync(SCRIPT), "scripts/factory/statusline.mjs exists");
  const expected = downLine(WRITTEN, "missing (reference)");
  const required = SCHEMA.required;
  assert.ok(Array.isArray(required) && required.includes("written_at"), "the schema names its required fields");
  const withoutRequired = Object.fromEntries(Object.entries(SAMPLE).filter(([key]) => key !== "builders"));
  const cases = {
    empty: "",
    "not JSON": '{"schema_version": 1, "written_at": ',
    "a JSON array": "[]",
    "missing a required field (builders)": JSON.stringify(withoutRequired),
    "only two required fields": JSON.stringify({ schema_version: 1, written_at: SAMPLE.written_at }),
    "written_at of the wrong type": JSON.stringify({ ...SAMPLE, written_at: WRITTEN / 1000 }),
    "builders of the wrong type": JSON.stringify({ ...SAMPLE, builders: "four" }),
  };
  for (const [why, content] of Object.entries(cases)) {
    const result = run({ stdin: payload(scratch("proj")), env: { VEXTRUS_NOW: SAMPLE.written_at, VEXTRUS_STATUS_FILE: withStatus(content) } });
    assert.equal(oneLine(result, why), expected, `${why}: the same line as a missing file`);
    assert.equal(result.stderr, "", `${why}: nothing on stderr`);
  }
});

test("S5 ctx <n>% shows when stdin carries context_window.used_percentage, and the line survives null, absent, empty and bad stdin", () => {
  assert.ok(existsSync(SCRIPT), "scripts/factory/statusline.mjs exists");
  const env = { VEXTRUS_NOW: SAMPLE.written_at, VEXTRUS_STATUS_FILE: SAMPLE_PATH };
  const withCtx = oneLine(run({ stdin: payload(scratch("proj")), env }), "used_percentage 42");
  assert.ok(withCtx.includes("ctx 42%"), withCtx);
  for (const shown of ["93.7", "93%", "94%", "rate"]) assert.ok(!withCtx.includes(shown), `rate_limits never printed (${shown}): ${withCtx}`);
  const nulled = payload(scratch("proj"), { context_window: { used_percentage: null, context_window_size: 200000 } });
  const absent = payload(scratch("proj"));
  delete absent.context_window;
  const stdins = { "used_percentage null": nulled, "context_window absent": absent, "empty stdin": "", "non-JSON stdin": "not json {" };
  for (const [why, stdin] of Object.entries(stdins)) {
    const line = oneLine(run({ stdin, env }), why);
    assert.ok(!line.includes("ctx"), `${why}: no ctx: ${line}`);
    assert.ok(line.includes(TOKENS[0]), `${why}: still the clock: ${line}`);
    assert.ok(line.includes("status 0m old"), `${why}: still the status: ${line}`);
  }
});

test("S6 the status file is found from stdin's workspace.project_dir, not the cwd; the cwd is the last resort", () => {
  assert.ok(existsSync(SCRIPT), "scripts/factory/statusline.mjs exists");
  const project = scratch("project");
  mkdirSync(join(project, dirname(STATUS_REL)), { recursive: true });
  writeFileSync(join(project, STATUS_REL), JSON.stringify(SAMPLE));
  // The cwd holds a stale copy, so reading the cwd's file would print WATCHER DOWN.
  const elsewhere = scratch("cwd");
  mkdirSync(join(elsewhere, dirname(STATUS_REL)), { recursive: true });
  writeFileSync(join(elsewhere, STATUS_REL), JSON.stringify({ ...SAMPLE, written_at: iso(WRITTEN - 3_600_000) }));
  const env = { VEXTRUS_NOW: SAMPLE.written_at };
  const fromProject = oneLine(run({ stdin: payload(project), env, cwd: elsewhere }), "project_dir");
  assert.ok(!fromProject.includes("WATCHER DOWN"), `read project_dir's file: ${fromProject}`);
  for (const token of TOKENS) assert.ok(fromProject.includes(token), `segment ${JSON.stringify(token)}: ${fromProject}`);
  // No project_dir: the cwd's file (stale here) is the one read.
  const bare = { ...payload(elsewhere), workspace: undefined };
  const fromCwd = oneLine(run({ stdin: bare, env, cwd: elsewhere }), "cwd");
  assert.ok(fromCwd.includes("WATCHER DOWN"), `read the cwd's stale file: ${fromCwd}`);
  // A cwd with no file at all, and no project_dir: WATCHER DOWN, not a crash.
  const nowhere = scratch("empty");
  const empty = oneLine(run({ stdin: { ...payload(nowhere), workspace: undefined }, env, cwd: nowhere }), "nothing anywhere");
  assert.ok(empty.includes("WATCHER DOWN"), empty);
});

test("S7 read-only and quick: no child process, network or file write in the source; no file written; under 2 s", () => {
  assert.ok(existsSync(SCRIPT), "scripts/factory/statusline.mjs exists");
  const source = readFileSync(SCRIPT, "utf8");
  const banned = [
    /child_process/,
    /["'](?:node:)?https?["']/,
    /["'](?:node:)?net["']/,
    /["'](?:node:)?(?:dgram|tls|http2)["']/,
    /\bfetch\s*\(/,
    /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|mkdir|mkdirSync|rename|renameSync|unlink|unlinkSync|rm|rmSync|copyFile|copyFileSync|truncate|truncateSync)\b/,
  ];
  for (const pattern of banned) assert.doesNotMatch(source, pattern, `statusline.mjs must not use ${pattern}`);
  const project = scratch("ro");
  mkdirSync(join(project, dirname(STATUS_REL)), { recursive: true });
  writeFileSync(join(project, STATUS_REL), JSON.stringify(SAMPLE));
  const cwd = scratch("ro-cwd");
  const listing = (dir) => readdirSync(dir, { recursive: true }).map(String).sort();
  const before = [listing(project), listing(cwd)];
  const result = run({ stdin: payload(project), env: { VEXTRUS_NOW: SAMPLE.written_at }, cwd });
  oneLine(result, "read-only run");
  assert.deepEqual([listing(project), listing(cwd)], before, "no file created in the project or the cwd");
  assert.ok(result.ms < 2000, `finished in ${Math.round(result.ms)} ms (under 2000)`);
});

test("S8 the status line and the band carry the same segment tokens for the sample", () => {
  assert.ok(existsSync(SCRIPT), "scripts/factory/statusline.mjs exists");
  assert.deepEqual(new Set(bandTokens()), new Set(TOKENS), "band.test.ts (M2) and this file carry the same token list");
  const line = oneLine(run({ stdin: payload(scratch("proj")), env: { VEXTRUS_NOW: SAMPLE.written_at, VEXTRUS_STATUS_FILE: SAMPLE_PATH } }), "S8");
  const present = new Set(bandTokens().filter((token) => line.includes(token)));
  assert.deepEqual(present, new Set(TOKENS), `every band token in the status line: ${line}`);
});
