/** S25-D1 round 2 (#774): a copy is named by the first field that tells IT from EVERY other copy. */
import { describe, expect, it } from 'vitest'
import { copiesTie, telling } from './questionWords'
import type { ProposalOut } from './data'

const copy = (over: Partial<ProposalOut> & { layout?: string | null }): ProposalOut =>
  ({ title: 'SLAB', file_id: 'f1', file_name: 'A.dwg', layout: null, revision_mark: 'R0', issue_date: '2026-08-20', ...over }) as unknown as ProposalOut

describe('telling: the first of title, file, place, mark, date that no other copy shares', () => {
  it('names two copies by title when only titles differ', () => {
    const [a, b] = [copy({ title: 'NORTH' }), copy({ title: 'SOUTH' })]
    expect(telling(a, [a, b])).toBe('title')
    expect(copiesTie([a, b])).toBe(false)
  })
  it('names by file name, then place, then mark, then date', () => {
    const files = [copy({ file_id: 'f1' }), copy({ file_id: 'f2', file_name: 'B.dwg' })]
    expect(telling(files[0]!, files)).toBe('file')
    const places = [copy({}), copy({ layout: 'L2' })]
    expect(telling(places[0]!, places)).toBe('place')
    const marks = [copy({ revision_mark: 'R1' }), copy({})]
    expect(telling(marks[0]!, marks)).toBe('mark')
    const dates = [copy({ issue_date: '2026-09-14' }), copy({})]
    expect(telling(dates[0]!, dates)).toBe('date')
  })
  it('does not tell two files that share a name apart by file, and calls them a tie', () => {
    const both = [copy({ file_id: 'f1' }), copy({ file_id: 'f2' })]
    expect(telling(both[0]!, both)).toBeNull()
    expect(copiesTie(both)).toBe(true)
  })
  it('three copies titled A, B, A: B is told by title, the two As are not', () => {
    const three = [copy({ title: 'A' }), copy({ title: 'B' }), copy({ title: 'A' })]
    expect(telling(three[0]!, three)).toBeNull()
    expect(telling(three[1]!, three)).toBe('title')
    expect(copiesTie(three)).toBe(false)
  })
  it('three copies in files F1, F2, F1 with all else alike: the F2 copy is told by file, the F1 copies are not', () => {
    const three = [copy({ file_id: 'f1' }), copy({ file_id: 'f2', file_name: 'B.dwg' }), copy({ file_id: 'f1' })]
    expect(telling(three[0]!, three)).toBeNull()
    expect(telling(three[1]!, three)).toBe('file')
  })
  it('three copies: a field that is unique to one copy only is not enough for the others', () => {
    const three = [copy({ title: 'A', revision_mark: 'R1' }), copy({ title: 'A', revision_mark: 'R2' }), copy({ title: 'A', revision_mark: 'R3' })]
    expect(three.map((c) => telling(c, three))).toEqual(['mark', 'mark', 'mark'])
  })
})
