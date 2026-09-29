/*
 * Storeys as Step 1 shows them (m0-screens §5 "Storeys", §6.8): 13's canonical keys (`floor_3`,
 * `basement_1`, `ground`, `roof`…, engine/recognise/storeys.py) in words, a run of three or more
 * floors one above another as "2nd–8th", and the storey strip: one slot per storey of the building, low
 * to high, before Step 3 the storeys the titles name (6.18 #9). A full slot is floor to floor; a bar at
 * its foot is members at that floor level.
 *
 *   <StoreysText views={sheet.views} />       // "3rd, 5th, 7th", amber "not stated", "—"
 *   <StoreyStrip slots={slots} views={sheet.views} />
 */
import type { MessageDescriptor } from '@lingui/core'
import { msg, selectOrdinal } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@/ui'
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
 * A title's storeys as stated, read into 13's keys where every part is a storey this screen knows
 * ("3RD, 5TH & 7TH FLOOR" → floor_3, floor_5, floor_7; "TYPICAL FLOOR" → typical; "PILE CAP TO 2ND
 * FLOOR" → pile_cap, to, floor_2), else null. Used only when the API sent no keys (review round 1,
 * M12): the words as stated are never shown as "not stated".
 */
export function storeysFromStated(stated: string): string[] | null {
  const text = stated
    .toLowerCase()
    .replace(/\b(floors?|flr|fl|levels?|storeys?|plans?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  const one = (part: string): string | null => {
    const p = part.trim().replace(/\.$/, '')
    const ordinal = /^(\d{1,3})\s*(st|nd|rd|th)?$/.exec(p)
    if (ordinal) return `floor_${Number(ordinal[1])}`
    const basement = /^basement\s*(\d*)$/.exec(p)
    if (basement) return basement[1] ? `basement_${Number(basement[1])}` : 'basement'
    const words: Record<string, string> = { ground: 'ground', 'g.': 'ground', g: 'ground', roof: 'roof', typical: 'typical', top: 'top', mezzanine: 'mezzanine', 'pile cap': 'pile_cap', pile: 'pile', foundation: 'foundation', plinth: 'plinth', podium: 'podium' }
    return words[p] ?? null
  }
  const keys: string[] = []
  for (const run of text.split(/\s*(?:,|&|\band\b)\s*/)) {
    if (!run) continue
    const ends = run.split(/\s+to\s+/)
    if (ends.length > 2) return null
    const read = ends.map(one)
    if (read.some((k) => k === null)) return null
    if (read.length === 2) keys.push(read[0]!, 'to', read[1]!)
    else keys.push(read[0]!)
  }
  return keys.length > 0 ? keys : null
}

/** A title's storeys as stated, in words: "3rd, 5th, 7th", "Pile cap to 2nd"; else the words as drawn. */
function StatedStoreys({ stated }: { stated: string }) {
  const words = useStoreysWords()
  const word = useStoreyWord()
  const keys = storeysFromStated(stated)
  if (keys?.includes('typical'))
    return (
      <span className="text-question">
        <Trans>typical (range from Step 3)</Trans>
      </span>
    )
  if (!keys) return <>{stated}</>
  const to = keys.indexOf('to')
  if (to > 0) {
    const from = word(keys[to - 1]!)
    const until = word(keys[to + 1]!)
    const before = words(keys.slice(0, to - 1))
    const run = <Trans>{from} to {until}</Trans>
    return before ? <>{before}, {run}</> : run
  }
  return <>{words(keys)}</>
}

/** The Storeys column's text (6.2): the storeys as stated and normalised, amber "not stated" or "typical (range from Step 3)", "—" with no plan view. */
export function StoreysText({ views, stated = '' }: { views: readonly ViewOut[] | undefined; stated?: string }) {
  const words = useStoreysWords()
  const found = plans(views)
  if (found.length === 0) return <span className="text-muted-foreground">—</span>
  const keys = found.flatMap((v) => v.storeys)
  // No storey read from the plans (the keys empty or "not stated"), but the title states some: show
  // the title's words, normalised (review round 1, M12).
  const titled = [...new Set([stated, ...found.map((v) => v.storeys_as_stated)].map((x) => x.trim()).filter(Boolean))]
  if (!keys.some((k) => k !== 'not_stated') && titled.length > 0)
    return (
      <>
        {titled.map((t, i) => (
          <span key={t}>
            {i > 0 ? ', ' : null}
            <StatedStoreys stated={t} />
          </span>
        ))}
      </>
    )
  if (keys.includes('typical'))
    return (
      <span className="text-question">
        <Trans>typical (range from Step 3)</Trans>
      </span>
    )
  // A key this screen has no words for is shown as the title states it.
  const unknown = found.filter((v) => v.storeys.some((k) => !knownStorey(k) && !NOT_A_STOREY.has(k)))
  const unknownStated = unknown.length > 0 ? unknown.map((v) => v.storeys_as_stated).filter(Boolean).join(', ') : ''
  const listed = [words(keys), unknownStated].filter(Boolean).join(', ')
  const missing = found.some((v) => !v.storeys.some((k) => k !== 'not_stated'))
  if (!listed)
    return (
      <span className="text-question">
        <Trans>not stated</Trans>
      </span>
    )
  return missing ? (
    <>
      {listed},{' '}
      <span className="text-question">
        <Trans>not stated</Trans>
      </span>
    </>
  ) : (
    <>{listed}</>
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
