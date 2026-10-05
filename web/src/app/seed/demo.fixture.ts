/*
 * The seed's static copy, for tests (docs/design/m0-screens.md §7): the Bangladesh Market's format
 * profile the formatters' tests read, and Step 1's counts after reading, which ticket 19a will send
 * and the frame's tests supply until then. The people and projects are api.fixture.ts's, served by
 * the in-memory API. Everything here is invented; nothing comes from a real Drawing Set, and nothing
 * here reaches a production bundle (scripts/check-dist.mjs).
 *
 * The market-literal scan allows this folder as Market data (tools/lint/market_literals_allowlist.toml).
 */
import { ENGLISH } from '@/i18n/languages'
import type { MarketFormat } from '@/format/profile'
import type { ProjectSummary } from '@/app/session'

/** The Bangladesh Market's format profile (ADR 0038): English borrowing en-IN for lakh and crore. */
export const BANGLADESH: MarketFormat = {
  language: ENGLISH,
  locale: 'en-IN',
  grouping: 'lakh',
  digits: 'latn',
  currency: { code: 'BDT', minorUnits: 2, display: 'narrowSymbol' },
  timeZone: 'Asia/Dhaka',
  unitSystems: { offered: ['imperial', 'metric'], default: 'imperial' },
}

/** Step 1's counts per project after reading (m0-screens §7): 24 sheets found, 5 Questions open. */
export const STEP1: Readonly<Record<string, ProjectSummary['step1']>> = {
  'KR-01': { found: 24, confirmed: 0, excluded: 0, questionsOpen: 5, undecided: 24 },
}
