// Acceptance tests for ticket T-WATCH-LOCAL (session 12 phase 6), section 3 B: the band and the status
// line keep finished local builders (`N done`, `N stopped`); the cloud group never prints them.
// Written by the acceptance-writer before the build; the builder never changes this file.
//
// Run: node --test scripts/factory/tests/acceptance/p6_watch_local/band_local.test.mjs
//
// Each case spawns `node scripts/factory/statusline.mjs` (its run() and VEXTRUS_NOW / VEXTRUS_STATUS_FILE
// helpers copied from scripts/factory/tests/acceptance/statusline.test.mjs) on a status file made from
// f0's sample (docs/specs/factory/contracts/status.sample.json, read here, never copied) with one
// builder group replaced and `builders.items` left as is, and also calls `bandText` from
// tools/mod/vextrus-factory/hooks/text.js: both must print the same group segment.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { bandText } from "../../../../../tools/mod/vextrus-factory/hooks/text.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const SCRIPT = join(ROOT, "scripts/factory/statusline.mjs");
const SAMPLE_PATH = join(ROOT, "docs/specs/factory/contracts/status.sample.json");
const STATUSLINE_TEST = join(ROOT, "scripts/factory/tests/acceptance/statusline.test.mjs");
const SEP = " · ";

const SAMPLE = JSON.parse(readFileSync(SAMPLE_PATH, "utf8"));
const WRITTEN = Date.parse(SAMPLE.written_at);

// Statusline S1's literal segment list, read from its file (between its TOKENS markers), never copied.
function s1Tokens() {
  const text = readFileSync(STATUSLINE_TEST, "utf8");
  const found = text.match(/\/\* TOKENS:BEGIN \*\/([\s\S]*?)\/\* TOKENS:END \*\//);
  assert.ok(found, "statusline.test.mjs carries its TOKENS markers");
  return JSON.parse(found[1]);
}

function iso(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Runs the script. `env` holds only what the test gives, plus PATH: no VEXTRUS_* leaks in.
function run({ stdin = "", env = {}, cwd = ROOT } = {}) {
  const input = typeof stdin === "string" ? stdin : JSON.stringify(stdin);
  const done = spawnSync(process.execPath, [SCRIPT], {
    cwd,
    input,
    env: { PATH: process.env.PATH ?? "", ...env },
    encoding: "utf8",
    timeout: 10_000,
  });
  return { status: done.status, stdout: done.stdout ?? "", stderr: done.stderr ?? "" };
}

function oneLine(result, why) {
  assert.equal(result.status, 0, `${why}: exit 0 (stderr: ${result.stderr.slice(0, 300)})`);
  assert.match(result.stdout, /^[^\n]+\n$/, `${why}: exactly one line, got ${JSON.stringify(result.stdout)}`);
  return result.stdout.slice(0, -1);
}

// A whole builder group (the schema's builderGroup): every count 0 but those given.
function group(counts) {
  return { working: 0, ready: 0, blocked: 0, quiet: 0, done: 0, failed: 0, stopped: 0, quiet_max_minutes: null, ...counts };
}

// The sample with `builders[which]` replaced; `builders.items` stays as the sample has it.
function withGroup(which, counts) {
  const status = structuredClone(SAMPLE);
  if (which !== null) status.builders[which] = group(counts);
  return status;
}

// The status line's text for `status`, and the band's own text for it.
function lines(status) {
  const dir = mkdtempSync(join(tmpdir(), "t-watch-local-band-"));
  const file = join(dir, "status.json");
  writeFileSync(file, JSON.stringify(status));
  const statusLine = oneLine(run({ env: { VEXTRUS_NOW: iso(WRITTEN), VEXTRUS_STATUS_FILE: file } }), "the status line");
  return { statusLine, band: bandText(status, WRITTEN) };
}

function segment(line, name) {
  const found = line.split(SEP).filter((seg) => seg === name || seg.startsWith(`${name} `));
  assert.equal(found.length, 1, `one ${name} segment in ${JSON.stringify(line)}`);
  return found[0];
}

function expectSegment(status, name, expected) {
  const { statusLine, band } = lines(status);
  assert.equal(segment(statusLine, name), expected, `the status line: ${statusLine}`);
  assert.equal(segment(band, name), expected, `the band: ${band}`);
}

test("B1 a finished local builder is printed: local 0, 1 done", () => {
  expectSegment(withGroup("local", { working: 0, done: 1 }), "local", "local 0, 1 done");
});

test("B2 every local count in order: working, READY, BLOCKED, failed, done, stopped", () => {
  const counts = { working: 1, ready: 1, blocked: 1, failed: 1, done: 2, stopped: 1, quiet: 0 };
  expectSegment(withGroup("local", counts), "local", "local 1, 1 READY, 1 BLOCKED, 1 failed, 2 done, 1 stopped");
});

test("B3 a stopped local builder is printed: local 0, 1 stopped", () => {
  expectSegment(withGroup("local", { working: 0, stopped: 1 }), "local", "local 0, 1 stopped");
});

test("B4 the sample as it is: local 1, and every token of statusline S1 is still there", () => {
  const status = withGroup(null, {});
  expectSegment(status, "local", "local 1");
  const { statusLine, band } = lines(status);
  for (const token of s1Tokens()) {
    assert.ok(statusLine.split(SEP).includes(token), `the status line has ${JSON.stringify(token)}: ${statusLine}`);
    assert.ok(band.split(SEP).includes(token), `the band has ${JSON.stringify(token)}: ${band}`);
  }
});

test("B5 the cloud group never prints done or stopped: cloud 1 working", () => {
  expectSegment(withGroup("cloud", { working: 1, done: 3, stopped: 1 }), "cloud", "cloud 1 working");
});
