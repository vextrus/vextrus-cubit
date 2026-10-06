// The band's words: one pure module the mod's band (register.js) and the orchestrator's status line
// (scripts/factory/statusline.mjs) both draw from, so the two cannot disagree (spec §4(b), §3.5).
// No `$`, no Node, no I/O: text in, text out. The data contract is
// docs/specs/factory/contracts/status.schema.json; field names are its own.

export const STALE_MS = 180_000
// A `written_at` more than a minute ahead of now is not fresh: skew or a hand-edited file over a
// dead watcher. Within a minute it is clock skew and stays fresh.
export const FUTURE_MS = 60_000
// The one size cap both readers share: the band measures the text in UTF-16 units, the status line
// the file in bytes; they differ only for non-ASCII text, which status.json is not expected to hold.
export const MAX_STATUS_BYTES = 4 * 1024 * 1024
export const DOWN = "WATCHER DOWN"
export const WIP_CAP = 5
const SEP = " · "
const UTC = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/
const SHA = /^[0-9a-f]{40}$/
const REQUIRED = ["schema_version", "written_at", "watcher", "clock", "resources", "lock", "builders", "reviews", "g1", "usage", "alarms"]
const GROUP = ["working", "ready", "blocked", "quiet", "done", "failed", "stopped"]
const LOCK_KINDS = ["post", "scored", "no-post"]
const G1_STATES = ["PASS", "FAIL", "RUNNING"]
const ALARM_CODES = ["BUILDER-QUIET", "BUILDER-BLOCKED", "READY-NO-VERIFY", "READY-WAITING", "NEW-CLAUDE-BRANCH", "LEAK-HIT", "BUDGET-PASSED", "FLOOR-CROSSED", "REVIEW-READY", "JEV-MODEL-MOVED"]
// A ticket name is the one free string the band prints: one line, at most 80 characters.
const TICKET = /^[^\u0000-\u001f\u007f-\u009f\u2028\u2029]{1,80}$/

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v)
const isCount = (v) => Number.isInteger(v) && v >= 0
const isSize = (v) => v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0)
const isUtc = (v) => typeof v === "string" && UTC.test(v) && Number.isFinite(Date.parse(v))
const orNull = (check) => (v) => v === null || check(v)

function isBudget(v) {
  return isObj(v) && isUtc(v.started_at) && Number.isInteger(v.budget_minutes) && v.budget_minutes >= 1 && isCount(v.elapsed_minutes)
}

function isGroup(v) {
  return isObj(v) && GROUP.every((k) => isCount(v[k])) && orNull(isCount)(v.quiet_max_minutes)
}

function isHolder(v) {
  return isObj(v) && LOCK_KINDS.includes(v.kind) && orNull((t) => typeof t === "string" && TICKET.test(t))(v.ticket) && isCount(v.elapsed_minutes)
}

// The fields the band reads, checked against the schema's types. Anything else is WATCHER DOWN.
function isStatus(s) {
  if (!isObj(s) || !REQUIRED.every((k) => k in s)) return false
  if (s.schema_version !== 1 || !isUtc(s.written_at)) return false
  const { clock, resources: r, lock, builders: b, g1 } = s
  if (!isObj(clock) || !orNull(isBudget)(clock.session) || !orNull(isBudget)(clock.phase)) return false
  if (!isObj(r) || !isSize(r.disk_free_gb) || !isSize(r.swap_used_gb) || !isSize(r.mem_available_gb)) return false
  if (!isObj(lock) || !orNull(isHolder)(lock.holder) || !Array.isArray(lock.waiters)) return false
  if (!isObj(b) || !isGroup(b.cloud) || !isGroup(b.local) || !Array.isArray(b.items)) return false
  if (!Array.isArray(s.reviews) || !s.reviews.every((x) => isObj(x) && isCount(x.pr) && isCount(x.round))) return false
  if (!isObj(g1) || !orNull((m) => isObj(m) && G1_STATES.includes(m.state) && typeof m.sha === "string" && SHA.test(m.sha))(g1.main)) return false
  if (!Array.isArray(s.alarms) || !s.alarms.every((a) => isObj(a) && ALARM_CODES.includes(a.code) && isUtc(a.since))) return false
  return s.usage === null || isObj(s.usage)
}

// The file's text -> { status } when it meets the contract, else { status: null, schema } where
// `schema` is true only for a well-formed file of another schema_version (the contract's
// "WATCHER DOWN with 'status schema'"). Never throws.
export function parseStatus(text) {
  try {
    if (typeof text !== "string" || text.length > MAX_STATUS_BYTES || text.trim() === "") return { status: null, schema: false }
    const value = JSON.parse(text)
    if (isStatus(value)) return { status: value, schema: false }
    return { status: null, schema: isObj(value) && typeof value.schema_version === "number" && value.schema_version !== 1 }
  } catch {
    return { status: null, schema: false }
  }
}

