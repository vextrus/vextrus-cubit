/*
 * The web's Discipline tables are the Market's (#205): DISCIPLINE_ORDER is vextrus/drawings/library.py's
 * order, read from its source, and every Discipline has its name, its name in running text and its drawing
 * list's title, so none shows as "Another Discipline" or sorts as unknown.
 */
import { describe, expect, it } from 'vitest'
import libraryPy from '../../../vextrus/drawings/library.py?raw'
import { DISCIPLINE_ORDER } from './model'
import { DISCIPLINE_IN_TEXT, DISCIPLINE_NAMES, LIST_TITLES } from './words'

describe('the Discipline tables (#205)', () => {
  const keys = [...libraryPy.matchAll(/_row\(\s*"([a-z_]+)"/g)].map((m) => m[1]!)

  it('orders the Disciplines as the backend lists them, General included', () => {
    expect(keys).toContain('general')
    expect([...DISCIPLINE_ORDER]).toEqual(keys)
  })

  it('words every Discipline the backend lists', () => {
    for (const key of keys) {
      expect(DISCIPLINE_NAMES[key], key).toBeDefined()
      expect(DISCIPLINE_IN_TEXT[key], key).toBeDefined()
      expect(LIST_TITLES[key], key).toBeDefined()
    }
  })
})
