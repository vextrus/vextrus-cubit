import type { ReactNode } from 'react'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import type { MessageDescriptor } from '@lingui/core'
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

/** Key names that are words go through the catalogue; arrows and ↵ are signs. */
const NAMED: Record<string, MessageDescriptor | string> = {
  Ctrl: msg`Ctrl`,
  Alt: msg`Alt`,
  Shift: msg`Shift`,
  Escape: msg`Esc`,
  Space: msg`Space`,
  Tab: msg`Tab`,
  Home: msg`Home`,
  End: msg`End`,
  PageUp: msg`PageUp`,
  PageDown: msg`PageDown`,
  Delete: msg`Del`,
  Enter: '↵',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backspace: '⌫',
  '-': '−',
}

/** A combination as Kbd chips: `Ctrl K`, `Shift F6`, `↵`. Takes the map's written form. */
export function KeyCombo({ combo, className }: { combo: string; className?: string }) {
  const { _ } = useLingui()
  const parts = normaliseCombo(combo).split(/\+(?=.)/)
  return (
    <span className={cn('inline-flex items-center gap-0.5 whitespace-nowrap', className)} dir="ltr">
      {parts.map((part) => {
        const named = NAMED[part]
        const text = named === undefined ? part : typeof named === 'string' ? named : _(named)
        return <Kbd key={part}>{text}</Kbd>
      })}
    </span>
  )
}
