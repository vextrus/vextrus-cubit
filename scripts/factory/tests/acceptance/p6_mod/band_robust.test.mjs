// Acceptance tests for ticket T-MOD (session 12 phase 6), section 3 B: the band and the status line,
// hardened (#283). Written by the acceptance-writer before the build; the builder never changes this file.
//
// Run: node --test scripts/factory/tests/acceptance/p6_mod/band_robust.test.mjs
//
// Node tests, so CI's harness job runs them (`plugin test` never runs in CI). The status line is
// spawned as scripts/factory/tests/acceptance/statusline.test.mjs spawns it: "now" through VEXTRUS_NOW,
// the file through VEXTRUS_STATUS_FILE, nothing read from the wall clock. The words module and the
// mod's register.js are imported directly; register.js gets a fake `$`. Values come from
// docs/specs/factory/contracts/status.sample.json, read here, never copied. The builder's contract:
// text.js exports MAX_STATUS_BYTES (4 MiB) and FUTURE_MS (60 s).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import * as text from "../../../../../tools/mod/vextrus-factory/hooks/text.js";
import { register } from "../../../../../tools/mod/vextrus-factory/hooks/register.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const SCRIPT = join(ROOT, "scripts/factory/statusline.mjs");
const SAMPLE_PATH = join(ROOT, "docs/specs/factory/contracts/status.sample.json");
const SAMPLE_TEXT = readFileSync(SAMPLE_PATH, "utf8");
const SAMPLE = JSON.parse(SAMPLE_TEXT);
const WRITTEN = Date.parse(SAMPLE.written_at);
const DOWN = "WATCHER DOWN";
const MIB = 1024 * 1024;

function iso(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function hhmmz(ms) {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}Z`;
}

function scratch(prefix) {
  return mkdtempSync(join(tmpdir(), `t-mod-${prefix}-`));
}

// A copy of the sample with `changes` laid over the top level.
function sample(changes = {}) {
  return { ...structuredClone(SAMPLE), ...changes };
}

function withStatus(content) {
  const file = join(scratch("status"), "status.json");
  writeFileSync(file, content);
  return file;
}

// Runs the status line; `env` holds only what the test gives, plus PATH. A hang ends at 10 s
// (status null), which fails the exit-0 check.
function run(env) {
  const projectDir = scratch("proj");
  const done = spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    input: JSON.stringify({ hook_event_name: "Status", cwd: projectDir, workspace: { current_dir: projectDir, project_dir: projectDir } }),
    env: { PATH: process.env.PATH ?? "", ...env },
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(done.status, 0, `the status line exits 0 within 10 s (signal ${done.signal}, stderr: ${(done.stderr ?? "").slice(0, 300)})`);
  assert.match(done.stdout, /^[^\n]+\n$/, `one line, got ${JSON.stringify((done.stdout ?? "").slice(0, 300))}`);
  return done.stdout.slice(0, -1);
}

// The sample's text padded through `usage` (an any-object field) to `bytes` long, still valid JSON.
function paddedText(bytes) {
  const base = JSON.stringify(sample({ usage: { ...SAMPLE.usage, pad: "" } }));
  const padded = JSON.stringify(sample({ usage: { ...SAMPLE.usage, pad: "x".repeat(bytes - base.length) } }));
  assert.equal(padded.length, bytes, "the padded text has the length asked for");
  return padded;
}

test("B1 a written_at 5 min ahead of now reads WATCHER DOWN in the band", () => {
  const status = sample({ written_at: iso(WRITTEN + 5 * 60_000) });
  assert.ok(text.parseStatus(JSON.stringify(status)).status !== null, "the future-dated status is on the contract");
  const band = text.bandText(status, WRITTEN);
  assert.ok(band.includes(DOWN), `a status 5 min in the future is a dead watcher: ${band}`);
  assert.ok(text.segments(status, WRITTEN).includes(DOWN), "segments carries WATCHER DOWN too");
  assert.equal(text.FUTURE_MS, 60_000, "text.js exports FUTURE_MS = 60000");
});

test("B1 a written_at 30 s ahead of now is fresh (clock skew under a minute)", () => {
  const status = sample({ written_at: iso(WRITTEN + 30_000) });
  const band = text.bandText(status, WRITTEN);
  assert.ok(!band.includes(DOWN), `30 s of skew is fresh: ${band}`);
});

test("B2 the status line 5 min before the sample's written_at shows WATCHER DOWN and the clock", () => {
  const nowMs = WRITTEN - 5 * 60_000;
  const line = run({ VEXTRUS_NOW: iso(nowMs), VEXTRUS_STATUS_FILE: SAMPLE_PATH });
  assert.ok(line.includes(DOWN), `WATCHER DOWN on a future-dated file: ${line}`);
  assert.ok(line.includes(hhmmz(nowMs)), `the clock ${hhmmz(nowMs)} in ${line}`);
});

test("B2 the status line 30 s before the sample's written_at draws the sample", () => {
  const line = run({ VEXTRUS_NOW: iso(WRITTEN - 30_000), VEXTRUS_STATUS_FILE: SAMPLE_PATH });
  assert.ok(!line.includes(DOWN), `30 s of skew is fresh: ${line}`);
});

test("B3 a valid status file over 4 MiB reads WATCHER DOWN in the status line", () => {
  const file = withStatus(paddedText(5 * MIB));
  const line = run({ VEXTRUS_NOW: SAMPLE.written_at, VEXTRUS_STATUS_FILE: file });
  assert.ok(line.includes(DOWN), `a 5 MiB status file is not drawn: ${line.slice(0, 200)}`);
});

test("B3 parseStatus refuses a text over MAX_STATUS_BYTES", () => {
  const big = paddedText(5 * MIB);
  assert.ok(JSON.parse(big).usage.pad.length > 0, "the 5 MiB text is valid JSON");
  assert.equal(text.parseStatus(big).status, null, "parseStatus of a 5 MiB text gives status null");
  assert.equal(text.MAX_STATUS_BYTES, 4 * MIB, "text.js exports MAX_STATUS_BYTES = 4194304");
});

test("B3 a valid status file just under the cap is still read and drawn", () => {
  const under = paddedText(4 * MIB - 100 * 1024);
  assert.ok(text.parseStatus(under).status !== null, "parseStatus reads a text just under 4 MiB");
  const line = run({ VEXTRUS_NOW: SAMPLE.written_at, VEXTRUS_STATUS_FILE: withStatus(under) });
  assert.ok(!line.includes(DOWN), `a file under the cap is drawn: ${line.slice(0, 200)}`);
  assert.ok(line.includes("lock: post t228 14m"), `the sample's lock segment in ${line.slice(0, 200)}`);
});

