import { describe, expect, it } from 'vitest'
import { BANGLADESH } from '@/app/seed/demo.fixture'
import { unitSystem } from '@/format/units'
import { areaUnitOf } from './data'

describe('areaUnitOf', () => {
  it('enters an area in square feet where the unit system writes feet and inches, else in square metres', () => {
    const { default: own, offered } = BANGLADESH.unitSystems
    expect(areaUnitOf(unitSystem(own))).toBe('sft')
    for (const other of offered.filter((k) => k !== own)) expect(areaUnitOf(unitSystem(other))).toBe('m2')
  })
})
