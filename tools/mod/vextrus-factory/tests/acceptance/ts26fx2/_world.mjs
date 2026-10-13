// The mock world for ticket S26-FX2's acceptance tests (the factory mod's wake): ts14u1's world (a
// hand-made `$` standing for Claude Code's engine, the mod run under plain `node --test`) with one
// answer more, `$.prompt.submit`, the one call the owner's ruling Q-R4 (13 Oct 2026) gives the mod:
// "The factory mod may submit one batched, rate-capped wake prompt into the orchestrator's session".
// Written by the acceptance-writer before the build; the builder never changes this file.
//
// `$.prompt.submit({ text })` is recorded in `world.submits` and, as the engine's does (the types of
// 2.1.296: "a turn of its own, once the session is idle"; "the call resolves as that turn starts"),
// its promise stays unresolved until the test says the session went idle and the turn started:
// `world.idle()` resolves every submit made so far with `{ text }`. Everything else is ts14u1's:
// `$.state` and `$.store` survive `load()` (a reload), the clock moves only with `advance(ms)`, the
// factory folder is `/repo/.private/work/factory/` (`world.files`), `world.band(columns)` draws the
// AbovePrompt band into terminal lines, and every `$` call is in `world.calls`.
//
// The events.log line format is scripts/factory/watch.py's: `<UTC> <KIND> <ticket|-> <detail>`.

import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const MOD = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
export const ROOT = resolve(MOD, "../../..")
export const PLUGIN = "vextrus-factory"
export const FACTORY = "/repo/.private/work/factory"
export const POLL_MS = 15_000
export const ENGINE_BAND = "engine-band-sentinel"
export const T0 = Date.parse("2026-10-13T01:00:00Z")
export const WAKE_END = "Act on these; no Monitor is needed."

// Calls that put words in the owner's prompt box or transcript, run a model, start an agent, a
// tool, a command or a process, end a turn, or reach the network: none is the mod's. Its one prompt
// is `$.prompt.submit`, the wake (Q-R4), counted on its own in `world.submits`.
export const FORBIDDEN = [
  "prompt.fill",
  "prompt.suggest",
  "session.send",
  "session.append",
  "session.compact",
  "model.complete",
  "model.fork",
  "model.classify",
  "agent.spawn",
  "tool.call",
  "command.run",
  "turn.abort",
  "process.run",
  "process.spawn",
  "http.fetch",
  "mcp.call",
]

export function iso(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z")
}

// One events.log line, watch.py's form.
export function eventLine(ms, kind, ticket, detail) {
  return `${iso(ms)} ${kind} ${ticket} ${detail}\n`
}

export const HEAD_D1 = "4596e870a1b2c3d4e5f60718293a4b5c6d7e8f90"
export const HEAD_D2 = "0e361a97b1c2d3e4f5a60718293a4b5c6d7e8f91"
export const HEAD_L1 = "2a4cca8ac1d2e3f4a5b60718293a4b5c6d7e8f92"

// The live tickets: S25-D1 READY 9 minutes, S25-D2 working 4 minutes, S25-L1 (local) working 23
// minutes with `relay` set (a SAID with no answer). `state_at` and `relay` are FX2's fields.
export function items(writtenMs) {
  const ago = (m) => iso(writtenMs - m * 60_000)
  const item = (ticket, where, state, head, minutes, relay) => ({
    ticket, where, state, branch: `${ticket.toLowerCase()}-work`, head, last_push_at: ago(minutes),
    quiet_minutes: where === "cloud" ? minutes : null, pr: null, state_at: ago(minutes), relay,
  })
  return [
    item("S25-D1", "cloud", "ready", HEAD_D1, 9, false),
    item("S25-D2", "cloud", "working", HEAD_D2, 4, false),
    item("S25-L1", "local", "working", HEAD_L1, 23, true),
  ]
}

// A status.json that meets docs/specs/factory/contracts/status.schema.json, written at `writtenMs`:
// the three live tickets of `items`, one review running, no budget in it.
export function status(writtenMs, overrides = {}) {
  const at = iso(writtenMs)
  const idle = { working: 0, ready: 0, blocked: 0, quiet: 0, done: 0, failed: 0, stopped: 0, quiet_max_minutes: null }
  return {
    schema_version: 1,
    written_at: at,
    watcher: { pid: 4242, started_at: iso(writtenMs - 3_600_000) },
    clock: { session: null, phase: null },
    resources: { disk_free_gb: 60.4, swap_used_gb: 0.0, mem_available_gb: 12.2 },
    lock: { holder: { kind: "post", ticket: "t228", head: null, since: at, elapsed_minutes: 3 }, waiters: [] },
    builders: { cloud: { ...idle, working: 1, ready: 1 }, local: { ...idle, working: 1 }, items: items(writtenMs) },
    reviews: [{ pr: 250, round: 1, head: "fc3cc78a83fa1c5678e9ab21e14caba5f2e4a57c" }],
    g1: { main: null },
    usage: null,
    alarms: [],
    ...overrides,
  }
}

