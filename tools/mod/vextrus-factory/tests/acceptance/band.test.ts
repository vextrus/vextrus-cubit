// Acceptance tests for ticket f8 (the band): docs/specs/factory.md §4(b), §10 row f8.
// Written by the acceptance-writer before the build; the builder never changes this file.
//
// Run: claude plugin test tools/mod/vextrus-factory
//
// The kit runs a test where the plugin's hooks run (no fs, no network, no process), so the
// test cannot open docs/specs/factory/contracts/status.sample.json itself. SAMPLE below is that
// file's content, byte-for-byte as JSON, and test_mod_layout.py (L4) fails the moment the two
// differ. TOKENS is the literal segment list shared with
// scripts/factory/tests/acceptance/statusline.test.mjs (S1, S8), which also fails when the two
// lists differ: the band and the status line cannot silently disagree.
//
// Every hook the mod may reach is answered here, beneath the plugin (the kit's bottom hook throws
// on anything unanswered): the session (id, cwd, root), the environment, the store, the clock
// (mocked), fs.read and fs.exists (recorded), process.run (throws, counted), ui.status (recorded),
// and the engine's own AbovePrompt drawing (a sentinel, so "draws nothing" is the sentinel).

import { expect, mock, test } from 'claude-code/testing'
import { register } from '../../hooks/register.js'

// prettier-ignore
const SAMPLE: any = /* SAMPLE:BEGIN */
  {
    "schema_version": 1,
    "written_at": "2026-10-05T00:20:00Z",
    "watcher": {
      "pid": 48213,
      "started_at": "2026-10-04T21:31:07Z"
    },
    "clock": {
      "session": {
        "started_at": "2026-10-04T16:50:00Z",
        "budget_minutes": 660,
        "elapsed_minutes": 450
      },
      "phase": {
        "name": "phase 3",
        "started_at": "2026-10-04T21:08:14Z",
        "budget_minutes": 330,
        "elapsed_minutes": 192
      }
    },
    "resources": {
      "disk_free_gb": 61.2,
      "swap_used_gb": 0.0,
      "mem_available_gb": 14.1
    },
    "lock": {
      "holder": {
        "kind": "post",
        "ticket": "t228",
        "head": "c09bb890b096f7306f688cc6d1dad34e7e52a223",
        "since": "2026-10-05T00:06:00Z",
        "elapsed_minutes": 14
      },
      "waiters": [
        {
          "kind": "post",
          "ticket": "t229",
          "head": "619aae029dda528253a6af0ba619b45baa1df115",
          "since": "2026-10-05T00:09:00Z"
        },
        {
          "kind": "scored",
          "ticket": "loop-iou",
          "head": "adfec5772ae8932aa10896037b0779bec915015b",
          "since": "2026-10-05T00:12:30Z"
        }
      ]
    },
    "builders": {
      "cloud": {
        "working": 4,
        "ready": 1,
        "blocked": 0,
        "quiet": 1,
        "done": 0,
        "failed": 0,
        "stopped": 0,
        "quiet_max_minutes": 31
      },
      "local": {
        "working": 1,
        "ready": 0,
        "blocked": 0,
        "quiet": 0,
        "done": 0,
        "failed": 0,
        "stopped": 0,
        "quiet_max_minutes": null
      },
      "items": [
        {
          "ticket": "f1",
          "where": "cloud",
          "state": "ready",
          "branch": "f1-ci-launcher",
          "head": "cf1126f67238bf3e85fcc8c8737b72e80ddcfddb",
          "last_push_at": "2026-10-05T00:02:11Z",
          "quiet_minutes": 17,
          "pr": 251
        },
        {
          "ticket": "f3",
          "where": "cloud",
          "state": "working",
          "branch": "f3-local-govern-watch",
          "head": "fe91c0394869857c0e93272302f4d04fde05a402",
          "last_push_at": "2026-10-05T00:17:40Z",
          "quiet_minutes": 2,
          "pr": null
        },
        {
          "ticket": "f4",
          "where": "cloud",
          "state": "working",
          "branch": "f4-review-gate",
          "head": "e62f41d02c28cb089872e955dfb86a9ad16d79b6",
          "last_push_at": "2026-10-05T00:11:02Z",
          "quiet_minutes": 9,
          "pr": null
        },
        {
          "ticket": "f6",
          "where": "cloud",
          "state": "working",
          "branch": "f6-session-hooks",
          "head": "80c7068f531db65831e8fa8ffa3dd5e6824a2eeb",
          "last_push_at": "2026-10-05T00:14:55Z",
          "quiet_minutes": 5,
          "pr": null
        },
        {
          "ticket": "f8",
          "where": "cloud",
          "state": "working",
          "branch": "f8-band",
          "head": "e117797422d35ce52f036963c7e9603e9955b5c7",
          "last_push_at": "2026-10-05T00:16:20Z",
          "quiet_minutes": 3,
          "pr": null
        },
        {
          "ticket": "f9",
          "where": "cloud",
          "state": "quiet",
          "branch": "f9-jev-client",
          "head": "443a7bf35f406a4f97f0277e9789737caf247842",
          "last_push_at": "2026-10-04T23:49:00Z",
          "quiet_minutes": 31,
          "pr": null
        },
        {
          "ticket": "f2",
          "where": "local",
          "state": "working",
          "branch": "f2-walls",
          "head": null,
          "last_push_at": null,
          "quiet_minutes": null,
          "pr": null
        }
      ]
    },
    "reviews": [
      {
        "pr": 250,
        "round": 1,
        "head": "fc3cc78a83fa1c5678e9ab21e14caba5f2e4a57c"
      },
      {
        "pr": 251,
        "round": 2,
        "head": "cf1126f67238bf3e85fcc8c8737b72e80ddcfddb"
      }
    ],
    "g1": {
      "main": {
        "state": "FAIL",
        "sha": "ca2e1c4acf84011644b1906ba1961d2b6970ac50",
        "at": "2026-10-05T00:01:00Z"
      }
    },
    "usage": {
      "session_percent": 41.0,
      "week_percent": 38.0,
      "read_at": "2026-10-05T00:15:00Z"
    },
    "alarms": [
      {
        "code": "BUILDER-QUIET",
        "subject": "f9",
        "detail": "no push for 31 min",
        "since": "2026-10-05T00:19:00Z"
      }
    ]
  }
