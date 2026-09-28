/*
 * Performance readouts only behind `?perf` (docs/design/m0-screens.md §1.6): adding `?perf` to any
 * address sets a flag for the tab's session, `?perf=0` clears it, and closing the tab forgets it.
 * Without the flag no readout exists in the DOM: the frame renders the `status.perf` slot only with it,
 * and features read `usePerfFlag()` before rendering their own (16's "Measure", 20b's read times).
 */
import { useRouterState } from '@tanstack/react-router'

const KEY = 'vextrus.perf'

function storage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Applies an address's `?perf` or `?perf=0` to the tab's flag, and returns the flag. */
export function applyPerfSearch(search: string): boolean {
  const params = new URLSearchParams(search)
  const store = storage()
  if (params.has('perf')) {
    const on = params.get('perf') !== '0'
    if (on) store?.setItem(KEY, '1')
    else store?.removeItem(KEY)
    return on
  }
  return store?.getItem(KEY) === '1'
}

/** The `?perf` flag, following the address. */
export function usePerfFlag(): boolean {
  const search = useRouterState({ select: (s) => s.location.searchStr })
  return applyPerfSearch(search)
}
