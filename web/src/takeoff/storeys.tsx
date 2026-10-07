/*
 * Storeys as Step 1 shows them (m0-screens §5 "Storeys", §6.8): 13's canonical keys (`floor_3`,
 * `basement_1`, `ground`, `roof`…, engine/recognise/storeys.py) in words, a run of three or more
 * floors one above another as "2nd–8th", and the storey strip: one slot per storey of the building, low
 * to high, before Step 3 the storeys the titles name (6.18 #9). A full slot is floor to floor; a bar at
 * its foot is members at that floor level.
 *
 *   <StoreysText views={sheet.views} stated={sheet.storeys_as_stated} titled={sheet.storeys_titled} />
 *     // "3rd, 5th, 7th"; amber "not stated"; muted "3rd as titled"; "—"
 *   <StoreyStrip slots={slots} views={sheet.views} />
 */
import type { MessageDescriptor } from '@lingui/core'
import { msg, selectOrdinal } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { DrawingText, cn } from '@/ui'
import type { ViewOut } from './data'

const NAMED: Readonly<Record<string, { rank: number; words: MessageDescriptor; slot: string }>> = {
  pile: { rank: 0, words: msg({ message: 'Pile', context: 'storey' }), slot: 'foundations' },
  pile_cap: { rank: 1, words: msg({ message: 'Pile cap', context: 'storey' }), slot: 'foundations' },
  foundation: { rank: 2, words: msg({ message: 'Foundations', context: 'storey' }), slot: 'foundations' },
  lower_ground: { rank: 150, words: msg({ message: 'Lower ground', context: 'storey' }), slot: 'lower_ground' },
  plinth: { rank: 160, words: msg({ message: 'Plinth', context: 'storey' }), slot: 'plinth' },
  ground: { rank: 200, words: msg({ message: 'Ground', context: 'storey' }), slot: 'ground' },
  mezzanine: { rank: 210, words: msg({ message: 'Mezzanine', context: 'storey' }), slot: 'mezzanine' },
  podium: { rank: 220, words: msg({ message: 'Podium', context: 'storey' }), slot: 'podium' },
  roof: { rank: 1000, words: msg({ message: 'Roof', context: 'storey' }), slot: 'roof' },
  stair_room_roof: { rank: 1010, words: msg({ message: 'Stair-room roof', context: 'storey' }), slot: 'above' },
  lift_machine_room: { rank: 1020, words: msg({ message: 'Lift machine room', context: 'storey' }), slot: 'above' },
  lift_machine_room_roof: { rank: 1030, words: msg({ message: 'Lift machine room roof', context: 'storey' }), slot: 'above' },
  top: { rank: 999, words: msg({ message: 'top (top from Step 3)', context: 'storey' }), slot: 'top' },
}

/** A storey's place, low to high (13's ranks), or null for a key this screen does not know. */
export function storeyRank(key: string): number | null {
  const floor = /^floor_(\d+)$/.exec(key)
  if (floor) return 300 + Number(floor[1])
  const basement = /^basement_(\d+)$/.exec(key)
  if (basement) return 100 - Number(basement[1])
  if (key === 'basement') return 99
  return NAMED[key]?.rank ?? null
}

/** The strip's slot a storey falls in: the foundations one slot, the roofs above the roof one slot. */
export function storeySlot(key: string): string {
  if (/^floor_\d+$|^basement_\d+$/.test(key)) return key
  if (key === 'basement') return 'basement_1'
  return NAMED[key]?.slot ?? key
}

function useStoreyWord() {
  const { i18n, t } = useLingui()
  return (key: string): string => {
    const floor = /^floor_(\d+)$/.exec(key)
    if (floor) {
      const n = Number(floor[1])
      return t`${selectOrdinal(n, { one: '#st', two: '#nd', few: '#rd', other: '#th' })}`
    }
    const basement = /^basement_(\d+)$/.exec(key)
    if (basement) {
      const n = Number(basement[1])
      return n === 1 ? t`Basement` : t`Basement ${n}`
    }
    if (key === 'basement') return t`Basement`
    const named = NAMED[key]
    return named ? i18n._(named.words) : key.replace(/_/g, ' ')
  }
}

/** The keys that are not a storey of the building: said apart, never listed. */
const NOT_A_STOREY = new Set(['typical', 'top', 'not_stated'])

/** A key this screen can word: a storey of 13's vocabulary. */
export const knownStorey = (key: string) => !NOT_A_STOREY.has(key) && storeyRank(key) !== null

/**
 * "3rd, 5th, 7th"; a run of three or more floors one above another as "2nd–8th" (6.8); a list that runs
 * to the top as "1st to top (top from Step 3)" (§5).
 */
export function useStoreysWords() {
  const word = useStoreyWord()
  const { t } = useLingui()
  return (keys: readonly string[]): string => {
    const known = [...new Set(keys)].filter(knownStorey)
    known.sort((a, b) => (storeyRank(a) ?? 5000) - (storeyRank(b) ?? 5000))
    const parts: string[] = []
    for (let i = 0; i < known.length; ) {
      let j = i
      const floor = (k: string | undefined) => (k ? /^floor_(\d+)$/.exec(k) : null)
      while (floor(known[j]) && floor(known[j + 1]) && Number(floor(known[j + 1])![1]) === Number(floor(known[j])![1]) + 1) j += 1
      if (j - i >= 2) parts.push(`${word(known[i]!)}–${word(known[j]!)}`)
      else for (let k = i; k <= j; k++) parts.push(word(known[k]!))
      i = j + 1
    }
    if (keys.includes('top') && known.includes('roof')) {
      // "6TH FLOOR TO ROOF": 13 sends the storeys named and marks the run open; the floors between come from Step 3.
      const above = known.filter((k) => (storeyRank(k) ?? 0) > 1000).map(word)
      const aboveWords = new Set([...above, word('roof')])
      const below = parts.filter((p) => !aboveWords.has(p)).join(', ')
      const run = below ? t`${below} to Roof (floors between from Step 3)` : word('roof')
      return [run, ...above].join(', ')
    }
    const listed = parts.join(', ')
    return keys.includes('top') && listed ? t`${listed} to top (top from Step 3)` : listed
  }
}

