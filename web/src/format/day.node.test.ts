/*
 * A drawn day (ticket 22; the design gate's M1): the API sends a sheet's issue date as an ISO date,
 * read on the server in the Market's day-month order, and the web formats ISO dates only. A date as
 * drawn ("12.09.2026", which `new Date` reads as 9 Dec 2026) is no date here, shown as "—".
 */
import { describe, expect, it } from 'vitest'
import { BANGLADESH } from '@/app/seed/demo.fixture'
import { formatDay } from './dates'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (iso: string | null | undefined, timeZone = BANGLADESH.timeZone) => formatDay(iso, { ...BANGLADESH, timeZone }, (m) => MONTHS[m]!)

describe('formatDay', () => {
  it('shows an ISO date as the Market writes a day: "12 Sep 2026"', () => {
    expect(day('2026-09-12')).toBe('12 Sep 2026')
    expect(day('2026-08-02')).toBe('2 Aug 2026')
  })

  it('never moves the day, whatever the time zone', () => {
    for (const zone of ['UTC', 'Pacific/Honolulu', 'Pacific/Kiritimati']) expect(day('2026-09-12', zone)).toBe('12 Sep 2026')
  })

  it('refuses a date as drawn, so "12.09.2026" is never read as 9 Dec 2026', () => {
    for (const drawn of ['12.09.2026', '09/12/2026', '2026-9-12', '2026-02-30', '12 Sep 2026', '', null, undefined]) expect(day(drawn)).toBe('—')
  })
})
