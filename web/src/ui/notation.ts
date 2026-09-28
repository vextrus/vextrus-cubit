/*
 * Drawing notation (docs/design/m0-screens.md §1.8): every piece of it is isolated left to right and
 * carries `data-notation` with its kind. DrawingText (here) and 03's formatters set it; 03's and 22's
 * DOM tests call `notationProblems` on the seeded screens.
 */

/** The kinds of drawing notation (m0-screens §1.8). */
export const NOTATION_KINDS = [
  'length',
  'coordinate',
  'level',
  'scale',
  'sheet-number',
  'revision',
  'mark',
  'grid',
  'file-name',
] as const
export type NotationKind = (typeof NOTATION_KINDS)[number]

/** Plain-text isolates (UAX #9), for tooltips, the clipboard and other text without markup. */
const LRI = '⁦'
const FSI = '⁨'
const PDI = '⁩'

/** A notation in plain text: left to right whatever surrounds it. */
export function isolateLtr(text: string): string {
  return `${LRI}${text}${PDI}`
}

/** Drawing text in plain text, in its own direction (from its first strong letter). */
export function isolateOwn(text: string): string {
  return `${FSI}${text}${PDI}`
}

/**
 * Every element under `root` marked `data-notation` that is not a left-to-right isolate, or whose
 * kind is not one of the nine. Empty when the screen keeps the rule.
 */
// Its findings are for developers' test output, never shown in the UI.
/* eslint-disable lingui/no-unlocalized-strings */
export function notationProblems(root: ParentNode): string[] {
  const problems: string[] = []
  for (const el of root.querySelectorAll<HTMLElement>('[data-notation]')) {
    const kind = el.getAttribute('data-notation') ?? ''
    const style = getComputedStyle(el)
    const where = `<${el.tagName.toLowerCase()} data-notation="${kind}">${el.textContent ?? ''}`
    if (!(NOTATION_KINDS as readonly string[]).includes(kind)) problems.push(`${where}: unknown notation kind`)
    if (el.getAttribute('dir') !== 'ltr' || style.direction !== 'ltr') problems.push(`${where}: not left to right`)
    if (style.unicodeBidi !== 'isolate') problems.push(`${where}: not an isolate`)
  }
  return problems
}
/* eslint-enable lingui/no-unlocalized-strings */
