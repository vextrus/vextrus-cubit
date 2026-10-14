// The fast verify scales each project's timeouts by VEXTRUS_TIME_SCALE (S29-F2a); unset, Vitest's own
// defaults stand (browser 15 s and 30 s, node 5 s and 10 s), so a timeout set at the root never shrinks
// the browser projects' longer ones in CI's runs (the review of S29-F2a's first head).
import { fileURLToPath } from 'node:url'
import { loadConfigFromFile } from 'vite'
import { afterEach, expect, it, vi } from 'vitest'

const configFile = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
const root = fileURLToPath(new URL('..', import.meta.url))

type Project = { test?: { name?: string; testTimeout?: number; hookTimeout?: number } }

async function projects(): Promise<{ root: Record<string, unknown>; projects: Project[] }> {
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, configFile, root)
  const test = (loaded?.config.test ?? {}) as Record<string, unknown>
  return { root: test, projects: (test.projects ?? []) as Project[] }
}

afterEach(() => vi.unstubAllEnvs())

it("sets no timeout when no scale is given, so Vitest's defaults stand", async () => {
  vi.stubEnv('VEXTRUS_TIME_SCALE', '')
  const found = await projects()
  expect(found.root.testTimeout).toBeUndefined()
  expect(found.root.hookTimeout).toBeUndefined()
  expect(found.projects).toHaveLength(4)
  for (const project of found.projects) {
    expect(project.test?.testTimeout, project.test?.name).toBeUndefined()
    expect(project.test?.hookTimeout, project.test?.name).toBeUndefined()
  }
}, 60_000)

it("scales each project's own defaults by the factor", async () => {
  vi.stubEnv('VEXTRUS_TIME_SCALE', '2')
  const found = await projects()
  expect(found.root.testTimeout).toBeUndefined()
  for (const project of found.projects) {
    const browser = String(project.test?.name).startsWith('browser')
    expect(project.test?.testTimeout, project.test?.name).toBe(browser ? 30_000 : 10_000)
    expect(project.test?.hookTimeout, project.test?.name).toBe(browser ? 60_000 : 20_000)
  }
}, 60_000)

it('ignores a factor that is not a number above one', async () => {
  for (const given of ['0.5', '1', 'fast']) {
    vi.stubEnv('VEXTRUS_TIME_SCALE', given)
    for (const project of (await projects()).projects) {
      expect(project.test?.testTimeout, `${given} ${project.test?.name}`).toBeUndefined()
    }
  }
}, 60_000)