// Terminal cells of a string: East Asian Wide and Fullwidth code points take 2, combining marks and
// zero-width characters 0, every other printable code point 1.
const WIDE = [
  [0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff],
  [0xa000, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xff60],
  [0xffe0, 0xffe6], [0x1f300, 0x1f64f], [0x1f900, 0x1f9ff], [0x20000, 0x3fffd],
]
const ZERO = [[0x0300, 0x036f], [0x1ab0, 0x1aff], [0x1dc0, 0x1dff], [0x200b, 0x200f], [0x20d0, 0x20ff], [0xfe00, 0xfe0f], [0xfe20, 0xfe2f]]
const within = (cp, ranges) => ranges.some(([lo, hi]) => cp >= lo && cp <= hi)

export function cells(text) {
  let n = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (within(cp, ZERO)) continue
    n += within(cp, WIDE) ? 2 : 1
  }
  return n
}

const kids = (node) => (node.children ?? []).flat(Infinity)

function inline(node) {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (node === null || typeof node !== "object") return ""
  return kids(node).map(inline).join("")
}

// The tree as the terminal lines it takes.
export function lines(node) {
  if (typeof node === "string" || typeof node === "number") return String(node).split("\n")
  if (Array.isArray(node)) return lines({ type: "Box", props: { flexDirection: "column" }, children: node })
  if (node === null || typeof node !== "object") return []
  if (node.type === "Text") return inline(node).split("\n")
  if (node.type !== "Box") return []
  const parts = kids(node).map(lines).filter((ls) => ls.length > 0)
  if (String(node.props?.flexDirection ?? "row").startsWith("column")) return parts.flat()
  const height = Math.max(0, ...parts.map((ls) => ls.length))
  const widths = parts.map((ls) => Math.max(0, ...ls.map(cells)))
  const out = []
  for (let i = 0; i < height; i += 1) {
    out.push(parts.map((ls, k) => {
      const piece = ls[i] ?? ""
      return k === parts.length - 1 ? piece : piece + " ".repeat(widths[k] - cells(piece))
    }).join(""))
  }
  return out
}

const settle = async () => {
  for (let i = 0; i < 25; i += 1) await new Promise((done) => setImmediate(done))
}

let loads = 0

function modulePath() {
  const hooks = JSON.parse(readFileSync(join(MOD, "hooks/hooks.json"), "utf8"))
  return join(MOD, "hooks", hooks.modules[0])
}

