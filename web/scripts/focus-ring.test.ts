/*
 * A focus ring that never draws (the design gate's M9, ticket 22's walk 1): in Tailwind 4 `outline-none`
 * sets the outline's style to none, and `focus-visible:outline-2` only sets its width, so the ring is
 * invisible unless the same class list also says `focus-visible:outline-solid`. This refuses the class.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..', 'src')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('focus rings (§8 item 7, M9)', () => {
  it('no class list hides the outline and sets a focus width without a style', () => {
    const found = sources(SRC).flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(/(['"`])([^'"`]*\boutline-none\b[^'"`]*)\1/g)]
        .map((m) => m[2]!)
        .filter((classes) => /\bfocus-visible:outline-(?:\d|\[)/.test(classes) && !/\bfocus-visible:outline-(?:solid|dashed|dotted|double)\b/.test(classes))
        .map((classes) => `${relative(SRC, path)}: ${classes}`),
    )
    expect(found).toEqual([])
  })
})