const plans = (views: readonly ViewOut[] | undefined) => (views ?? []).filter((v) => v.kind === 'plan')

/**
 * The Storeys column's text (6.2, 6.8, Ruling 2 as T-W318 amended it): the plan views' storeys in
 * words; amber "not stated" for a plan view with no storey keys (the engine decided: a view's own title
 * states none and it took none from its sheet's title) or "typical (range from Step 3)". When every plan
 * view's storeys were taken from its sheet's title (`storeys_source: 'sheet_title'`), they are muted and
 * marked "as titled". A sheet with no plan view shows the storeys its title states (`titled`, the keys
 * the server read them to; with none, the words verbatim), muted, "as titled", and asks nothing; with
 * none stated, "—". The screen reads no storey from words: the engine is their one owner (S15-E3).
 */
export function StoreysText({ views, stated = '', titled }: { views: readonly ViewOut[] | undefined; stated?: string; titled?: readonly string[] | null }) {
  const words = useStoreysWords()
  const found = plans(views)
  if (found.length === 0) {
    const text = stated.trim()
    if (!text) return <span className="text-muted-foreground">—</span>
    const keys = titled ?? []
    const listed = keys.includes('typical') ? '' : words(keys)
    return (
      <span className="text-muted-foreground">
        {listed || <DrawingText kind="title" text={text} truncate={false} />} <AsTitled />
      </span>
    )
  }
  const keyed = (v: ViewOut) => v.storeys.some((k) => k !== 'not_stated')
  const keysOf = (v: ViewOut) => (keyed(v) ? v.storeys : [])
  const keys = found.flatMap(keysOf)
  if (keys.includes('typical'))
    return (
      <span className="text-question">
        <Trans>typical (range from Step 3)</Trans>
      </span>
    )
  // A key this screen has no words for is shown as the title states it.
  const unknown = found.filter((v) => v.storeys.some((k) => !knownStorey(k) && !NOT_A_STOREY.has(k)))
  const statedUnknown = unknown.map((v) => v.storeys_as_stated).filter(Boolean)
  const listed = [words(keys), ...new Set(statedUnknown)].filter(Boolean).join(', ')
  const missing = found.some((v) => keysOf(v).length === 0)
  if (!listed)
    return (
      <span className="text-question">
        <Trans>not stated</Trans>
      </span>
    )
  if (missing)
    return (
      <>
        {listed},{' '}
        <span className="text-question">
          <Trans>not stated</Trans>
        </span>
      </>
    )
  const fromTitle = found.every((v) => v.storeys_source === 'sheet_title')
  return fromTitle ? (
    <span className="text-muted-foreground">
      {listed} <AsTitled />
    </span>
  ) : (
    <>{listed}</>
  )
}

/** "as titled": storeys read from the sheet's title, not from a plan view's own (the owner's ruling on #318). */
function AsTitled() {
  return (
    <span className="text-muted-foreground">
      <Trans>as titled</Trans>
    </span>
  )
}

/** The project's slots, low to high: every storey the titles name, with Ground and Roof as landmarks. */
export function stripSlots(all: readonly (readonly ViewOut[] | undefined)[]): string[] {
  const slots = new Map<string, number>([
    ['ground', 200],
    ['roof', 1000],
  ])
  for (const views of all)
    for (const v of plans(views))
      for (const key of v.storeys) {
        const rank = storeyRank(key)
        if (rank === null || !knownStorey(key)) continue
        const slot = storeySlot(key)
        slots.set(slot, Math.min(slots.get(slot) ?? rank, rank))
      }
  return [...slots.entries()].sort((a, b) => a[1] - b[1]).map(([slot]) => slot)
}

/** The storey strip (6.8): 5 px slots with a 1 px gap; Ground and Roof a shade darker; full = floor to floor, a bar = at floor level. */
export function StoreyStrip({ slots, views, muted, size = 5 }: { slots: readonly string[]; views: readonly ViewOut[] | undefined; muted?: boolean; size?: number }) {
  const full = new Set<string>()
  const bar = new Set<string>()
  for (const v of plans(views))
    for (const key of v.storeys.filter(knownStorey)) (v.storeys_meaning === 'floor_to_floor' ? full : bar).add(storeySlot(key))
  if (full.size + bar.size === 0) return null
  return (
    <span aria-hidden dir="ltr" className={cn('inline-flex h-3 shrink-0 items-end gap-px', muted && 'opacity-40')}>
      {slots.map((slot) => (
        <span
          key={slot}
          style={{ inlineSize: size }}
          className={cn('relative h-3', slot === 'ground' || slot === 'roof' ? 'bg-border-strong' : 'bg-border-subtle')}
        >
          {full.has(slot) ? <span className="absolute inset-0 bg-ink-secondary" /> : bar.has(slot) ? <span className="absolute start-0 end-0 bottom-0 h-[3px] bg-ink-secondary" /> : null}
        </span>
      ))}
    </span>
  )
}
