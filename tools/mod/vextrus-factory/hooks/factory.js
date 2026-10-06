// The factory's words for /wip, the /factory pane and the spinner suffix: pure functions, no `$`, no
// Node, no I/O (the mod's register.js reads the files and draws; this module only turns text into text).
// Data: status.json (parsed by text.js's parseStatus), the last line of review-cost.jsonl and the
// clock's session.json (scripts/factory/stamp.py's `start` writes it).
//
// A row begins with a word of this module's own (a state, a kind, #PR), never with a name from a file,
// and a name from a file is shown only when it is one line of printable text (TICKET): a crafted
// ticket cannot forge a row, a section heading or a control sequence.

import { DOWN, FUTURE_MS, STALE_MS, TICKET, fitRow, hm, oneLine } from "./text.js"

export const TABS = ["Builders", "Reviews", "Lock", "PR queue"]

const UTC = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/
const STATES = ["working", "ready", "blocked", "quiet", "done", "failed", "stopped"]
const BIDI = /[‪-‮⁦-⁩]/
// One session is never longer than this many minutes (a week of minutes, with room): a larger
// budget in session.json is a broken file, not a plan.
const BUDGET_MAX = 100_000
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v)
const isCount = (v) => Number.isInteger(v) && v >= 0 && v <= 1_000_000_000
const isUtc = (v) => typeof v === "string" && UTC.test(v) && Number.isFinite(Date.parse(v))

// The clock's session as { elapsed_minutes, budget_minutes } at `nowMs`, else null (broken file).
export function sessionBudget(text, nowMs) {
  try {
    if (typeof text !== "string" || !Number.isFinite(nowMs)) return null
    const { started_utc: started, budget_minutes: budget } = JSON.parse(text)
    if (!isUtc(started) || !Number.isInteger(budget) || budget < 1 || budget > BUDGET_MAX) return null
    return { elapsed_minutes: Math.max(0, Math.floor((nowMs - Date.parse(started)) / 60_000)), budget_minutes: budget }
  } catch {
    return null
  }
}

// `1h16/5h00`, the form the orchestrator's status line writes.
export const budgetText = (b) => `${hm(b.elapsed_minutes)}/${hm(b.budget_minutes)}`

// The last non-empty line of review-cost.jsonl's `total_cost_usd`, else null.
export function lastCost(text) {
  try {
    if (typeof text !== "string") return null
    const last = text.split("\n").map((l) => l.trim()).filter((l) => l !== "").pop()
    const usd = JSON.parse(last ?? "").total_cost_usd
    return typeof usd === "number" && Number.isFinite(usd) && usd >= 0 && usd < 1_000_000 ? usd : null
  } catch {
    return null
  }
}

// A ticket name from a file: itself when it is safe to print, else "?".
const ticketOf = (t) => (typeof t === "string" && TICKET.test(t) && !BIDI.test(t) ? t : "?")
const stateOf = (s) => (STATES.includes(s) ? s : "?")
const whereOf = (w) => (w === "cloud" || w === "local" ? w : "?")
const kindOf = (k) => (k === "post" || k === "scored" || k === "no-post" ? k : "?")
const minutes = (m) => (isCount(m) ? (m >= 60 ? hm(m) : `${m}m`) : "-")
const since = (at, nowMs) => (isUtc(at) ? minutes(Math.max(0, Math.floor((nowMs - Date.parse(at)) / 60_000))) : "-")
const prOf = (p) => (isCount(p) && p > 0 ? p : null)

// Every tab states facts as status.json and the ledger give them and gives no advice: no derived
// "next" action anywhere (#485 and #495 each found one that contradicted the ledger).
const headOf = (h) => (isHead(h) ? head12(h) : "-")

const items = (status) => (Array.isArray(status.builders.items) ? status.builders.items.filter(isObj) : [])

function builderRows(status, nowMs) {
  const rows = items(status).map((b) => {
    const state = stateOf(b.state)
    const age = b.where === "cloud" ? minutes(b.quiet_minutes) : since(b.last_push_at, nowMs)
    return `${state} · ${ticketOf(b.ticket)} · ${whereOf(b.where)} · branch ${ticketOf(b.branch)} · head ${headOf(b.head)} · ${age}`
  })
  return rows.length ? rows : ["no builders"]
}

// The ledger's verdicts a review row reads: { "<pr>-<head>": "PASS" | "FIX" | "BLOCK" } (register.js
// reads each listed review's record, `ledger/<pr>-<head>.json`). status.json carries no verdict.
export const VERDICTS = ["PASS", "FIX", "BLOCK"]
export const verdictKey = (pr, head) => `${pr}-${head}`

