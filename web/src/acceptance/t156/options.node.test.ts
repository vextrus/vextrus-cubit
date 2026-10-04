/*
 * Ticket 156 (issue #156, W4): "every option key every Question code can carry has an English
 * message". This half proves options.fixture.ts is exactly what 21c's backend raises, read from the
 * backend's own source, so a key added there and not here fails; answer-words.test.tsx proves the
 * screen words every key in the table.
 */
import { describe, expect, it } from 'vitest'
import proposalsPy from '../../../../vextrus/takeoff/services/read_propose/proposals.py?raw'
import step1Py from '../../../../vextrus/takeoff/services/step1.py?raw'
import libraryPy from '../../../../vextrus/drawings/library.py?raw'
import conventionsJson from '../../../../engine/recognise/conventions/sheet-default.json?raw'
import registerPy from '../../../../engine/check/register.py?raw'
import registerCodesPy from '../../../../engine/messages/register_check.py?raw'
import { DISCIPLINES, QUESTION_SHAPES, SHEET_KINDS } from './options.fixture'

const KEEP_OPEN = 'keep_open'

/** A Python tuple of string literals and `KEEP_OPEN`, as its keys. */
function tuple(body: string): string[] {
  return body
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s === 'KEEP_OPEN' ? KEEP_OPEN : s.replace(/^["']|["']$/g, '')))
}

/** proposals.py's `NAME_OPTIONS = (…)` constants. */
function optionConstants(): Record<string, string[]> {
  const found: Record<string, string[]> = {}
  for (const m of proposalsPy.matchAll(/^([A-Z_]+_OPTIONS)\s*=\s*\(([^)]*)\)/gm)) found[m[1]!] = tuple(m[2]!)
  return found
}

const shape = (code: string) => QUESTION_SHAPES.find((s) => s.code === code)

describe('the table of Question codes and option keys is the backend’s (#156)', () => {
  it('has every Discipline the Market seeds', () => {
    const keys = [...libraryPy.matchAll(/_row\(\s*"([a-z_]+)"/g)].map((m) => m[1])
    expect(keys.length).toBeGreaterThan(0)
    expect([...DISCIPLINES]).toEqual(keys)
  })

  it('has every sheet kind the conventions name', () => {
    const conventions = JSON.parse(conventionsJson) as { sheet_kinds: Record<string, string[]>; common_sheet_kinds: string[] }
    const kinds = [...new Set([...Object.values(conventions.sheet_kinds).flat(), ...conventions.common_sheet_kinds])]
    expect(new Set(SHEET_KINDS)).toEqual(new Set(kinds))
  })

  it('uses every *_OPTIONS constant the read job raises Questions with, each with its keys', () => {
    const constants = optionConstants()
    expect(Object.keys(constants).sort()).toEqual(['BOUNDARY_OPTIONS', 'CHECK_OPTIONS', 'CONFLICT_OPTIONS', 'HELD_OPTIONS', 'LISTS_OPTIONS', 'MISSING_OPTIONS', 'SAME_NUMBER_OPTIONS'])
    expect(shape('engine.decoders_agree.disagree')?.options).toEqual(constants.HELD_OPTIONS)
    expect(shape('engine.conflicts.same_number')?.options).toEqual(constants.SAME_NUMBER_OPTIONS)
    expect(shape('engine.conflicts.same_title')?.options).toEqual(constants.CONFLICT_OPTIONS)
    expect(shape('engine.conflicts.same_storey')?.options).toEqual(constants.CONFLICT_OPTIONS)
    expect(shape('takeoff.step1.no_number')?.options).toEqual(constants.MISSING_OPTIONS)
    expect(shape('takeoff.proposals.boundary_storey')?.options).toEqual(constants.BOUNDARY_OPTIONS)
    expect(shape('engine.register_check.not_found')?.options).toEqual(constants.CHECK_OPTIONS)
  })

  it('gives the drawing-list Question Step 1 raises the keys step1.py offers', () => {
    const m = /"options":\s*\[\{"key": k, "picked": False\} for k in \(([^)]*)\)\]/.exec(step1Py)
    expect(m, 'step1.py raises the lists-disagree Question with its keys').not.toBeNull()
    expect(shape('takeoff.proposals.lists_disagree')?.options).toEqual(tuple(m![1]!))
    expect(shape('takeoff.proposals.lists_disagree')?.options).toEqual(optionConstants().LISTS_OPTIONS)
  })

  it('has a Check Question for every finding the drawing-list Check raises', () => {
    const names = [...new Set([...registerPy.matchAll(/finding\s*=[^\n]*?codes\.([A-Z_]+)\(/g)].map((m) => m[1]!))]
    expect(names.length).toBeGreaterThan(0)
    const codes = names.map((name) => new RegExp(`^${name}\\s*=\\s*MessageCode\\(\\s*"([a-z_.]+)"`, 'm').exec(registerCodesPy)?.[1])
    const checks = QUESTION_SHAPES.filter((s) => s.kind === 'check').map((s) => s.code)
    expect(new Set(checks)).toEqual(new Set(codes))
  })

  it('names the Discipline and sheet-kind Questions by 21c’s codes, ending in "keep open"', () => {
    expect(proposalsPy).toMatch(/"missing_discipline",\s*said\.WHICH_DISCIPLINE/)
    expect(proposalsPy).toMatch(/"low_confidence",\s*said\.WHICH_KIND/)
    for (const s of QUESTION_SHAPES) expect(s.options.at(-1), s.code).toBe(KEEP_OPEN)
  })
})
