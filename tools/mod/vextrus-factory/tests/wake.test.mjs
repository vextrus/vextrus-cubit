// Unit tests of the wake's pure seams (S26-FX2): wake.js's decisions and text.js's live rows and wake
// text. The acceptance tests (tests/acceptance/ts26fx2) drive the same through the mod.
// Run: node --test 'tools/mod/**/*.test.mjs'

import assert from "node:assert/strict"
import { test } from "node:test"

import { TABLE_HEAD, WAKE_END, liveRows, parseEvents, wakeText } from "../hooks/text.js"
import { CAP_PER_HOUR, HELD_MAX, PUSH_EVERY_MS, WAKE_KINDS, advance, freshEvents, giveBack, kindOf, readWake } from "../hooks/wake.js"

const T0 = Date.parse("2026-10-13T01:00:00Z")
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z")
const line = (ms, kind, ticket, detail) => `${iso(ms)} ${kind} ${ticket} ${detail}\n`
const SHA = "4596e870a1b2c3d4e5f60718293a4b5c6d7e8f90"

function status(writtenMs, items) {
  const idle = { working: 0, ready: 0, blocked: 0, quiet: 0, done: 0, failed: 0, stopped: 0, quiet_max_minutes: null }
  return {
    schema_version: 1, written_at: iso(writtenMs), watcher: { pid: 1, started_at: iso(writtenMs) },
    clock: { session: null, phase: null }, resources: { disk_free_gb: 60, swap_used_gb: 0, mem_available_gb: 12 },
    lock: { holder: null, waiters: [] }, builders: { cloud: idle, local: idle, items }, reviews: [], g1: { main: null }, usage: null, alarms: [],
  }
}
const item = (ticket, state, extra = {}) => ({ ticket, where: "cloud", state, branch: "b", head: SHA, last_push_at: iso(T0 - 5 * 60_000), quiet_minutes: 5, pr: null, ...extra })

test("kindOf: G1 and a done WALK wake, a WALK not done rides, PUSH is routine, an unknown kind is ignored", () => {
  const ev = (text) => parseEvents(text, [...WAKE_KINDS, "SAID"])[0]
  assert.equal(kindOf(ev(line(T0, "G1", "-", "4596e870 PASS"))), "wake")
  assert.equal(kindOf(ev(line(T0, "WALK", "-", `${SHA} done`))), "wake")
  assert.equal(kindOf(ev(line(T0, "WALK", "-", `${SHA} started`))), "ride")
  assert.equal(kindOf(ev(line(T0, "OWNER-RULING", "-", "Q1"))), "wake")
  assert.equal(kindOf(ev(line(T0, "PUSH", "t1", "abc"))), "routine")
  assert.equal(kindOf(ev(line(T0, "SAID", "t1", "sent"))), null)
})

test("a first reading is history: it sets the cursor at the log's end and wakes for nothing", () => {
  const log = line(T0, "READY", "t1", "abc") + line(T0 + 1000, "BLOCKED", "t2", "x")
  const first = advance(undefined, log, T0 + 2000, false)
  assert.equal(first.lines, null)
  assert.equal(first.state.cursor.at, iso(T0 + 1000))
  const next = advance(first.state, log + line(T0 + 3000, "READY", "t3", "def"), T0 + 4000, false)
  assert.deepEqual(next.lines, [line(T0 + 3000, "READY", "t3", "def").trimEnd()])
})

test("lines written in the cursor's second after it was read are still new; the ones read are not", () => {
  const a = line(T0, "READY", "t1", "a")
  const { cursor } = freshEvents(parseEvents(a, WAKE_KINDS), { at: "", hashes: [] })
  const both = parseEvents(a + line(T0, "READY", "t2", "b"), WAKE_KINDS)
  const { fresh } = freshEvents(both, cursor)
  assert.deepEqual(fresh.map((e) => e.ticket), ["t2"])
})

