/*
 * Jump to's request to Step 1 (Ctrl K, m0-screens §2.2): "open this sheet". The address (`?sheet=`) takes the
 * QS to Step 1, but opening a sheet by paging, Esc or a row never writes it, so a second jump to the same
 * sheet would change nothing in the address. The request carries its own count, which changes on every jump,
 * so Step 1 acts on each one.
 */
import { useSyncExternalStore } from 'react'

export interface SheetRequest {
  /** How many jumps there have been; changes on every one. */
  count: number
  /** The sheet's sheet_id. */
  sheet: string
}

let current: SheetRequest = { count: 0, sheet: '' }
const listeners = new Set<() => void>()

export function requestSheet(sheet: string): void {
  current = { count: current.count + 1, sheet }
  for (const listener of [...listeners]) listener()
}

export function useSheetRequest(): SheetRequest {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    () => current,
  )
}
