// Acceptance tests for ticket S14-U1 (the mod's event band): the band above the prompt shows the last
// high-signal events from events.log, never the routine ones, within one poll, cut to the terminal's
// width counted in cells, and only for the orchestrator.
// Written by the acceptance-writer before the build; the builder never changes this file.
//
// Authority: session 13's factory-next §5 item 3 ("last 3-5 high-signal events (READY, BLOCKED,
// LEAK-HIT, BUDGET-PASSED, CI-red) from `events.log`, read every 15 s, truncated by terminal cells not
// UTF-16 units (this is #366)"), §8 row 10 ("fixture `events.log` line appears in the band within one
// poll"); issue #366 ("East Asian width plus zero-width marks, with a test on wide and combining
// text"). The events.log line is watch.py's `<UTC> <KIND> <ticket|-> <detail>`; its kinds READY,
// BLOCKED, LEAK-HIT, BUDGET-PASSED, PUSH and COMMIT are watch.py's. CI-RED is this ticket's kind for
// "CI red" (defined here: watch.py writes no CI kind yet).
//
// Run: node --test 'tools/mod/vextrus-factory/tests/acceptance/ts14u1/*.test.mjs'

import assert from "node:assert/strict"
import { test } from "node:test"

import { ENGINE_BAND, POLL_MS, T0, cells, eventLine, status, world } from "./_world.mjs"

const HIGH = ["READY", "BLOCKED", "LEAK-HIT", "BUDGET-PASSED", "CI-RED"]
const STATUS = JSON.stringify(status(T0))
const min = (n) => T0 - n * 60_000

function routine() {
  return eventLine(min(50), "PUSH", "s14-p0", "a1b2c3d") + eventLine(min(49), "COMMIT", "s14-k0", "local head e4f5a6b")
}

async function orchestrator(events) {
  const w = world({ files: { "status.json": STATUS, "events.log": events } })
  await w.load()
  await w.start()
  return w
}

test("each high-signal kind in events.log shows in the band with its ticket", async () => {
  for (const [i, kind] of HIGH.entries()) {
    const ticket = `s14-h${i}`
    const w = await orchestrator(routine() + eventLine(min(10), kind, ticket, "detail words"))
    const { text } = await w.band(200)
    assert.ok(text.includes(kind), `${kind}: the kind is in the band, got ${JSON.stringify(text)}`)
    assert.ok(text.includes(ticket), `${kind}: its ticket ${ticket} is in the band, got ${JSON.stringify(text)}`)
  }
})

test("routine PUSH and COMMIT lines never show in the band, even when newest", async () => {
  const log =
    eventLine(min(20), "READY", "s14-r1", "Factory-Verify ok") +
    eventLine(min(5), "PUSH", "s14-p1", "push 9f8e7d6") +
    eventLine(min(4), "COMMIT", "s14-k1", "local head 1a2b3c4")
  const w = await orchestrator(log)
  const { text } = await w.band(200)
  assert.ok(text.includes("s14-r1"), `the READY line shows, got ${JSON.stringify(text)}`)
  for (const word of ["PUSH", "COMMIT", "s14-p1", "s14-k1", "9f8e7d6", "1a2b3c4"]) {
    assert.ok(!text.includes(word), `${word} is routine and must not show, got ${JSON.stringify(text)}`)
  }
})

test("the band keeps only the newest high-signal events: the newest 3 show, a sixth-newest does not", async () => {
  let log = routine()
  for (let i = 1; i <= 6; i += 1) log += eventLine(min(30 - i), HIGH[i % HIGH.length], `s14-e${i}`, `event ${i}`)
  const w = await orchestrator(log)
  const { text } = await w.band(200)
  for (const ticket of ["s14-e4", "s14-e5", "s14-e6"]) {
    assert.ok(text.includes(ticket), `newest event ${ticket} shows, got ${JSON.stringify(text)}`)
  }
  assert.ok(!text.includes("s14-e1"), `the sixth-newest event s14-e1 is dropped, got ${JSON.stringify(text)}`)
})

