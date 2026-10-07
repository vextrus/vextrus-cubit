/*
 * Steps 3, 4 and 6's decisions without the screen (model.ts): which proposals Enter confirms and X
 * leaves out, a group's mark, the next group to go to, and how a typed level or size is read.
 */
import { describe, expect, it } from 'vitest'
import type { FrameGroup, FrameProposal, StoreyOut } from './api'
import { counts, groupState, lowToHigh, nextOpenGroup, readDecimal, readSize, toConfirm, toExclude, toUndo, valueText } from './model'

let n = 0
const proposal = (state: string, questions = 0): FrameProposal => {
  n += 1
  return {
    id: `p${n}`,
    family: 'column',
    mark: 'C1',
    storey: 'Ground',
    values: {},
    state,
    questions: Array.from({ length: questions }, () => ({ code: 'q', params: {} })),
    trace: [],
  }
}
const group = (key: string, ...proposals: FrameProposal[]): FrameGroup => ({ key, label: key, proposals })

describe('what Enter and X act on', () => {
  it('confirms the agreeing proposals only: open, and no Question holds them', () => {
    const agree = proposal('proposal')
    const held = proposal('proposal', 1)
    const done = proposal('confirmed')
    const left = proposal('excluded')
    expect(toConfirm(group('g', agree, held, done, left))).toEqual([agree])
  })

  it('leaves out every proposal still open, held or not', () => {
    const agree = proposal('proposal')
    const held = proposal('proposal', 1)
    const done = proposal('confirmed')
    expect(toExclude(group('g', agree, held, done))).toEqual([agree, held])
  })

  it('takes back what was confirmed or left out, nothing else', () => {
    const open = proposal('proposal')
    const done = proposal('confirmed')
    const left = proposal('excluded')
    expect(toUndo(group('g', open, done, left))).toEqual([done, left])
  })
})

describe('a group’s mark and the next group', () => {
  it('a Question wins, then all confirmed, then all left out, else Proposals ready', () => {
    expect(groupState(group('a', proposal('proposal', 1), proposal('confirmed')))).toBe('question')
    expect(groupState(group('b', proposal('confirmed'), proposal('confirmed')))).toBe('confirmed')
    expect(groupState(group('c', proposal('excluded')))).toBe('excluded')
    expect(groupState(group('d', proposal('proposal'), proposal('confirmed')))).toBe('proposal')
    expect(groupState(group('e'))).toBe('proposal')
  })

  it('goes to the next group with something to confirm or a Question, wrapping, and to none when all are done', () => {
    const a = group('a', proposal('confirmed'))
    const b = group('b', proposal('proposal'))
    const c = group('c', proposal('proposal', 1))
    expect(nextOpenGroup([a, b, c], null)).toBe(b)
    expect(nextOpenGroup([a, b, c], 'b')).toBe(c)
    expect(nextOpenGroup([a, b, c], 'c')).toBe(b)
    expect(nextOpenGroup([a, group('x', proposal('excluded'))], null)).toBeNull()
    expect(nextOpenGroup([], null)).toBeNull()
  })

  it('counts proposals, not groups', () => {
    const g = [group('a', proposal('confirmed'), proposal('confirmed'), proposal('excluded')), group('b', proposal('proposal', 1), proposal('proposal'))]
    expect(counts(g)).toEqual({ n: 2, N: 5, excluded: 1, questions: 1 })
  })
})

describe('typed levels and sizes', () => {
  it('reads a decimal as the plain string the API takes, never through a float', () => {
    expect(readDecimal('3.5')).toBe('3.5')
    expect(readDecimal(' -3 ')).toBe('-3')
    expect(readDecimal('3,5')).toBe('3.5')
    expect(readDecimal('−0.250')).toBe('-0.250')
    expect(readDecimal('১২.৫')).toBe('12.5')
    expect(readDecimal('.5')).toBe('0.5')
    expect(readDecimal('3.100000000000000000001')).toBe('3.100000000000000000001')
  })

  it('refuses what is not a number', () => {
    for (const bad of ['', ' ', 'abc', '3.', '1e3', '--3', '3 m', '1.2.3', '-']) expect(readDecimal(bad), bad).toBeNull()
  })

  it('a size is a number above zero', () => {
    expect(readSize('12')).toBe('12')
    expect(readSize('0.5')).toBe('0.5')
    for (const bad of ['0', '0.00', '-4', 'x', '']) expect(readSize(bad), bad).toBeNull()
  })
})

describe('storeys and values', () => {
  it('lists storeys low to high by their order, whatever order they came in', () => {
    const s = (name: string, order: number): StoreyOut => ({ id: name, name, order, level_m: null, height_m: null, level_basis: 'default' })
    expect(lowToHigh([s('2nd', 3), s('Basement', 0), s('1st', 2), s('Ground', 1)]).map((x) => x.name)).toEqual(['Basement', 'Ground', '1st', '2nd'])
  })

  it('reads a value as text, whether the API sent a string, a number or {text}', () => {
    expect(valueText({ a: '10' }, 'a')).toBe('10')
    expect(valueText({ a: 10 }, 'a')).toBe('10')
    expect(valueText({ a: { value: '10', text: '10"' } }, 'a')).toBe('10"')
    expect(valueText({ a: null }, 'a')).toBeNull()
    expect(valueText({}, 'a')).toBeNull()
  })
})
