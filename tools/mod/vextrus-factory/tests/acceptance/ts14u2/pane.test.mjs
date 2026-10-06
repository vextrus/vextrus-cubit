// Acceptance tests for ticket S14-U2 (the `/factory` pane): four tabs, Builders | Reviews | Lock |
// PR queue, each drawing the factory's state from its files; switching tabs is local UI only, and
// no Button in the pane submits a prompt or runs anything.
// Written by the acceptance-writer before the build; the builder never changes this file.
//
// Authority: session 13's factory-next §5 item 5 ("`/factory` pane and `/wip` command (U2,
// `immediate: true`): tabs Builders | Reviews | Lock | PR queue; each row ticket, state, age, next
// action ... Read-only in v1; no button that submits a prompt (that would act around the guard)"),
// §8 row 16 ("pane tabs render fixture state"); the owner's ruling Q6, 5 Oct 2026 (read-only, no
// button that submits a prompt).
//
// Seams assumed: `/factory` (a `command.run` hook) opens the pane with `$.ui.open({ id, title })` and
// answers `{ text }` itself; the pane is drawn by a `ui.render` hook on `{ component: "Pane",
// requestId: id }`; each tab is a Button in the pane whose label is the tab's name (a hotkey digit
// beside it is allowed), and pressing it redraws the pane on that tab (state the hook reads).
//
// Run: node --test 'tools/mod/vextrus-factory/tests/acceptance/ts14u2/*.test.mjs'

import assert from "node:assert/strict"
import { test } from "node:test"

import { ENGINE_PANE, POLL_MS, TABS, buttons, factoryFiles, lineOf, names, status, tabButton, world } from "./_world.mjs"

// The orchestrator's world with /factory run: { w, id, opened }.
async function opened(files = factoryFiles()) {
  const w = await world({ files }).boot()
  const before = w.opened.length
  const out = await w.command("factory")
  const mine = w.opened.slice(before)
  const id = (mine.at(-1) ?? w.opened.at(-1))?.id
  return { w, id, out }
}

// The pane drawn after pressing the tab `name`.
async function onTab(w, id, name) {
  const first = await w.pane(id)
  const button = tabButton(first.tree, name)
  assert.ok(button, `a Button labelled ${name} in the pane, got ${JSON.stringify(buttons(first.tree).map((b) => b.label))}`)
  await w.press(button, id)
  return w.pane(id)
}

test("/factory opens one pane and answers by itself, with no engine run and no forbidden call", async () => {
  const { w, id, out } = await opened()
  assert.ok(typeof id === "string" && id !== "", `$.ui.open({ id }) was called, got ${JSON.stringify(w.opened)}`)
  assert.equal(new Set(w.opened.map((p) => p.id)).size, 1, `one pane, got ${JSON.stringify(w.opened)}`)
  assert.deepEqual(w.nexts, [], "the mod's own answer: next (the engine's run of the command) is not called")
  assert.ok(out.result && typeof out.result === "object", "a command.run result")
  assert.deepEqual(w.forbidden(), [], "no call that submits a prompt, runs a model, an agent, a tool or a process, or writes")
})

test("the pane shows the four tabs Builders, Reviews, Lock and PR queue, in that order, as Buttons", async () => {
  const { w, id } = await opened()
  const { tree, text } = await w.pane(id)
  assert.ok(!text.includes(ENGINE_PANE), `the mod draws the pane, got:\n${text}`)
  const found = TABS.map((name) => tabButton(tree, name))
  assert.ok(found.every(Boolean), `a Button per tab, got ${JSON.stringify(buttons(tree).map((b) => b.label))}`)
  const order = buttons(tree).map((b) => b.node)
  const at = found.map((b) => order.indexOf(b.node))
  assert.deepEqual([...at].sort((a, b) => a - b), at, `in the order ${TABS.join(" | ")}`)
})

test("the Builders tab lists every builder with its state", async () => {
  const { w, id } = await opened()
  const { text } = await onTab(w, id, "Builders")
  const want = { "s14-a1": /ready/i, "s14-b2": /working/i, "s14-c3": /quiet/i, "s14-d4": /working/i, "s14-e5": /blocked/i }
  for (const [ticket, state] of Object.entries(want)) {
    const row = lineOf(text, ticket)
    assert.ok(row, `a row for ${ticket}, got:\n${text}`)
    assert.match(row, state, `${ticket}'s row shows its state, got ${JSON.stringify(row)}`)
  }
  for (const other of ["s14-lk", "loop-iou"]) assert.ok(!names(text, other), `the Lock tab's ${other} is not on Builders, got:\n${text}`)
})

