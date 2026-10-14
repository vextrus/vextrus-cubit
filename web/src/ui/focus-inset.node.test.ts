/*
 * `focus-inset` draws a region's focus ring inside it (system.md §7); Tailwind's `outline-none` beside it
 * wins over it, and the region takes the focus with no ring at all (m0-screens 8.7; the design gate on
 * #842 found it twice: Step 1's sheet region and the viewer's "could not be drawn" region). No class
 * string in web/src names both, on one line or in one `cn(...)` call.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) sources(path, out)
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path)
  }
  return out
}

const both = (text: string) => /(^|[\s'"`])focus-inset($|[\s'"`])/.test(text) && /(^|[\s'"`])outline-none($|[\s'"`])/.test(text)

/** Every string literal, and every `cn(...)` call whole, with its line. */
function classStrings(source: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = []
  const lineOf = (at: number) => source.slice(0, at).split('\n').length
  for (const m of source.matchAll(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g)) out.push({ line: lineOf(m.index), text: m[0] })
  for (const m of source.matchAll(/\bcn\(/g)) {
    let depth = 0
    let end = m.index + 2
    for (; end < source.length; end++) {
      if (source[end] === '(') depth++
      else if (source[end] === ')' && --depth === 0) break
    }
    out.push({ line: lineOf(m.index), text: source.slice(m.index, end + 1) })
  }
  return out
}

describe('focus-inset is never cancelled by outline-none', () => {
  it('finds the pair in a class string and in a cn() call (the check catches what it is for)', () => {
    expect(classStrings(`<div className="focus-inset absolute outline-none" />`).some((s) => both(s.text))).toBe(true)
    expect(classStrings(`cn('focus-inset', open && 'outline-none')`).some((s) => both(s.text))).toBe(true)
    expect(classStrings(`<div className="focus-inset absolute" />`).some((s) => both(s.text))).toBe(false)
  })

  it('has no class string in web/src naming both', () => {
    const found: string[] = []
    for (const file of sources(SRC)) {
      for (const s of classStrings(readFileSync(file, 'utf8'))) if (both(s.text)) found.push(`${relative(SRC, file)}:${s.line}`)
    }
    expect(found).toEqual([])
  })
})
