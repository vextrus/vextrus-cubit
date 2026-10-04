// The builder's own tests for the band (beyond tests/acceptance): handlers never throw, the band
// fits two rows of a narrow terminal, and the null cases of the contract have words.
// Run: claude plugin test tools/mod/vextrus-factory

import { expect, mock, test } from 'claude-code/testing'
import { bandRows, bandText, parseStatus } from '../hooks/text.js'

const NOW = Date.parse('2026-10-05T00:20:00Z')
const STATUS: any = {
  schema_version: 1,
  written_at: '2026-10-05T00:20:00Z',
  watcher: { pid: 1, started_at: '2026-10-05T00:00:00Z' },
  clock: { session: null, phase: null },
  resources: { disk_free_gb: null, swap_used_gb: 1.25, mem_available_gb: 3.0 },
  lock: { holder: null, waiters: [] },
  builders: {
    cloud: { working: 0, ready: 0, blocked: 2, quiet: 0, done: 0, failed: 0, stopped: 0, quiet_max_minutes: null },
    local: { working: 1, ready: 1, blocked: 0, quiet: 0, done: 0, failed: 0, stopped: 0, quiet_max_minutes: null },
    items: [],
  },
  reviews: [],
  g1: { main: null },
  usage: null,
  alarms: [
    { code: 'BUILDER-QUIET', subject: 'x1', detail: 'quiet', since: '2026-10-05T00:10:00Z' },
    { code: 'LEAK-HIT', subject: 'x2', detail: 'a:1 1', since: '2026-10-05T00:15:00Z' },
  ],
}
const PROPS: any = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 200, scroll: { offset: 0, bodyRows: 12 }, view: {} }

function textOf(node: any): string {
  if (typeof node === 'string') return node
  if (node === null || typeof node !== 'object') return ''
  return (node.children ?? []).map(textOf).join('')
}

test('the null cases of the contract have words, and another schema_version says so', () => {
  const { status } = parseStatus(JSON.stringify(STATUS))
  expect(status).not.toBeNull()
  const text = bandText(status, NOW)
  for (const words of ['no budget', 'lock: free', 'disk ? swap 1.3G avail 3G', 'cloud 0 working, 2 BLOCKED', 'local 1, 1 READY', 'G1 main: none', 'alarms 2, newest LEAK-HIT', 'status 0m old']) {
    expect(text).toContain(words)
  }
  expect(text).not.toContain('reviews')
  const other = parseStatus(JSON.stringify({ ...STATUS, schema_version: 2 }))
  expect(other.status).toBeNull()
  expect(bandText(other.status, NOW, null, other.schema)).toBe('00:20Z · WATCHER DOWN status schema')
})

test('a line break in a string field is off the contract (WATCHER DOWN), never a second line', () => {
  const sample = { ...STATUS, lock: { holder: { kind: 'post', ticket: 't1', head: null, since: STATUS.written_at, elapsed_minutes: 3 }, waiters: [] } }
  expect(bandText(parseStatus(JSON.stringify(sample)).status, NOW)).toContain('lock: post t1 3m')
  const broken: any[] = [
    { ...sample, lock: { ...sample.lock, holder: { ...sample.lock.holder, ticket: 't1\nINJECTED' } } },
    { ...sample, lock: { ...sample.lock, holder: { ...sample.lock.holder, kind: 'post\nINJECTED' } } },
    { ...sample, alarms: [{ code: 'x\ny\u2028z', subject: null, detail: 'd', since: STATUS.written_at }] },
    { ...sample, g1: { main: { state: 'FAIL\r', sha: 'c'.repeat(40), at: STATUS.written_at } } },
  ]
  for (const bad of broken) {
    const { status } = parseStatus(JSON.stringify(bad))
    expect(status).toBeNull()
    const text = bandText(status, NOW)
    expect(text).toBe('00:20Z · WATCHER DOWN')
    expect(bandRows(status, NOW, 200)).toEqual(['00:20Z · WATCHER DOWN'])
  }
})

test('a narrow band keeps to two rows of its columns', () => {
  const { status } = parseStatus(JSON.stringify({ ...STATUS, reviews: [{ pr: 250, round: 1, head: null }] }))
  for (const columns of [40, 60, 120]) {
    const rows = bandRows(status, NOW, columns)
    expect(rows.length).toBeLessThanOrEqual(2)
    for (const row of rows) expect(row.length).toBeLessThanOrEqual(columns)
  }
})

test('every $ call failing: session.start and the band never throw, and the engine draws its own', async ($, on) => {
  mock.clock(on, { now: NOW })
  for (const noun of ['env.get', 'session.id', 'session.root', 'session.cwd', 'store.get', 'store.set', 'fs.read', 'state.get', 'state.set', 'ui.status', 'process.run']) {
    on(noun as any, () => {
      throw new Error(`${noun} failed`)
    })
  }
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, null, 'engine')
  })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'vextrus-factory', surface: 'terminal', component: 'AbovePrompt', props: PROPS })
  expect(textOf(await ui.drawn())).toBe('engine')
  await ui.unmount()
})

test('the band yields to a survey', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'VEXTRUS_ROLE' ? 'orchestrator' : undefined }))
  on('session.id', () => ({ value: 's1' }))
  on('session.root', () => ({ value: '/repo' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('fs.read', () => ({ value: JSON.stringify(STATUS) }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, null, 'engine')
  })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const survey = await $.ui.mount({ plugin: 'vextrus-factory', surface: 'terminal', component: 'AbovePrompt', props: { ...PROPS, hasSurvey: true } })
  expect(textOf(await survey.drawn())).toBe('engine')
  await survey.unmount()
  const band = await $.ui.mount({ plugin: 'vextrus-factory', surface: 'terminal', component: 'AbovePrompt', props: PROPS })
  expect(textOf(await band.drawn())).toContain('lock: free')
  await band.unmount()
})