test("the Reviews tab lists each PR under review and not the builders", async () => {
  const { w, id } = await opened()
  const { text } = await onTab(w, id, "Reviews")
  for (const pr of ["250", "251"]) assert.match(text, new RegExp(`(^|[^0-9])${pr}(?![0-9])`), `PR ${pr}, got:\n${text}`)
  for (const other of ["s14-c3", "s14-d4", "loop-iou"]) assert.ok(!names(text, other), `${other} is not on Reviews, got:\n${text}`)
})

test("the Lock tab shows the holder with its kind and every waiter, and not the builders", async () => {
  const { w, id } = await opened()
  const { text } = await onTab(w, id, "Lock")
  assert.ok(names(text, "s14-lk"), `the holder, got:\n${text}`)
  assert.match(text, /\bpost\b/, `the holder's kind, got:\n${text}`)
  for (const waiter of ["s14-wa", "loop-iou"]) assert.ok(names(text, waiter), `the waiter ${waiter}, got:\n${text}`)
  for (const other of ["s14-b2", "s14-c3", "s14-d4"]) assert.ok(!names(text, other), `${other} is not on Lock, got:\n${text}`)
})

test("the PR queue tab lists the builders with an open PR and no other", async () => {
  const { w, id } = await opened()
  const { text } = await onTab(w, id, "PR queue")
  for (const [ticket, pr] of [["s14-a1", "251"], ["s14-e5", "252"]]) {
    const row = lineOf(text, ticket)
    assert.ok(row, `${ticket} queued, got:\n${text}`)
    assert.match(row, new RegExp(`\\b${pr}\\b`), `${ticket}'s row names PR ${pr}, got ${JSON.stringify(row)}`)
  }
  for (const other of ["s14-b2", "s14-c3", "s14-d4", "loop-iou"]) assert.ok(!names(text, other), `${other} is not queued, got:\n${text}`)
})

test("switching tabs is local UI only: a press reads no file and calls nothing but the mod's state and the pane's redraw", async () => {
  const { w, id } = await opened()
  for (const name of [...TABS, "Builders"]) {
    const { tree } = await w.pane(id)
    const button = tabButton(tree, name)
    assert.ok(button, `the ${name} tab`)
    const before = w.calls.length
    const nextsBefore = w.nexts.length
    await w.press(button, id)
    const made = w.calls.slice(before).map((c) => c.name)
    const local = /^(state\.(get|set)|ui\.(invalidate|focus|scroll)|clock\.now|env\.get)$/
    assert.deepEqual(made.filter((n) => !local.test(n)), [], `pressing ${name} calls only state and redraw, got ${JSON.stringify(made)}`)
    assert.equal(w.nexts.length, nextsBefore, "no command runs")
  }
  const back = await w.pane(id)
  assert.ok(names(back.text, "s14-c3"), `back on Builders, got:\n${back.text}`)
})

test("no Button in the pane, on any tab, submits a prompt or runs a model, an agent, a tool, a command or a process", async () => {
  const { w, id } = await opened()
  for (const name of TABS) {
    const { tree } = await onTab(w, id, name)
    for (const button of buttons(tree)) await w.press(button, id)
  }
  assert.deepEqual(w.forbidden(), [], "no forbidden call")
  assert.deepEqual(w.nexts, [], "no command runs")
})

test("the pane draws what the files say now: a builder that turned READY shows READY on Builders within one poll", async () => {
  const { w, id } = await opened()
  await onTab(w, id, "Builders")
  const moved = status(w.now, {})
  moved.builders.items = moved.builders.items.map((b) => (b.ticket === "s14-b2" ? { ...b, state: "ready", pr: 253 } : b))
  w.files["status.json"] = JSON.stringify(moved)
  await w.advance(POLL_MS)
  const { text } = await w.pane(id)
  const row = lineOf(text, "s14-b2")
  assert.ok(row, `got:\n${text}`)
  assert.match(row, /ready/i, `s14-b2 is now ready, got ${JSON.stringify(row)}`)
})

test("the pane with no status.json says WATCHER DOWN", async () => {
  const files = factoryFiles()
  delete files["status.json"]
  const { w, id } = await opened(files)
  const { text } = await w.pane(id)
  assert.match(text, /WATCHER DOWN/, `got:\n${text}`)
})

test("the pane with a crafted ticket name (a terminal escape and a line break) draws no control character and no forged row", async () => {
  const crafted = status()
  crafted.builders.items[0] = { ...crafted.builders.items[0], ticket: "s14-a1\u001b[2J\nFAKE READY" }
  const { w, id } = await opened({ ...factoryFiles(), "status.json": JSON.stringify(crafted) })
  const { text } = await onTab(w, id, "Builders")
  assert.ok(names(text, "s14-c3"), `the other builders still show, got:\n${text}`)
  assert.ok(!/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029]/.test(text), `no control character, got ${JSON.stringify(text)}`)
  assert.ok(!text.split("\n").some((row) => /^\W*FAKE READY/.test(row)), `the crafted line break forges no row, got:\n${text}`)
})
