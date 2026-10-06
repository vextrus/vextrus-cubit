// Acceptance tests for ticket S14-U1 (the mod validates, and is read-only by its own call list).
// Written by the acceptance-writer before the build; the builder never changes this file.
//
// Authority: session 13's factory-next §8 row 10 ("`claude plugin validate`"), §5 item 5 ("Read-only
// in v1; no button that submits a prompt"); the owner's ruling Q6, 5 Oct 2026 ("the mods UI stays
// read-only, no button that submits a prompt"). `claude plugin validate <folder>` reads the module's
// source the way the engine will and prints, per module, a `calls:` line of every `$.<noun>.<method>`
// it reaches. Both tests skip, with the reason, only where the `claude` command is absent (CI).
//
// Run: node --test 'tools/mod/vextrus-factory/tests/acceptance/ts14u1/*.test.mjs'

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"

import { FORBIDDEN, MOD } from "./_world.mjs"

const probe = spawnSync("claude", ["--version"], { encoding: "utf8", timeout: 30_000 })
const absent = probe.error !== undefined || probe.status !== 0
const SKIP = absent ? "the claude command is not on PATH here, so `claude plugin validate` cannot run" : false

function validate() {
  const done = spawnSync("claude", ["plugin", "validate", MOD], { encoding: "utf8", timeout: 120_000 })
  return { status: done.status, out: `${done.stdout ?? ""}${done.stderr ?? ""}` }
}

test("claude plugin validate passes on the mod", { skip: SKIP }, () => {
  const { status, out } = validate()
  assert.equal(status, 0, `exit 0, got ${status}:\n${out}`)
  assert.match(out, /Validation passed/)
})

test("the mod's call list holds $.ui.toast and nothing that submits a prompt or runs a model, an agent, a tool or a process", { skip: SKIP }, () => {
  const { status, out } = validate()
  assert.equal(status, 0, out)
  const calls = out
    .split("\n")
    .filter((row) => /\bcalls:/.test(row))
    .flatMap((row) => row.slice(row.indexOf("calls:") + "calls:".length).split(","))
    .map((item) => item.replace(/\(via [^)]*\)/, "").trim())
    .filter((item) => item !== "" && item !== "nothing")
  assert.ok(calls.length > 0, `validate lists the module's calls:\n${out}`)
  assert.ok(calls.includes("$.ui.toast"), `the mod toasts: $.ui.toast is in ${JSON.stringify(calls)}`)
  const made = calls.filter((item) => FORBIDDEN.some((name) => item === `$.${name}`) || item.startsWith("$.model."))
  assert.deepEqual(made, [], `no forbidden call in ${JSON.stringify(calls)}`)
})
