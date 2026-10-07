// Acceptance tests for ticket S14-U1 (the mod's toasts): a line in events.log that the owner must act
// on raises exactly one toast, and the mod only shows it: it submits no prompt and runs no model.
// Written by the acceptance-writer before the build; the builder never changes this file.
//
// Authority: the owner's brief, 5 Oct 2026 ("toasts for anything the owner must act on (a ruling, a
// `!` command)"); the owner's ruling Q6, 5 Oct 2026 ("the mods UI stays read-only, no button that
// submits a prompt"); session 13's factory-next §5 item 4 ("owner action: run `! <command>`").
// The kinds OWNER-COMMAND (the detail is the `!` command to run) and OWNER-RULING (the detail names
// the ruling asked) are this ticket's, defined here; the line is watch.py's
// `<UTC> <KIND> <ticket|-> <detail>`. Toasts are `$.ui.toast(text)`.
//
// Run: node --test 'tools/mod/vextrus-factory/tests/acceptance/ts14u1/*.test.mjs'

import assert from "node:assert/strict"
import { test } from "node:test"

import { FORBIDDEN, POLL_MS, T0, eventLine, status, world } from "./_world.mjs"

const STATUS = JSON.stringify(status(T0))
const ROUTINE = eventLine(T0 - 600_000, "PUSH", "s14-p0", "a1b2c3d") + eventLine(T0 - 590_000, "COMMIT", "s14-k0", "local head e4f5a6b")

// Starts the orchestrator's mod on a log of routine lines, appends `lines` and runs one poll.
async function afterOnePoll(lines) {
  const w = world({ files: { "status.json": STATUS, "events.log": ROUTINE } })
  await w.load()
  await w.start()
  w.append("events.log", lines)
  await w.advance(POLL_MS)
  return w
}

// Four more polls, then a reload of the mod (a fresh module, the host's state and store kept) and two polls.
async function laterAndReloaded(w) {
  await w.advance(POLL_MS * 4)
  await w.load()
  await w.start()
  await w.advance(POLL_MS * 2)
}

test("an OWNER-COMMAND line raises exactly one toast carrying the command, through polls and a reload", async () => {
  const command = "! gh auth refresh -s project"
  const w = await afterOnePoll(
    eventLine(T0 + 1_000, "PUSH", "s14-p1", "push 9f8e7d6") +
      eventLine(T0 + 2_000, "COMMIT", "s14-k1", "local head 1a2b3c4") +
      eventLine(T0 + 3_000, "OWNER-COMMAND", "-", command),
  )
  assert.equal(w.toasts.length, 1, `one toast after one poll (PUSH and COMMIT raise none), got ${JSON.stringify(w.toasts)}`)
  assert.ok(w.toasts[0].includes(command), `the toast carries the command, got ${JSON.stringify(w.toasts[0])}`)
  await laterAndReloaded(w)
  assert.equal(w.toasts.length, 1, `still one toast after more polls and a reload, got ${JSON.stringify(w.toasts)}`)
})

test("an OWNER-RULING line raises exactly one toast carrying the ruling asked, through polls and a reload", async () => {
  const ruling = "Q21 the pane's tabs"
  const w = await afterOnePoll(eventLine(T0 + 3_000, "OWNER-RULING", "s14-u2", ruling))
  assert.equal(w.toasts.length, 1, `one toast after one poll, got ${JSON.stringify(w.toasts)}`)
  assert.ok(w.toasts[0].includes(ruling), `the toast carries the ruling, got ${JSON.stringify(w.toasts[0])}`)
  await laterAndReloaded(w)
  assert.equal(w.toasts.length, 1, `still one toast after more polls and a reload, got ${JSON.stringify(w.toasts)}`)
})

test("the owner's command is shown as a toast and never acted on: no prompt submitted, no model, agent, tool or process run", async () => {
  const command = "! uv run python -m scripts.factory.governor check cloud-session"
  const w = await afterOnePoll(
    eventLine(T0 + 1_000, "READY", "s14-r1", "Factory-Verify ok") +
      eventLine(T0 + 2_000, "OWNER-RULING", "s14-u2", "Q22 cut U2") +
      eventLine(T0 + 3_000, "OWNER-COMMAND", "-", command),
  )
  for (const columns of [40, 200]) await w.band(columns)
  await laterAndReloaded(w)
  await w.band(200)
  assert.ok(w.toasts.some((t) => t.includes(command)), `the command is toasted, got ${JSON.stringify(w.toasts)}`)
  const made = w.calls.map((c) => c.name).filter((name) => FORBIDDEN.includes(name))
  assert.deepEqual(made, [], "the mod calls nothing that submits a prompt or runs a model, an agent, a tool or a process")
})
