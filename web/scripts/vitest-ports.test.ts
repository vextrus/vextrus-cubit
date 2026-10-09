// verify gives each worktree's run its own port block (issue #617): the config must hand it to Vitest
// where Vitest reads it (`test.api`), which only a resolve through Vitest itself shows.
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import { createVitest } from 'vitest/node'

const config = fileURLToPath(new URL('../vite.config.ts', import.meta.url))

async function ports(): Promise<Record<string, number | undefined>> {
  const ctx = await createVitest('test', { watch: false, config, root: fileURLToPath(new URL('..', import.meta.url)) })
  try {
    return Object.fromEntries(
      ctx.projects
        .filter((project) => project.name.startsWith('browser'))
        .map((project) => [project.name, project.config.api?.port]),
    )
  } finally {
    await ctx.close()
  }
}

afterEach(() => vi.unstubAllEnvs())

it('gives the three browser projects the block VEXTRUS_VITEST_PORT names', async () => {
  vi.stubEnv('VEXTRUS_VITEST_PORT', '41000')
  const got = await ports()
  expect(Object.values(got).sort()).toEqual([41000, 41001, 41002])
}, 60_000)