test("B4 a FIFO at the status path prints WATCHER DOWN and exits 0 without blocking", () => {
  const fifo = join(scratch("fifo"), "status.json");
  const made = spawnSync("mkfifo", [fifo], { encoding: "utf8" });
  assert.equal(made.status, 0, `mkfifo made the FIFO (stderr: ${made.stderr})`);
  const line = run({ VEXTRUS_NOW: SAMPLE.written_at, VEXTRUS_STATUS_FILE: fifo });
  assert.ok(line.includes(DOWN), `a FIFO is not read: ${line}`);
});

// A fake `$` for register.js's handlers: every call is recorded in `calls`.
function fakeEnv({ remote = false, storeSetThrows = false } = {}) {
  const calls = { envGet: [], storeGet: [], storeSet: [], fsRead: [], stateSet: [], every: [] };
  const env = { VEXTRUS_ROLE: "orchestrator", ...(remote ? { CLAUDE_CODE_REMOTE: "true" } : {}) };
  const $ = {
    env: { get: async (name) => (calls.envGet.push(name), env[name]) },
    session: { id: async () => "s1", root: async () => "/repo", cwd: async () => "/repo" },
    store: {
      get: async (key) => (calls.storeGet.push(key), undefined),
      set: async (key, value) => {
        calls.storeSet.push([key, value]);
        if (storeSetThrows) throw new Error("store unavailable");
      },
    },
    fs: { read: async (path) => (calls.fsRead.push(path), SAMPLE_TEXT) },
    state: {
      set: async (key, value) => {
        calls.stateSet.push([key, value]);
      },
      get: async () => ({ value: undefined }),
    },
    clock: {
      now: async () => WRITTEN,
      every: (ms, fn) => {
        calls.every.push([ms, fn]);
        return { cancel() {} };
      },
    },
    ui: { status() {} },
  };
  return { $, calls };
}

function sessionStart() {
  const handlers = [];
  register((event, ...rest) => handlers.push({ event, handler: rest[rest.length - 1] }));
  const found = handlers.filter((h) => h.event === "session.start");
  assert.equal(found.length, 1, "register registers one session.start handler");
  return found[0].handler;
}

test("B5 a throwing store.set does not stop the poll or the 15 s timer", async () => {
  const handler = sessionStart();
  const { $, calls } = fakeEnv({ storeSetThrows: true });
  const e = { event: "session.start" };
  const passed = [];
  const result = await handler($, e, (x) => (passed.push(x), "next-result"));
  assert.deepEqual(passed, [e], "the handler calls next(e)");
  assert.equal(result, "next-result", "the handler returns next(e)");
  assert.equal(calls.every.length, 1, "clock.every was called once");
  assert.equal(calls.every[0][0], 15_000, "clock.every polls every 15000 ms");
  assert.equal(calls.stateSet.length >= 1, true, "state.set was called");
  assert.deepEqual(calls.stateSet[0][0], { plugin: "vextrus-factory", key: "reading" }, "state.set's key");
  assert.deepEqual(calls.stateSet[0][1], { text: SAMPLE_TEXT }, "state.set holds the status file's text");
});

test("B5 with CLAUDE_CODE_REMOTE=true session.start reads, stores and starts nothing", async () => {
  const handler = sessionStart();
  const { $, calls } = fakeEnv({ remote: true });
  const e = { event: "session.start" };
  const passed = [];
  await handler($, e, (x) => (passed.push(x), undefined));
  assert.deepEqual(passed, [e], "the handler calls next(e)");
  assert.deepEqual(calls.fsRead, [], "nothing is read");
  assert.deepEqual(calls.storeGet, [], "the store is not read");
  assert.deepEqual(calls.storeSet, [], "nothing is stored");
  assert.deepEqual(calls.stateSet, [], "no reading is set");
  assert.deepEqual(calls.every, [], "no timer starts");
});

test("B6 the band strips bidi overrides and isolates from the lock's ticket", () => {
  const status = sample();
  status.lock.holder.ticket = "t2‮x⁦y";
  assert.ok(text.parseStatus(JSON.stringify(status)).status !== null, "the ticket is on the contract");
  const band = text.bandText(status, WRITTEN);
  assert.ok(band.includes("lock: post"), `the lock segment is drawn: ${band}`);
  const found = [...band].filter((ch) => /[‪-‮⁦-⁩]/.test(ch)).map((ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase()}`);
  assert.deepEqual(found, [], "no bidi control in the band");
});
