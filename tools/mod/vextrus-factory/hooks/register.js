// The vextrus-factory mod: the orchestrator's band above the prompt (docs/specs/factory.md §4(b)).
//
// Its only data: .private/work/factory/status.json and events.log (scripts/factory/watch.py writes
// them), read at session start and every 15 s with $.clock.every and $.fs.read. The band shows the
// summary, one row per live ticket and the newest high-signal events; an OWNER-COMMAND or OWNER-RULING
// line raises one toast from the poll. Its one acting call is the wake (the owner's ruling Q-R4, 13 Oct
// 2026, which lifts Q6's read-only for exactly this): from the poll, one batched, rate-capped
// $.prompt.submit({ text }), framed as this plugin's message (wake.js decides; text.js words it). No
// model, agent, tool or $.process call. It intercepts nothing: it registers session.start and
// ui.render on AbovePrompt, and no other event (no prompt.* hook).
//
// Walls for builders: it loads only through --plugin-dir (orchestrator.sh), builder.settings.json
// turns it off, and it reads, stores and draws nothing when CLAUDE_CODE_REMOTE is "true" or
// VEXTRUS_ROLE is not "orchestrator" (checked at start, at each read and at each draw). Each session
// where it activated is recorded in $.store under "activated".
//
// Every handler catches its own errors: a throw out of a hook could end the session.

import { TABS, VERDICTS, budgetText, factoryView, lastCost, sessionBudget, verdictKey, wipText } from "./factory.js"
import { OWNER_KINDS, bandEvents, bandRows, bandText, eventRow, fitRow, oneLine, parseEvents, parseStatus, ticketRows, toastText, wakeText } from "./text.js"
import { advance, giveBack, readWake } from "./wake.js"

// "band" draws above the prompt (AbovePrompt); "status" is the verified fallback, $.ui.status(text).
const SURFACE = "band"
const POLL_MS = 15_000
const STATUS_REL = ".private/work/factory/status.json"
const EVENTS_REL = ".private/work/factory/events.log"
// The host's $.fs.read rejects a file over 4 MiB and events.log only grows: a log over this size is
// not read; watch.py leaves its tail in events.tail (the last 200 lines the mod shows or toasts).
const TAIL_REL = ".private/work/factory/events.tail"
const LOG_READ_MAX = 1024 * 1024
// /wip and /factory (S14-U2) and the spinner's elapsed/budget read these beside status.json.
const COST_REL = ".private/work/factory/review-cost.jsonl"
const SESSION_REL = ".private/work/factory/session.json"
const SESSION_MAX = 64 * 1024
// A ledger record (scripts/ledger.py) is `<pr>-<head>.json`; at most this many listed reviews are read.
const LEDGER_REL = ".private/work/factory/ledger"
const RECORD_MAX = 16 * 1024
const REVIEWS_MAX = 20
const PANE = "factory"
const READING = { plugin: "vextrus-factory", key: "reading" }
const EVENTS = { plugin: "vextrus-factory", key: "events" }
const SESSION = { plugin: "vextrus-factory", key: "session" }
const COST = { plugin: "vextrus-factory", key: "cost" }
const VERDICTS_REF = { plugin: "vextrus-factory", key: "verdicts" }
const TAB = { plugin: "vextrus-factory", key: "tab" }
// The band's view of the wake: { capped } (a due wake held by the hourly cap).
const WAKE = { plugin: "vextrus-factory", key: "wake" }
// The wake's own memory in $.store (cursor, held lines, per-ticket PUSH times, the hour's wakes): a
// reload or a restart never wakes again for a line already sent, and the cap holds across both.
const WAKE_STORE = "wake"
export const CAPPED_WORDS = "wakes capped"
// A toast is raised for an owner-action line at most this old, and its line is remembered in the
// store (across polls, reloads and sessions) so it is raised once.
const TOAST_WINDOW_MS = 6 * 3_600_000
const TOASTED_KEEP = 200

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

async function factoryFile($, rel) {
  try {
    return `${await $.session.root()}/${rel}`
  } catch {
    return `${await $.session.cwd()}/${rel}`
  }
}

async function readText($, path) {
  try {
    const read = await $.fs.read(path)
    return typeof read === "string" ? read : null
  } catch {
    return null
  }
}

// A file of at most `max` bytes as text, else null (missing, too large, unreadable).
async function readSmall($, path, max) {
  try {
    const { size } = await $.fs.stat(path)
    return typeof size === "number" && size <= max ? await readText($, path) : null
  } catch {
    return null
  }
}

async function factoryPaths($) {
  return {
    status: await factoryFile($, STATUS_REL),
    events: await factoryFile($, EVENTS_REL),
    tail: await factoryFile($, TAIL_REL),
    cost: await factoryFile($, COST_REL),
    session: await factoryFile($, SESSION_REL),
    ledger: await factoryFile($, LEDGER_REL),
  }
}

