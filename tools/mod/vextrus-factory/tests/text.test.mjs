// Unit tests of the words module the band and the status line share (hooks/text.js): the cell-width
// cut (#366), events.log's parser and the toast words. Run by CI's node --test glob.

import assert from "node:assert/strict"
import { test } from "node:test"

import { bandEvents, cells, cutCells, eventRow, parseEvents, toastText } from "../hooks/text.js"

const line = (at, kind, ticket, detail) => `2026-10-06T${at}Z ${kind} ${ticket} ${detail}\n`

test("cells: wide characters 2, combining marks and zero-width 0", () => {
  assert.equal(cells("abc"), 3)
  assert.equal(cells("漢字"), 4)
  assert.equal(cells("é"), 1)
  assert.equal(cells("a​b"), 2)
})

test("cutCells: fits unchanged, else width cells with an ellipsis, never splitting a wide character or a mark off its base", () => {
  assert.equal(cutCells("abc", 3), "abc")
  assert.equal(cutCells("abcdef", 4), "abc…")
  assert.equal(cutCells("漢字漢字", 5), "漢字…")
  assert.equal(cutCells("漢字漢字", 4), "漢…")
  assert.equal(cells(cutCells("é".repeat(30), 10)), 10)
  assert.ok(cutCells("é".repeat(30), 10).startsWith("é".repeat(9)))
})

test("parseEvents keeps watch.py's form only, tolerates a missing detail and CRLF, skips junk", () => {
  const text = line("01:00:00", "READY", "t1", "abc") + "junk\n" + "2026-10-06T01:01:00Z BLOCKED t2\r\n" + "2026-13-99T01:01:00Z READY t3 x\n"
  const got = parseEvents(text, ["READY", "BLOCKED"])
  assert.deepEqual(got.map((e) => [e.kind, e.ticket, e.detail]), [["READY", "t1", "abc"], ["BLOCKED", "t2", ""]])
  assert.deepEqual(parseEvents(null, ["READY"]), [])
})

test("bandEvents: high-signal kinds only, newest first, at most the limit", () => {
  let text = line("00:00:00", "PUSH", "p", "x")
  for (let i = 1; i <= 7; i += 1) text += line(`00:0${i}:00`, i % 2 ? "READY" : "CI-RED", `t${i}`, "d")
  text += line("00:09:00", "COMMIT", "k", "x") + line("00:10:00", "OWNER-COMMAND", "-", "! x")
  assert.deepEqual(bandEvents(text).map((e) => e.ticket), ["t7", "t6", "t5", "t4", "t3"])
  assert.equal(bandEvents(text, 2).length, 2)
})

test("eventRow and toastText hold one line and the width", () => {
  const e = { at: "2026-10-06T01:57:00Z", kind: "BLOCKED", ticket: "t", detail: "漢字".repeat(30) }
  assert.ok(cells(eventRow(e, 40)) <= 40)
  assert.ok(eventRow(e, 40).startsWith("01:57Z BLOCKED t "))
  const hostile = { kind: "OWNER-COMMAND", ticket: "-", detail: "! a\nb‮c" }
  assert.equal(toastText(hostile), "OWNER-COMMAND: ! a b c")
  assert.equal(toastText({ kind: "OWNER-RULING", ticket: "s14-u2", detail: "Q21" }), "OWNER-RULING s14-u2: Q21")
})
