/*
 * A view's storeys in words (m0-screens §5 "Storeys", §6.8): the engine sends storey keys
 * (`floor_3`, `ground`, `basement_1`, `typical`, `not_stated`; engine/recognise/storeys.py) and these
 * word them, "3rd", "Ground", "Basement 1"; "typical (range from Step 3)", "top (top from Step 3)" and
 * "not stated" are marked amber, as questions the QS or Step 3 answers.
 */
import type { ReactNode } from 'react'
import { msg } from '@lingui/core/macro'
import type { MessageDescriptor } from '@lingui/core'
import { SelectOrdinal, Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@/ui'

const NAMED: Readonly<Record<string, MessageDescriptor>> = {
  pile: msg`Pile`,
  pile_cap: msg`Pile cap`,
  foundation: msg`Foundation`,
  lower_ground: msg`Lower ground`,
  plinth: msg`Plinth`,
  ground: msg`Ground`,
  mezzanine: msg`Mezzanine`,
  podium: msg`Podium`,
  roof: msg`Roof`,
  stair_room_roof: msg`Stair-room roof`,
  lift_machine_room: msg`Lift machine room`,
  lift_machine_room_roof: msg`Lift machine room roof`,
  typical: msg`typical (range from Step 3)`,
  top: msg`top (top from Step 3)`,
  not_stated: msg`not stated`,
}
const OPEN = new Set(['typical', 'top', 'not_stated'])
const OTHER = msg`a storey Vextrus has no name for yet`

/** The words for one storey key, and whether it is open (amber). */
export function useStoreyWords(): (key: string) => { text: ReactNode; open: boolean } {
  const { i18n } = useLingui()
  return (key) => {
    const floor = /^floor_(\d+)$/.exec(key)
    if (floor) return { text: <SelectOrdinal value={Number(floor[1])} one="#st" two="#nd" few="#rd" other="#th" />, open: false }
    const basement = /^basement_(\d+)$/.exec(key)
    if (basement) {
      const n = Number(basement[1])
      return { text: <Trans>Basement {n}</Trans>, open: false }
    }
    const named = NAMED[key]
    return { text: i18n._(named ?? OTHER), open: OPEN.has(key) }
  }
}

const RANK: Readonly<Record<string, number>> = {
  pile: 0, pile_cap: 1, foundation: 2, lower_ground: 150, plinth: 160, ground: 200, mezzanine: 210, podium: 220,
  roof: 1000, stair_room_roof: 1010, lift_machine_room: 1020, lift_machine_room_roof: 1030, typical: 2000, top: 2001, not_stated: 2002,
}

/** A storey key's place low to high (engine/recognise/storeys.py's order): basements below ground, floors above. */
export function storeyRank(key: string): number {
  const floor = /^floor_(\d+)$/.exec(key)
  if (floor) return 300 + Number(floor[1])
  const basement = /^basement_(\d+)$/.exec(key)
  if (basement) return 100 - Number(basement[1])
  return RANK[key] ?? 3000
}

/** Storey keys as text, low to high, "3rd, 5th, 7th", the open ones in amber. */
export function StoreyList({ keys }: { keys: readonly string[] }) {
  const word = useStoreyWords()
  return (
    <>
      {[...keys].sort((a, b) => storeyRank(a) - storeyRank(b)).map((key, i) => {
        const { text, open } = word(key)
        return (
          <span key={key}>
            {i > 0 ? ', ' : null}
            <span className={cn(open && 'text-question')}>{text}</span>
          </span>
        )
      })}
    </>
  )
}
