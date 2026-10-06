// The mock world for ticket S14-U2's acceptance tests: a hand-made `$` that stands for Claude Code's
// engine, so the vextrus-factory mod runs under plain `node --test` with no `claude-code` package.
// Written by the acceptance-writer before the build; the builder never changes this file. It follows
// S14-U1's mock (tests/acceptance/ts14u1/_world.mjs) and adds what U2 needs: slash commands, the
// pane, the spinner and pressing a Button.
//
// What it holds:
// - The mod is imported from the path `hooks/hooks.json` names (`modules[0]`), fresh on each `load`.
// - `$` is a Proxy: every `$.<noun>.<method>(...)` is recorded in `world.calls` as "<noun>.<method>",
//   answered where the mod needs an answer (env, session, fs, state, store, clock, ui, command) and
//   resolved to undefined otherwise, so a call the mod must never make still shows in the record.
// - The factory folder is `/repo/.private/work/factory/` (`$.session.root` is `/repo`). `world.files`
//   maps a path inside it (`status.json`, `launches/s14-c3-20261006T000000Z.json`) to its text; a
//   name it lacks rejects as missing, and so does any path outside it.
// - The clock is mocked: `world.advance(ms)` moves it on and runs every due `$.clock.every` and
//   `$.clock.after` callback, then lets the mod's promises settle (no wall clock, no sleep).
// - `world.command(name)` runs the mod's `command.run` hooks for `/<name>` the way the engine does for
//   a person's Enter; `next` (the engine's own run, which for a plugin command is a model turn's
//   worth of work the mod must not ask for) is recorded in `world.nexts`.
// - `world.pane(id)` runs the mod's `ui.render` hook for `{ component: "Pane", requestId: id }`;
//   `world.spinner()` the one for `Spinner`. Both lay the tree out into terminal lines (a column Box
//   stacks, a row Box sits side by side, a Button draws `[ label ]`). `buttons(tree)` lists the
//   Buttons in a tree with their labels; `world.press(button)` runs its `onPress`.

import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const MOD = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
export const PLUGIN = "vextrus-factory"
export const POLL_MS = 15_000
export const T0 = Date.parse("2026-10-06T01:00:00Z")
export const TABS = ["Builders", "Reviews", "Lock", "PR queue"]

// Calls that submit a prompt, put words in the owner's prompt box or transcript, run a model, start
// an agent, a tool, a command or a process, end a turn, reach the network or write a file: none is
// the mod's (read-only in v1; the owner's ruling Q6).
const FORBIDDEN_NAMES = new Set([
  "prompt.submit",
  "prompt.fill",
  "prompt.suggest",
  "session.send",
  "session.append",
  "session.compact",
  "agent.spawn",
  "tool.call",
  "command.run",
  "turn.abort",
  "mcp.call",
  "mcp.connect",
  "fs.write",
  "env.set",
  "config.set",
])
const FORBIDDEN_NOUNS = new Set(["model", "process", "http"])
export const isForbidden = (name) => FORBIDDEN_NAMES.has(name) || FORBIDDEN_NOUNS.has(name.split(".")[0])

export function iso(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z")
}

const sha = (c) => c.repeat(40)

// The fixture factory: five builders (ticket, state, PR), two reviews, a held lock with two
// waiters. status.json meets docs/specs/factory/contracts/status.schema.json, written 30 s before T0.
export function status(writtenMs = T0 - 30_000, overrides = {}) {
  const at = iso(writtenMs)
  const min = (m) => iso(writtenMs - m * 60_000)
  const idle = { working: 0, ready: 0, blocked: 0, quiet: 0, done: 0, failed: 0, stopped: 0, quiet_max_minutes: null }
  return {
    schema_version: 1,
    written_at: at,
    watcher: { pid: 4242, started_at: min(120) },
    clock: { session: null, phase: null },
    resources: { disk_free_gb: 60.4, swap_used_gb: 0.0, mem_available_gb: 12.2 },
    lock: {
      holder: { kind: "post", ticket: "s14-lk", head: sha("a"), since: min(14), elapsed_minutes: 14 },
      waiters: [
        { kind: "post", ticket: "s14-wa", head: sha("b"), since: min(11) },
        { kind: "scored", ticket: "loop-iou", head: sha("c"), since: min(8) },
      ],
    },
    builders: {
      cloud: { ...idle, working: 1, ready: 1, blocked: 1, quiet: 1, quiet_max_minutes: 31 },
      local: { ...idle, working: 1 },
      items: [
        { ticket: "s14-a1", where: "cloud", state: "ready", branch: "s14-a1", head: sha("d"), last_push_at: min(17), quiet_minutes: 17, pr: 251 },
        { ticket: "s14-b2", where: "cloud", state: "working", branch: "s14-b2", head: sha("e"), last_push_at: min(2), quiet_minutes: 2, pr: null },
        { ticket: "s14-c3", where: "cloud", state: "quiet", branch: "s14-c3", head: sha("f"), last_push_at: min(31), quiet_minutes: 31, pr: null },
        { ticket: "s14-d4", where: "local", state: "working", branch: "s14-d4", head: null, last_push_at: null, quiet_minutes: null, pr: null },
        { ticket: "s14-e5", where: "cloud", state: "blocked", branch: "s14-e5", head: sha("a"), last_push_at: min(40), quiet_minutes: 40, pr: 252 },
      ],
    },
    reviews: [
      { pr: 250, round: 1, head: sha("b") },
      { pr: 251, round: 2, head: sha("d") },
    ],
    g1: { main: null },
    usage: null,
    alarms: [],
    ...overrides,
  }
}