/* SAMPLE:END */

// prettier-ignore
const TOKENS: string[] = /* TOKENS:BEGIN */ ["00:20Z", "3h12/5h30", "lock: post t228 14m (+2 waiting)", "disk 61G swap 0.0G avail 14G", "cloud 4 working, 1 READY, 1 quiet 31m", "local 1", "reviews #250 r1, #251 r2", "G1 main: FAIL ca2e1c4", "status 0m old"] /* TOKENS:END */

const PLUGIN = 'vextrus-factory'
const STATUS_PATH = '.private/work/factory/status.json'
const WRITTEN = Date.parse(SAMPLE.written_at)
const POLL_MS = 15000
const ENGINE_BAND = 'engine-band-sentinel'
const PROPS: any = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 12,
  bodyColumns: 200,
  scroll: { offset: 0, bodyRows: 12 },
  view: {},
}
const FORBIDDEN_EVENTS = ['tool.check', 'prompt.edit', 'agent.spawn']

type FileAnswer = string | Error

type World = {
  clock: ReturnType<typeof mock.clock>
  env: Record<string, string | undefined>
  session: { id: string }
  file: { answer: FileAnswer }
  reads: string[]
  runs: number
  statusTexts: (string | undefined)[]
  store: Map<string, unknown>
  storeWrites: string[]
}

