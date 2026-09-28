/*
 * Figures that are not drawing notation (docs/design/system.md §6; m0-screens §1.2): money, quantities,
 * counts and shares, grouped as the Market groups. One function per kind, each taking the Market's
 * format profile, so a coordinate can never reach the grouping money uses (the post-mortem's lakh
 * grouping on coordinates came from one global number formatter).
 *
 * The borrowed locale gives the digits' shapes, the decimal and group symbols and where a currency's
 * symbol goes; the profile's own `grouping` decides where the group symbols fall, and `digits` which
 * numbering system is written. Exact decimals travel as strings (docs/data-model.md §2) and are
 * formatted exactly: `Intl.NumberFormat` reads a numeric string as a decimal, never through a float,
 * and rounds half away from zero.
 */
import type { Grouping, MarketFormat } from './profile'

/** An empty figure: an em dash, never 0.000 (system.md §6). */
export const EMPTY = '—'

/** A true minus (U+2212), never a hyphen (system.md §6). */
const MINUS = '−'

/** An exact decimal as the API sends it ("1470752.50"), or a number. */
export type Decimal = string | number

/** Money as the API sends it: an exact decimal and its ISO 4217 currency (docs/plans/M0.md, 02). */
export interface Money {
  amount: string
  currency: string
}

const cache = new Map<string, Intl.NumberFormat>()

function numberFormat(profile: MarketFormat, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const all: Intl.NumberFormatOptions = { ...options, numberingSystem: profile.digits, useGrouping: false }
  const key = `${profile.locale}\u0000${JSON.stringify(all)}`
  let nf = cache.get(key)
  if (!nf) {
    nf = new Intl.NumberFormat(profile.locale, all)
    cache.set(key, nf)
  }
  return nf
}

const groupSymbols = new Map<string, string>()

/** The locale's group symbol ("," in English). */
function groupSymbol(profile: MarketFormat): string {
  const key = `${profile.locale}\u0000${profile.digits}`
  let symbol = groupSymbols.get(key)
  if (symbol === undefined) {
    const parts = new Intl.NumberFormat(profile.locale, { numberingSystem: profile.digits }).formatToParts(1234567)
    symbol = parts.find((p) => p.type === 'group')?.value ?? ','
    groupSymbols.set(key, symbol)
  }
  return symbol
}

/** 1234567 → 12,34,567 (lakh) or 1,234,567 (thousands). */
export function groupDigits(digits: string, grouping: Grouping, symbol: string): string {
  const chars = [...digits]
  if (chars.length <= 3) return digits
  const out = chars.slice(-3)
  let rest = chars.slice(0, -3)
  const size = grouping === 'lakh' ? 2 : 3
  while (rest.length > 0) {
    out.unshift(...rest.slice(-size), symbol)
    rest = rest.slice(0, -size)
  }
  return out.join('')
}

function toParts(nf: Intl.NumberFormat, value: Decimal): Intl.NumberFormatPart[] {
  return nf.formatToParts(value as Intl.StringNumericLiteral)
}

/** Formats with Intl, then groups the integer as the profile says and writes a true minus. */
function write(profile: MarketFormat, value: Decimal, options: Intl.NumberFormatOptions, grouped: boolean): string {
  const symbol = groupSymbol(profile)
  return toParts(numberFormat(profile, options), value)
    .map((part) => {
      if (part.type === 'integer' && grouped) return groupDigits(part.value, profile.grouping, symbol)
      if (part.type === 'minusSign') return MINUS
      return part.value
    })
    .join('')
}

function isEmpty(value: Decimal | null | undefined): value is null | undefined {
  return value === null || value === undefined || value === ''
}

/** A whole number, grouped as the Market groups: 2,45,600. */
export function formatInteger(value: number | null | undefined, profile: MarketFormat): string {
  if (isEmpty(value)) return EMPTY
  return write(profile, value, { maximumFractionDigits: 0, signDisplay: 'negative' }, true)
}

/**
 * A quantity, grouped as the Market groups, to the decimals its Rule Set rounds to (two by default,
 * ADR 0008): 1,24,842.50. The Billing Unit is shown beside it by the caller.
 */
export function formatQuantity(value: Decimal | null | undefined, profile: MarketFormat, decimals = 2): string {
  if (isEmpty(value)) return EMPTY
  return write(profile, value, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, signDisplay: 'negative' }, true)
}

/**
 * Money with its currency's symbol, rounded to the currency's minor units (the Market's data for its
 * own currency, else ISO 4217's through Intl): ৳1,47,07,525.50. `change` writes an explicit sign,
 * +৳42,65,400.00 and −৳1,20,500.00 (system.md §6). `symbol: false` leaves it out, for a grid column
 * whose header names the currency.
 */
export function formatMoney(
  money: Money | null | undefined,
  profile: MarketFormat,
  { change = false, symbol = true }: { change?: boolean; symbol?: boolean } = {},
): string {
  if (!money || isEmpty(money.amount)) return EMPTY
  const own = money.currency === profile.currency.code
  const digits = own ? { minimumFractionDigits: profile.currency.minorUnits, maximumFractionDigits: profile.currency.minorUnits } : {}
  const sign: Intl.NumberFormatOptions['signDisplay'] = change ? 'exceptZero' : 'negative'
  if (!symbol) {
    const fraction = own
      ? profile.currency.minorUnits
      : new Intl.NumberFormat(profile.locale, { style: 'currency', currency: money.currency }).resolvedOptions().maximumFractionDigits
    return write(profile, money.amount, { minimumFractionDigits: fraction, maximumFractionDigits: fraction, signDisplay: sign }, true)
  }
  return write(
    profile,
    money.amount,
    { style: 'currency', currency: money.currency, currencyDisplay: profile.currency.display, signDisplay: sign, ...digits },
    true,
  )
}

/** n / N (system.md §6): "12 / 13"; an unknown N is "—", never a guess. */
export function formatCount(n: number, N: number | null, profile: MarketFormat): string {
  return `${formatInteger(n, profile)} / ${N === null ? EMPTY : formatInteger(N, profile)}`
}

/**
 * A whole percent, always shown beside what it is a share of (system.md §6): 62%. It never reads 100%
 * before the whole is reached, nor 0% once something has begun; with nothing to share of, "—".
 */
export function formatShare(part: number, whole: number, profile: MarketFormat): string {
  if (!(whole > 0) || !Number.isFinite(part)) return EMPTY
  let percent = Math.round((part / whole) * 100)
  if (part < whole && percent >= 100) percent = 99
  if (part > 0 && percent <= 0) percent = 1
  return write(profile, percent / 100, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'negative' }, true)
}
