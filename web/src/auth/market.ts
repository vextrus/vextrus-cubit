/*
 * The format profile of the pages outside the frame, where no Developer is chosen: sign-in, the
 * chooser, "No access". None of them shows a date or a figure; the two that show dates, "Access ended"
 * and an invitation link's page, word them with the Market the API sends beside them (`ended[].market`,
 * the look-up's `market`; the orchestrator's ruling, 29 Sep 2026), never with this. It holds no Market:
 * the shipped language's own forms, dates in UTC (how times are stored), never the browser's zone.
 */
import type { MarketFormat } from '@/format/profile'
import { UNIT_SYSTEM_KEYS } from '@/format/units'
import { SHIPPED_LANGUAGES } from '@/i18n/languages'

export function neutralFormat(): MarketFormat {
  const language = SHIPPED_LANGUAGES[0]!
  const unit = UNIT_SYSTEM_KEYS[0]!
  return {
    language,
    locale: language.code,
    grouping: 'thousands',
    digits: 'latn',
    currency: { code: 'XXX', minorUnits: 0, display: 'code' },
    timeZone: 'UTC',
    unitSystems: { offered: [unit], default: unit },
  }
}
