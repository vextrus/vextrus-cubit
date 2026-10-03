/*
 * #205: Step 1's Discipline tables are the Market's, read from the backend's own source, so a
 * Discipline added there (General, #159) is ordered and named here, never "Another Discipline".
 */
import { describe, expect, it } from 'vitest'
import libraryPy from '../../../vextrus/drawings/library.py?raw'
import { DISCIPLINE_ORDER } from './model'
import { DISCIPLINE_IN_TEXT, DISCIPLINE_NAMES, LIST_TITLES } from './words'

const marketKeys = () => [...libraryPy.matchAll(/_row\(\s*"([a-z_]+)"/g)].map((m) => m[1]!)

describe('the Discipline tables are the Market’s (#205)', () => {
  it('orders every Discipline as the backend lists them', () => {
    expect(marketKeys()).toContain('general')
    expect([...DISCIPLINE_ORDER]).toEqual(marketKeys())
  })

  it('names every Discipline, in a heading, in running text and as its drawing list', () => {
    for (const key of marketKeys()) {
      expect(DISCIPLINE_NAMES[key], key).toBeDefined()
      expect(DISCIPLINE_IN_TEXT[key], key).toBeDefined()
      expect(LIST_TITLES[key], key).toBeDefined()
    }
  })
})