// The verdicts of the status's listed reviews, each from its ledger record `<pr>-<head>.json`:
// { "<pr>-<head>": "PASS" | "FIX" | "BLOCK" }. A record that is missing or off-form is left out.
async function readVerdicts($, paths, text) {
  const out = {}
  const { status } = parseStatus(text)
  const listed = status === null ? [] : status.reviews.slice(0, REVIEWS_MAX)
  for (const r of listed) {
    if (typeof r.head !== "string" || !/^[0-9a-f]{40}$/.test(r.head)) continue
    const record = await readSmall($, `${paths.ledger}/${verdictKey(r.pr, r.head)}.json`, RECORD_MAX)
    try {
      const verdict = record === null ? null : JSON.parse(record).verdict
      if (VERDICTS.includes(verdict)) out[verdictKey(r.pr, r.head)] = verdict
    } catch {
      // off-form record: no verdict
    }
  }
  return out
}

// The events text: events.log while it is small, else events.tail. { text: null, unreadable: true }
// when the log exists and neither can be read; { text: null } when there is no log at all.
async function readEvents($, paths) {
  let size = null
  try {
    size = (await $.fs.stat(paths.events)).size
  } catch {
    size = null
  }
  if (size !== null && size <= LOG_READ_MAX) {
    const text = await readText($, paths.events)
    if (text !== null) return { text, unreadable: false }
  }
  const tail = await readText($, paths.tail)
  if (tail !== null) return { text: tail, unreadable: false }
  return { text: null, unreadable: size !== null }
}

// Raises one toast for each owner-action line not raised before. The line is stored first: a toast
// lost to a failed store write is better than one raised again on every poll.
async function toastOwnerLines($, text, nowMs) {
  const held = await $.store.get("toasted")
  const seen = Array.isArray(held) ? held.filter((x) => typeof x === "string") : []
  const fresh = parseEvents(text, OWNER_KINDS).filter(
    (e) => !seen.includes(e.line) && nowMs - Date.parse(e.at) <= TOAST_WINDOW_MS,
  )
  if (fresh.length === 0) return
  const lines = [...new Set(fresh.map((e) => e.line))]
  await $.store.set("toasted", [...seen, ...lines].slice(-TOASTED_KEEP))
  const raised = new Set()
  for (const e of fresh) {
    if (raised.has(e.line)) continue
    raised.add(e.line)
    $.ui.toast(toastText(e))
  }
}

// A submitted wake waits until the session is idle; the engine resolves its promise as its turn
// starts. Until then no second wake is submitted: the lines are held for the next one. A wake whose
// submit failed gives its lines back to the next poll.
// A wake still waiting after WAIT_MAX_MS no longer holds the next (the cap still does): a submit the
// engine never starts must not stop every later wake.
const WAIT_MAX_MS = 30 * 60_000
let waitingSince = null
let givenBack = []
// The hour's wake times as this module last stored them: a store that reads back off-form must not
// reset the cap (it is the loop guard).
let sentMemory = []

async function wake($, log, unreadable, statusText) {
  const nowMs = await $.clock.now()
  let held = readWake(await $.store.get(WAKE_STORE))
  held = { ...held, sentAt: [...new Set([...held.sentAt, ...sentMemory])] }
  if (givenBack.length > 0) {
    held = giveBack(held, givenBack)
    givenBack = []
  }
  // No events.log yet: every line it later gets is news. An unreadable one is not read as empty.
  const read = log === null && !unreadable ? "" : log
  const waiting = waitingSince !== null && nowMs - waitingSince < WAIT_MAX_MS
  const { state, lines, capped } = advance(held, read, nowMs, waiting)
  sentMemory = state.sentAt
  // Stored before the submit: a failed write submits nothing, so no line is sent twice.
  await $.store.set(WAKE_STORE, state)
  await $.state.set(WAKE, { capped })
  if (lines === null) return
  const { status, schema } = parseStatus(statusText)
  const text = wakeText(lines, status, nowMs, schema)
  waitingSince = nowMs
  let sent
  try {
    sent = Promise.resolve($.prompt.submit({ text }))
  } catch (error) {
    sent = Promise.reject(error)
  }
  // Never awaited: the poll goes on while the wake waits for the session to be idle.
  sent.then(
    () => {
      waitingSince = null
    },
    () => {
      waitingSince = null
      givenBack.push(...lines)
    },
  )
}

// The module's own timer: a reload drops it with the old environment; a second session.start in
// the same environment cancels it before starting another, so one poll runs.
let timer = null

let polling = false

async function poll($, paths) {
  if (polling) return
  polling = true
  try {
    if (!(await isOrchestrator($))) return
    const text = await readText($, paths.status)
    const { text: log, unreadable } = await readEvents($, paths)
    await $.state.set(READING, { text })
    await $.state.set(EVENTS, { events: bandEvents(log), unreadable })
    await $.state.set(SESSION, { text: await readSmall($, paths.session, SESSION_MAX) })
    await $.state.set(VERDICTS_REF, { byReview: await readVerdicts($, paths, text) })
    await $.state.set(COST, { usd: lastCost(await readSmall($, paths.cost, LOG_READ_MAX)) })
    if (SURFACE === "status") {
      const { status, schema } = parseStatus(text)
      $.ui.status(bandText(status, await $.clock.now(), null, schema))
    }
    if (log !== null) await toastOwnerLines($, log, await $.clock.now())
    await wake($, log, unreadable, text)
  } catch {
    // never throw out of the poll
  } finally {
    polling = false
  }
}

