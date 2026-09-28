import type { ReactNode } from 'react'
import { cn } from './cn'
import { normaliseCombo } from './keys/registry'

/** A key chip, 16 px high (docs/design/m0-screens.md §3). Never a word longer than PageDown. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-kbd min-w-kbd items-center justify-center rounded-xs border border-border-strong bg-paper px-1 font-sans text-2xs font-medium text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/*
 * Key names are notation, as a keyboard prints them (design gate m13): keycaps stay Latin on an
 * Arabic or Bangla keyboard, so the names are never translated, and a combination is isolated left
 * to right. What a key does (its label in the ? overlay) is a message.
 */
/* eslint-disable lingui/no-unlocalized-strings -- keycap names, not prose */
const NAMED: Record<string, string> = {
  Escape: 'Esc',
  Delete: 'Del',
  Enter: '↵',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backspace: '⌫',
  '-': '−',
}
/* eslint-enable lingui/no-unlocalized-strings */

/** A combination as Kbd chips: `Ctrl K`, `Shift F6`, `↵`. Takes the map's written form. */
export function KeyCombo({ combo, className }: { combo: string; className?: string }) {
  const parts = normaliseCombo(combo).split(/\+(?=.)/)
  return (
    <bdi dir="ltr" className={cn('inline-flex items-center gap-0.5 whitespace-nowrap', className)}>
      {parts.map((part) => (
        <Kbd key={part}>{NAMED[part] ?? part}</Kbd>
      ))}
    </bdi>
  )
}