test("a ticket named __proto__ or constructor is throttled like any other and survives the store", () => {
  let state = { cursor: { at: "", hashes: [] } }
  for (const ticket of ["__proto__", "constructor"]) {
    const r1 = advance(state, line(T0, "PUSH", ticket, "a"), T0, false)
    assert.ok(r1.lines !== null, `${ticket}: the first PUSH wakes`)
    state = JSON.parse(JSON.stringify(r1.state))
    const r2 = advance(state, line(T0, "PUSH", ticket, "a") + line(T0 + 1000, "PUSH", ticket, "b"), T0 + 1000, false)
    assert.equal(r2.lines, null, `${ticket}: a second PUSH within 15 min does not wake`)
    state = JSON.parse(JSON.stringify(r2.state))
    state.held = []
    state.cursor = { at: "", hashes: [] }
    state.pushWokeAt = []
  }
  assert.ok(PUSH_EVERY_MS === 15 * 60_000)
})

test("the cap counts only the last hour's wakes, and a wake time from the future is dropped", () => {
  const sentAt = Array.from({ length: CAP_PER_HOUR }, (_, i) => T0 - i * 1000)
  const held = advance({ cursor: { at: "", hashes: [] }, sentAt }, line(T0, "READY", "t1", "a"), T0 + 1000, false)
  assert.equal(held.lines, null)
  assert.equal(held.capped, true)
  const future = advance({ cursor: { at: "", hashes: [] }, sentAt: sentAt.map((ms) => ms + 10 * 3_600_000) }, line(T0, "READY", "t1", "a"), T0 + 1000, false)
  assert.ok(future.lines !== null, "a clock moved back does not hold the wake for ever")
})

test("held lines are capped: riders go first, and the wake says how many were dropped", () => {
  let log = ""
  for (let i = 0; i < HELD_MAX + 5; i += 1) log += line(T0, "BUILDER-QUIET", `t${i}`, "quiet")
  const riders = advance({ cursor: { at: "", hashes: [] } }, log, T0, false)
  assert.equal(riders.state.held.length, HELD_MAX)
  assert.equal(riders.state.dropped, 5)
  const woke = advance(riders.state, log + line(T0 + 1000, "READY", "t1", "a"), T0 + 1000, false)
  assert.equal(woke.lines[0], "(6 earlier lines dropped)")
  assert.ok(woke.lines.at(-1).includes("READY t1 a"))
})

test("a failed submit gives its lines back, each waking again, without the dropped note", () => {
  const back = giveBack({ held: [{ line: "x", wakes: false }] }, ["(3 earlier lines dropped)", "L1", "L2"])
  assert.deepEqual(back.held, [{ line: "L1", wakes: true }, { line: "L2", wakes: true }, { line: "x", wakes: false }])
  assert.deepEqual(readWake("junk"), { cursor: null, held: [], dropped: 0, pushWokeAt: [], sentAt: [] })
})

test("liveRows: done and stopped are left out; minutes fall back to last_push_at; a bad head is '-'", () => {
  const s = status(T0, [item("a", "working", { state_at: iso(T0 - 9 * 60_000) }), item("b", "done"), item("c", "stopped"), item("d", "ready", { head: "nope" })])
  assert.deepEqual(liveRows(s, T0), ["a working 4596e870 9", "d ready - 5"])
  assert.deepEqual(liveRows(status(T0 - 10 * 60_000, [item("a", "working")]), T0), [], "a stale status has no rows")
})

test("wakeText: the lines, the table, the closing sentence; a stale status says WATCHER DOWN; no bidi or control survives", () => {
  const s = status(T0, [item("a‮b", "working", { relay: true })])
  const text = wakeText(["2026-10-13T01:00:00Z READY t1 x⁦y\u0007"], s, T0)
  const rows = text.split("\n")
  assert.equal(rows[2], TABLE_HEAD)
  assert.equal(rows[3], "a b working 4596e870 5 relay")
  assert.equal(rows.at(-1), WAKE_END)
  assert.ok(!/[\u0000-\u0009\u000b-\u001f‪-‮⁦-⁩]/.test(text))
  assert.ok(wakeText(["l"], s, T0 + 3_600_000).includes("status.json: WATCHER DOWN"))
})