// The four tabs from the poll's last readings, drawn at the clock's now.
async function currentView($) {
  const held = (await $.state.get(READING)).value
  const { status, schema } = parseStatus(held === undefined ? null : held.text)
  const cost = (await $.state.get(COST)).value
  const verdicts = (await $.state.get(VERDICTS_REF)).value
  return factoryView(status, await $.clock.now(), schema, cost === undefined ? null : cost.usd, verdicts === undefined ? {} : verdicts.byReview)
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
        const paths = await factoryPaths($)
        try {
          await $.command.register({ name: "wip", description: "Print the factory's builders, reviews, lock and PR queue (no model turn)", immediate: true })
          await $.command.register({ name: "factory", description: "Open the factory pane: Builders | Reviews | Lock | PR queue", immediate: true })
        } catch {
          // the commands are lost; the band still runs
        }
        await poll($, paths)
        timer = $.clock.every(POLL_MS, () => {
          poll($, paths)
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
          const held = (await $.state.get(EVENTS)).value
          const events = held !== undefined && Array.isArray(held.events) ? held.events : []
          const unreadable = held !== undefined && held.unreadable === true
          const now = await $.clock.now()
          const tickets = ticketRows(status, now, e.props.bodyColumns)
          const all = [...rows, ...tickets, ...events.map((event) => eventRow(event, e.props.bodyColumns))]
          if (unreadable) all.push(fitRow("events: unreadable", e.props.bodyColumns))
          const woke = (await $.state.get(WAKE)).value
          if (woke !== undefined && woke.capped === true) all.push(fitRow(CAPPED_WORDS, e.props.bodyColumns))
          tree = h(Box, { flexDirection: "column" }, ...all.map((row) => h(Text, null, row)))
        }
      }
    } catch {
      tree = null
    }
    return tree === null ? next(e) : tree
  })

  // /wip: the four sections as text, from the files as of now. It answers itself (no `next`: the
  // engine's own run of a plugin command is a model turn) and calls nothing that submits or runs.
  on("command.run", { command: "wip" }, async ($, e, next) => {
    try {
      if (!(await isOrchestrator($))) return next(e)
      await poll($, await factoryPaths($))
      return { text: wipText(await currentView($)) }
    } catch {
      return { text: "WATCHER DOWN" }
    }
  })

  on("command.run", { command: "factory" }, async ($, e, next) => {
    try {
      if (!(await isOrchestrator($))) return next(e)
      await poll($, await factoryPaths($))
      const opened = await $.ui.open({ id: PANE, title: "Factory" })
      const placed = opened === undefined || opened === null || opened.isPlaced !== false
      return { text: placed ? "Factory pane opened." : "Factory pane opened; it shows when the window is wide enough." }
    } catch {
      return { text: "The factory pane could not open." }
    }
  })

  // The pane: one tab row (Buttons that change only the local tab value) and the tab's rows.
  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e, next) => {
    let tree = null
    try {
      if (await isOrchestrator($)) {
        const view = await currentView($)
        const held = (await $.state.get(TAB)).value
        const tab = held !== undefined && TABS.includes(held.name) ? held.name : TABS[0]
        const { Box, Text, Button } = $.ui.resolve(e)
        const columns = e.props.bodyColumns
        const tabs = TABS.map((name, i) => {
          const props = { label: name, hotkey: String(i + 1), onPress: () => $.state.set(TAB, { name }) }
          if (name === tab) props.variant = "primary"
          return h(Button, props)
        })
        const rows = view.tabs[tab].map((row) => h(Text, null, fitRow(row, columns)))
        const head = view.down === null ? [] : [h(Text, { bold: true }, fitRow(view.down, columns))]
        const foot = view.age === null ? [] : [h(Text, { dimColor: true }, fitRow(`status ${view.age}m old`, columns))]
        tree = h(Box, { flexDirection: "column" }, h(Box, { flexDirection: "row", gap: 1 }, ...tabs), ...head, ...rows, ...foot)
      }
    } catch {
      tree = null
    }
    return tree === null ? next(e) : tree
  })

  // The spinner: its word stays; the suffix gains the session's elapsed/budget from session.json.
  // A missing or broken session.json leaves the engine's own spinner.
  on("ui.render", { component: "Spinner" }, async ($, e, next) => {
    try {
      if (await isOrchestrator($)) {
        const held = (await $.state.get(SESSION)).value
        const budget = held === undefined ? null : sessionBudget(held.text, await $.clock.now())
        if (budget !== null) return next({ ...e, props: { ...e.props, suffix: oneLine(`${e.props.suffix} ${budgetText(budget)}`) } })
      }
    } catch {
      // the engine's own spinner
    }
    return next(e)
  })
}
