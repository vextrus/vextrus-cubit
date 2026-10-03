/*
 * A range of drawing notation is one left-to-right isolate (m0-screens §1.8; the design gate's M10,
 * walk 1 of ticket 22): "S-01–S-13" split into two isolated numbers joined by a dash reads backwards
 * in a right-to-left language ("S-13–S-01"). This refuses the split form anywhere in the web's source:
 * two isolated values with only a dash between them, in markup or in a message.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..', 'src')
const SPLIT = [/\/>\s*[–-]\s*<(?:DrawingText|Notation|bdi|SheetRange)\b/, /\}\s*[–]\s*\{/]

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sources(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$|\.gen\.ts$/.test(name) ? [path] : []
  })
}

describe('ranges of notation (§1.8, M10)', () => {
  it('no source joins two isolated values with a dash', () => {
    const found = sources(SRC).flatMap((path) =>
      readFileSync(path, 'utf8')
        .split('\n')
        .flatMap((line, i) => (SPLIT.some((re) => re.test(line)) ? [`${relative(SRC, path)}:${i + 1}: ${line.trim()}`] : [])),
    )
    expect(found).toEqual([])
  })
})
