/*
 * The router keeps `?sheet=` as text (S25-D4, PR #771's round 5): a sheet's number is read and written as typed,
 * where the router's own JSON rule would make "1.10" the number 1.1, "2.0" 2 and "007" 7.
 */
import { describe, expect, it } from 'vitest'
import { parseSearch, stringifySearch } from './search'

describe('?sheet= round-trips a sheet number as text', () => {
  for (const number of ['1.10', '2.0', '007', '101', '01', 'S-04', '1e3', 'true', 'A+B', 'S 04', '"S-04"']) {
    it(`keeps ${JSON.stringify(number)} as written, read and written`, () => {
      const written = stringifySearch({ sheet: number })
      expect(parseSearch(written)).toEqual({ sheet: number })
      expect(stringifySearch(parseSearch(written))).toBe(written)
      // As typed in the address bar, unencoded where a browser would leave it so.
      if (/^[\w.-]+$/.test(number)) expect(written).toBe(`?sheet=${number}`)
    })
  }

  it('reads a typed address as text', () => {
    expect(parseSearch('?sheet=1.10')).toEqual({ sheet: '1.10' })
    expect(parseSearch('?sheet=2.0')).toEqual({ sheet: '2.0' })
    expect(parseSearch('?sheet=007')).toEqual({ sheet: '007' })
  })

  it('leaves every other value to the router’s own rule', () => {
    expect(parseSearch('?n=1.10&sheet=1.10')).toEqual({ n: 1.1, sheet: '1.10' })
    expect(stringifySearch({ n: 1.1, sheet: '1.10' })).toBe('?n=1.1&sheet=1.10')
    expect(stringifySearch({ n: 2 })).toBe('?n=2')
    expect(stringifySearch({})).toBe('')
    expect(parseSearch('')).toEqual({})
  })
})
