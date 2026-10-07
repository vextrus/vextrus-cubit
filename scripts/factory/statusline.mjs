#!/usr/bin/env node
// The orchestrator's status line (docs/specs/factory.md §3.5 "Status line", §9 T8): one line from
// .private/work/factory/status.json (written by scripts/factory/watch.py; contract
// docs/specs/factory/contracts/status.schema.json) and the status-line payload on stdin. It carries
// every segment of the vextrus-factory mod's band, from the same words module, plus `ctx <n>%` when
// stdin has it; WATCHER DOWN and the clock when the file is missing, unreadable, off the contract or
// its `written_at` is over 3 min old. Read-only: no process, no network, no file written. Always
// exits 0. For the owner's eyes only.
//
// It also shows `WIP n/5` (builders working against the cap), `review $0.43` (the last line of
// review-cost.jsonl's `total_cost_usd`) and, when status.json holds no budget, elapsed/budget from
// the clock's session.json (scripts/factory/stamp.py's `start` format); all three sit beside status.json.
//
// The settings object scripts/factory/orchestrator.settings.json (f3) must carry:
//   "statusLine": { "type": "command", "command": "node <absolute path to scripts/factory/statusline.mjs>", "refreshInterval": 15 }
//
// The status file: $VEXTRUS_STATUS_FILE, else <stdin workspace.project_dir>/.private/work/factory/
// status.json, else <cwd>/.private/work/factory/status.json. $VEXTRUS_NOW (ISO UTC) sets "now" for
// tests only.

import { readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"

import { MAX_STATUS_BYTES, bandText, parseStatus } from "../../tools/mod/vextrus-factory/hooks/text.js"

const STATUS_REL = ".private/work/factory/status.json"
const COST_FILE = "review-cost.jsonl"
const SESSION_FILE = "session.json"
const SMALL_BYTES = 1024 * 1024

function readStdin() {
  try {
    const value = JSON.parse(readFileSync(0, "utf8"))
    return value !== null && typeof value === "object" ? value : {}
  } catch {
    return {}
  }
}

function now() {
  const injected = Date.parse(process.env.VEXTRUS_NOW ?? "")
  return Number.isFinite(injected) ? injected : Date.now()
}

function statusPath(input) {
  if (process.env.VEXTRUS_STATUS_FILE) return process.env.VEXTRUS_STATUS_FILE
  const project = input.workspace?.project_dir
  return join(typeof project === "string" && project !== "" ? project : process.cwd(), STATUS_REL)
}

// A small regular file's text, else null (missing, unreadable, a FIFO or too big).
function small(path) {
  try {
    const stat = statSync(path)
    return stat.isFile() && stat.size <= SMALL_BYTES ? readFileSync(path, "utf8") : null
  } catch {
    return null
  }
}

// The last review's cost: `total_cost_usd` of review-cost.jsonl's last non-empty line, else null.
function lastCost(dir) {
  const text = small(join(dir, COST_FILE))
  if (text === null) return null
  const last = text.split("\n").map((l) => l.trim()).filter((l) => l !== "").pop()
  try {
    const usd = JSON.parse(last ?? "").total_cost_usd
    return typeof usd === "number" && Number.isFinite(usd) && usd >= 0 ? usd : null
  } catch {
    return null
  }
}

// The clock's session as { elapsed_minutes, budget_minutes }, else null.
function sessionBudget(dir, nowMs) {
  const text = small(join(dir, SESSION_FILE))
  if (text === null) return null
  try {
    const { started_utc: started, budget_minutes: budget } = JSON.parse(text)
    const at = Date.parse(started)
    if (!Number.isFinite(at) || !Number.isInteger(budget) || budget < 1) return null
    return { elapsed_minutes: Math.max(0, Math.floor((nowMs - at) / 60_000)), budget_minutes: budget }
  } catch {
    return null
  }
}

function line() {
  const nowMs = now()
  try {
    const input = readStdin()
    const used = input.context_window?.used_percentage
    const ctx = typeof used === "number" && Number.isFinite(used) ? Math.round(used) : null
    let text = ""
    const path = statusPath(input)
    const dir = dirname(path)
    try {
      // A regular file only: a FIFO or a device would block the read and the line never prints.
      // Over the band's cap (text.js) it is not read: WATCHER DOWN, as the band.
      const stat = statSync(path)
      if (stat.isFile() && stat.size <= MAX_STATUS_BYTES) text = readFileSync(path, "utf8")
    } catch {
      // missing or unreadable: parseStatus("") is WATCHER DOWN
    }
    const { status, schema } = parseStatus(text)
    return bandText(status, nowMs, ctx, schema, { wip: true, cost: lastCost(dir), session: sessionBudget(dir, nowMs) })
  } catch {
    return bandText(null, nowMs)
  }
}

process.stdout.write(`${line()}\n`)
