// Unit tests for hooks/factory.js (S14-U2): the words of /wip, the pane and the spinner suffix.
// Run: node --test 'tools/mod/**/*.test.mjs'

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, rmdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

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

const view = (s, cost = null, verdicts = {}) => factoryView(parseStatus(JSON.stringify(s)).status, NOW, false, cost, verdicts)
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
  assert.deepEqual(v.tabs.Reviews, ["no open review round", "last review cost unknown"])
  assert.equal(view(status([]), 0.4).tabs.Reviews.at(-1), "last review cost $0.40")
})

const SHA = "b".repeat(40)
const NEW = "e".repeat(40)
const row = (round, verdict, builder = {}) =>
  view(status([item({ ticket: "t9", state: "ready", pr: 12, head: SHA, ...builder })], { reviews: [{ pr: 12, round, head: SHA }] }), null, verdict === null ? {} : { [`12-${SHA}`]: verdict }).tabs.Reviews[0]

test("a Reviews row states facts only: PR, round, verdict, reviewed head, current head and whether it moved", () => {
  const fixed = `#12 \u00b7 round 1 \u00b7 PASS \u00b7 reviewed ${"b".repeat(12)} \u00b7 now ${"b".repeat(12)} \u00b7 same head \u00b7 t9`
  assert.equal(row(1, "PASS"), fixed)
})

test("PASS then a clean merge of main (the head moved, status.json cannot tell why): a fact, not an action", () => {
  assert.equal(row(1, "PASS", { head: NEW }), `#12 \u00b7 round 1 \u00b7 PASS \u00b7 reviewed ${"b".repeat(12)} \u00b7 now ${"e".repeat(12)} \u00b7 head moved \u00b7 t9`)
})

test("FIX then a pushed fix: reviewed and current heads differ, the verdict stays FIX", () => {
  assert.equal(row(2, "FIX", { head: NEW, state: "ready" }), `#12 \u00b7 round 2 \u00b7 FIX \u00b7 reviewed ${"b".repeat(12)} \u00b7 now ${"e".repeat(12)} \u00b7 head moved \u00b7 t9`)
})

test("FIX with a blocked (failed, stopped, quiet) builder: the same facts, whatever the builder's state", () => {
  for (const state of ["blocked", "failed", "stopped", "quiet", "working"]) {
    assert.equal(row(1, "FIX", { head: NEW, state }), `#12 \u00b7 round 1 \u00b7 FIX \u00b7 reviewed ${"b".repeat(12)} \u00b7 now ${"e".repeat(12)} \u00b7 head moved \u00b7 t9`, state)
  }
  assert.match(row(1, "FIX", { state: "blocked" }), /same head/)
})

const at = (now, moved) => `#12 \u00b7 round 1 \u00b7 PASS \u00b7 reviewed ${"b".repeat(12)} \u00b7 now ${now} \u00b7 ${moved} \u00b7 t9`

test("#495 round 2: a local builder at H whose PR passed at H reads current head unknown, never same head or head moved", () => {
  for (const head of [SHA, NEW, null]) assert.equal(row(1, "PASS", { where: "local", head }), at("?", "current head unknown"), String(head))
})

test("#495 round 2: a cloud builder's rows are unchanged: its head is the PR's, so same head and head moved read", () => {
  assert.equal(row(1, "PASS", { where: "cloud", head: SHA }), at("b".repeat(12), "same head"))
  assert.equal(row(1, "PASS", { where: "cloud", head: NEW }), at("e".repeat(12), "head moved"))
})

test("a missing verdict is ?, a builder with no usable head is current head unknown, and no row carries an action", () => {
  assert.match(row(1, null), /round 1 \u00b7 \? \u00b7 reviewed b{12} \u00b7 now b{12} \u00b7 same head/)
  for (const head of [null, "xyz", 7]) assert.match(row(1, "FIX", { head }), /now \? \u00b7 current head unknown/, String(head))
  const noBuilder = view(status([], { reviews: [{ pr: 12, round: 1, head: SHA }] }), null, { [`12-${SHA}`]: "BLOCK" }).tabs.Reviews[0]
  assert.equal(noBuilder, `#12 \u00b7 round 1 \u00b7 BLOCK \u00b7 reviewed ${"b".repeat(12)} \u00b7 now ? \u00b7 current head unknown`)
  for (const text of [row(1, "PASS"), row(1, "FIX", { head: NEW }), noBuilder]) assert.ok(!/next:|land|fix round|re-submit|owner decides|review round/.test(text), text)
})

