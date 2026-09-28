/*
 * The unit systems a Market may offer (ADR 0038 item 6; docs/data-model.md, Market and Project): each
 * one's key as the Market's data names it, its name from the catalogue (the status bar shows it,
 * m0-screens §4.1) and how it writes drawing notation. These are the unit systems' own definitions,
 * the same for every Market; which ones a Market offers, and its default, are the Market's data
 * (profile.ts). The market-literal scan allows this one file to name them
 * (tools/lint/market_literals_allowlist.toml).
 */
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { UnitSystemKey } from './profile'

/** How lengths, coordinates and levels are written: feet and inches to 1/8″, or metric. */
export type LengthNotation = 'feet-inches' | 'metric'

export interface UnitSystem {
  key: UnitSystemKey
  name: MessageDescriptor
  length: LengthNotation
}

const UNIT_SYSTEMS: Readonly<Record<string, UnitSystem>> = {
  imperial: { key: 'imperial', name: msg({ message: 'Imperial', context: 'unit system' }), length: 'feet-inches' },
  metric: { key: 'metric', name: msg({ message: 'Metric', context: 'unit system' }), length: 'metric' },
}

export class UnknownUnitSystem extends Error {
  override name = 'UnknownUnitSystem' // eslint-disable-line lingui/no-unlocalized-strings -- an error class name
}

/** The unit system a Market's data names; throws for a key the web does not know. */
export function unitSystem(key: UnitSystemKey): UnitSystem {
  const found = UNIT_SYSTEMS[key]
  if (!found) throw new UnknownUnitSystem(`No unit system "${key}" (src/format/units.ts)`) // eslint-disable-line lingui/no-unlocalized-strings -- a developer's error
  return found
}