// Answers every noun the mod may touch, before the test's first call on `$` (the kit's rule).
function world(on: any, env: Record<string, string | undefined>, now: number, answer: FileAnswer): World {
  const w: World = {
    clock: mock.clock(on, { now }),
    env,
    session: { id: 'session-orchestrator-1' },
    file: { answer },
    reads: [],
    runs: 0,
    statusTexts: [],
    store: new Map(),
    storeWrites: [],
  }
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: w.session.id }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.root', () => ({ value: '/repo' }))
  on('env.get', (_$: any, e: any) => ({ value: w.env[e.name] }))
  on('fs.read', (_$: any, e: any) => {
    w.reads.push(e.path)
    if (!String(e.path).endsWith(STATUS_PATH)) throw new Error(`ENOENT: ${e.path}`)
    if (w.file.answer instanceof Error) throw w.file.answer
    return { value: w.file.answer }
  })
  on('fs.exists', (_$: any, e: any) => ({ value: String(e.path).endsWith(STATUS_PATH) }))
  on('process.run', () => {
    w.runs += 1
    throw new Error('process.run is not allowed in the band')
  })
  on('ui.status', (_$: any, e: any) => {
    w.statusTexts.push(e.text)
    return { value: undefined }
  })
  on('store.get', (_$: any, e: any) => ({ value: w.store.get(e.key) }))
  on('store.set', (_$: any, e: any) => {
    w.storeWrites.push(e.key)
    w.store.set(e.key, JSON.parse(JSON.stringify(e.value)))
    return { value: undefined }
  })
  on('store.delete', (_$: any, e: any) => {
    w.storeWrites.push(e.key)
    w.store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...w.store.keys()] }))
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, null, ENGINE_BAND)
  })
  return w
}

const ORCHESTRATOR = { VEXTRUS_ROLE: 'orchestrator' }

async function start($: any, w: World): Promise<void> {
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await w.clock.settle()
}

function textOf(node: any): string {
  if (typeof node === 'string') return node
  if (node === null || typeof node !== 'object') return ''
  return (node.children ?? []).map(textOf).join('')
}

function typesOf(node: any, into: Set<string> = new Set()): Set<string> {
  if (node !== null && typeof node === 'object') {
    into.add(node.type)
    for (const child of node.children ?? []) typesOf(child, into)
  }
  return into
}

// Rows a tree takes: a column Box stacks its children, a row Box and a Text take their tallest,
// a newline inside a text starts a row.
function rowsOf(node: any): number {
  if (typeof node === 'string') return node.split('\n').length
  if (node === null || typeof node !== 'object') return 0
  const kids: number[] = (node.children ?? []).map(rowsOf)
  if (node.type === 'Box' && String(node.props?.flexDirection ?? 'row').startsWith('column')) {
    return kids.reduce((a, b) => a + b, 0)
  }
  return Math.max(1, ...kids)
}

async function band($: any, surface: 'terminal' | 'desktop' = 'terminal'): Promise<{ tree: any; text: string }> {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: PROPS })
  const tree = await ui.drawn()
  await ui.unmount()
  return { tree, text: textOf(tree) }
}

function hhmmz(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`
}

function iso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function statusReads(w: World): number {
  return w.reads.filter(p => p.endsWith(STATUS_PATH)).length
}

function drewNothing(w: World, drawn: { text: string }, why: string): void {
  expect(drawn.text, `${why}: the band must be the engine's own drawing`).toBe(ENGINE_BAND)
  expect(w.reads, `${why}: no fs.read at all`).toEqual([])
  expect(w.storeWrites, `${why}: $.store untouched`).toEqual([])
  expect(w.statusTexts.filter(t => typeof t === 'string' && t !== ''), `${why}: no ui.status text`).toEqual([])
}

