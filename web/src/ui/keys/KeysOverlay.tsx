/*
 * The ? overlay (docs/design/m0-screens.md §2.1): drawn from the key map, so it lists exactly the
 * keys active where focus was when it opened, grouped "On this screen", "On the sheet", "Everywhere".
 * The shell (ticket 03) binds `?` to open it; the overlay closes itself on Esc, and on `?` again
 * (m0-screens §2.2, "Open or close"), bound inside its own dialog scope, the only one active while
 * it is open.
 */
import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { KeyCombo } from '../Kbd'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../primitives/dialog'
import { useActiveKeys, useKeys } from './KeyMapProvider'
import type { KeyGroup, RegisteredBinding } from './registry'

const GROUP_ORDER: readonly KeyGroup[] = ['screen', 'sheet', 'global']

/** `?` closes the overlay it opened; mounted inside the dialog's scope. */
function QuestionMarkCloses({ close }: { close: () => void }) {
  const { t } = useLingui()
  useKeys([{ key: '?', label: t`Close the keys overlay`, group: 'global', run: close }])
  return null
}

export function KeysOverlay({
  open,
  onOpenChange,
  from,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Where focus was when the overlay was asked for; the element focused now if not given. */
  from?: Element | null
}) {
  const { t } = useLingui()
  const activeFor = useActiveKeys()
  // Taken once per opening, from where focus was: the overlay's own Esc must not replace the
  // screen's keys in the list.
  const [snapshot, setSnapshot] = useState<{ open: boolean; bindings: RegisteredBinding[] }>({ open: false, bindings: [] })
  if (open !== snapshot.open) {
    setSnapshot({ open, bindings: open ? activeFor(from ?? document.activeElement) : [] })
  }
  const headings: Record<KeyGroup, string> = { screen: t`On this screen`, sheet: t`On the sheet`, global: t`Everywhere` }
  const groups = GROUP_ORDER.map((group) => ({ group, bindings: snapshot.bindings.filter((b) => b.group === group) })).filter(
    (g) => g.bindings.length > 0,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <QuestionMarkCloses close={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>
            <Trans>Keys</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>The keys that work here now.</Trans>
          </DialogDescription>
        </DialogHeader>
        {groups.map(({ group, bindings }) => (
          <section key={group} aria-labelledby={`keys-${group}`}>
            <h3 id={`keys-${group}`} className="mb-1 text-xs font-semibold text-ink-secondary">
              {headings[group]}
            </h3>
            <ul className="divide-y divide-border">
              {bindings.map((b: RegisteredBinding) => (
                <li key={`${b.scope.id}:${b.combo}`} className="flex h-row items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{b.label}</span>
                  <KeyCombo combo={b.combo} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  )
}
