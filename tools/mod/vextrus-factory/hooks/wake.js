// The wake's decisions (S26-FX2; the owner's ruling Q-R4, 13 Oct 2026: "The factory mod may submit
// one batched, rate-capped wake prompt into the orchestrator's session"). Pure: no `$`, no I/O. The
// poll (register.js) reads events.log, asks `advance` what to hold and whether to submit, keeps the
// returned state in $.store, and submits the lines it is handed.
//
// What wakes: READY, BLOCKED, CI-RED, LEAK-HIT, STATUS, WALK-SCRIPT-DONE, G1, BUDGET-PASSED, OWNER-*,
// and `WALK - <sha> done`. PUSH and COMMIT wake at most once per ticket per 15 minutes (decided when
// the line arrives); READY-WAITING, BUILDER-QUIET, FLOOR-CROSSED and the PUSH or COMMIT that does not
// wake ride along with the next wake. At most 12 wakes in any hour: past that the lines wait and the
// band says "wakes capped".

import { parseEvents } from "./text.js"

export const CAP_PER_HOUR = 12
export const HOUR_MS = 3_600_000
export const PUSH_EVERY_MS = 15 * 60_000
// The held lines kept at most: riders are dropped first, oldest first.
export const HELD_MAX = 100
export const WAKING = ["READY", "BLOCKED", "CI-RED", "LEAK-HIT", "STATUS", "WALK-SCRIPT-DONE", "G1", "BUDGET-PASSED"]
export const RIDING = ["READY-WAITING", "BUILDER-QUIET", "FLOOR-CROSSED"]
export const ROUTINE = ["PUSH", "COMMIT"]
// Every kind the wake reads (OWNER-* are the two the watcher and the orchestrator write).
export const WAKE_KINDS = [...WAKING, ...RIDING, ...ROUTINE, "WALK", "OWNER-COMMAND", "OWNER-RULING"]

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v)
const isText = (v) => typeof v === "string"
const isTime = (v) => typeof v === "number" && Number.isFinite(v)

// "wake", "ride" or "routine" for a parsed event; null for a kind the wake ignores.
export function kindOf(event) {
  const { kind, detail } = event
  if (WAKING.includes(kind) || kind.startsWith("OWNER-")) return "wake"
  if (kind === "WALK") return /(^| )done$/.test(detail) ? "wake" : "ride"
  if (RIDING.includes(kind)) return "ride"
  if (ROUTINE.includes(kind)) return "routine"
  return null
}

