// Acceptance tests for ticket S14-U2 (the `/wip` command): it prints the factory's WIP table, in
// four sections Builders, Reviews, Lock and PR queue, from the factory's files, with no model turn.
// Written by the acceptance-writer before the build; the builder never changes this file.
//
// Authority: session 13's factory-next §5 item 5 ("`/factory` pane and `/wip` command (U2,
// `immediate: true`): tabs Builders | Reviews | Lock | PR queue; each row ticket, state, age, next
// action. `/wip` prints the WIP table with no model turn, which removes the orchestrator turn behind
// every status question. Read-only in v1; no button that submits a prompt"), §8 row 16 ("`/wip`
// prints without a model turn (mocked command test)"); the owner's brief ("a `/factory` pane plus a
// `/wip` command (Builders | Reviews | Lock | PR queue) that answer status questions without a model
// turn") and ruling Q6, 5 Oct 2026 (read-only, no button that submits a prompt).
//
// Seams assumed: the mod registers the command with `$.command.register({ name: "wip", immediate:
// true, ... })` and answers it with a `command.run` hook returning `{ text }` without calling `next`
// (the plugin-authoring skill: "A hook's own answer without `next` runs no command"). Its data are
// the factory folder's files beside status.json (`<session root>/.private/work/factory/`). The
// band's word for a missing or off-contract status.json is "WATCHER DOWN" (hooks/text.js).
//
// Run: node --test 'tools/mod/vextrus-factory/tests/acceptance/ts14u2/*.test.mjs'

import assert from "node:assert/strict"
import { test } from "node:test"

import { POLL_MS, TABS, factoryFiles, lineOf, names, sectionsOf, status, world } from "./_world.mjs"

async function wip(files = factoryFiles()) {
  const w = await world({ files }).boot()
  const out = await w.command("wip")
  return { w, ...out }
}

test("/wip and /factory are registered as immediate slash commands for the orchestrator", async () => {
  const w = await world({ files: factoryFiles() }).boot()
  for (const name of ["wip", "factory"]) {
    const spec = w.registered.find((s) => s.name === name)
    assert.ok(spec, `$.command.register named ${name}, got ${JSON.stringify(w.registered)}`)
    assert.equal(spec.immediate, true, `/${name} runs at once, even mid-turn (immediate: true)`)
    assert.ok(typeof spec.description === "string" && spec.description.trim() !== "", `/${name} has a description`)
  }
})

test("/wip answers by itself: the engine's run is never called and no prompt, model, agent, tool or process call is made", async () => {
  const { w, result, text } = await wip()
  assert.ok(text.trim() !== "", `/wip prints text, got ${JSON.stringify(result)}`)
  assert.deepEqual(w.nexts, [], "the mod's own answer: next (the engine's run of the command) is not called")
  assert.deepEqual(w.forbidden(), [], "no call that submits a prompt, runs a model, an agent, a tool or a process, or writes")
})

test("/wip prints the sections Builders, Reviews, Lock and PR queue, in that order", async () => {
  const { text } = await wip()
  const s = sectionsOf(text)
  assert.ok(s, `each of ${TABS.join(", ")} starts a line, got:\n${text}`)
  assert.deepEqual(s.order, TABS, `in the order ${TABS.join(" | ")}, got:\n${text}`)
})

test("/wip's Builders section lists every builder on its own row with its state", async () => {
  const { text } = await wip()
  const builders = sectionsOf(text)?.Builders ?? ""
  const want = { "s14-a1": /ready/i, "s14-b2": /working/i, "s14-c3": /quiet/i, "s14-d4": /working/i, "s14-e5": /blocked/i }
  for (const [ticket, state] of Object.entries(want)) {
    const row = lineOf(builders, ticket)
    assert.ok(row, `a row for ${ticket} in Builders, got:\n${builders}`)
    assert.match(row, state, `${ticket}'s row shows its state ${state}, got ${JSON.stringify(row)}`)
  }
})