test("a line appended to events.log shows in the band within one poll (15 s)", async () => {
  const w = await orchestrator(routine() + eventLine(min(10), "READY", "s14-r1", "Factory-Verify ok"))
  const before = await w.band(200)
  assert.ok(before.text.includes("s14-r1"), `the line present at start shows, got ${JSON.stringify(before.text)}`)
  assert.ok(!before.text.includes("s14-b2"), "the line not yet written does not show")
  w.append("events.log", eventLine(T0 + 1_000, "BLOCKED", "s14-b2", "waiting for the owner"))
  w.files["status.json"] = JSON.stringify(status(T0 + POLL_MS))
  await w.advance(POLL_MS)
  const after = await w.band(200)
  assert.ok(after.text.includes("s14-b2"), `the appended line shows after one poll, got ${JSON.stringify(after.text)}`)
  assert.ok(after.text.includes("BLOCKED"), "with its kind")
})

test("no band row is wider than the terminal's columns, a wide character counting 2 cells", async () => {
  const wide = "漢字".repeat(10)
  const files = {
    "status.json": JSON.stringify(status(T0, { lock: { holder: { kind: "post", ticket: wide, head: null, since: "2026-10-06T00:57:00Z", elapsed_minutes: 3 }, waiters: [] } })),
    "events.log": routine() + eventLine(min(3), "BLOCKED", "s14-w1", "漢字".repeat(30)),
  }
  const w = world({ files })
  await w.load()
  await w.start()
  for (const columns of [40, 60]) {
    const { lines, text } = await w.band(columns)
    assert.ok(!text.includes(ENGINE_BAND), `${columns} columns: the mod draws the band`)
    assert.ok(text.includes("s14-w1"), `${columns} columns: the event shows, got ${JSON.stringify(text)}`)
    for (const line of lines) {
      assert.ok(cells(line) <= columns, `${columns} columns: a row of ${cells(line)} cells: ${JSON.stringify(line)}`)
    }
    assert.ok(lines.some((line) => cells(line) >= columns - 1), `${columns} columns: a row too wide is cut to the width, not short of it`)
  }
})

test("a row cut for width fills it when the text has combining marks (a combining mark is 0 cells)", async () => {
  const combining = "é".repeat(30)
  const files = {
    "status.json": JSON.stringify(status(T0, { lock: { holder: { kind: "post", ticket: combining, head: null, since: "2026-10-06T00:57:00Z", elapsed_minutes: 3 }, waiters: [] } })),
    "events.log": routine(),
  }
  const w = world({ files })
  await w.load()
  await w.start()
  const columns = 40
  const { lines } = await w.band(columns)
  const row = lines.find((line) => line.includes("lock: post"))
  assert.ok(row !== undefined, `the lock segment shows, got ${JSON.stringify(lines)}`)
  assert.ok(cells(row) <= columns, `the row is at most ${columns} cells, got ${cells(row)}: ${JSON.stringify(row)}`)
  assert.ok(cells(row) >= columns - 1, `the row is cut to ${columns} cells, not short of it, got ${cells(row)}: ${JSON.stringify(row)}`)
})

test("only VEXTRUS_ROLE=orchestrator sees the events: a builder, an unset role or a cloud session draws the engine's band and reads no events.log", async () => {
  const files = { "status.json": STATUS, "events.log": routine() + eventLine(min(10), "LEAK-HIT", "s14-l1", "a:1 1") }
  const shown = await orchestrator(files["events.log"])
  const drawn = await shown.band(200)
  assert.ok(drawn.text.includes("s14-l1"), `the orchestrator sees the event, got ${JSON.stringify(drawn.text)}`)
  const others = [
    ["builder", { VEXTRUS_ROLE: "builder" }],
    ["unset", {}],
    ["empty", { VEXTRUS_ROLE: "" }],
    ["cloud", { VEXTRUS_ROLE: "orchestrator", CLAUDE_CODE_REMOTE: "true" }],
  ]
  for (const [why, env] of others) {
    const w = world({ env, files })
    await w.load()
    await w.start()
    w.append("events.log", eventLine(T0 + 1_000, "OWNER-COMMAND", "-", "! gh auth refresh -s project"))
    await w.advance(POLL_MS * 2)
    const { text } = await w.band(200)
    assert.equal(text, ENGINE_BAND, `${why}: the band is the engine's own drawing`)
    assert.deepEqual(w.reads.filter((p) => p.endsWith("events.log")), [], `${why}: events.log is never read`)
    assert.deepEqual(w.toasts, [], `${why}: no toast`)
  }
})
