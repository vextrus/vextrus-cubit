/*
 * The shell's layers and its global keys (docs/design/m0-screens.md §2.2; ticket 03 registers them):
 *   ?          open the keys overlay (it closes on Esc, as every layer does)
 *   Ctrl K     Jump to
 *   F6         the next region;  Shift F6  the previous one
 * Esc is each layer's own (01b's primitives register it), and the step rail's while it is open.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useLingui } from '@lingui/react/macro'
import { KeysOverlay, useKeys } from '@/ui'
import { JumpTo } from './JumpTo'
import { moveToRegion } from './regions'
import type { ProjectSummary, Session } from './session'

interface Shell {
  /** Opens the keys overlay, listing the keys active where focus was (`from`, else the focused element). */
  openKeys(from: Element | null): void
  openJump(from: Element | null): void
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

  const shell = useMemo<Shell>(
    () => ({
      openKeys(from) {
        setKeysFrom(from ?? document.activeElement)
        setKeysOpen(true)
      },
      openJump() {
        setJumpOpen(true)
      },
    }),
    [],
  )

  useKeys([
    { key: '?', label: t`Open the keys overlay`, group: 'global', run: () => shell.openKeys(document.activeElement) },
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
