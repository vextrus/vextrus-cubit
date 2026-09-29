/*
 * Dates and times (docs/design/m0-screens.md §1.2, §1.9): a date as "26 Sep 2026" and a time as
 * "10:42", in the Market's time zone, though every time is stored in UTC. The borrowed locale gives
 * the order of day, month and year and the digits; the month's short name comes from the catalogue,
 * because the locale Bangladesh's English borrows writes "Sept" and a Dhaka QS writes "Sep" (§1.9;
 * the table of expected strings holds that row).
 */
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { EMPTY } from './numbers'
import type { MarketFormat } from './profile'

/** Each month's short name, January first, from the catalogue. */
export const SHORT_MONTHS: readonly MessageDescriptor[] = [
  msg({ message: 'Jan', context: 'short month' }),
  msg({ message: 'Feb', context: 'short month' }),
  msg({ message: 'Mar', context: 'short month' }),
  msg({ message: 'Apr', context: 'short month' }),
  msg({ message: 'May', context: 'short month' }),
  msg({ message: 'Jun', context: 'short month' }),
  msg({ message: 'Jul', context: 'short month' }),
  msg({ message: 'Aug', context: 'short month' }),
  msg({ message: 'Sep', context: 'short month' }),
  msg({ message: 'Oct', context: 'short month' }),
  msg({ message: 'Nov', context: 'short month' }),
  msg({ message: 'Dec', context: 'short month' }),
]

/** A time as stored (an ISO 8601 instant in UTC, or a Date). */
export type Instant = string | Date

function toDate(at: Instant | null | undefined): Date | null {
  if (at === null || at === undefined || at === '') return null
  const date = at instanceof Date ? at : new Date(at)
  return Number.isNaN(date.getTime()) ? null : date
}

const cache = new Map<string, Intl.DateTimeFormat>()

function dateFormat(profile: MarketFormat, options: Intl.DateTimeFormatOptions, digits = profile.digits): Intl.DateTimeFormat {
  const all: Intl.DateTimeFormatOptions = { ...options, timeZone: profile.timeZone, numberingSystem: digits }
  const key = `${profile.locale}\u0000${JSON.stringify(all)}`
  let f = cache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(profile.locale, all)
    cache.set(key, f)
  }
  return f
}

/** The calendar day in the Market's time zone, in Latin digits: [year, month 1–12, day]. */
function calendarDay(date: Date, profile: MarketFormat): [number, number, number] {
  const parts = dateFormat(profile, { year: 'numeric', month: 'numeric', day: 'numeric' }, 'latn').formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value)
  return [get('year'), get('month'), get('day')]
}

/** "26 Sep 2026": day, the catalogue's short month, year, in the Market's time zone. */
export function formatDate(at: Instant | null | undefined, profile: MarketFormat, monthName: (month: number) => string): string {
  const date = toDate(at)
  if (!date) return EMPTY
  const [, month] = calendarDay(date, profile)
  return dateFormat(profile, { day: 'numeric', month: 'short', year: 'numeric' })
    .formatToParts(date)
    .map((part) => (part.type === 'month' ? monthName(month - 1) : part.value))
    .join('')
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * "12 Sep 2026" from a calendar day the API sends as an ISO date ("2026-09-12"), such as a sheet's
 * issue date; no time zone moves it. Anything else ("12.09.2026", an instant) is not a day and shows
 * as empty: the API reads a drawing's date in the Market's order, never the browser.
 */
export function formatDay(iso: string | null | undefined, profile: MarketFormat, monthName: (month: number) => string): string {
  const found = iso ? ISO_DAY.exec(iso) : null
  if (!found) return EMPTY
  const [year, month, day] = [Number(found[1]), Number(found[2]), Number(found[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return EMPTY
  return formatDate(date, { ...profile, timeZone: 'UTC' }, monthName)
}

/** "10:42": hours and minutes on the 24-hour clock, in the Market's time zone. */
export function formatTime(at: Instant | null | undefined, profile: MarketFormat): string {
  const date = toDate(at)
  if (!date) return EMPTY
  return dateFormat(profile, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}

/**
 * Whole calendar days from `from` to `to`, both read as days in the Market's time zone (the
 * AccessChip's "ends in 2 days"): 0 on the same day, negative once `to` has passed.
 */
export function daysBetween(from: Instant, to: Instant, profile: MarketFormat): number {
  const a = toDate(from)
  const b = toDate(to)
  if (!a || !b) return Number.NaN
  const [ya, ma, da] = calendarDay(a, profile)
  const [yb, mb, db] = calendarDay(b, profile)
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000)
}
