// verify gives each worktree's run its own port block (issue #617): the config must hand it to Vitest
// where Vitest reads it (`test.api`), which only Vitest's own resolve shows. Nothing listens here, and
// each project's `api` goes through Vitest's own resolver. The block is one the test has just found free, never a fixed one.
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { loadConfigFromFile } from 'vite'
import { afterEach, expect, it, vi } from 'vitest'
import { resolveApiServerConfig } from 'vitest/node'

const configFile = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
const root = fileURLToPath(new URL('..', import.meta.url))

async function free(port: number): Promise<boolean> {
  return new Promise((done) => {
    const probe = createServer()
    probe.once('error', () => done(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => done(true)))
  })
}

async function freeBlock(): Promise<number> {
  for (let first = 41000; first < 60000; first += 3) {
    if ((await Promise.all([0, 1, 2].map((k) => free(first + k)))).every(Boolean)) return first
  }
  throw new Error('no free block of three ports')
}

afterEach(() => vi.unstubAllEnvs())

it('gives the three browser projects the block VEXTRUS_VITEST_PORT names', async () => {
  const first = await freeBlock()
  vi.stubEnv('VEXTRUS_VITEST_PORT', String(first))
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, configFile, root)
  const projects = (loaded?.config.test?.projects ?? []) as { test?: Record<string, unknown> }[]
  const browsers = projects.filter((project) => String(project.test?.name).startsWith('browser'))
  expect(browsers).toHaveLength(3)
  const quiet = { warn() {}, error() {}, log() {}, info() {} } as never
  const resolved = browsers.map((project) =>
    resolveApiServerConfig({ api: project.test?.api, browser: { enabled: true } } as never, 63315, quiet),
  )
  expect(resolved.map((api) => api.port).sort()).toEqual([first, first + 1, first + 2])
  expect(resolved.every((api) => api.strictPort === true)).toBe(true)
}, 60_000)