// Amended 5 Oct 2026: S14-U2's /wip, /factory pane and spinner suffix (the owner's session-14 brief) need these hooks; still read-only (Q6).
test('M1 registers exactly session.start, command.run on /wip and /factory, and ui.render on AbovePrompt, Pane and Spinner, and nothing that intercepts', async () => {
  const seen: { event: string; matcher: any }[] = []
  const recording: any = (event: string, matcherOrHook: unknown, hook?: unknown) => {
    seen.push({ event, matcher: hook === undefined ? undefined : matcherOrHook })
  }
  register(recording, {})
  const events = [...new Set(seen.map(s => s.event))].sort()
  expect(events).toEqual(['command.run', 'session.start', 'ui.render'])
  for (const name of FORBIDDEN_EVENTS) expect(events).not.toContain(name)
  for (const name of events) expect(name).not.toMatch(/^(tool|prompt|agent)\./)
  // Each ui.render hook names its component; together exactly AbovePrompt, Pane and Spinner.
  const renders = seen.filter(s => s.event === 'ui.render')
  for (const s of renders) expect(typeof s.matcher?.component, 'a ui.render hook names its component').toBe('string')
  expect([...new Set(renders.map(s => s.matcher.component))].sort()).toEqual(['AbovePrompt', 'Pane', 'Spinner'])
  // Each command.run hook names its command (none catches every command); together exactly wip and factory.
  const commands = seen.filter(s => s.event === 'command.run')
  for (const s of commands) expect(typeof s.matcher?.command, 'a command.run hook names its command').toBe('string')
  expect([...new Set(commands.map(s => s.matcher.command))].sort()).toEqual(['factory', 'wip'])
})

test('M2 as the orchestrator, the AbovePrompt band carries every segment of the sample in at most 2 rows of Box and Text', async ($, on) => {
  const w = world(on, { ...ORCHESTRATOR }, WRITTEN, JSON.stringify(SAMPLE))
  await start($, w)
  for (const surface of ['terminal', 'desktop'] as const) {
    const { tree, text } = await band($, surface)
    for (const token of TOKENS) expect(text, `${surface}: segment ${JSON.stringify(token)}`).toContain(token)
    expect(text).not.toContain('WATCHER DOWN')
    expect(text).not.toContain(ENGINE_BAND)
    expect(rowsOf(tree), `${surface}: rows`).toBeLessThanOrEqual(2)
    for (const type of typesOf(tree)) expect(['Box', 'Text'], `${surface}: element ${type}`).toContain(type)
  }
})

test('M3 in a cloud session (CLAUDE_CODE_REMOTE=true) the mod draws nothing, reads nothing and leaves the store alone', async ($, on) => {
  const w = world(on, { ...ORCHESTRATOR, CLAUDE_CODE_REMOTE: 'true' }, WRITTEN, JSON.stringify(SAMPLE))
  await start($, w)
  for (let tick = 0; tick < 4; tick += 1) await w.clock.advance(POLL_MS)
  drewNothing(w, await band($), 'cloud')
  expect(w.store.get('activated')).toBeUndefined()
})

test('M4 unless VEXTRUS_ROLE is orchestrator (unset, builder, empty) the mod draws nothing, reads nothing and leaves the store alone', async ($, on) => {
  const w = world(on, {}, WRITTEN, JSON.stringify(SAMPLE))
  for (const role of [undefined, 'builder', '']) {
    w.env.VEXTRUS_ROLE = role
    w.session.id = `session-builder-${String(role)}`
    await start($, w)
    for (let tick = 0; tick < 4; tick += 1) await w.clock.advance(POLL_MS)
    drewNothing(w, await band($), `VEXTRUS_ROLE=${JSON.stringify(role)}`)
  }
  expect(w.store.get('activated')).toBeUndefined()
})

