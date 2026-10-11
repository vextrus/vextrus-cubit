/*
 * "At ceiling level" (S19-B5's third storey meaning) is known to the strip and the spec (review 1 of
 * #648, design gate must 2; the orchestrator's default): the strip gives it no mark of its own, its
 * tooltip says a bar at a slot's foot is members at that floor level or what hangs under its ceiling,
 * m0-screens 6.8 lists the meaning, and 6.9 says the two-choice toggle shows it as read and never
 * offers it. The tooltip in code is the sentence 6.8 quotes.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const flat = (s: string) => s.replace(/\s+/g, ' ')
const spec = flat(read('../../../docs/design/m0-screens.md'))
const strip = flat(read('./SheetList.tsx'))

const TOOLTIP =
  'Each slot is a storey: foundations, Basement, Ground, Mezzanine, 1st to 9th, Roof, the roofs above. A full slot is floor to floor; a bar at its foot is members at that floor level or what hangs under its ceiling.'

function section(heading: string): string {
  const start = spec.indexOf(heading)
  expect(start, heading).toBeGreaterThan(-1)
  const end = spec.indexOf('### ', start + heading.length)
  return spec.slice(start, end)
}

describe('at ceiling level on the strip and in the spec', () => {
  it("the strip's tooltip names what hangs under a ceiling, as 6.8 quotes it", () => {
    expect(strip).toContain(`<Trans>${TOOLTIP}</Trans>`)
    expect(section('### 6.8 Storeys and the storey strip')).toContain(`"${TOOLTIP}"`)
  })

  it('6.8 lists "at ceiling level" as a meaning drawn as the floor-level bar', () => {
    const storeys = section('### 6.8 Storeys and the storey strip')
    expect(storeys).toContain('"at ceiling level" (what hangs under those storeys\' ceilings')
    expect(storeys).toContain('The strip draws "at ceiling level" as "at floor level"')
  })

  it("6.9's toggle shows a ceiling-level reading as read and keeps its two choices", () => {
    const corrections = section('### 6.9 Exclusion, assignment, corrections and undo')
    expect(corrections).toContain('a two-choice toggle, "at floor level" | "floor to floor"')
    expect(corrections).toContain('a view read "at ceiling level" shows that meaning as read beside the toggle, and the toggle does not offer it')
  })
})
