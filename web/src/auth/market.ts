/*
 * The Market for the pages outside the frame. `/api/me` sends a Market only while the session works in
 * a Developer, and an invitation link's look-up sends none, yet "Access ended" and the link's page show
 * dates ("…ended on 26 Oct 2026", "…until 26 Oct 2026"), which are the Market's (m0-screens §1.2, §1.9).
 * Until the API sends the Market with them (a gap this ticket reports), these pages format with the
 * Market this browser last worked in, remembered from the frame, else with the shipped language's own
 * forms in the browser's time zone.
 */
import type { MarketFormat } from '@/format/profile'
import { UNIT_SYSTEM_KEYS } from '@/format/units'
import { SHIPPED_LANGUAGES } from '@/i18n/languages'

const KEY = 'vextrus.market'

let last: MarketFormat | null = null

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Remembers the Market the session works in (the frame calls it). */
export function rememberMarket(profile: MarketFormat): void {
  last = profile
  storage()?.setItem(KEY, JSON.stringify(profile))
}

function stored(): MarketFormat | null {
  try {
    const raw = storage()?.getItem(KEY)
    if (!raw) return null
    const found = JSON.parse(raw) as MarketFormat
    const language = SHIPPED_LANGUAGES.find((l) => l.code === found.language?.code)
    if (!language || typeof found.timeZone !== 'string' || typeof found.locale !== 'string' || !found.unitSystems?.offered?.length) return null
    return { ...found, language }
  } catch {
    return null
  }
}

/** The Market the pages outside the frame format with. */
export function outsideMarket(): MarketFormat {
  last ??= stored()
  if (last) return last
  const language = SHIPPED_LANGUAGES[0]!
  const unit = UNIT_SYSTEM_KEYS[0]!
  return {
    language,
    locale: language.code,
    grouping: 'thousands',
    digits: 'latn',
    currency: { code: 'XXX', minorUnits: 0, display: 'code' },
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    unitSystems: { offered: [unit], default: unit },
  }
}

/** Tests only: forget the remembered Market. */
export function forgetMarket(): void {
  last = null
  storage()?.removeItem(KEY)
}
