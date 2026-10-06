// The host's $.fs.read rejects a file over 4 MiB, and events.log only grows: over it, the band and the
// OWNER-* toasts must come from events.tail (watch.py's), and an unreadable log must say so.

import assert from "node:assert/strict"
import { test } from "node:test"

import { POLL_MS, T0, eventLine, status, world } from "./acceptance/ts14u1/_world.mjs"

const MIB = 1024 * 1024
const min = (n) => T0 - n * 60_000
const filler = (bytes) => eventLine(min(500), "PUSH", "s14-p0", "x".repeat(60)).repeat(Math.ceil(bytes / 100))

// The acceptance world's `$` answers every read, so the host's 4 MiB rule is checked by what the mod
// asks for: a log over 4 MiB must never be read at all (`world.reads` records each read's path).
const hostWorld = (files) => world({ files })
const neverReadLog = (w) => assert.deepEqual(w.reads.filter((p) => p.endsWith("events.log")), [], "the log over the host's limit is not read")

const big = () => filler(5 * MIB) + eventLine(min(5), "BLOCKED", "s14-big", "waiting") + eventLine(T0 - 1000, "OWNER-COMMAND", "-", "! make it so")
const tail = () => eventLine(min(5), "BLOCKED", "s14-big", "waiting") + eventLine(T0 - 1000, "OWNER-COMMAND", "-", "! make it so")

test("a 5 MiB events.log still shows the newest high-signal event and raises the toast, from events.tail", async () => {
  const w = hostWorld({ "status.json": JSON.stringify(status(T0)), "events.log": big(), "events.tail": tail() })
  await w.load()
  await w.start()
  const { text } = await w.band(200)
  assert.ok(text.includes("s14-big"), `the newest high-signal event shows, got ${JSON.stringify(text)}`)
  assert.ok(!text.includes("unreadable"), "nothing is unreadable")
  neverReadLog(w)
  assert.equal(w.toasts.length, 1, JSON.stringify(w.toasts))
  assert.ok(w.toasts[0].includes("! make it so"))
  w.append("events.tail", eventLine(T0 + 1000, "READY", "s14-new", "ok"))
  w.files["status.json"] = JSON.stringify(status(T0 + POLL_MS))
  await w.advance(POLL_MS)
  assert.ok((await w.band(200)).text.includes("s14-new"), "a line the tail gains shows within one poll")
  assert.equal(w.toasts.length, 1, "and the toast is not repeated")
})

test("a big events.log with no events.tail says `events: unreadable` rather than going blank", async () => {
  const w = hostWorld({ "status.json": JSON.stringify(status(T0)), "events.log": big() })
  await w.load()
  await w.start()
  const { text, lines } = await w.band(200)
  assert.ok(text.includes("events: unreadable"), `got ${JSON.stringify(text)}`)
  neverReadLog(w)
  assert.ok(lines.length >= 2, "the status rows still draw")
})

test("no events.log at all is not an error: the band shows no events row and no warning", async () => {
  const w = hostWorld({ "status.json": JSON.stringify(status(T0)) })
  await w.load()
  await w.start()
  assert.ok(!(await w.band(200)).text.includes("unreadable"))
})
