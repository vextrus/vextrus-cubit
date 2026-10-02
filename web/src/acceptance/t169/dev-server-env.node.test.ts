/*
 * Ticket 169's acceptance tests (issue #169, M0 fix F7): "The web dev server's port and API proxy
 * target are fixed (5410 → 8000): a parallel walk needs a hand edit of `web/vite.config.ts`."
 * Pinned: "`VEXTRUS_WEB_PORT` and `VEXTRUS_API_URL` are honoured; the defaults stay 5410 and
 * 127.0.0.1:8000", and a malformed port is refused with an error naming the variable, never ignored.
 *
 * Each test sets the environment, then imports the config afresh and resolves it as `vite` (serve,
 * development) would, so a config that reads the environment at import or at resolve both count.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConfigEnv, UserConfig } from 'vite'

const SERVE: ConfigEnv = { command: 'serve', mode: 'development', isSsrBuild: false, isPreview: false }

async function resolveConfig(): Promise<UserConfig> {
  vi.resetModules()
  const module = (await import('../../../vite.config')) as { default: unknown }
  const exported = module.default
  return typeof exported === 'function'
    ? await (exported as (env: ConfigEnv) => UserConfig | Promise<UserConfig>)(SERVE)
    : (exported as UserConfig)
}

function apiTarget(config: UserConfig): unknown {
  const proxy = config.server?.proxy?.['/api']
  return typeof proxy === 'string' ? proxy : proxy?.target
}

function unset(name: string): void {
  // vi.stubEnv(name, undefined) deletes the variable, and unstubAllEnvs restores it.
  vi.stubEnv(name, undefined)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the dev server from the environment', () => {
  it('serves on 5410 when VEXTRUS_WEB_PORT is not set', async () => {
    unset('VEXTRUS_WEB_PORT')
    unset('VEXTRUS_API_URL')
    const config = await resolveConfig()
    expect(config.server?.port).toBe(5410)
  })

  it('proxies /api to http://127.0.0.1:8000 when VEXTRUS_API_URL is not set', async () => {
    unset('VEXTRUS_WEB_PORT')
    unset('VEXTRUS_API_URL')
    const config = await resolveConfig()
    expect(apiTarget(config)).toBe('http://127.0.0.1:8000')
  })

  it('serves on the port VEXTRUS_WEB_PORT names', async () => {
    vi.stubEnv('VEXTRUS_WEB_PORT', '5423')
    unset('VEXTRUS_API_URL')
    const config = await resolveConfig()
    expect(config.server?.port).toBe(5423)
  })

  it('proxies /api to the URL VEXTRUS_API_URL names', async () => {
    unset('VEXTRUS_WEB_PORT')
    vi.stubEnv('VEXTRUS_API_URL', 'http://127.0.0.1:8013')
    const config = await resolveConfig()
    expect(apiTarget(config)).toBe('http://127.0.0.1:8013')
  })

  it('honours both variables together, one walk beside another', async () => {
    vi.stubEnv('VEXTRUS_WEB_PORT', '5431')
    vi.stubEnv('VEXTRUS_API_URL', 'http://127.0.0.1:8021')
    const config = await resolveConfig()
    expect(config.server?.port).toBe(5431)
    expect(apiTarget(config)).toBe('http://127.0.0.1:8021')
  })

  it.each(['abc', '5410x', '54.10', '-1', '0', '65536', '99999'])(
    'refuses a malformed VEXTRUS_WEB_PORT (%j) with an error naming the variable',
    async (bad) => {
      vi.stubEnv('VEXTRUS_WEB_PORT', bad)
      unset('VEXTRUS_API_URL')
      await expect(resolveConfig()).rejects.toThrow(/VEXTRUS_WEB_PORT/)
    },
  )
})
