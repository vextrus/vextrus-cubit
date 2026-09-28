/*
 * The other half of the U9 DOM test (docs/design/m0-screens.md §1.8; ui/notation.ts has the first):
 * a formatted length, coordinate, level or scale that appears in the page without its left-to-right
 * isolate marked `data-notation`. A screen's test runs both on the seed; `extra` adds the patterns
 * only that screen knows, such as the seed's sheet numbers.
 */

/** Figures only the formatters write: feet and inches with primes, metric lengths and levels, scales. */
export const FORMATTED_NOTATION: readonly RegExp[] = [
  /[−+±]?\d+′-\d+[⅛¼⅜½⅝¾⅞]?″/u,
  /[−+±]?\d+\.\d{3}\u00a0m\b/u,
  /\d+\u00a0mm\b/u,
  /\b1:\d+\b/u,
]

/** Each text in `root` holding a formatted figure outside an element marked `data-notation`. */
export function unmarkedNotation(root: Node, extra: readonly RegExp[] = []): string[] {
  const patterns = [...FORMATTED_NOTATION, ...extra]
  const found: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    if (!patterns.some((p) => p.test(text))) continue
    if (node.parentElement?.closest('[data-notation]')) continue
    found.push(text)
  }
  return found
}