function two(n) {
  return String(n).padStart(2, "0")
}

export function clockText(nowMs) {
  const d = new Date(nowMs)
  return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}Z`
}

const hm = (m) => `${Math.floor(m / 60)}h${two(m % 60)}`
const gb = (v) => (v === null ? "?" : `${Math.round(v)}G`)
const gb1 = (v) => (v === null ? "?" : `${v.toFixed(1)}G`)

// "cloud 4 working, 1 READY, 1 quiet 31m"; "local 1, 1 done" (local builders are never quiet: the
// schema's quiet is a cloud state). Zero counts other than working are left out. Only the local group
// prints done and stopped: a finished local builder waits for the orchestrator to push it, while a
// cloud builder's done is a merged PR.
function groupText(name, g, working) {
  const parts = [working ? `${g.working} working` : `${g.working}`]
  if (g.ready) parts.push(`${g.ready} READY`)
  if (g.blocked) parts.push(`${g.blocked} BLOCKED`)
  if (g.quiet) parts.push(g.quiet_max_minutes === null ? `${g.quiet} quiet` : `${g.quiet} quiet ${g.quiet_max_minutes}m`)
  if (g.failed) parts.push(`${g.failed} failed`)
  if (name === "local" && g.done) parts.push(`${g.done} done`)
  if (name === "local" && g.stopped) parts.push(`${g.stopped} stopped`)
  return `${name} ${parts.join(", ")}`
}

// The band's segments, in the spec's order (§4(b)'s example line). `status` is a parsed, valid
// status or null; `ctx` a context percentage or null (the status line's alone).
// `extra` is the status line's own addition: { wip: true } adds `WIP n/5`, { cost } the last review's
// cost in dollars, { session } { elapsed_minutes, budget_minutes } when status.json holds no budget.
export function segments(status, nowMs, ctx = null, schema = false, extra = {}) {
  const out = [clockText(nowMs)]
  const age = status === null ? Infinity : nowMs - Date.parse(status.written_at)
  if (!(age <= STALE_MS) || age < -FUTURE_MS) {
    out.push(schema ? `${DOWN} status schema` : DOWN)
    if (ctx !== null) out.push(`ctx ${ctx}%`)
    return out
  }
  const budget = status.clock.phase ?? status.clock.session
  const shown = budget ?? extra.session ?? null
  out.push(shown === null ? "no budget" : `${hm(shown.elapsed_minutes)}/${hm(shown.budget_minutes)}`)
  const { holder, waiters } = status.lock
  if (holder === null) out.push(waiters.length ? `lock: free (+${waiters.length} waiting)` : "lock: free")
  else out.push(`lock: ${holder.kind} ${holder.ticket ?? "?"} ${holder.elapsed_minutes}m${waiters.length ? ` (+${waiters.length} waiting)` : ""}`)
  const r = status.resources
  out.push(`disk ${gb(r.disk_free_gb)} swap ${gb1(r.swap_used_gb)} avail ${gb(r.mem_available_gb)}`)
  out.push(groupText("cloud", status.builders.cloud, true))
  out.push(groupText("local", status.builders.local, false))
  if (extra.wip) out.push(`WIP ${status.builders.cloud.working + status.builders.local.working}/${WIP_CAP}`)
  if (status.reviews.length) out.push(`reviews ${status.reviews.map((x) => `#${x.pr} r${x.round}`).join(", ")}`)
  const main = status.g1.main
  out.push(main === null ? "G1 main: none" : `G1 main: ${main.state} ${main.sha.slice(0, 7)}`)
  if (status.alarms.length) {
    const newest = status.alarms.reduce((a, b) => (Date.parse(b.since) > Date.parse(a.since) ? b : a))
    out.push(status.alarms.length === 1 ? `alarm ${newest.code}` : `alarms ${status.alarms.length}, newest ${newest.code}`)
  }
  if (typeof extra.cost === "number" && Number.isFinite(extra.cost) && extra.cost >= 0) out.push(`review $${extra.cost.toFixed(2)}`)
  out.push(`status ${Math.floor(Math.max(0, age) / 60_000)}m old`)
  if (ctx !== null) out.push(`ctx ${ctx}%`)
  return out
}

// Belt and braces: whatever passed the checks, no segment carries a line break, a control character
// or a bidi embedding, override or isolate (U+202A-202E, U+2066-2069), which could reorder the band.
const oneLine = (seg) => seg.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, " ")

export function bandText(status, nowMs, ctx = null, schema = false, extra = {}) {
  return segments(status, nowMs, ctx, schema, extra).map(oneLine).join(SEP)
}

// Terminal cells: East Asian Wide and Fullwidth code points take 2, combining marks and zero-width
// characters 0, every other code point 1 (not UTF-16 units: #366).
const WIDE = [
  [0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff],
  [0xa000, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xff60],
  [0xffe0, 0xffe6], [0x1f300, 0x1f64f], [0x1f680, 0x1f6ff], [0x1f900, 0x1f9ff], [0x20000, 0x3fffd],
]
const ZERO = [[0x0300, 0x036f], [0x1ab0, 0x1aff], [0x1dc0, 0x1dff], [0x200b, 0x200f], [0x20d0, 0x20ff], [0xfe00, 0xfe0f], [0xfe20, 0xfe2f]]
const within = (cp, ranges) => ranges.some(([lo, hi]) => cp >= lo && cp <= hi)

function cellWidth(cp) {
  if (within(cp, ZERO)) return 0
  return within(cp, WIDE) ? 2 : 1
}

export function cells(text) {
  let n = 0
  for (const ch of text) n += cellWidth(ch.codePointAt(0))
  return n
}

// `text` in at most `width` cells: when it is too wide, as much as fits in width-1 cells and an
// ellipsis. A combining mark stays with the character before it.
export function cutCells(text, width) {
  if (cells(text) <= width) return text
  let out = ""
  let n = 0
  for (const ch of text) {
    const w = cellWidth(ch.codePointAt(0))
    if (n + w > width - 1) break
    out += ch
    n += w
  }
  return `${out}…`
}

// The band in at most two rows of `columns` cells: segments fill the first row, the rest go to the
// second, which is cut with an ellipsis if it is still too wide.
export function bandRows(status, nowMs, columns, schema = false) {
  const width = Number.isInteger(columns) && columns > 10 ? columns : 80
  const rows = [""]
  for (const seg of segments(status, nowMs, null, schema).map(oneLine)) {
    const last = rows.length - 1
    const joined = rows[last] === "" ? seg : rows[last] + SEP + seg
    if (cells(joined) <= width || rows[last] === "" || rows.length === 2) rows[last] = joined
    else rows.push(seg)
  }
  return rows.map((row) => cutCells(row, width))
}

// ---- events.log: watch.py's line, `<UTC> <KIND> <ticket|-> <detail>` ----

// The kinds that matter to the owner. PUSH and COMMIT are routine and never show.
export const HIGH_KINDS = ["READY", "BLOCKED", "LEAK-HIT", "BUDGET-PASSED", "CI-RED"]
// The kinds the owner must act on: each raises one toast.
export const OWNER_KINDS = ["OWNER-COMMAND", "OWNER-RULING"]
export const BAND_EVENTS = 5
// Only the log's tail is read: a log grows without end.
const LOG_TAIL = 256 * 1024
const EVENT = /^([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z) ([A-Z][A-Z-]*) ([^ ]+)(?: (.*))?$/

// The log's text -> the events whose kind is in `kinds`, oldest first, each { at, kind, ticket,
// detail, line }. A line that is not watch.py's form is skipped. Never throws.
export function parseEvents(text, kinds) {
  const out = []
  try {
    if (typeof text !== "string") return out
    const tail = text.length > LOG_TAIL ? text.slice(text.indexOf("\n", text.length - LOG_TAIL) + 1) : text
    for (const raw of tail.split("\n")) {
      const m = EVENT.exec(raw.replace(/\r$/, ""))
      if (m === null || !kinds.includes(m[2]) || !Number.isFinite(Date.parse(m[1]))) continue
      out.push({ at: m[1], kind: m[2], ticket: m[3], detail: m[4] ?? "", line: raw })
    }
  } catch {
    return []
  }
  return out
}

// The newest `limit` high-signal events of the log's text, newest first, as { at, kind, ticket, detail }.
export function bandEvents(text, limit = BAND_EVENTS) {
  return parseEvents(text, HIGH_KINDS)
    .map((e, i) => ({ e, i }))
    .sort((a, b) => Date.parse(b.e.at) - Date.parse(a.e.at) || b.i - a.i)
    .slice(0, limit)
    .map(({ e }) => ({ at: e.at, kind: e.kind, ticket: e.ticket, detail: e.detail }))
}

// One event as a row of at most `columns` cells: `01:57Z BLOCKED s14-w1 detail`.
export function eventRow(event, columns) {
  const width = Number.isInteger(columns) && columns > 10 ? columns : 80
  const at = clockText(Date.parse(event.at))
  return cutCells(oneLine(`${at} ${event.kind} ${event.ticket}${event.detail === "" ? "" : ` ${event.detail}`}`), width)
}

// The toast's words for an owner-action event.
export function toastText(event) {
  const who = event.ticket === "-" ? "" : ` ${event.ticket}`
  return oneLine(`${event.kind}${who}: ${event.detail}`).trim()
}
