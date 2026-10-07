/*
 * Ticket S15-W0's acceptance tests, a split that loses nothing: the takeoff catalogues together hold
 * exactly what one catalogue of the whole `web/src/takeoff/` folder would (what main holds today, in
 * `web/src/takeoff/locales/en.po`), each message with the English the code gives it.
 *
 * "What one catalogue would hold" is Lingui's own extraction of the folder's code (`@lingui/cli/api`),
 * with `web/lingui.config.ts`'s settings and its exclusions (tests and catalogues), so a source file left
 * out of every split catalogue, whose words would then have no English, is found. This holds after every
 * later ticket too: it compares the catalogues with the code as it is, never with a copy.
 */
import { getCatalogs } from '@lingui/cli/api'
import { getConfig } from '@lingui/conf'
import { describe, expect, it } from 'vitest'
import { keyOf, takeoffCatalogues, WEB } from './po'

/** Every message the code under `web/src/takeoff/` asks for: key → English. */
async function askedFor(): Promise<Map<string, string>> {
  const config = getConfig({ cwd: WEB, configPath: `${WEB}lingui.config.ts`, skipValidation: true })
  const [one] = await getCatalogs({
    ...config,
    catalogs: [
      {
        path: `${WEB}node_modules/.tmp/ts15w0-one/{locale}`,
        include: [`${WEB}src/takeoff/`],
        exclude: ['**/*.test.ts', '**/*.test.tsx', '**/locales/**'],
      },
    ],
  })
  const collected = await one!.collect()
  expect(collected, 'Lingui extracted takeoff’s code').toBeDefined()
  const asked = new Map<string, string>()
  for (const message of Object.values(collected!)) {
    const id = message.message ?? ''
    asked.set(keyOf({ context: message.context, id }), id)
  }
  return asked
}

/** Every message the takeoff catalogues hold: key → English (a message in two catalogues must agree). */
function held(): Map<string, string> {
  const out = new Map<string, string>()
  for (const catalogue of takeoffCatalogues()) {
    for (const entry of catalogue.entries) {
      const key = keyOf(entry)
      const before = out.get(key)
      expect(before === undefined || before === entry.english, `${key} worded alike in every catalogue`).toBe(true)
      out.set(key, entry.english)
    }
  }
  return out
}

describe('the split takeoff catalogues lose nothing (S15-W0)', () => {
  it('hold every message takeoff’s code asks for, in the code’s own English', { timeout: 120_000 }, async () => {
    const asked = await askedFor()
    const have = held()
    expect(asked.size, 'takeoff’s code asks for messages').toBeGreaterThan(0)
    const missing = [...asked].filter(([key, english]) => have.get(key) !== english).map(([key]) => key)
    expect(missing, 'messages without their English in any takeoff catalogue').toEqual([])
  })

  it('hold no message takeoff’s code does not ask for', { timeout: 120_000 }, async () => {
    const asked = await askedFor()
    const extra = [...held().keys()].filter((key) => !asked.has(key))
    expect(extra, 'messages no takeoff code asks for').toEqual([])
  })
})
