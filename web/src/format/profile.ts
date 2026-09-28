/*
 * The Market on the web (docs/plans/M0.md, "The Market on the web"; ADR 0038; docs/data-model.md,
 * Market): what a Developer's Market sets on screen. `/api/me` carries it from ticket 20a; until then
 * the shell takes Bangladesh's from the seed's static copy (src/app/seed/). Every formatter takes it as
 * an argument, so no formatter holds a market.
 */
import type { Language } from '@/i18n/languages'

/** How the integer part of a figure is grouped: lakh and crore (12,34,56,789) or thousands. */
export type Grouping = 'lakh' | 'thousands'

/** A unit system's key, as the Market's data names it; its definition is in units.ts. */
export type UnitSystemKey = string

export interface MarketFormat {
  /** The language pages are shown in, with its direction (English, left to right). */
  language: Language
  /** The locale the language borrows for figures and dates (Bangladesh's English borrows one with lakh grouping). */
  locale: string
  grouping: Grouping
  /** The digits figures are written in: a Unicode numbering system (`latn`). */
  digits: string
  /** The Market's currency: its ISO 4217 code, its minor units and how its symbol is shown. */
  currency: {
    code: string
    minorUnits: number
    display: 'narrowSymbol' | 'symbol' | 'code'
  }
  /** Dates and times are shown in this IANA time zone; every time is stored in UTC. */
  timeZone: string
  /** The unit systems a project may use, and the one a new project takes. */
  unitSystems: {
    offered: readonly UnitSystemKey[]
    default: UnitSystemKey
  }
}