test('M5 the file is read at start and every 15 s after (not before), a changed file changes the band, and a restart keeps one timer', async ($, on) => {
  const w = world(on, { ...ORCHESTRATOR }, WRITTEN, JSON.stringify(SAMPLE))
  await start($, w)
  expect(statusReads(w), 'read once at start').toBe(1)
  await w.clock.advance(POLL_MS - 1)
  expect(statusReads(w), 'no read before 15 s').toBe(1)
  const changed = {
    ...SAMPLE,
    resources: { ...SAMPLE.resources, disk_free_gb: 59.0 },
    lock: { ...SAMPLE.lock, holder: { ...SAMPLE.lock.holder, elapsed_minutes: 15 } },
  }
  w.file.answer = JSON.stringify(changed)
  await w.clock.advance(1)
  expect(statusReads(w), 'read again at 15 s').toBe(2)
  const { text } = await band($)
  expect(text).toContain('disk 59G')
  expect(text).toContain('lock: post t228 15m (+2 waiting)')
  expect(text).not.toContain('disk 61G')
  // A reload fires session.start again: the poll must not stack a second timer.
  await start($, w)
  const before = statusReads(w)
  await w.clock.advance(POLL_MS)
  expect(statusReads(w) - before, 'one read per 15 s after a second start').toBe(1)
  await w.clock.advance(POLL_MS)
  expect(statusReads(w) - before, 'still one read per 15 s').toBe(2)
})

test('M6 a rejected, empty, non-JSON, schema-invalid or stale file shows WATCHER DOWN with the clock, never throws, and a good file recovers', async ($, on) => {
  const w = world(on, { ...ORCHESTRATOR }, WRITTEN + 181_000, new Error('ENOENT: no such file'))
  const bad: [string, FileAnswer][] = [
    ['rejected', new Error('ENOENT: no such file')],
    ['empty', ''],
    ['not JSON', '{"schema_version": 1, "written_at": '],
    ['missing required fields', JSON.stringify({ schema_version: 1, written_at: SAMPLE.written_at })],
    ['a field of the wrong type', JSON.stringify({ ...SAMPLE, builders: 'four' })],
    ['older than 3 min', JSON.stringify(SAMPLE)],
  ]
  await start($, w)
  for (const [why, answer] of bad) {
    w.file.answer = answer
    await w.clock.advance(POLL_MS)
    const { text } = await band($)
    expect(text, why).toContain('WATCHER DOWN')
    expect(text, `${why}: the clock`).toContain(hhmmz(w.clock.now()))
    expect(text, `${why}: no stale segment`).not.toContain('lock: post t228')
  }
  w.file.answer = JSON.stringify({ ...SAMPLE, written_at: iso(w.clock.now() + POLL_MS) })
  await w.clock.advance(POLL_MS)
  const { text } = await band($)
  expect(text).not.toContain('WATCHER DOWN')
  expect(text).toContain('lock: post t228 14m (+2 waiting)')
  expect(text).toContain('status 0m old')
})

test('M7 the mod never calls process.run: start plus 10 polls and a draw, zero calls', async ($, on) => {
  const w = world(on, { ...ORCHESTRATOR }, WRITTEN, JSON.stringify(SAMPLE))
  await start($, w)
  for (let tick = 0; tick < 10; tick += 1) await w.clock.advance(POLL_MS)
  await band($)
  expect(statusReads(w), 'the poll ran').toBe(11)
  expect(w.runs).toBe(0)
})

test('M8 each orchestrator session records its id once in the store under "activated"', async ($, on) => {
  const w = world(on, { ...ORCHESTRATOR }, WRITTEN, JSON.stringify(SAMPLE))
  await start($, w)
  expect(w.store.get('activated')).toEqual(['session-orchestrator-1'])
  await start($, w)
  expect(w.store.get('activated'), 'the same session again: no duplicate').toEqual(['session-orchestrator-1'])
  w.session.id = 'session-orchestrator-2'
  await start($, w)
  expect(w.store.get('activated')).toEqual(['session-orchestrator-1', 'session-orchestrator-2'])
  w.env.VEXTRUS_ROLE = 'builder'
  w.session.id = 'session-builder-1'
  await start($, w)
  w.env.VEXTRUS_ROLE = 'orchestrator'
  w.env.CLAUDE_CODE_REMOTE = 'true'
  w.session.id = 'session-cloud-1'
  await start($, w)
  expect(w.store.get('activated'), 'a builder or cloud session adds nothing').toEqual([
    'session-orchestrator-1',
    'session-orchestrator-2',
  ])
})
