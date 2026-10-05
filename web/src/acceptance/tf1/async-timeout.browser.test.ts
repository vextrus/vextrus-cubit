/*
 * Ticket f1, section 3 F1 (issue #245): every findBy and waitFor in the browser tests waits up to
 * 5 s by default. The setup file (web/src/test/setup.ts) sets it once for the class: Testing
 * Library's own default, 1000 ms, failed under CI load.
 */
import { describe, expect, it } from 'vitest'
import { getConfig } from '@testing-library/react'

describe('the browser tests’ async wait', () => {
  it('is 5000 ms once the setup file has run', () => {
    expect(getConfig().asyncUtilTimeout).toBe(5000)
  })
})
