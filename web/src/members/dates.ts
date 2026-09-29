/*
 * An end date, as the invite dialog takes it (docs/design/m0-screens.md §4.4, §1.2): a calendar day
 * in the Market's time zone, shown and typed as "26 Oct 2026", sent as the end of that day there,
 * whatever the browser's own zone (CI runs in UTC; the owner in Dhaka). Nothing here reads the
 * browser's zone: every function is given the Market's.
 */

/** A calendar day: year, month 1–12, day of month. */
export interface Day {
  y: number
  m: number
  d: number
}

const partsCache = new Map<string, Intl.DateTimeFormat>()

function partsFormat(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en', {
      timeZone,
      numberingSystem: 'latn',
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    partsCache.set(timeZone, f)
  }
  return f
}

function wallClock(at: number, timeZone: string): { y: number; m: number; d: number; h: number; mi: number; s: number } {
  const get = (type: Intl.DateTimeFormatPartTypes, parts: Intl.DateTimeFormatPart[]) => Number(parts.find((p) => p.type === type)?.value)
  const parts = partsFormat(timeZone).formatToParts(new Date(at))
  return { y: get('year', parts), m: get('month', parts), d: get('day', parts), h: get('hour', parts), mi: get('minute', parts), s: get('second', parts) }
}

/** The day `at` falls on in `timeZone`. */
export function dayIn(at: Date | number, timeZone: string): Day {
  const { y, m, d } = wallClock(typeof at === 'number' ? at : at.getTime(), timeZone)
  return { y, m, d }
}

/** `timeZone`'s offset from UTC at `at`, in milliseconds (Dhaka: +6 h). */
function offsetAt(at: number, timeZone: string): number {
  const w = wallClock(at, timeZone)
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(at / 1000) * 1000
}

/** The last second of `day` in `timeZone`, as an ISO instant in UTC. */
export function endOfDay(day: Day, timeZone: string): string {
  const wall = Date.UTC(day.y, day.m - 1, day.d, 23, 59, 59)
  let at = wall - offsetAt(wall, timeZone)
  at = wall - offsetAt(at, timeZone)
  return new Date(at).toISOString()
}

/** `day` moved by `n` days. */
export function addDays(day: Day, n: number): Day {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d + n))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

/** Whole days from `from` to `to` (0 on the same day). */
export function daysBetween(from: Day, to: Day): number {
  return Math.round((Date.UTC(to.y, to.m - 1, to.d) - Date.UTC(from.y, from.m - 1, from.d)) / 86_400_000)
}

/**
 * A day typed as 1.2 writes it, "26 Oct 2026": the day, the month by the catalogue's short name (or a
 * longer word it begins, "October", "Sept"), the year; any case, any spaces. Null for anything else,
 * or a day that does not exist (31 Sep).
 */
export function parseDay(text: string, shortMonths: readonly string[]): Day | null {
  const match = /^\s*(\d{1,2})\s+(\p{L}+)\.?\s+(\d{4})\s*$/u.exec(text)
  if (!match) return null
  const [, dayText, monthText, yearText] = match
  const word = monthText!.toLocaleLowerCase()
  const index = shortMonths.findIndex((name) => {
    const short = name.toLocaleLowerCase()
    return word === short || (word.length > short.length && word.startsWith(short))
  })
  if (index < 0) return null
  const day = { y: Number(yearText), m: index + 1, d: Number(dayText) }
  const back = addDays(day, 0)
  return back.y === day.y && back.m === day.m && back.d === day.d ? day : null
}
