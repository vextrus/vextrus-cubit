/*
 * The 14 Takeoff Steps in building-first order (CONTEXT.md, "Takeoff Step"; m0-screens §4.1), as the
 * step rail and the toolbar name them. Step 1 is the only one open in M0; the MEP Parts' own steps
 * join in M3 (ADR 0007). Ticket 19a's Library rows carry the steps from wave 4; the rail's short names
 * are the catalogue's.
 */
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { STEP_GLYPHS } from '@/ui/glyphs'

export interface TakeoffStep {
  number: number
  key: keyof typeof STEP_GLYPHS
  name: MessageDescriptor
  /** Open: Step 1 (M0); Steps 3, 4 and 6 (S16-W1). */
  open: boolean
}

export const TAKEOFF_STEPS: readonly TakeoffStep[] = [
  { number: 1, key: 'sheets', name: msg({ message: 'Sheets', context: 'Takeoff Step' }), open: true },
  { number: 2, key: 'notes', name: msg({ message: 'Notes', context: 'Takeoff Step' }), open: false },
  { number: 3, key: 'level', name: msg({ message: 'Levels', context: 'Takeoff Step' }), open: true },
  { number: 4, key: 'grid', name: msg({ message: 'Grid', context: 'Takeoff Step' }), open: true },
  { number: 5, key: 'foundation', name: msg({ message: 'Foundations', context: 'Takeoff Step' }), open: false },
  { number: 6, key: 'column', name: msg({ message: 'Columns', context: 'Takeoff Step' }), open: true },
  { number: 7, key: 'beam', name: msg({ message: 'Beams', context: 'Takeoff Step' }), open: false },
  { number: 8, key: 'slab', name: msg({ message: 'Slabs', context: 'Takeoff Step' }), open: false },
  { number: 9, key: 'stair', name: msg({ message: 'Stairs', context: 'Takeoff Step' }), open: false },
  { number: 10, key: 'tank', name: msg({ message: 'Tanks', context: 'Takeoff Step' }), open: false },
  { number: 11, key: 'wall', name: msg({ message: 'Walls', context: 'Takeoff Step' }), open: false },
  { number: 12, key: 'room', name: msg({ message: 'Rooms', context: 'Takeoff Step' }), open: false },
  { number: 13, key: 'roof', name: msg({ message: 'Roof', context: 'Takeoff Step' }), open: false },
  { number: 14, key: 'site', name: msg({ message: 'Site', context: 'Takeoff Step' }), open: false },
]

/** The step a route's `$step` names, or undefined for anything that is not 1–14. */
export function stepFor(param: string): TakeoffStep | undefined {
  if (!/^(?:[1-9]|1[0-4])$/.test(param)) return undefined
  return TAKEOFF_STEPS[Number(param) - 1]
}

/** The step a project opens on: its first step still to confirm. In M0 always Step 1, the only one open. */
export function currentStep(): TakeoffStep {
  return TAKEOFF_STEPS.find((s) => s.open) ?? TAKEOFF_STEPS[0]!
}
