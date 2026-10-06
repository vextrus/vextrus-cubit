// Acceptance tests for ticket S14-U2 (the walls): `/wip`, the `/factory` pane and the spinner suffix
// are the orchestrator's alone, and nothing in the mod calls an API that submits a prompt, runs a
// model or runs a command.
// Written by the acceptance-writer before the build; the builder never changes this file.
//
// Authority: session 13's factory-next §5 ("local orchestrator terminal only, cloud sessions draw
// nothing"; "Mods are not sandboxed, so keep ours read-only"; item 5 "Read-only in v1; no button
// that submits a prompt (that would act around the guard)"); the owner's ruling Q6, 5 Oct 2026; the
// mod's own wall (hooks/register.js: it "reads, stores and draws nothing when CLAUDE_CODE_REMOTE is
// "true" or VEXTRUS_ROLE is not "orchestrator"").
//
// Each wall test first shows the orchestrator getting the feature in the same fixture, so a mod
// without the feature cannot pass it by drawing nothing for anyone.
//
// Run: node --test 'tools/mod/vextrus-factory/tests/acceptance/ts14u2/*.test.mjs'

import assert from "node:assert/strict"
import { test } from "node:test"

import { ENGINE_PANE, ENGINE_SUFFIX, factoryFiles, sectionsOf, sources, world } from "./_world.mjs"

const OTHERS = [
  ["a builder (VEXTRUS_ROLE=builder)", { VEXTRUS_ROLE: "builder" }],
  ["a session with no role", {}],
  ["a cloud session (CLAUDE_CODE_REMOTE=true)", { VEXTRUS_ROLE: "orchestrator", CLAUDE_CODE_REMOTE: "true" }],
]
const TICKETS = /s14-[a-e][1-5]|s14-lk|loop-iou/

// The orchestrator gets all three: /wip's sections, the pane, the spinner suffix.
async function orchestratorGetsThem() {
  const w = await world({ files: factoryFiles() }).boot()
  const wip = await w.command("wip")
  assert.ok(sectionsOf(wip.text), `the orchestrator's /wip prints its sections, got:\n${wip.text}`)
  await w.command("factory")
  const id = w.opened.at(-1)?.id
  assert.ok(id, "the orchestrator's /factory opens the pane")
  assert.match((await w.pane(id)).text, TICKETS, "the orchestrator's pane names the builders")
  assert.match((await w.spinner()).text, /\b1[:h]16\/5[:h]00\b/, "the orchestrator's spinner shows elapsed/budget")
  return id
}

for (const [who, env] of OTHERS) {
  test(`${who} gets no /wip, no /factory pane and the engine's own spinner, and reads no factory file`, async () => {
    const id = await orchestratorGetsThem()
    const w = await world({ env, files: factoryFiles() }).boot()
    const mine = w.registered.filter((s) => s.name === "wip" || s.name === "factory")
    assert.deepEqual(mine, [], `${who}: neither command is registered`)
    const wip = await w.command("wip")
    assert.doesNotMatch(wip.text, TICKETS, `${who}: /wip prints no factory state`)
    await w.command("factory")
    assert.deepEqual(w.opened, [], `${who}: no pane opens`)
    assert.equal((await w.pane(id)).text, ENGINE_PANE, `${who}: the engine draws the pane site`)
    const spin = await w.spinner()
    assert.equal(spin.text, `Sauteing${ENGINE_SUFFIX}`, `${who}: the engine's spinner, got ${JSON.stringify(spin.text)}`)
    assert.deepEqual(w.factoryReads(), [], `${who}: no factory file is read`)
    assert.deepEqual(w.forbidden(), [], `${who}: no forbidden call`)
  })
}

// The mod's own source: no call through `$` (or any name) to an API that submits a prompt, fills
// the prompt box, sends into the session, runs a model, an agent, a tool, a command, a process, the
// network, or writes a file. `on("command.run", ...)`, a hook, is not a call.
const FORBIDDEN_SOURCE = [
  /\.\s*prompt\s*\.\s*(submit|fill|suggest)\b/,
  /\.\s*session\s*\.\s*(send|append|compact)\b/,
  /\.\s*model\s*\.\s*(complete|fork|classify)\b/,
  /\.\s*agent\s*\.\s*spawn\b/,
  /\.\s*tool\s*\.\s*call\b/,
  /\.\s*command\s*\.\s*run\b/,
  /\.\s*turn\s*\.\s*abort\b/,
  /\.\s*process\s*\.\s*(run|spawn)\b/,
  /\.\s*http\s*\.\s*fetch\b/,
  /\.\s*mcp\s*\.\s*(call|connect)\b/,
  /\.\s*fs\s*\.\s*write\b/,
  /\bfetch\s*\(/,
]

test("the mod hooks /wip, /factory, the pane and the spinner, and its source calls no prompt, model or command-running API", async () => {
  const w = await world({ files: factoryFiles() }).boot()
  const hooked = (event, key, value) => w.hooks.some((x) => x.event === event && (x.matcher === undefined || x.matcher[key] === undefined || x.matcher[key] === value))
  assert.ok(w.hooks.some((x) => x.event === "command.run"), "a command.run hook (for /wip and /factory)")
  assert.ok(w.registered.some((s) => s.name === "wip") && w.registered.some((s) => s.name === "factory"), `both commands registered, got ${JSON.stringify(w.registered)}`)
  assert.ok(w.hooks.some((x) => x.event === "ui.render" && x.matcher?.component === "Pane"), "a ui.render hook on Pane")
  assert.ok(w.hooks.some((x) => x.event === "ui.render" && x.matcher?.component === "Spinner"), "a ui.render hook on Spinner")
  assert.ok(hooked("command.run", "command", "wip"), "the command.run hook answers wip")
  const files = sources()
  assert.ok(files.length > 0, "the mod's sources were read")
  const found = []
  for (const { name, text } of files) {
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
    for (const re of FORBIDDEN_SOURCE) {
      const m = re.exec(code)
      if (m) found.push(`${name}: ${m[0]}`)
    }
  }
  assert.deepEqual(found, [], "no forbidden call in the mod's source")
})
