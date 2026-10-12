import { i18n } from '@lingui/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { groupName, sectionName, stepName } from './words'

beforeAll(() => {
  i18n.load('en', {})
  i18n.activate('en')
})

describe("the Priced BOQ's names", () => {
  it("names the seven BOQ Sections in CONTEXT.md's words", () => {
    const keys = ['sub_structure', 'super_structure', 'masonry', 'finishes', 'doors_windows', 'services', 'external_works']
    expect(keys.map((k) => sectionName(k, i18n))).toEqual([
      'Sub-structure',
      'Super-structure',
      'Masonry',
      'Finishes',
      'Doors & Windows',
      'Services',
      'External works',
    ])
  })
  it('words a key it has no name for as plain words, never the key', () => {
    expect(sectionName('lift_wells', i18n)).toBe('Lift wells')
    expect(groupName('septic_tanks', i18n)).toBe('Septic tanks')
    expect(stepName('beams', i18n)).toBe('Beams')
  })
})