// The Reviews rows state facts only: PR, round, the ledger's verdict, the head that round reviewed, the
// builder's head now, and whether they are the same. No tab gives advice. status.json does not say whether the move is the lander's clean merge of
// main (watch.py's clean_merges_of_main is not in the contract), so a move reads "head moved".
const head12 = (h) => h.slice(0, 12)
const isHead = (h) => typeof h === "string" && /^[0-9a-f]{40}$/.test(h)

function reviewRows(status, cost, verdicts) {
  const byPr = new Map()
  for (const b of items(status)) {
    if (prOf(b.pr) === null) continue
    byPr.set(b.pr, { ticket: ticketOf(b.ticket), head: isHead(b.head) ? b.head : null })
  }
  const held = isObj(verdicts) ? verdicts : {}
  const rows = (Array.isArray(status.reviews) ? status.reviews.filter(isObj) : []).map((r) => {
    const reviewed = isHead(r.head)
    const found = reviewed ? held[verdictKey(r.pr, r.head)] : undefined
    const verdict = VERDICTS.includes(found) ? found : "?"
    const builder = byPr.get(r.pr)
    const now = builder === undefined ? null : builder.head
    const moved = !reviewed || now === null ? "current head unknown" : now === r.head ? "same head" : "head moved"
    const who = builder === undefined ? "" : ` · ${builder.ticket}`
    const round = isCount(r.round) ? r.round : "?"
    return `#${isCount(r.pr) ? r.pr : "?"} · round ${round} · ${verdict} · reviewed ${reviewed ? head12(r.head) : "?"} · now ${now === null ? "?" : head12(now)} · ${moved}${who}`
  })
  if (rows.length === 0) rows.push("no open review round")
  rows.push(typeof cost === "number" ? `last review cost $${cost.toFixed(2)}` : "last review cost unknown")
  return rows
}

function lockRows(status, nowMs) {
  const { holder, waiters } = status.lock
  const rows = []
  const queue = Array.isArray(waiters) ? waiters.filter(isObj) : []
  if (!isObj(holder)) rows.push(queue.length ? `free · ${queue.length} waiting` : "free")
  else rows.push(`held · ${kindOf(holder.kind)} · ${ticketOf(holder.ticket)} · ${minutes(holder.elapsed_minutes)}`)
  for (const w of queue) rows.push(`waiting · ${kindOf(w.kind)} · ${ticketOf(w.ticket)} · ${since(w.since, nowMs)}`)
  return rows
}

function queueRows(status, nowMs) {
  const rows = items(status)
    .filter((b) => prOf(b.pr) !== null)
    .map((b) => {
      const state = stateOf(b.state)
      return `PR #${b.pr} · ${state} · ${ticketOf(b.ticket)} · head ${headOf(b.head)} · ${since(b.last_push_at, nowMs)}`
    })
  return rows.length ? rows : ["no builder has an open PR"]
}

// The four tabs as { down, tabs: { Builders: [row], ... }, age } at `nowMs`. `status` is a parsed,
// valid status or null (text.js's parseStatus); `schema` its second result; `cost` the last review's
// dollars or null; `verdicts` the ledger's verdicts of the listed reviews (verdictKey). A stale or missing status is DOWN, as the band: every tab then says so.
export function factoryView(status, nowMs, schema, cost, verdicts = {}) {
  const age = status === null ? Infinity : nowMs - Date.parse(status.written_at)
  if (!(age <= STALE_MS) || age < -FUTURE_MS) {
    const down = schema ? `${DOWN} status schema` : DOWN
    return { down, age: null, tabs: Object.fromEntries(TABS.map((name) => [name, ["no reading"]])) }
  }
  return {
    down: null,
    age: Math.floor(Math.max(0, age) / 60_000),
    tabs: {
      Builders: builderRows(status, nowMs),
      Reviews: reviewRows(status, cost, verdicts),
      Lock: lockRows(status, nowMs),
      "PR queue": queueRows(status, nowMs),
    },
  }
}

const WIP_COLUMNS = 160

// /wip's text: DOWN when the watcher is, then each tab as a heading line and its rows, indented.
export function wipText(view) {
  const out = []
  if (view.down !== null) out.push(view.down)
  for (const name of TABS) {
    out.push(name)
    for (const row of view.tabs[name]) out.push(`  ${fitRow(row, WIP_COLUMNS)}`)
  }
  if (view.age !== null) out.push(`status ${view.age}m old`)
  return out.map(oneLine).join("\n")
}