const ADVICE = /next:|\breview\b|\bmerge\b|\bland\b|re-submit|owner decides|fix round|take over|relaunch|restart|wait\b/i
// The cost row's own label, "last review cost", is a fact and the one place the word review may appear.
const everyRow = (v) => TABS.flatMap((name) => v.tabs[name]).filter((row) => !row.startsWith("last review cost"))

test("no tab gives advice: a ready builder at a FIX head, at a BLOCK head and after a PASS (#495 findings 1 and 2)", () => {
  const heads = { fix: "1".repeat(40), block: "2".repeat(40), pass: "3".repeat(40) }
  const s = status(
    [
      item({ ticket: "t-fix", state: "ready", pr: 21, head: heads.fix }),
      item({ ticket: "t-block", state: "ready", pr: 22, head: heads.block }),
      item({ ticket: "t-pass", state: "ready", pr: 23, head: heads.pass }),
      item({ ticket: "t-w", state: "working", pr: 24 }),
      item({ ticket: "t-b", state: "blocked" }),
      item({ ticket: "t-f", state: "failed", where: "local" }),
      item({ ticket: "t-s", state: "stopped", where: "local" }),
      item({ ticket: "t-q", state: "quiet" }),
      item({ ticket: "t-d", state: "done" }),
    ],
    {
      // watch.py's reviews_view drops the PASS at its current head: only the FIX and the BLOCK are open
      reviews: [{ pr: 21, round: 1, head: heads.fix }, { pr: 22, round: 1, head: heads.block }],
      lock: { holder: { kind: "post", ticket: "t-fix", head: heads.fix, since: iso(NOW), elapsed_minutes: 3 }, waiters: [] },
    },
  )
  const v = view(s, 0.5, { [`21-${heads.fix}`]: "FIX", [`22-${heads.block}`]: "BLOCK" })
  for (const row of everyRow(v)) assert.ok(!ADVICE.test(row), row)
  assert.match(v.tabs.Builders[0], /^ready \u00b7 t-fix \u00b7 cloud \u00b7 branch t1 \u00b7 head 111111111111 \u00b7 3m$/)
  assert.match(v.tabs["PR queue"][2], /^PR #23 \u00b7 ready \u00b7 t-pass \u00b7 head 333333333333 \u00b7 -$/)
  assert.ok(!/next:/.test(wipText(v)), "/wip carries no advice either")
})

test("an empty Reviews list says no open review round, fed reviews_view's real output after a PASS (#495 finding 3)", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")
  const dir = mkdtempSync(join(tmpdir(), "reviews-view-"))
  const h = "a".repeat(40)
  try {
    mkdirSync(join(dir, "ledger"))
    writeFileSync(join(dir, "ledger", `12-${h}.json`), JSON.stringify({ pr: 12, round: 1, head: h, verdict: "PASS", recorded_at: "2026-10-06T01:00:00Z" }))
    const code = "import json, sys, pathlib\nfrom scripts.factory import watch\nprint(json.dumps(watch.reviews_view(pathlib.Path(sys.argv[1]), [{'number': 12, 'state': 'OPEN', 'headRefOid': sys.argv[2]}])))"
    const out = spawnSync("python3", ["-c", code, dir, h], { cwd: root, encoding: "utf8" })
    assert.equal(out.status, 0, out.stderr)
    const reviews = JSON.parse(out.stdout)
    assert.deepEqual(reviews, [], "reviews_view drops a PR whose ledger holds a PASS for its current head")
    const v = view(status([item({ ticket: "t9", state: "ready", pr: 12, head: h })], { reviews }), null)
    assert.deepEqual(v.tabs.Reviews, ["no open review round", "last review cost unknown"])
  } finally {
    rmSync(join(dir, "ledger", `12-${h}.json`))
    rmdirSync(join(dir, "ledger"))
    rmdirSync(dir)
  }
})

test("through the mod: the Reviews tab reads each listed review's ledger record, and only that", async () => {
  const { factoryFiles, world } = await import("./acceptance/ts14u2/_world.mjs")
  const files = {
    ...factoryFiles(),
    [`ledger/250-${"b".repeat(40)}.json`]: JSON.stringify({ pr: 250, round: 1, head: "b".repeat(40), verdict: "FIX" }),
    [`ledger/251-${"d".repeat(40)}.json`]: "{not json",
  }
  const w = await world({ files }).boot()
  const { text } = await w.command("wip")
  assert.match(text, /^ {2}#250 · round 1 · FIX · reviewed b{12} · now \? · current head unknown$/m)
  assert.match(text, /^ {2}#251 · round 2 · \? · reviewed d{12} · now d{12} · same head · s14-a1$/m)
  assert.deepEqual(w.forbidden(), [])
  assert.ok(new Set(w.factoryReads().filter((p) => p.includes("/ledger/"))).size <= 2, "only the listed reviews' records are read")
})
