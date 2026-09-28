/*
 * F6 and Shift F6 (docs/design/m0-screens.md §2.2): focus moves to the next or previous region of the
 * frame (top bar, the step's list or rail, the canvas, the inspector, the status bar), each marked
 * `data-region`, in document order, wrapping round.
 */

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'

function visible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0
}

/** Moves focus to the next (1) or previous (−1) region; returns the region focused. */
export function moveToRegion(step: 1 | -1, root: ParentNode = document): HTMLElement | null {
  const regions = [...root.querySelectorAll<HTMLElement>('[data-region]')].filter(visible)
  if (regions.length === 0) return null
  const active = document.activeElement
  const current = regions.findIndex((r) => r.contains(active))
  const next = regions[(current + step + regions.length) % regions.length]!
  const first = [...next.querySelectorAll<HTMLElement>(FOCUSABLE)].find(visible)
  if (first) first.focus()
  else {
    if (!next.hasAttribute('tabindex')) next.tabIndex = -1
    next.focus()
  }
  return next
}
