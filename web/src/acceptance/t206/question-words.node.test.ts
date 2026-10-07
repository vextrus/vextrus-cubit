/*
 * Ticket 206's acceptance tests, the words' source (issue #206): "m0-screens §6.7's two no-number first
 * lines and S-13's 'Not part of this set' promise acts 21c does not do (the sheet is neither confirmed
 * nor taken off the list); amend §6.7 and the option words, or 21c." The orchestrator's ruling: amend
 * §6.7 and the option words to what 21c's answer does (no new backend act).
 *
 * What 21c's answer does (`vextrus/takeoff/services/step1.py`, `_apply`): for a no-number Question,
 * "Leave it without a number" changes nothing and "Type a number" sets the sheet's number; neither
 * confirms the sheet. For a drawing-list Check, "Not part of this set" is recorded and nothing else:
 * the sheet is not taken off the drawing list, which still counts it.
 *
 * Pinned here: the design's words (docs/design/m0-screens.md §6.7's table and §5's templates) no
 * longer promise those acts, and the screen's catalogues (every `.po` under web/src/takeoff/: one file
 * until S15-W0 split it by screen area) carry the design's words, so the two agree. The exact new words
 * are the builder's (the report recommends some).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ROOT = new URL('../../../../', import.meta.url)
const doc = readFileSync(new URL('docs/design/m0-screens.md', ROOT), 'utf8')
const TAKEOFF = new URL('web/src/takeoff/', ROOT)
const catalogue = (readdirSync(TAKEOFF, { recursive: true }) as string[])
  .filter((p) => p.endsWith('.po'))
  .sort()
  .map((p) => readFileSync(new URL(p.replace(/\\/g, '/'), TAKEOFF), 'utf8'))
  .join('\n')

/** One kind of apostrophe and quote, and single spaces, so the doc's ASCII and the screen's typography compare. */
const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()

/** The catalogues' English, each msgid joined across its continuation lines. */
const msgids: string[] = (() => {
  const out: string[] = []
  let current: string | null = null
  for (const line of catalogue.split('\n')) {
    const start = /^msgid "(.*)"$/.exec(line)
    const more = /^"(.*)"$/.exec(line)
    if (start) {
      if (current !== null) out.push(current)
      current = start[1]!
    } else if (more && current !== null) current += more[1]!
    else if (current !== null) {
      out.push(current)
      current = null
    }
  }
  if (current !== null) out.push(current)
  return out.map((s) => norm(s.replace(/\\"/g, '"')))
})()

/** A section of m0-screens, from its heading line (`## 5.`, `### 6.7 …`) to the next heading of its level or above. */
function section(heading: string): string {
  const start = doc.indexOf(`\n${heading}`)
  expect(start, `m0-screens has "${heading}"`).toBeGreaterThanOrEqual(0)
  const level = heading.split(' ')[0]!
  const next = [...doc.slice(start + 1).matchAll(/\n(#+) /g)].find((m) => m[1]!.length <= level.length)
  return doc.slice(start, next ? start + 1 + next.index : undefined)
}

/** The cells of the table row in `text` that starts with `| <first cell>`. */
function row(text: string, first: string): string[] {
  const line = text.split('\n').find((l) => l.startsWith(`| ${first}`))
  expect(line, `a row "${first}"`).toBeDefined()
  return line!
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim())
}

/** `2 "words"` in an options cell: option 2's words. */
function option(cell: string, n: number): string {
  const m = new RegExp(`(?:^|·\\s*)${n} "([^"]+)"`).exec(cell)
  expect(m, `option ${n} in ${cell}`).not.toBeNull()
  return norm(m![1]!)
}

/** `2: "words"` or `2, 3: "words"` in a first-lines cell: the first line for option `n`. */
function firstLine(cell: string, n: number): string {
  for (const m of cell.matchAll(/(?:^|·\s*)([\d, ]+):\s*"([^"]+)"/g)) {
    if (m[1]!.split(',').map((x) => Number(x.trim())).includes(n)) return norm(m[2]!)
  }
  throw new Error(`no first line for option ${n} in: ${cell}`)
}

const s5 = () => section('## 5. Step 1')
const s67 = () => section('### 6.7 Questions')
// §6.7's table: Kind | Title | Body and Trace | Options | First line after the pick.
const noNumber = () => row(s67(), 'No number (`missing`)')
const drawingList = () => row(s67(), 'On the drawing list, in no file (Check)')
// §5's templates: Kind | Title | Options.
const drawingListTemplate = () => row(s5(), 'Drawing list against sheets (Check)')

describe('§6.7’s no-number first lines say what 21c’s answer does (#206)', () => {
  it('does not say "Leave it without a number" confirms the sheet', () => {
    expect(firstLine(noNumber()[4]!, 2)).not.toMatch(/confirms/i)
  })

  it('does not say "Type a number" confirms the sheet', () => {
    expect(firstLine(noNumber()[4]!, 3)).not.toMatch(/confirms/i)
  })

  it('is the screen’s own first line for "Leave it without a number"', () => {
    expect(msgids).toContain(firstLine(noNumber()[4]!, 2))
  })

  it('is the screen’s own first line for "Type a number"', () => {
    expect(msgids).toContain(firstLine(noNumber()[4]!, 3))
  })
})

describe('"Not part of this set" promises only what 21c’s answer does (#206)', () => {
  it('does not promise to take the sheet off the list in §6.7’s drawing-list option', () => {
    const words = option(drawingList()[3]!, 2)
    expect(words).toMatch(/^Not part of this set/)
    expect(words).not.toMatch(/off the list/i)
  })

  it('does not promise to take the sheet off the list in §5’s drawing-list template', () => {
    const words = option(drawingListTemplate()[2]!, 2)
    expect(words).toMatch(/^Not part of this set/)
    expect(words).not.toMatch(/off the list/i)
  })

  it('words the option alike in §6.7 and §5', () => {
    expect(option(drawingList()[3]!, 2)).toBe(option(drawingListTemplate()[2]!, 2))
  })

  it('does not say answering takes the sheet off the list or lowers the count in §6.7’s first line', () => {
    expect(firstLine(drawingList()[4]!, 2)).not.toMatch(/off the list|sheets expected/i)
  })

  it('is the screen’s own option words', () => {
    expect(msgids).toContain(option(drawingListTemplate()[2]!, 2))
  })

  it('leaves no "take it off the list" in the screen’s catalogue', () => {
    expect(msgids.filter((m) => /take it off the list/i.test(m))).toEqual([])
  })
})