// FNV-1a over the line's UTF-16 units, as 8 hex digits: the cursor's memory of the lines at its second.
export function lineHash(line) {
  let h = 0x811c9dc5
  for (let i = 0; i < line.length; i += 1) {
    h ^= line.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

// The state as held in $.store, made whole: anything off-form is left out.
// { cursor: { at, hashes } | null, held: [{ line, wakes }], dropped, pushWokeAt: [[ticket, ms]], sentAt: [ms] }
// (pushWokeAt is pairs, not an object: a ticket name is the log's, and "__proto__" is a name.)
export function readWake(raw) {
  const v = isObj(raw) ? raw : {}
  const c = v.cursor
  const cursor = isObj(c) && isText(c.at) && Array.isArray(c.hashes) ? { at: c.at, hashes: c.hashes.filter(isText) } : null
  const held = Array.isArray(v.held) ? v.held.filter((x) => isObj(x) && isText(x.line)).map((x) => ({ line: x.line, wakes: x.wakes === true })) : []
  const pushWokeAt = Array.isArray(v.pushWokeAt)
    ? v.pushWokeAt.filter((p) => Array.isArray(p) && p.length === 2 && isText(p[0]) && isTime(p[1])).map(([t, ms]) => [t, ms])
    : []
  const sentAt = Array.isArray(v.sentAt) ? v.sentAt.filter(isTime) : []
  const dropped = Number.isInteger(v.dropped) && v.dropped > 0 ? v.dropped : 0
  return { cursor, held, dropped, pushWokeAt, sentAt }
}

// How far before the cursor's second a line appended later is still read as new (a pass's lines share
// one second; a clock stepped back a little stamps a later line earlier).
export const CURSOR_WINDOW_MS = 120_000
const within = (at, cursorAt) => Date.parse(at) >= Date.parse(cursorAt) - CURSOR_WINDOW_MS

// The cursor at the log's newest second, with the hashes of every line of its window. An identical
// line written twice inside the window is read once.
function endCursor(events, previous) {
  if (events.length === 0) return previous ?? { at: "", hashes: [] }
  const at = events.reduce((m, e) => (e.at > m ? e.at : m), "")
  return { at, hashes: [...new Set(events.filter((e) => within(e.at, at)).map((e) => lineHash(e.line)))] }
}

// The lines of `events` after the cursor. A first reading (no cursor) is history, not news: it sets
// the cursor at the log's end and returns nothing.
export function freshEvents(events, cursor) {
  if (cursor === null) return { fresh: [], cursor: endCursor(events, null) }
  const fresh = events.filter((e) => e.at > cursor.at || (within(e.at, cursor.at) && !cursor.hashes.includes(lineHash(e.line))))
  return { fresh, cursor: fresh.length === 0 ? cursor : endCursor(events, cursor) }
}

function trimHeld(held, dropped) {
  let out = held
  let lost = dropped
  while (out.length > HELD_MAX) {
    const rider = out.findIndex((h) => !h.wakes)
    out = out.filter((_, i) => i !== (rider < 0 ? 0 : rider))
    lost += 1
  }
  return { held: out, dropped: lost }
}

// One poll's step. `text` is the events text read (null: none), `nowMs` the clock, `waiting` true while
// a submitted wake has not started. Returns the new state, the lines to submit (null: none) and
// whether a due wake is held by the hourly cap.
export function advance(state, text, nowMs, waiting) {
  const s = readWake(state)
  const events = text === null ? [] : parseEvents(text, WAKE_KINDS)
  const { fresh, cursor } = text === null ? { fresh: [], cursor: s.cursor } : freshEvents(events, s.cursor)
  // A time ahead of the clock (the clock stepped back) counts as now: a step back never frees a wake.
  const pushWokeAt = new Map(s.pushWokeAt.map(([t, ms]) => [t, Math.min(ms, nowMs)]).filter(([, ms]) => nowMs - ms < PUSH_EVERY_MS))
  let held = [...s.held]
  for (const e of fresh) {
    const kind = kindOf(e)
    if (kind === null) continue
    let wakes = kind === "wake"
    if (kind === "routine" && !pushWokeAt.has(e.ticket)) {
      wakes = true
      pushWokeAt.set(e.ticket, nowMs)
    }
    held.push({ line: e.line, wakes })
  }
  const trimmed = trimHeld(held, s.dropped)
  held = trimmed.held
  const sentAt = s.sentAt.map((ms) => Math.min(ms, nowMs)).filter((ms) => nowMs - ms < HOUR_MS)
  const due = held.some((h) => h.wakes)
  const capped = due && sentAt.length >= CAP_PER_HOUR
  if (!due || capped || waiting) {
    return { state: { cursor, held, dropped: trimmed.dropped, pushWokeAt: [...pushWokeAt], sentAt }, lines: null, capped }
  }
  const lines = held.map((h) => h.line)
  if (trimmed.dropped > 0) lines.unshift(`(${trimmed.dropped} earlier lines dropped)`)
  return { state: { cursor, held: [], dropped: 0, pushWokeAt: [...pushWokeAt], sentAt: [...sentAt, nowMs] }, lines, capped: false }
}

// A wake whose submit failed: its lines go back in front of the held ones, each waking again.
export function giveBack(state, lines) {
  const s = readWake(state)
  const back = lines.filter((l) => !/^\(\d+ earlier lines dropped\)$/.test(l)).map((line) => ({ line, wakes: true }))
  const { held, dropped } = trimHeld([...back, ...s.held], s.dropped)
  return { ...s, held, dropped }
}
