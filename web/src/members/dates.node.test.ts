/*
 * An end date's arithmetic (m0-screens §1.2, §4.4): a day in the Market's time zone, its end there,
 * and the day typed as 1.2 writes it. Nothing here reads the machine's own zone.
 */
import { describe, expect, it } from 'vitest'
import { addDays, dayIn, daysBetween, endOfDay, parseDay } from './dates'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

describe('endOfDay', () => {
  it('ends a day in Dhaka (UTC+6) at 17:59:59 UTC', () => {
    expect(endOfDay({ y: 2026, m: 10, d: 26 }, 'Asia/Dhaka')).toBe('2026-10-26T17:59:59.000Z')
  })

  it('ends a day in UTC at 23:59:59 UTC', () => {
    expect(endOfDay({ y: 2026, m: 10, d: 26 }, 'UTC')).toBe('2026-10-26T23:59:59.000Z')
  })

  it('ends a day west of UTC on the next UTC day, daylight saving included', () => {
    // Los Angeles is UTC−7 in October (daylight time) and UTC−8 in December.
    expect(endOfDay({ y: 2026, m: 10, d: 26 }, 'America/Los_Angeles')).toBe('2026-10-27T06:59:59.000Z')
    expect(endOfDay({ y: 2026, m: 12, d: 26 }, 'America/Los_Angeles')).toBe('2026-12-27T07:59:59.000Z')
  })

  it('falls on the day it names in that zone', () => {
    for (const zone of ['Asia/Dhaka', 'UTC', 'America/Los_Angeles']) {
      expect(dayIn(Date.parse(endOfDay({ y: 2026, m: 3, d: 8 }, zone)), zone)).toEqual({ y: 2026, m: 3, d: 8 })
    }
  })
})

describe('dayIn', () => {
  it('reads the day in the zone given, not the machine’s', () => {
    const at = Date.parse('2026-09-28T20:00:00Z')
    expect(dayIn(at, 'Asia/Dhaka')).toEqual({ y: 2026, m: 9, d: 29 })
    expect(dayIn(at, 'UTC')).toEqual({ y: 2026, m: 9, d: 28 })
    expect(dayIn(at, 'America/Los_Angeles')).toEqual({ y: 2026, m: 9, d: 28 })
  })
})

describe('addDays', () => {
  it('crosses a month end', () => {
    expect(addDays({ y: 2026, m: 9, d: 29 }, 30)).toEqual({ y: 2026, m: 10, d: 29 })
    expect(addDays({ y: 2026, m: 1, d: 31 }, 1)).toEqual({ y: 2026, m: 2, d: 1 })
  })

  it('crosses a year end, and a leap day', () => {
    expect(addDays({ y: 2026, m: 12, d: 15 }, 30)).toEqual({ y: 2027, m: 1, d: 14 })
    expect(addDays({ y: 2028, m: 2, d: 28 }, 1)).toEqual({ y: 2028, m: 2, d: 29 })
  })

  it('goes back', () => {
    expect(addDays({ y: 2026, m: 1, d: 1 }, -1)).toEqual({ y: 2025, m: 12, d: 31 })
  })
})

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween({ y: 2026, m: 9, d: 29 }, { y: 2026, m: 10, d: 29 })).toBe(30)
    expect(daysBetween({ y: 2026, m: 9, d: 29 }, { y: 2026, m: 9, d: 29 })).toBe(0)
    expect(daysBetween({ y: 2026, m: 12, d: 31 }, { y: 2027, m: 1, d: 1 })).toBe(1)
    expect(daysBetween({ y: 2026, m: 10, d: 1 }, { y: 2026, m: 9, d: 30 })).toBe(-1)
  })
})

describe('parseDay', () => {
  it.each([
    ['26 Oct 2026', { y: 2026, m: 10, d: 26 }],
    ['26 october 2026', { y: 2026, m: 10, d: 26 }],
    ['26 Sept 2026', { y: 2026, m: 9, d: 26 }],
    ['  3 Oct 2026 ', { y: 2026, m: 10, d: 3 }],
    ['29 Feb 2028', { y: 2028, m: 2, d: 29 }],
    ['1 JAN 2027', { y: 2027, m: 1, d: 1 }],
  ])('reads %j', (text, day) => {
    expect(parseDay(text, MONTHS)).toEqual(day)
  })

  it.each(['31 Sep 2026', '29 Feb 2026', 'Oct 26 2026', '26/10/2026', '2026-10-26', '', '26 Foo 2026', '26 Oc 2026', '26 Oct 26'])('refuses %j', (text) => {
    expect(parseDay(text, MONTHS)).toBeNull()
  })
})
