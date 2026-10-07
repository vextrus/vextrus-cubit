import { describe, expect, it } from 'vitest'
import { priceAsTyped } from './data'

describe('priceAsTyped', () => {
  it('reads a decimal as typed, grouped as lakh or thousands, or not at all', () => {
    expect(priceAsTyped('95.00')).toBe('95.00')
    expect(priceAsTyped(' 1,25,000.50 ')).toBe('125000.50')
    expect(priceAsTyped('38,400')).toBe('38400')
    expect(priceAsTyped('1,234,567')).toBe('1234567')
    expect(priceAsTyped('7')).toBe('7')
  })
  it('refuses a decimal comma, which is not a group: 95,50 is not 9550', () => {
    for (const text of ['95,50', '1,2', '12,34', ',500', '1,,000']) expect(priceAsTyped(text), text).toBeNull()
  })
  it('refuses zero in any spelling, since it would price a Resource at ৳0.00', () => {
    for (const text of ['0', '0.00', '000', '0,000']) expect(priceAsTyped(text), text).toBeNull()
  })
  it('refuses anything else, a sign and an exponent included', () => {
    for (const text of ['', 'ninety', '-5', '1e3', '1.', '.5', '৳95']) expect(priceAsTyped(text), text).toBeNull()
  })
})