// One events.log line, watch.py's form: `<UTC> <KIND> <ticket|-> <detail>`.
export function eventLine(ms, kind, ticket, detail) {
  return `${iso(ms)} ${kind} ${ticket} ${detail}\n`
}

const costLine = (usd, at, pr) =>
  JSON.stringify({ pr, head: sha("d"), round: 1, tier: "normal", verdict: "PASS", total_cost_usd: usd, at }) + "\n"

// The clock's session.json, in the form scripts/factory/stamp.py's `start` writes: started 76
// minutes before T0, a budget of 300 minutes.
export function session(startedMs = T0 - 76 * 60_000, budget = 300) {
  return JSON.stringify({ schema: 1, started_utc: iso(startedMs), budget_minutes: budget, state_file: "/repo/.private/work/session-14/STATE.md", phases: [] })
}

// Every factory file /wip and the pane read: status.json, events.log, a launch record, the
// review-cost log and the clock's session.json.
export function factoryFiles() {
  return {
    "status.json": JSON.stringify(status()),
    "events.log":
      eventLine(T0 - 40 * 60_000, "BLOCKED", "s14-e5", "waiting for the owner") +
      eventLine(T0 - 17 * 60_000, "READY", "s14-a1", "head ready") +
      eventLine(T0 - 2 * 60_000, "PUSH", "s14-b2", "pushed"),
    "launches/s14-c3-20261006T000000Z.json": JSON.stringify({ ticket: "s14-c3", branch: "s14-c3", kind: "cloud", launched_at: iso(T0 - 60 * 60_000) }),
    "review-cost.jsonl": costLine(1.27, iso(T0 - 50 * 60_000), 250) + costLine(0.43, iso(T0 - 10 * 60_000), 251),
    "session.json": session(),
  }
}

// ---- drawing a tree into terminal lines ----

const WIDE = [
  [0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff],
  [0xa000, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xff60],
  [0xffe0, 0xffe6], [0x1f300, 0x1f64f], [0x1f900, 0x1f9ff], [0x20000, 0x3fffd],
]
const ZERO = [[0x0300, 0x036f], [0x200b, 0x200f], [0xfe00, 0xfe0f]]
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
  if (node.type === "Button") return `[ ${label(node)} ]`
  if (node.type === "Markdown") return String(node.props?.text ?? "")
  if (node.type === "Code") return String(node.props?.source ?? "")
  if (node.type === "Link") return String(node.props?.label ?? (kids(node).map(inline).join("") || node.props?.href || ""))
  return kids(node).map(inline).join("")
}

// A Button's label: its `label` prop, else its text children.
export function label(node) {
  if (typeof node?.props?.label === "string") return node.props.label
  return kids(node).map(inline).join("")
}

// The tree as the terminal lines it takes.
export function lines(node) {
  if (typeof node === "string" || typeof node === "number") return String(node).split("\n")
  if (Array.isArray(node)) return lines({ type: "Box", props: { flexDirection: "column" }, children: node })
  if (node === null || typeof node !== "object") return []
  if (node.type !== "Box") return inline(node).split("\n")
  const parts = kids(node).map(lines).filter((ls) => ls.length > 0)
  if (String(node.props?.flexDirection ?? "row").startsWith("column")) return parts.flat()
  const height = Math.max(0, ...parts.map((ls) => ls.length))
  const widths = parts.map((ls) => Math.max(0, ...ls.map(cells)))
  const out = []
  for (let i = 0; i < height; i += 1) {
    out.push(parts.map((ls, k) => {
      const piece = ls[i] ?? ""
      return k === parts.length - 1 ? piece : piece + " ".repeat(widths[k] - cells(piece))
    }).join(" "))
  }
  return out
}

