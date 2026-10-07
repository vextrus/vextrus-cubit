import { describe, expect, it } from 'vitest'
import { priceAsTyped } from './data'

describe('priceAsTyped', () => {
  it('reads a decimal as typed, lakh commas and spaces allowed', () => {
    expect(priceAsTyped('95.00')).toBe('95.00')
    expect(priceAsTyped(' 1,25,000.50 ')).toBe('125000.50')
    expect(priceAsTyped('7')).toBe('7')
  })
  it('refuses anything else, a sign and an exponent included', () => {
    for (const text of ['', 'ninety', '-5', '1e3', '1.', '.5', '৳95']) expect(priceAsTyped(text), text).toBeNull()
  })
})
