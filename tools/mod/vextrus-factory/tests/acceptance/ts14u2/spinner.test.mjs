// Acceptance tests for ticket S14-U2 (the spinner suffix): while a turn runs, the spinner shows the
// session's elapsed time against its budget, from the clock's session.json.
// Written by the acceptance-writer before the build; the builder never changes this file.
//
// Authority: session 13's factory-next §8 row 16 ("Mod: `/factory` pane, `/wip` command, spinner
// suffix with elapsed/budget"); §5 ("render sites include `AbovePrompt`, `Pane`, `Spinner`"). The
// clock's session.json is the form scripts/factory/stamp.py's `start` writes, beside status.json in
// the factory folder; elapsed/budget is written as S14-U1's status line writes it (`1h16/5h00`, or
// `1:16/5:00`).
//
// Seams assumed: a `ui.render` hook on `{ component: "Spinner" }` that either rewrites the `suffix`
// prop and calls `next`, or draws its own tree; either way the spinner's word stays.
//
// Run: node --test 'tools/mod/vextrus-factory/tests/acceptance/ts14u2/*.test.mjs'

import assert from "node:assert/strict"
import { test } from "node:test"

import { POLL_MS, factoryFiles, world } from "./_world.mjs"

test("the spinner's suffix shows elapsed against budget from session.json: 76 of 300 minutes is 1h16/5h00", async () => {
  const w = await world({ files: factoryFiles() }).boot()
  const { text } = await w.spinner()
  assert.match(text, /\b1[:h]16\/5[:h]00\b/, `got ${JSON.stringify(text)}`)
  assert.ok(text.includes("Sauteing"), `the spinner's word stays, got ${JSON.stringify(text)}`)
})

test("the spinner's elapsed moves with the clock: four minutes on it reads 1h20/5h00", async () => {
  const w = await world({ files: factoryFiles() }).boot()
  await w.spinner()
  await w.advance(16 * POLL_MS)
  const { text } = await w.spinner()
  assert.match(text, /\b1[:h]20\/5[:h]00\b/, `got ${JSON.stringify(text)}`)
})

test("a broken session.json leaves the spinner its word and draws no NaN, undefined or control character", async () => {
  // Shown working first, so the test cannot pass on a mod that never touches the spinner.
  const good = await world({ files: factoryFiles() }).boot()
  assert.match((await good.spinner()).text, /\b1[:h]16\/5[:h]00\b/)
  const broken = [
    "{not json",
    JSON.stringify({ schema: 1, started_utc: "yesterday", budget_minutes: 300, phases: [] }),
    JSON.stringify({ schema: 1, started_utc: "2026-10-06T00:00:00Z", budget_minutes: "\u001b[2J", phases: [] }),
    JSON.stringify({ schema: 1, started_utc: "2026-10-06T00:00:00Z", budget_minutes: -5, phases: [] }),
  ]
  for (const text of broken) {
    const w = await world({ files: { ...factoryFiles(), "session.json": text } }).boot()
    const drawn = (await w.spinner()).text
    assert.ok(drawn.includes("Sauteing"), `the word stays for ${JSON.stringify(text)}, got ${JSON.stringify(drawn)}`)
    assert.ok(!/NaN|undefined|Infinity|null/.test(drawn), `no broken number for ${JSON.stringify(text)}, got ${JSON.stringify(drawn)}`)
    assert.ok(!/[\u0000-\u001f\u007f-\u009f]/.test(drawn), `no control character for ${JSON.stringify(text)}, got ${JSON.stringify(drawn)}`)
  }
})
