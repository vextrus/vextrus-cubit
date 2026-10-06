// Acceptance tests for ticket S14-U1 (the orchestrator's status line): it shows the WIP against the
// cap of 5, the last review's cost and the session's elapsed time against its budget.
// Written by the acceptance-writer before the build; the builder never changes this file.
//
// Authority: session 13's factory-next §5 item 2 ("Status line (exists): add WIP count against cap 5,
// reviews running, last review cost from `review-cost.jsonl`, elapsed/budget"), §8 row 10
// ("status-line WIP and cost fields"); the owner's brief, 5 Oct 2026 ("the status line (WIP against
// the cap, reviews running, the last review's cost, elapsed against budget)"). The status line is
// scripts/factory/statusline.mjs, the `statusLine` command scripts/factory/orchestrator.settings.json
// runs. Its files sit in the factory folder, `<workspace.project_dir>/.private/work/factory/`:
// status.json (status.schema.json), review-cost.jsonl (one JSON object per review, appended by
// `scripts.factory.review`; its cost is `total_cost_usd`) and session.json (the clock's data, in the
// form scripts/factory/stamp.py's `start` writes). "Reviews running" is already shown on main
// (`reviews #250 r1`, statusline.test.mjs S1) and is not pinned again here.
//
// Run: node --test 'tools/mod/vextrus-factory/tests/acceptance/ts14u1/*.test.mjs'

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { ROOT, T0, iso, status } from "./_world.mjs"

const SCRIPT = join(ROOT, "scripts/factory/statusline.mjs")

// A project folder whose factory folder holds `files` (name -> text).
function project(files) {
  const dir = mkdtempSync(join(tmpdir(), "s14u1-statusline-"))
  const factory = join(dir, ".private", "work", "factory")
  mkdirSync(factory, { recursive: true })
  for (const [name, text] of Object.entries(files)) writeFileSync(join(factory, name), text)
  return dir
}

// The status line's one line for that project at T0, as Claude Code runs it (payload on stdin).
function line(dir) {
  const payload = { hook_event_name: "Status", cwd: dir, workspace: { current_dir: dir, project_dir: dir }, context_window: { used_percentage: 42 } }
  const done = spawnSync(process.execPath, [SCRIPT], {
    cwd: dir,
    input: JSON.stringify(payload),
    env: { PATH: process.env.PATH ?? "", VEXTRUS_NOW: iso(T0) },
    encoding: "utf8",
    timeout: 10_000,
  })
  assert.equal(done.status, 0, `exit 0 (stderr: ${String(done.stderr).slice(0, 300)})`)
  assert.match(done.stdout, /^[^\n]+\n$/, `exactly one line, got ${JSON.stringify(done.stdout)}`)
  return done.stdout.slice(0, -1)
}

const cost = (usd, at, pr) =>
  JSON.stringify({ pr, head: "c09bb890b096f7306f688cc6d1dad34e7e52a223", round: 1, tier: "normal", verdict: "PASS", total_cost_usd: usd, at }) + "\n"

test("the status line shows the WIP against the cap: 3 cloud and 1 local builder working read WIP 4/5", () => {
  const text = line(project({ "status.json": JSON.stringify(status(T0)) }))
  assert.match(text, /WIP 4\/5/, `got ${JSON.stringify(text)}`)
})

test("the status line shows the last review's cost from review-cost.jsonl's last line", () => {
  const dir = project({
    "status.json": JSON.stringify(status(T0)),
    "review-cost.jsonl": cost(1.27, "2026-10-06T00:20:00Z", 470) + cost(0.43, "2026-10-06T00:50:00Z", 471),
  })
  const text = line(dir)
  assert.match(text, /\$0\.43\b/, `the last line's cost, got ${JSON.stringify(text)}`)
  assert.ok(!text.includes("1.27"), `not an earlier line's cost, got ${JSON.stringify(text)}`)
})

test("the status line shows elapsed against budget from the clock's session.json when status.json has no budget", () => {
  const session = {
    schema: 1,
    started_utc: iso(T0 - 76 * 60_000),
    budget_minutes: 300,
    state_file: "/repo/.private/work/session-14/STATE.md",
    phases: [],
  }
  const dir = project({ "status.json": JSON.stringify(status(T0)), "session.json": JSON.stringify(session) })
  const text = line(dir)
  assert.match(text, /\b1[:h]16\/5[:h]00\b/, `76 of 300 minutes, got ${JSON.stringify(text)}`)
  assert.ok(!text.includes("no budget"), `got ${JSON.stringify(text)}`)
})
