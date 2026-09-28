/*
 * Toast (m0-screens §3): a dark pill at the canvas foot or the page foot, 6 s, one at a time (a new
 * one replaces the old), announced politely. When the act can be undone it carries "Undo  Ctrl Z";
 * the screen registers Ctrl Z itself (m0-screens §2.2), the button is the pointer's way.
 *
 * <ToastProvider> holds the one toast; <ToastViewport> is where it shows (the frame places it; by
 * default the provider places it at the page foot).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Trans } from '@lingui/react/macro'
import { cn } from './cn'
import { KeyCombo } from './Kbd'

export interface ToastMessage {
  /** The sentence, from the catalogue. */
  message: ReactNode
  /** Given when the act can be undone. */
  onUndo?: () => void
}

interface ToastApi {
  show(toast: ToastMessage): void
  clear(): void
}

const ToastContext = createContext<ToastApi | null>(null)
const ToastState = createContext<{ current: (ToastMessage & { id: number }) | null; clear(): void } | null>(null)

export const TOAST_MS = 6000

export function ToastProvider({ children, viewport = true }: { children: ReactNode; viewport?: boolean }) {
  const [current, setCurrent] = useState<(ToastMessage & { id: number }) | null>(null)
  const clear = useCallback(() => setCurrent(null), [])
  const api = useMemo<ToastApi>(() => ({ show: (t) => setCurrent({ ...t, id: Date.now() + Math.random() }), clear }), [clear])

  useEffect(() => {
    if (!current) return
    const timer = setTimeout(clear, TOAST_MS)
    return () => clearTimeout(timer)
  }, [current, clear])

  return (
    <ToastContext.Provider value={api}>
      <ToastState.Provider value={{ current, clear }}>
        {children}
        {viewport ? <ToastViewport className="fixed inset-x-0 bottom-6" /> : null}
      </ToastState.Provider>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast is used inside <ToastProvider>')
  return api
}

/** Where the toast shows: centred along the bottom of its positioned parent. */
export function ToastViewport({ className }: { className?: string }) {
  const state = useContext(ToastState)
  const toast = state?.current
  return (
    <div role="status" aria-live="polite" className={cn('pointer-events-none z-(--z-toast) flex justify-center', className)}>
      {toast ? (
        <div
          key={toast.id}
          className="pointer-events-auto inline-flex h-toast items-center gap-3 rounded-full bg-inverse ps-4 pe-1.5 text-sm text-ink-inverse shadow-3 animate-in fade-in-0 duration-(--motion-panel)"
        >
          <span>{toast.message}</span>
          {toast.onUndo ? (
            <button
              type="button"
              onClick={() => {
                toast.onUndo?.()
                state?.clear()
              }}
              className="inline-flex h-6 items-center gap-2 rounded-full px-2 font-medium text-ink-inverse hover:bg-inverse-hover"
            >
              <Trans>Undo</Trans>
              <KeyCombo combo="Ctrl Z" className="[&_kbd]:border-ink-secondary [&_kbd]:bg-inverse [&_kbd]:text-ink-inverse" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