test("/wip's Reviews section lists each PR under review", async () => {
  const { text } = await wip()
  const reviews = sectionsOf(text)?.Reviews ?? ""
  for (const pr of ["250", "251"]) assert.match(reviews, new RegExp(`(^|[^0-9])${pr}(?![0-9])`), `PR ${pr} in Reviews, got:\n${reviews}`)
  assert.ok(!names(reviews, "s14-c3"), `Reviews holds no builder without a review, got:\n${reviews}`)
})

test("/wip shows the last review's cost from review-cost.jsonl", async () => {
  const { text } = await wip()
  assert.match(text, /\$0\.43\b/, `the last review's cost, got:\n${text}`)
})

test("/wip's Lock section shows the holder with its kind and every waiter", async () => {
  const { text } = await wip()
  const lock = sectionsOf(text)?.Lock ?? ""
  const holder = lineOf(lock, "s14-lk")
  assert.ok(holder, `the holder s14-lk in Lock, got:\n${lock}`)
  assert.match(lock, /\bpost\b/, `the holder's kind, got:\n${lock}`)
  for (const waiter of ["s14-wa", "loop-iou"]) assert.ok(names(lock, waiter), `the waiter ${waiter} in Lock, got:\n${lock}`)
})

test("/wip's Lock section says the lock is free when no one holds it", async () => {
  const files = { ...factoryFiles(), "status.json": JSON.stringify(status(undefined, { lock: { holder: null, waiters: [] } })) }
  const { text } = await wip(files)
  const lock = sectionsOf(text)?.Lock ?? ""
  assert.match(lock, /\bfree\b/i, `got:\n${lock}`)
  assert.ok(!names(lock, "s14-lk"), `no holder named, got:\n${lock}`)
})

test("/wip's PR queue lists the builders with an open PR and no other", async () => {
  const { text } = await wip()
  const queue = sectionsOf(text)?.["PR queue"] ?? ""
  for (const [ticket, pr] of [["s14-a1", "251"], ["s14-e5", "252"]]) {
    const row = lineOf(queue, ticket)
    assert.ok(row, `${ticket} in the PR queue, got:\n${queue}`)
    assert.match(row, new RegExp(`\\b${pr}\\b`), `${ticket}'s row names PR ${pr}, got ${JSON.stringify(row)}`)
  }
  for (const ticket of ["s14-b2", "s14-c3", "s14-d4"]) assert.ok(!names(queue, ticket), `${ticket} has no PR and is not queued, got:\n${queue}`)
})

test("/wip shows what the files say now: a builder that turned READY shows READY within one poll", async () => {
  const w = await world({ files: factoryFiles() }).boot()
  const moved = status(w.now, {})
  moved.builders.items = moved.builders.items.map((b) => (b.ticket === "s14-b2" ? { ...b, state: "ready", pr: 253 } : b))
  w.files["status.json"] = JSON.stringify(moved)
  await w.advance(POLL_MS)
  const { text } = await w.command("wip")
  const row = lineOf(sectionsOf(text)?.Builders ?? "", "s14-b2")
  assert.ok(row, `got:\n${text}`)
  assert.match(row, /ready/i, `s14-b2 is now ready, got ${JSON.stringify(row)}`)
})

test("/wip with no status.json prints WATCHER DOWN and answers by itself", async () => {
  const files = factoryFiles()
  delete files["status.json"]
  const { w, text } = await wip(files)
  assert.match(text, /WATCHER DOWN/, `got:\n${text}`)
  assert.deepEqual(w.nexts, [], "no engine run")
})

test("/wip with a crafted ticket name (a terminal escape and a line break) prints no control character and no forged row", async () => {
  const crafted = status()
  crafted.builders.items[0] = { ...crafted.builders.items[0], ticket: "s14-a1\u001b[2J\nFAKE READY" }
  const files = { ...factoryFiles(), "status.json": JSON.stringify(crafted) }
  const { w, text } = await wip(files)
  assert.ok(text.trim() !== "", `/wip still prints, got ${JSON.stringify(text)}`)
  assert.deepEqual(w.nexts, [], "no engine run")
  assert.ok(!/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029]/.test(text), `no control character, got ${JSON.stringify(text)}`)
  assert.ok(!text.split("\n").some((row) => /^\W*FAKE READY/.test(row)), `the crafted line break forges no row, got:\n${text}`)
})
