// Acceptance tests for ticket S27-W835 (#835), the factory mod's part: the wake ignores events.log lines
// older than the session's start.
// Written by the acceptance-writer before the build; the builder never changes this file.
//
// Seen at session 26's close: after `stamp end`, the watcher wrote ~80 stale READY-WAITING /
// BUDGET-PASSED / BUILDER-QUIET lines and the mod (S26-FX2) woke the orchestrator with all of them.
// #835's owed check: "the wake ignores lines older than the session start". The session's start is
// session.json's `started_utc` (scripts/factory/stamp.py `start`), which the mod already reads every
// poll (`.private/work/factory/session.json`).
//
// The scenario: the orchestrator's mod runs in session 26 (its cursor in $.store), the Claude session
// closes, the watcher writes stale lines between sessions, `stamp start` writes session 27's
// session.json, and a new Claude session loads the mod with the same store. Those lines, stamped before
// session 27's start, wake nothing and ride along with nothing; a line written after the start still
// wakes, alone.
//
// Not pinned: what the wake does while no session.json exists (#835 speaks only of lines older than
// the session start).
//
// Run: node --test 'tools/mod/vextrus-factory/tests/acceptance/ts27w835/*.test.mjs'

import assert from "node:assert/strict"
import { test } from "node:test"

import { HEAD_D1, POLL_MS, T0, eventLine, iso, status, world } from "../ts26fx2/_world.mjs"

const MIN = 60_000
const head8 = (sha) => sha.slice(0, 8)
const SESSION_26 = T0 - 6 * 60 * MIN
const SESSION_27 = T0 + 60 * MIN
const session = (startMs) => JSON.stringify({ schema: 1, started_utc: iso(startMs), budget_minutes: 360, state_file: "/repo/.private/work/s27/STATE.md", phases: [] })

// Stale lines of launches back to session 13, stamped between the sessions: every kind of the incident,
// and waking kinds besides (READY, BLOCKED, BUDGET-PASSED wake on their own).
function staleLines(fromMs) {
  const out = []
  for (let n = 0; n < 20; n += 1) {
    const at = fromMs + n * MIN
    const ticket = `S${13 + (n % 13)}-OLD${n}`
    out.push(eventLine(at, "READY-WAITING", ticket, `${n}0c0ffee READY ${900 + n} min, not merged`))
    out.push(eventLine(at, "BUDGET-PASSED", ticket, `${20000 + n}/60 min`))
    out.push(eventLine(at, "BUILDER-QUIET", ticket, `no push for ${20000 + n} min`))
    out.push(eventLine(at, "READY", ticket, `${n}0c0ffee`.slice(0, 8)))
  }
  out.push(eventLine(fromMs + 30 * MIN, "BLOCKED", "S20-OLD99", "deadbeef no reason given"))
  return out
}

const texts = (w) => w.submits.map((s) => String(s?.text ?? ""))

async function poll(w, ...lines) {
  for (const [kind, ticket, detail] of lines) w.append("events.log", eventLine(w.now, kind, ticket, detail))
  w.files["status.json"] = JSON.stringify(status(w.now + POLL_MS))
  await w.advance(POLL_MS)
}

// Session 26's mod has read the log (its cursor is at the log's end) and the Claude session closed;
// between sessions the stale lines were written, `stamp end` removed session 26's session.json and
// `stamp start` wrote session 27's; the new Claude session loads the mod with the same store.
async function nextSession() {
  const w = world({
    files: {
      "status.json": JSON.stringify(status(T0)),
      "events.log": eventLine(T0 - 2 * MIN, "READY", "S26-FX2", "3123ce4c"),
      "session.json": session(SESSION_26),
    },
  })
  await w.load()
  await w.start()
  await poll(w)
  await w.idle()
  assert.equal(w.submits.length, 0, "session 26's history wakes nothing")
  for (const t of w.timers) t.live = false // the Claude session closed: its poll stops
  for (const line of staleLines(T0 + 5 * MIN)) w.append("events.log", line)
  delete w.files["session.json"]
  w.files["session.json"] = session(SESSION_27)
  w.now = SESSION_27 + 5 * MIN
  w.files["status.json"] = JSON.stringify(status(w.now))
  await w.load()
  await w.start()
  return w
}

test("lines stamped before the session's start wake nothing", async () => {
  const w = await nextSession()
  await poll(w)
  await poll(w)
  assert.equal(w.submits.length, 0, `W835: no wake for lines older than the session start, got ${w.submits.length}: ${texts(w).join("\n---\n").slice(0, 600)}`)
})

test("a line written after the session's start wakes alone, without the older lines", async () => {
  const w = await nextSession()
  await poll(w)
  await w.idle()
  await poll(w, ["READY", "S27-W1", head8(HEAD_D1)])
  assert.ok(w.submits.length >= 1, "W835: the new READY wakes")
  const text = texts(w).at(-1)
  assert.ok(text.includes(`READY S27-W1 ${head8(HEAD_D1)}`), `W835: the wake holds the new line, got:\n${text}`)
  const all = texts(w).join("\n")
  for (const kind of ["READY-WAITING", "BUDGET-PASSED", "BUILDER-QUIET", "BLOCKED"]) {
    assert.ok(!all.includes(` ${kind} S`), `W835: no ${kind} line older than the session start in any wake, got:\n${all.slice(0, 600)}`)
  }
  assert.ok(!/ READY S\d+-OLD/.test(all), `W835: no READY line older than the session start in any wake, got:\n${all.slice(0, 600)}`)
  assert.ok(!/earlier lines dropped/.test(all), `W835: the older lines are ignored, not counted as dropped, got:\n${all.slice(0, 600)}`)
})
