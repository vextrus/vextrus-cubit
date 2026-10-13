// The mod's wake through register.js, for the refuter's breaks of S26-FX2's first build (the
// acceptance world, tests/acceptance/ts26fx2/_world.mjs, stands for the engine).
// Run: node --test 'tools/mod/**/*.test.mjs'

import assert from "node:assert/strict"
import { test } from "node:test"

import { POLL_MS, T0, eventLine, status, world } from "./acceptance/ts26fx2/_world.mjs"

async function poll(w, ...lines) {
  for (const [kind, ticket, detail] of lines) w.append("events.log", eventLine(w.now, kind, ticket, detail))
  w.files["status.json"] = JSON.stringify(status(w.now + POLL_MS))
  await w.advance(POLL_MS)
}

test("no events.log at the first poll: the first line it gets still wakes", async () => {
  const w = world({ files: { "status.json": JSON.stringify(status(T0)) } })
  await w.load()
  await w.start()
  await poll(w)
  w.files["events.log"] = ""
  await poll(w, ["READY", "S25-D1", "4596e870"])
  assert.equal(w.submits.length, 1)
})

test("a store that reads back off-form does not reset the hour's cap", async () => {
  const w = world({ files: { "status.json": JSON.stringify(status(T0)), "events.log": "" } })
  await w.load()
  await w.start()
  for (let i = 1; i <= 12; i += 1) {
    await poll(w, ["READY", `S26-C${i}`, "abcdef12"])
    await w.idle()
  }
  w.store.set("wake", "junk")
  await poll(w, ["BLOCKED", "S26-C13", "abcdef12 x"])
  assert.equal(w.submits.length, 12)
})

test("a submit that never starts holds the next wake for at most 30 minutes", async () => {
  const w = world({ files: { "status.json": JSON.stringify(status(T0)), "events.log": "" } })
  await w.load()
  await w.start()
  await poll(w, ["READY", "S25-D1", "4596e870"])
  await poll(w, ["READY", "S25-D2", "0e361a97"])
  assert.equal(w.submits.length, 1)
  await w.advance(31 * 60_000)
  await poll(w)
  assert.equal(w.submits.length, 2)
  assert.ok(w.submits[1].text.includes("READY S25-D2 0e361a97"))
})

// Review round 3 of PR #794: stop-failure.mjs runs in every session, the orchestrator's too.
test("the orchestrator's own STOP-FAILURE never wakes it; a builder's still does", async () => {
  const w = world({ env: { VEXTRUS_ROLE: "orchestrator", __session: "0f3a9c2e-1111-2222-3333-444455556666" }, files: { "status.json": JSON.stringify(status(T0)), "events.log": "" } })
  await w.load()
  await w.start()
  await poll(w, ["STOP-FAILURE", "-", "overloaded 0f3a9c2e"])
  await poll(w)
  assert.equal(w.submits.length, 0, "its own stop failure does not wake it")
  await poll(w, ["STOP-FAILURE", "-", "rate_limit abcdef12"])
  assert.equal(w.submits.length, 1, "a builder's stop failure wakes it")
  assert.ok(w.submits[0].text.includes("STOP-FAILURE - overloaded 0f3a9c2e"), "its own line rides along")
})
