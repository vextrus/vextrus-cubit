#!/usr/bin/env node
// The orchestrator's status line (docs/specs/factory.md §3.5 "Status line", §9 T8): one line from
// .private/work/factory/status.json (written by scripts/factory/watch.py; contract
// docs/specs/factory/contracts/status.schema.json) and the status-line payload on stdin. It carries
// every segment of the vextrus-factory mod's band, from the same words module, plus `ctx <n>%` when
// stdin has it; WATCHER DOWN and the clock when the file is missing, unreadable, off the contract or
// its `written_at` is over 3 min old. Read-only: no process, no network, no file written. Always
// exits 0. For the owner's eyes only.
//
// The settings object scripts/factory/orchestrator.settings.json (f3) must carry:
//   "statusLine": { "type": "command", "command": "node <absolute path to scripts/factory/statusline.mjs>", "refreshInterval": 15 }
//
// The status file: $VEXTRUS_STATUS_FILE, else <stdin workspace.project_dir>/.private/work/factory/
// status.json, else <cwd>/.private/work/factory/status.json. $VEXTRUS_NOW (ISO UTC) sets "now" for
// tests only.

import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { MAX_STATUS_BYTES, bandText, parseStatus } from "../../tools/mod/vextrus-factory/hooks/text.js"

const STATUS_REL = ".private/work/factory/status.json"

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

function line() {
  const nowMs = now()
  try {
    const input = readStdin()
    const used = input.context_window?.used_percentage
    const ctx = typeof used === "number" && Number.isFinite(used) ? Math.round(used) : null
    let text = ""
    try {
      const path = statusPath(input)
      // A regular file only: a FIFO or a device would block the read and the line never prints.
      // Over the band's cap (text.js) it is not read: WATCHER DOWN, as the band.
      const stat = statSync(path)
      if (stat.isFile() && stat.size <= MAX_STATUS_BYTES) text = readFileSync(path, "utf8")
    } catch {
      // missing or unreadable: parseStatus("") is WATCHER DOWN
    }
    const { status, schema } = parseStatus(text)
    return bandText(status, nowMs, ctx, schema)
  } catch {
    return bandText(null, nowMs)
  }
}

process.stdout.write(`${line()}\n`)
