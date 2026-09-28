/*
 * F6 and Shift F6 (docs/design/m0-screens.md §2.2): focus moves to the next or previous region of the
 * frame (top bar, the step's list or rail, the canvas, the inspector, the status bar), each marked
 * `data-region`, in document order, wrapping round. The region itself takes focus, its ring drawn
 * inside it (`focus-inset`, system.md §7), so no ring falls off the screen or under a neighbour; Tab
 * then walks into it. A feature may mark the element F6 should land on instead with
 * `data-region-focus` (22's sheet list), which then draws its own ring inside itself too.
 */

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
  const target = [...next.querySelectorAll<HTMLElement>('[data-region-focus]')].find(visible) ?? next
  if (!target.hasAttribute('tabindex')) target.tabIndex = -1
  target.focus()
  return next
}
