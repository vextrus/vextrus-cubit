import { describe, expect, it } from 'vitest'

import { stateWord } from './api'

describe('stateWord', () => {
  it('reads the API\'s "proposed" as the screens\' "proposal", so Enter can confirm it', () => {
    expect(stateWord('proposed')).toBe('proposal')
    expect(stateWord('confirmed')).toBe('confirmed')
  })
})
