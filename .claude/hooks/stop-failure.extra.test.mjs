// The builder's own tests for `stop-failure.mjs` (T-SETTINGS fix round 1): Claude Code 2.1.289 sends the error type
// in `error` (`error_type` is only the matcher's name for it), so a real payload must be logged with its type.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = fileURLToPath(new URL("./stop-failure.mjs", import.meta.url));
const NOW = "2026-10-05T04:00:00Z";

function run(payload, factory) {
  const env = { ...process.env, VEXTRUS_FACTORY_DIR: factory, VEXTRUS_NOW_UTC: NOW };
  for (const name of ["CLAUDE_CODE_REMOTE", "CLAUDE_PROJECT_DIR"]) delete env[name];
  return spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), env, encoding: "utf8", timeout: 15_000 });
}

test("the real payload shape: `error` carries the type, with error_details beside it", () => {
  for (const error of ["rate_limit", "overloaded", "billing_error", "max_output_tokens"]) {
    const factory = mkdtempSync(join(tmpdir(), "stop-failure-extra-"));
    const done = run(
      { hook_event_name: "StopFailure", session_id: "abc12345-xyz", error, error_details: "SENTINEL-DET" },
      factory,
    );
    assert.equal(done.status, 0, done.stderr);
    assert.equal(done.stdout + done.stderr, "");
    assert.equal(readFileSync(join(factory, "events.log"), "utf8"), `${NOW} STOP-FAILURE - ${error} abc12345\n`, error);
  }
});

test("`error` wins over `error_type`; a hostile `error` is unknown, never a fallback to the other field", () => {
  const cases = [
    [{ error: "overloaded", error_type: "rate_limit" }, "overloaded"],
    [{ error: "x\nFORGED READY 1 y", error_type: "rate_limit" }, "unknown"],
    [{ error: 529 }, "unknown"],
  ];
  for (const [fields, expected] of cases) {
    const factory = mkdtempSync(join(tmpdir(), "stop-failure-extra-"));
    const done = run({ hook_event_name: "StopFailure", session_id: "abc12345-xyz", ...fields }, factory);
    assert.equal(done.status, 0, done.stderr);
    const log = readFileSync(join(factory, "events.log"), "utf8");
    assert.equal(log, `${NOW} STOP-FAILURE - ${expected} abc12345\n`, JSON.stringify(fields));
  }
});
