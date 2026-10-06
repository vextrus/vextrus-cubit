// Unit tests for hooks/factory.js (S14-U2): the words of /wip, the pane and the spinner suffix.
// Run: node --test 'tools/mod/**/*.test.mjs'

import assert from "node:assert/strict"
import { test } from "node:test"

import { TABS, budgetText, factoryView, lastCost, sessionBudget, wipText } from "../hooks/factory.js"
import { parseStatus } from "../hooks/text.js"

const NOW = Date.parse("2026-10-06T01:00:00Z")
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z")

function status(items = [], extra = {}) {
  const idle = { working: 0, ready: 0, blocked: 0, quiet: 0, done: 0, failed: 0, stopped: 0, quiet_max_minutes: null }
  return {
    schema_version: 1,
    written_at: iso(NOW - 10_000),
    watcher: { pid: 1, started_at: iso(NOW - 3_600_000) },
    clock: { session: null, phase: null },
    resources: { disk_free_gb: 50, swap_used_gb: 0, mem_available_gb: 10 },
    lock: { holder: null, waiters: [] },
    builders: { cloud: idle, local: idle, items },
    reviews: [],
    g1: { main: null },
    usage: null,
    alarms: [],
    ...extra,
  }
}

const view = (s, cost = null) => factoryView(parseStatus(JSON.stringify(s)).status, NOW, false, cost)
const item = (over) => ({ ticket: "t1", where: "cloud", state: "working", branch: "t1", head: null, last_push_at: null, quiet_minutes: 3, pr: null, ...over })

test("sessionBudget: minutes elapsed and the budget; a broken file is null", () => {
  const text = JSON.stringify({ started_utc: iso(NOW - 76 * 60_000), budget_minutes: 300 })
  assert.deepEqual(sessionBudget(text, NOW), { elapsed_minutes: 76, budget_minutes: 300 })
  assert.equal(budgetText(sessionBudget(text, NOW)), "1h16/5h00")
  for (const bad of [null, "", "{", "[]", "null", JSON.stringify({ started_utc: "yesterday", budget_minutes: 5 }), JSON.stringify({ started_utc: iso(NOW), budget_minutes: 0 }), JSON.stringify({ started_utc: iso(NOW), budget_minutes: 1e9 }), JSON.stringify({ started_utc: iso(NOW), budget_minutes: 1.5 })]) {
    assert.equal(sessionBudget(bad, NOW), null, JSON.stringify(bad))
  }
  assert.equal(sessionBudget(text, Number.NaN), null)
})

test("sessionBudget: a start in the future reads 0 elapsed, never negative", () => {
  const text = JSON.stringify({ started_utc: iso(NOW + 600_000), budget_minutes: 60 })
  assert.equal(sessionBudget(text, NOW).elapsed_minutes, 0)
})

test("lastCost: the last non-empty line's total_cost_usd, else null", () => {
  assert.equal(lastCost('{"total_cost_usd":1.5}\n{"total_cost_usd":0.25}\n\n'), 0.25)
  for (const bad of [null, "", "{", '{"total_cost_usd":"1"}', '{"total_cost_usd":-1}', '{"total_cost_usd":1e30}']) assert.equal(lastCost(bad), null, JSON.stringify(bad))
})

test("a row begins with this module's own word, so a ticket named like a heading forges no section", () => {
  const v = view(status([item({ ticket: "Lock" }), item({ ticket: "Reviews", state: "ready", pr: 7 })]))
  const text = wipText(v)
  for (const heading of TABS) assert.equal(text.split("\n").filter((l) => new RegExp(`^\\W*${heading.replace(" ", "\\s+")}\\b`).test(l)).length, 1, `${heading} heads one line, got:\n${text}`)
})

test("an unsafe ticket, state, kind or bidi override prints as ?", () => {
  const s = status([item({ ticket: "a\nb", state: "evil" }), item({ ticket: "t".repeat(81) })], { lock: { holder: null, waiters: [] } })
  s.lock = { holder: null, waiters: [{ kind: "x\u001b", ticket: "a\u202eb", since: iso(NOW) }] }
  const text = wipText(factoryView(s, NOW, false, null))
  assert.ok(!/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/.test(text), JSON.stringify(text))
  assert.match(text, /^ {2}\? · \? · cloud/m)
  assert.match(text, /^ {2}waiting · \? · \? · 0m$/m)
})

test("a missing, stale or off-schema status is DOWN on every tab", () => {
  assert.equal(factoryView(null, NOW, false, null).down, "WATCHER DOWN")
  assert.equal(factoryView(null, NOW, true, null).down, "WATCHER DOWN status schema")
  const stale = status([item()], { written_at: iso(NOW - 10 * 60_000) })
  const v = factoryView(stale, NOW, false, null)
  assert.equal(v.down, "WATCHER DOWN")
  for (const name of TABS) assert.deepEqual(v.tabs[name], ["no reading"])
  assert.match(wipText(v), /^WATCHER DOWN\nBuilders\n {2}no reading/)
})

test("each tab has its own rows; empty ones say so", () => {
  const v = view(status([]))
  assert.deepEqual(v.tabs.Builders, ["no builders"])
  assert.deepEqual(v.tabs["PR queue"], ["no builder has an open PR"])
  assert.deepEqual(v.tabs.Lock, ["free"])
  assert.deepEqual(v.tabs.Reviews, ["no review running", "last review cost unknown"])
  assert.equal(view(status([]), 0.4).tabs.Reviews.at(-1), "last review cost $0.40")
})

test("a review's PR names its builder; the last round says so", () => {
  const s = status([item({ ticket: "t9", state: "ready", pr: 12 })], { reviews: [{ pr: 12, round: 2, head: "b".repeat(40) }] })
  assert.equal(view(s).tabs.Reviews[0], "#12 · round 2 · bbbbbbb · t9 · next: last round: merge or take over")
})
