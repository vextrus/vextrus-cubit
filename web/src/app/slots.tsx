/*
 * The frame's slots (docs/plans/M0.md, "The shape of M0's code": "The status bar and toolbar take
 * contributions through slots (a feature registers an item; it never edits the frame's files)").
 *
 *   <SlotFill slot="toolbar.start" order={10}><SheetLabel /></SlotFill>     in a feature's screen
 *
 * The frame places a `SlotOutlet` for each name; a fill renders into it through a portal, so it keeps
 * its own feature's context. Fills in one slot sit in `order`, lowest first.
 */
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/ui/cn'

export type SlotName =
  /** The canvas toolbar, after the step and its Count: the sheet label, the viewer's switches (16, 22). */
  | 'toolbar.start'
  /** The canvas toolbar's end, before the keys button (the viewer's tools, "More"). */
  | 'toolbar.end'
  /** The status bar's start, before the unit system: the cursor and the stated scale (16). */
  | 'status.start'
  /** The status bar's end: Coverage (22) and the save state. */
  | 'status.end'
  /** The far end, only behind `?perf` (m0-screens §1.6). */
  | 'status.perf'
  /** The inspector's tabs (m0-screens §4.1, §6.6). */
  | 'inspector.selection'
  | 'inspector.questions'

interface Slots {
  targets: Partial<Record<SlotName, HTMLElement>>
  fills: Partial<Record<SlotName, number>>
  setTarget(name: SlotName, el: HTMLElement | null): void
  addFill(name: SlotName): () => void
}

const SlotsContext = createContext<Slots | null>(null)

export function SlotsProvider({ children }: { children: ReactNode }) {
  const [targets, setTargets] = useState<Partial<Record<SlotName, HTMLElement>>>({})
  const [fills, setFills] = useState<Partial<Record<SlotName, number>>>({})
  const setTarget = useCallback((name: SlotName, el: HTMLElement | null) => {
    setTargets((t) => {
      if ((t[name] ?? null) === el) return t
      const next = { ...t }
      if (el) next[name] = el
      else delete next[name]
      return next
    })
  }, [])
  const addFill = useCallback((name: SlotName) => {
    setFills((f) => ({ ...f, [name]: (f[name] ?? 0) + 1 }))
    return () => setFills((f) => ({ ...f, [name]: (f[name] ?? 1) - 1 }))
  }, [])
  const value = useMemo(() => ({ targets, fills, setTarget, addFill }), [targets, fills, setTarget, addFill])
  return <SlotsContext.Provider value={value}>{children}</SlotsContext.Provider>
}

function useSlots(): Slots {
  const slots = useContext(SlotsContext)
  if (!slots) throw new Error('Slots are used inside <SlotsProvider> (the frame)')
  return slots
}

/** Where a slot's fills appear. */
export function SlotOutlet({ name, className }: { name: SlotName; className?: string }) {
  const { setTarget } = useSlots()
  const ref = useCallback((el: HTMLDivElement | null) => setTarget(name, el), [name, setTarget])
  return <div ref={ref} data-slot-outlet={name} className={cn('flex min-w-0 items-center', className)} />
}

/** Contributes `children` to a slot of the frame, while mounted. */
export function SlotFill({ slot, order = 0, className, children }: { slot: SlotName; order?: number; className?: string; children: ReactNode }) {
  const { targets, addFill } = useSlots()
  useLayoutEffect(() => addFill(slot), [slot, addFill])
  const target = targets[slot]
  if (!target) return null
  return createPortal(
    <div className={cn('flex min-w-0 items-center gap-2', className)} style={{ order }}>
      {children}
    </div>,
    target,
  )
}

/** Whether anything fills a slot now (the inspector shows its empty line when not). */
export function useSlotFilled(name: SlotName): boolean {
  return (useSlots().fills[name] ?? 0) > 0
}