export function world({ env = { VEXTRUS_ROLE: "orchestrator" }, files = {}, now = T0 } = {}) {
  const w = {
    env: { ...env },
    files: { ...files },
    now,
    calls: [],
    toasts: [],
    submits: [],
    pending: [],
    statuses: [],
    reads: [],
    timers: [],
    state: new Map(),
    store: new Map(),
    hooks: [],
  }

  const factoryName = (path) => {
    const text = String(path)
    const at = text.lastIndexOf(".private/work/factory/")
    return at < 0 ? null : text.slice(at + ".private/work/factory/".length)
  }
  const fileText = (path) => {
    const name = factoryName(path)
    if (name === null || !(name in w.files)) throw new Error(`ENOENT: no such file: ${path}`)
    return w.files[name]
  }
  const stateKey = (ref) => `${ref.plugin}\u0000${ref.key}\u0000${ref.id ?? ""}`
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)))
  const timer = (ms, fn, repeat) => {
    const t = { due: w.now + Math.max(1, ms), ms: Math.max(1, ms), fn, repeat, live: true }
    w.timers.push(t)
    return { cancel: () => { t.live = false } }
  }

  const answers = {
    plugin: { name: PLUGIN, root: MOD },
    env: { get: async (name) => w.env[name] },
    session: {
      id: async () => w.env.__session ?? "session-orchestrator-1",
      root: async () => "/repo",
      cwd: async () => "/repo",
      surface: async () => "terminal",
      surfaces: async () => ["terminal"],
    },
    fs: {
      read: async (path) => {
        w.reads.push(String(path))
        return fileText(path)
      },
      exists: async (path) => {
        try { fileText(path); return true } catch { return false }
      },
      stat: async (path) => {
        const text = fileText(path)
        return { kind: "file", size: Buffer.byteLength(text), mtimeMs: w.now, isLink: false }
      },
      list: async () => Object.keys(w.files).map((name) => ({ name, kind: "file", size: Buffer.byteLength(w.files[name]), mtimeMs: w.now, isLink: false })),
    },
    state: {
      get: async (ref) => {
        const held = w.state.get(stateKey(ref))
        return held === undefined ? { value: undefined, version: 0 } : { value: clone(held.value), version: held.version }
      },
      set: async (ref, value, options = {}) => {
        const key = stateKey(ref)
        const version = w.state.get(key)?.version ?? 0
        if (options.ifVersion !== undefined && options.ifVersion !== version) return { isSet: false, version }
        w.state.set(key, { value: clone(value), version: version + 1 })
        return { isSet: true, version: version + 1 }
      },
    },
    store: {
      get: async (key) => clone(w.store.get(key)),
      set: async (key, value) => { w.store.set(key, clone(value)) },
      delete: async (key) => { w.store.delete(key) },
      keys: async () => [...w.store.keys()],
    },
    clock: {
      now: async () => w.now,
      every: (ms, fn) => timer(ms, fn, true),
      after: (ms, fn) => timer(ms, fn, false),
      sleep: (ms) => new Promise((done) => { timer(ms, done, false) }),
    },
    prompt: {
      submit: (input) => {
        w.submits.push(clone(input))
        return new Promise((done) => { w.pending.push(() => done({ text: input?.text })) })
      },
    },
    ui: {
      resolve: () => new Proxy({}, { get: (_t, name) => String(name) }),
      toast: (text) => { w.toasts.push(String(text)) },
      status: (text) => { w.statuses.push(text) },
      log: () => {},
      invalidate: () => {},
    },
  }

  const $ = new Proxy({}, {
    get(_t, noun) {
      if (typeof noun !== "string") return undefined
      if (noun === "plugin") return answers.plugin
      return new Proxy({}, {
        get(_u, method) {
          if (typeof method !== "string" || method === "then") return undefined
          return (...args) => {
            w.calls.push({ name: `${noun}.${method}`, args })
            const answer = answers[noun]?.[method]
            if (answer) return answer(...args)
            return Promise.resolve(undefined)
          }
        },
      })
    },
  })
  w.$ = $

  globalThis.h = (type, props, ...children) => ({ type, props: props ?? null, children: children.flat(Infinity) })

  w.load = async () => {
    loads += 1
    const { register } = await import(`${pathToFileURL(modulePath()).href}?load=${loads}`)
    w.hooks = []
    const on = (event, matcherOrHook, hook) => {
      if (hook === undefined) w.hooks.push({ event, matcher: undefined, hook: matcherOrHook })
      else w.hooks.push({ event, matcher: matcherOrHook, hook })
    }
    register(on, {})
  }

  w.start = async () => {
    const e = Object.freeze({ cwd: "/repo", surface: "terminal", isInteractive: true, source: "startup" })
    for (const { hook } of w.hooks.filter((x) => x.event === "session.start")) {
      await hook($, e, async () => ({ cwd: e.cwd }))
    }
    await settle()
  }

  w.advance = async (ms) => {
    const until = w.now + ms
    for (;;) {
      const due = w.timers.filter((t) => t.live && t.due <= until).sort((a, b) => a.due - b.due)[0]
      if (!due) break
      w.now = due.due
      if (due.repeat) due.due += due.ms
      else due.live = false
      due.fn()
      await settle()
    }
    w.now = until
    await settle()
  }

  w.append = (name, text) => {
    w.files[name] = (w.files[name] ?? "") + text
  }

  w.band = async (columns = 200) => {
    const props = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: columns, scroll: { offset: 0, bodyRows: 12 }, view: {} }
    const e = Object.freeze({ component: "AbovePrompt", surface: "terminal", props })
    const engine = { type: "Text", props: null, children: [ENGINE_BAND] }
    const render = w.hooks.filter((x) => x.event === "ui.render" && (!x.matcher || x.matcher.component === "AbovePrompt"))
    let tree = engine
    if (render.length > 0) tree = await render[0].hook($, e, async () => engine)
    const drawn = tree === undefined || tree === null ? [] : lines(tree)
    return { tree, lines: drawn, text: drawn.join("\n") }
  }

  // The session went idle and every submitted wake's turn started: each submit's promise resolves.
  w.idle = async () => {
    const started = w.pending.splice(0)
    for (const start of started) start()
    await settle()
  }

  w.called = (name) => w.calls.filter((c) => c.name === name)
  return w
}
