// Acceptance tests for ticket S26-FX2 (the band of live tickets): the band above the prompt shows one
// row per live ticket from status.json's builders.items, the row the wake's table carries.
// Written by the acceptance-writer before the build; the builder never changes this file.
//
// Authority: session 26's brief, row FX2 ("a status band of live tickets"); the factory-mod design of
// 13 Oct 2026, section 1: "What the prompt and band show: a status table of every live ticket, one row
// each: `ticket state head8 Δmin relay` ... The watcher computes the rows into `status.json`
// (`builders.items` gains `state_at`, `relay` ...), so band, `/wip` and the wake text cannot disagree."
//
// Run: node --test 'tools/mod/vextrus-factory/tests/acceptance/ts26fx2/*.test.mjs'

import assert from "node:assert/strict"
import { test } from "node:test"

import { ENGINE_BAND, HEAD_D1, HEAD_D2, HEAD_L1, T0, cells, status, world } from "./_world.mjs"

const head8 = (sha) => sha.slice(0, 8)
// Minutes as a number of their own, bare or with m or min after it (`9`, `9m`, `9 min`).
const mins = (n) => `(?<![0-9])${n}(?:\\s?m(?:in)?)?(?![0-9])`

async function orchestrator() {
  const w = world({ files: { "status.json": JSON.stringify(status(T0)), "events.log": "" } })
  await w.load()
  await w.start()
  return w
}

test("the band shows one row per live ticket: ticket, state, head8 and minutes since state_at", async () => {
  const w = await orchestrator()
  const { lines, text } = await w.band(200)
  assert.ok(!text.includes(ENGINE_BAND), "the mod draws the band")
  for (const [ticket, state, sha, minutes] of [["S25-D1", "ready", HEAD_D1, 9], ["S25-D2", "working", HEAD_D2, 4], ["S25-L1", "working", HEAD_L1, 23]]) {
    const row = new RegExp(`${ticket}\\b.*\\b${state}\\b.*\\b${head8(sha)}\\b.*${mins(minutes)}`, "i")
    assert.equal(lines.filter((line) => row.test(line)).length, 1, `one band row: ${ticket} ${state} ${head8(sha)} ${minutes}, got:\n${text}`)
  }
  const l1 = lines.find((line) => line.includes("S25-L1"))
  const d1 = lines.find((line) => line.includes("S25-D1"))
  assert.match(l1, /\brelay\b/i, "S25-L1's relay shows on its row")
  assert.doesNotMatch(d1, /\brelay\b/i, "S25-D1 has no relay")
})

test("a ticket's band row fits the terminal's columns", async () => {
  const w = await orchestrator()
  for (const columns of [40, 60]) {
    const { lines, text } = await w.band(columns)
    assert.ok(lines.some((line) => line.includes("S25-D1")), `${columns} columns: S25-D1 has a row, got:\n${text}`)
    for (const line of lines) assert.ok(cells(line) <= columns, `${columns} columns: a row of ${cells(line)} cells: ${JSON.stringify(line)}`)
  }
})