// Every Button in a tree, in drawing order: { node, label }.
export function buttons(node, out = []) {
  if (node === null || typeof node !== "object") return out
  if (Array.isArray(node)) {
    for (const k of node) buttons(k, out)
    return out
  }
  if (node.type === "Button") out.push({ node, label: label(node) })
  for (const k of kids(node)) buttons(k, out)
  return out
}

// The tab Button for a tab name: its label is the name, give or take a hotkey digit and marks.
export function tabButton(tree, name) {
  const want = name.toLowerCase()
  return buttons(tree).find((b) => b.label.replace(/[^A-Za-z ]/g, " ").replace(/\s+/g, " ").trim().toLowerCase() === want)
}

const settle = async () => {
  for (let i = 0; i < 25; i += 1) await new Promise((done) => setImmediate(done))
}

let loads = 0

function modulePath() {
  const hooks = JSON.parse(readFileSync(join(MOD, "hooks/hooks.json"), "utf8"))
  return join(MOD, "hooks", hooks.modules[0])
}

// The mod's own source files (hooks/*.js|ts|tsx|mjs) as { name, text }.
export function sources() {
  const hooks = JSON.parse(readFileSync(join(MOD, "hooks/hooks.json"), "utf8"))
  const seen = new Set()
  const out = []
  const visit = (path) => {
    if (seen.has(path)) return
    seen.add(path)
    let text
    try {
      text = readFileSync(path, "utf8")
    } catch {
      return
    }
    out.push({ name: path.slice(MOD.length + 1), text })
    for (const m of text.matchAll(/\bfrom\s+["'](\.{1,2}\/[^"']+)["']|\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']/g)) {
      visit(resolve(dirname(path), m[1] ?? m[2]))
    }
  }
  for (const rel of hooks.modules) visit(join(MOD, "hooks", rel))
  return out
}

export const ENGINE_PANE = "engine-pane-sentinel"
export const ENGINE_SUFFIX = "…"

export function world({ env = { VEXTRUS_ROLE: "orchestrator" }, files = {}, now = T0 } = {}) {
  const w = {
    env: { ...env },
    files: { ...files },
    now,
    calls: [],
    reads: [],
    nexts: [],
    opened: [],
    registered: [],
    timers: [],
    state: new Map(),
    store: new Map(),
    hooks: [],
  }

  const ROOT_DIR = "/repo/.private/work/factory/"
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
  const entry = (name, kind, size) => ({ name, kind, size, mtimeMs: kind === "file" ? w.now : 0, isLink: false })

  const answers = {
    env: { get: async (name) => w.env[name] },
    session: {
      id: async () => "session-orchestrator-1",
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
        const name = factoryName(String(path).replace(/\/*$/, "/"))
        if (name !== null && Object.keys(w.files).some((k) => k.startsWith(name))) return true
        try { fileText(path); return true } catch { return false }
      },
      stat: async (path) => {
        const dir = factoryName(String(path).replace(/\/*$/, "/"))
        if (dir !== null && !(factoryName(path) in w.files) && Object.keys(w.files).some((k) => k.startsWith(dir))) return { kind: "dir", size: 0, mtimeMs: 0, isLink: false }
        const text = fileText(path)
        return { kind: "file", size: Buffer.byteLength(text), mtimeMs: w.now, isLink: false }
      },
      list: async (path) => {
        const prefix = factoryName(String(path ?? "").replace(/\/*$/, "/"))
        if (prefix === null) throw new Error(`ENOENT: no such directory: ${path}`)
        const names = new Map()
        for (const key of Object.keys(w.files)) {
          if (!key.startsWith(prefix)) continue
          const rest = key.slice(prefix.length)
          const cut = rest.indexOf("/")
          if (cut < 0) names.set(rest, entry(rest, "file", Buffer.byteLength(w.files[key])))
          else names.set(rest.slice(0, cut), entry(rest.slice(0, cut), "dir", 0))
        }
        if (names.size === 0 && prefix !== "") throw new Error(`ENOENT: no such directory: ${path}`)
        return [...names.values()]
      },
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
    ui: {
      resolve: () => new Proxy({}, { get: (_t, name) => String(name) }),
      open: async (pane) => {
        w.opened.push(clone(pane))
        return { isPlaced: true }
      },
      close: async () => {},
      panes: async () => w.opened.map((p) => ({ id: p.id, title: p.title ?? p.id, isShown: true, isFocused: false, isPlaced: true })),
      toast: () => {},
      status: () => {},
      log: () => {},
      invalidate: () => {},
    },
    command: {
      register: async (spec) => {
        w.registered.push(clone(spec))
      },
      list: async () => [],
    },
  }

  const $ = new Proxy({}, {
    get(_t, noun) {
      if (typeof noun !== "string") return undefined
      if (noun === "plugin") return { name: PLUGIN, root: MOD }
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
    const { register } = await import(`${pathToFileURL(modulePath()).href}?u2load=${loads}`)
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

  // A fresh world loaded and started: the mod as a session sees it.
  w.boot = async () => {
    await w.load()
    await w.start()
    return w
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

  // `/<name>` typed by the person: the mod's command.run hooks for it, top first. `next` is the
  // engine's own run of the command; it is recorded and answers nothing.
  w.command = async (name, args = "") => {
    const e = Object.freeze({ command: name, args, origin: Object.freeze({ kind: "composer" }), presentation: Object.freeze({ isFullscreen: true, columns: 160 }) })
    const chain = w.hooks.filter((x) => x.event === "command.run" && (!x.matcher || x.matcher.command === undefined || x.matcher.command === name))
    const run = async (i, input) => {
      if (i >= chain.length) {
        w.nexts.push({ command: name, input })
        return {}
      }
      return chain[i].hook($, input, (next) => run(i + 1, next ?? input))
    }
    const result = await run(0, e)
    await settle()
    return { result, text: typeof result?.text === "string" ? result.text : "" }
  }

  // The Pane `id` drawn at `bodyColumns` cells: { tree, lines, text }.
  w.pane = async (id, bodyColumns = 120) => {
    const props = { title: id, isFocused: true, bodyColumns, placement: "dock", scroll: { offset: 0, bodyRows: 40 }, view: {} }
    const e = Object.freeze({ component: "Pane", surface: "terminal", requestId: id, viewport: { columns: 200, rows: 50 }, props })
    const engine = { type: "Text", props: null, children: [ENGINE_PANE] }
    const render = w.hooks.filter((x) => x.event === "ui.render" && x.matcher?.component === "Pane" && (x.matcher.requestId === undefined || x.matcher.requestId === id))
    let tree = engine
    if (render.length > 0) tree = await render[0].hook($, e, async () => engine)
    await settle()
    const drawn = tree === undefined || tree === null ? [] : lines(tree)
    return { tree, lines: drawn, text: drawn.join("\n") }
  }

  // The spinner as the terminal draws it: the word, then the suffix (the engine's, one ellipsis,
  // unless a hook rewrote it), or the hook's own tree. { text, input } where input is what reached
  // the engine (null when the hook drew its own tree).
  w.spinner = async () => {
    const props = Object.freeze({ word: "Sauteing", message: null, suffix: ENGINE_SUFFIX, mode: "thinking" })
    const e = Object.freeze({ component: "Spinner", surface: "terminal", requestId: "main", viewport: { columns: 160, rows: 50 }, props })
    let input = null
    const engine = async (next) => {
      input = next ?? e
      const p = input.props
      return { type: "Text", props: null, children: [`${p.message ?? p.word}${p.suffix}`] }
    }
    const render = w.hooks.filter((x) => x.event === "ui.render" && x.matcher?.component === "Spinner")
    const tree = render.length > 0 ? await render[0].hook($, e, engine) : await engine(e)
    await settle()
    const drawn = tree === undefined || tree === null ? [] : lines(tree)
    return { text: drawn.join("\n"), input }
  }

  // A press on a Button, as the engine raises it: its onPress runs in the plugin's environment.
  w.press = async (button, requestId) => {
    const node = button.node ?? button
    const arg = Object.freeze({ plugin: PLUGIN, element: node.props?.key ?? label(node), component: "Pane", requestId, surface: "terminal" })
    await node.props.onPress(arg)
    await settle()
  }

  w.forbidden = () => w.calls.map((c) => c.name).filter(isForbidden)
  w.factoryReads = () => w.reads.filter((p) => factoryName(p) !== null)
  w.ROOT_DIR = ROOT_DIR
  return w
}

// The text of each section, in the order the four names first start a line: { Builders: "...", ... }.
// A section runs from its heading line to the next heading. Null when a heading is missing.
export function sectionsOf(text) {
  const at = {}
  for (const name of TABS) {
    const m = new RegExp(`^[^A-Za-z0-9\\n]*${name.replace(" ", "\\s+")}\\b`, "m").exec(text)
    at[name] = m === null ? -1 : m.index
  }
  if (TABS.some((n) => at[n] < 0)) return null
  const order = [...TABS].sort((a, b) => at[a] - at[b])
  const out = { order }
  order.forEach((name, i) => {
    out[name] = text.slice(at[name], i + 1 < order.length ? at[order[i + 1]] : text.length)
  })
  return out
}

// The line of `text` that names `token` as a whole word.
export function lineOf(text, token) {
  const re = new RegExp(`(^|[^A-Za-z0-9-])${token.replace(/[-]/g, "\\-")}(?![A-Za-z0-9-])`)
  return text.split("\n").find((row) => re.test(row))
}

export const names = (text, token) => lineOf(text, token) !== undefined
