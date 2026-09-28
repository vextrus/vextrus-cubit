/*
 * The shell's layers and its global keys (docs/design/m0-screens.md §2.2; ticket 03 registers them):
 *   ?          open or close the keys overlay (the overlay binds ? inside itself to close)
 *   Ctrl K     Jump to
 *   F6         the next region;  Shift F6  the previous one
 *   Esc        close the top-most layer: an open dialog, popover or menu closes itself through its
 *              own dialog scope (01b's primitives), which outranks this; this one closes the shell's
 *              own panels (the open step rail), newest first, through `useCloseOnEsc`
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLingui } from '@lingui/react/macro'
import { KeysOverlay, useKeys } from '@/ui'
import { JumpTo } from './JumpTo'
import { moveToRegion } from './regions'
import type { ProjectSummary, Session } from './session'

interface Shell {
  /** Opens the keys overlay, listing the keys active where focus was (`from`, else the focused element). */
  openKeys(from: Element | null): void
  openJump(from: Element | null): void
  /** Adds a panel Esc closes; `close` returns false when the panel is not open. Returns the remover. */
  addCloser(close: () => boolean): () => void
}

const ShellContext = createContext<Shell | null>(null)

export function useShell(): Shell {
  const shell = useContext(ShellContext)
  if (!shell) throw new Error('useShell() is used inside the frame')
  return shell
}

export function ShellProvider({ session, project, children }: { session: Session; project: ProjectSummary | undefined; children: ReactNode }) {
  const { t } = useLingui()
  const [keysOpen, setKeysOpen] = useState(false)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [keysFrom, setKeysFrom] = useState<Element | null>(null)
  const closers = useRef<(() => boolean)[]>([])

  const shell = useMemo<Shell>(
    () => ({
      openKeys(from) {
        setKeysFrom(from ?? document.activeElement)
        setKeysOpen(true)
      },
      openJump() {
        setJumpOpen(true)
      },
      addCloser(close) {
        closers.current.push(close)
        return () => {
          closers.current = closers.current.filter((c) => c !== close)
        }
      },
    }),
    [],
  )

  useKeys([
    { key: '?', label: t`Open or close the keys overlay`, group: 'global', run: () => shell.openKeys(document.activeElement) },
    {
      key: 'Escape',
      label: t`Close the top-most layer`,
      group: 'global',
      run: () => void [...closers.current].reverse().some((close) => close()),
    },
    { key: 'Ctrl K', label: t`Jump to a project, or a place in this one`, group: 'global', run: () => shell.openJump(document.activeElement) },
    { key: 'F6', label: t`Move to the next region`, group: 'global', run: () => void moveToRegion(1) },
    { key: 'Shift F6', label: t`Move to the previous region`, group: 'global', run: () => void moveToRegion(-1) },
  ])

  return (
    <ShellContext.Provider value={shell}>
      {children}
      <KeysOverlay open={keysOpen} onOpenChange={setKeysOpen} from={keysFrom} />
      <JumpTo open={jumpOpen} onOpenChange={setJumpOpen} session={session} project={project} />
    </ShellContext.Provider>
  )
}

/** Registers a panel of the shell's (the open step rail) with the global Esc, newest first. */
export function useCloseOnEsc(open: boolean, close: () => void): void {
  const shell = useShell()
  const latest = useRef({ open, close })
  useEffect(() => {
    latest.current = { open, close }
  })
  useEffect(
    () =>
      shell.addCloser(() => {
        if (!latest.current.open) return false
        latest.current.close()
        return true
      }),
    [shell],
  )
}
