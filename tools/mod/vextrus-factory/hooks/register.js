// The vextrus-factory mod: the orchestrator's band above the prompt (docs/specs/factory.md §4(b)).
//
// Its only data: .private/work/factory/status.json (scripts/factory/watch.py writes it), read at
// session start and every 15 s with $.clock.every and $.fs.read. No $.process call. It intercepts
// nothing: it registers session.start and ui.render on AbovePrompt, and no other event.
//
// Walls for builders: it loads only through --plugin-dir (orchestrator.sh), builder.settings.json
// turns it off, and it reads, stores and draws nothing when CLAUDE_CODE_REMOTE is "true" or
// VEXTRUS_ROLE is not "orchestrator" (checked at start, at each read and at each draw). Each session
// where it activated is recorded in $.store under "activated".
//
// Every handler catches its own errors: a throw out of a hook could end the session.

import { bandRows, bandText, parseStatus } from "./text.js"

// "band" draws above the prompt (AbovePrompt); "status" is the verified fallback, $.ui.status(text).
const SURFACE = "band"
const POLL_MS = 15_000
const STATUS_REL = ".private/work/factory/status.json"
const READING = { plugin: "vextrus-factory", key: "reading" }

async function isOrchestrator($) {
  if ((await $.env.get("CLAUDE_CODE_REMOTE")) === "true") return false
  return (await $.env.get("VEXTRUS_ROLE")) === "orchestrator"
}

async function recordActivation($) {
  const id = await $.session.id()
  const held = await $.store.get("activated")
  const ids = Array.isArray(held) ? held.filter((x) => typeof x === "string") : []
  if (!ids.includes(id)) await $.store.set("activated", [...ids, id])
}

async function statusFile($) {
  try {
    return `${await $.session.root()}/${STATUS_REL}`
  } catch {
    return `${await $.session.cwd()}/${STATUS_REL}`
  }
}

// The module's own timer: a reload drops it with the old environment; a second session.start in
// the same environment cancels it before starting another, so one poll runs.
let timer = null

async function poll($, path) {
  try {
    if (!(await isOrchestrator($))) return
    let text = null
    try {
      const read = await $.fs.read(path)
      text = typeof read === "string" ? read : null
    } catch {
      text = null
    }
    await $.state.set(READING, { text })
    if (SURFACE === "status") {
      const { status, schema } = parseStatus(text)
      $.ui.status(bandText(status, await $.clock.now(), null, schema))
    }
  } catch {
    // never throw out of the poll
  }
}

export function register(on) {
  on("session.start", async ($, e, next) => {
    try {
      if (await isOrchestrator($)) {
        if (timer !== null) timer.cancel()
        timer = null
        // Its own try: a $.store failure must not stop the poll and the timer below.
        try {
          await recordActivation($)
        } catch {
          // the activation record is lost; the band still runs
        }
        const path = await statusFile($)
        await poll($, path)
        timer = $.clock.every(POLL_MS, () => {
          poll($, path)
        })
      }
    } catch {
      // never throw out of session.start
    }
    return next(e)
  })

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    let tree = null
    try {
      if (SURFACE === "band" && !e.props.hasSurvey && (await isOrchestrator($))) {
        const { value } = await $.state.get(READING)
        if (value !== undefined) {
          const { status, schema } = parseStatus(value.text)
          const rows = bandRows(status, await $.clock.now(), e.props.bodyColumns, schema)
          const { Box, Text } = $.ui.resolve(e)
          tree = h(Box, { flexDirection: "column" }, ...rows.map((row) => h(Text, null, row)))
        }
      }
    } catch {
      tree = null
    }
    return tree === null ? next(e) : tree
  })
}
