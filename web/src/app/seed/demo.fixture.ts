/*
 * The seed's static copy (docs/design/m0-screens.md §7 and §9 ruling 5; docs/plans/M0.md, "Seed"): the
 * invented demo project's Developers, people, projects and Step 1 counts, for shell work before the
 * API exists. Everything here is invented; nothing comes from a real Drawing Set.
 *
 * `/api/me` replaces the session (ticket 20a), the projects API the project list (08), and 19a's rows
 * the Step 1 counts; until then the shell reads this. Bangladesh's format profile here must match the
 * Market row ticket 02 seeds (docs/plans/M0.md, 02): the market-literal scan allows this folder as
 * Market data (tools/lint/market_literals_allowlist.toml).
 */
import { ENGLISH } from '@/i18n/languages'
import type { MarketFormat } from '@/format/profile'

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

export type Role = 'qs' | 'md' | 'vextrus_engineer' | 'guest'

export interface SeedDeveloper {
  id: string
  name: string
  market: MarketFormat
}

export interface SeedProject {
  developer: string
  code: string
  name: string
  unitSystem: string
}

export interface SeedMembership {
  email: string
  name: string
  developer: string
  role: Role
  /** The Projects the Membership may open by code, or 'all'. */
  projects: readonly string[] | 'all'
  /** The end of the access, as stored (UTC), or null. */
  until: string | null
}

export const DEVELOPERS: readonly SeedDeveloper[] = [
  { id: 'shapla', name: 'Shapla Homes Ltd', market: BANGLADESH },
  { id: 'meghna', name: 'Meghna Properties Ltd', market: BANGLADESH },
]

export const PROJECTS: readonly SeedProject[] = [
  { developer: 'shapla', code: 'KR-01', name: 'Kadam Residence', unitSystem: 'imperial' },
  { developer: 'shapla', code: 'BP-02', name: 'Bokul Place', unitSystem: 'imperial' },
  { developer: 'shapla', code: 'SG-03', name: 'Shimul Garden', unitSystem: 'imperial' },
  { developer: 'meghna', code: 'MG-01', name: 'Meghna Heights', unitSystem: 'imperial' },
]

/** The end of 26 Oct 2026 in Dhaka. */
const END_26_OCT = '2026-10-26T17:59:59Z'

export const MEMBERSHIPS: readonly SeedMembership[] = [
  { email: 'nusrat@shapla-homes.example', name: 'Nusrat Jahan', developer: 'shapla', role: 'qs', projects: 'all', until: null },
  { email: 'kamal@shapla-homes.example', name: 'Kamal Uddin', developer: 'shapla', role: 'md', projects: 'all', until: null },
  { email: 'arif@vextrus.example', name: 'Arif Rahman', developer: 'shapla', role: 'vextrus_engineer', projects: 'all', until: END_26_OCT },
  { email: 'farhana@padma-builders.example', name: 'Farhana Kabir', developer: 'shapla', role: 'guest', projects: ['KR-01'], until: END_26_OCT },
  { email: 'tanvir@meghna.example', name: 'Tanvir Ahmed', developer: 'meghna', role: 'qs', projects: 'all', until: null },
]

/** The member the static session signs in as: the seed's QS. */
export const DEFAULT_MEMBER = 'nusrat@shapla-homes.example'

/** Step 1's counts per project after reading (m0-screens §7): 24 sheets found, 5 Questions open. */
export const STEP1: Readonly<Record<string, { found: number | null; confirmed: number; excluded: number; questionsOpen: number }>> = {
  'KR-01': { found: 24, confirmed: 0, excluded: 0, questionsOpen: 5 },
  'BP-02': { found: null, confirmed: 0, excluded: 0, questionsOpen: 0 },
  'SG-03': { found: null, confirmed: 0, excluded: 0, questionsOpen: 0 },
  'MG-01': { found: null, confirmed: 0, excluded: 0, questionsOpen: 0 },
}
