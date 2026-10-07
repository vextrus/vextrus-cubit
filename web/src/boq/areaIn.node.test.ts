import { describe, expect, it } from 'vitest'

import { areaIn } from './BoqPage'

describe('areaIn', () => {
  it('shows the stored square metres in sft when the QS types sft', () => {
    expect(areaIn({ value: '3567.4767', unit: 'm2' }, 'sft')).toBe('38400')
  })
  it('keeps square metres as stored', () => {
    expect(areaIn({ value: '3567.4767', unit: 'm2' }, 'm2')).toBe('3567.4767')
  })
})
