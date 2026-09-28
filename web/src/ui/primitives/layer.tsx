/*
 * Every layer that closes on Esc (a dialog, a popover, a menu) closes through the key map, not
 * through Radix's own listener, so the Esc stack of m0-screens §2.2 has one owner: the layer's
 * content mounts a dialog scope whose Esc closes it. Radix is told to ignore Esc
 * (`onEscapeKeyDown` prevents its default).
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { useLingui } from '@lingui/react/macro'
import { KeyScope, useKeys } from '../keys/KeyMapProvider'

const LayerClose = createContext<(() => void) | null>(null)

/** Open state for a Radix root, controlled or not, and the close function its content needs. */
export function useLayerOpen(open: boolean | undefined, defaultOpen: boolean | undefined, onOpenChange?: (open: boolean) => void) {
  const [inner, setInner] = useState(defaultOpen ?? false)
  const isOpen = open ?? inner
  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setInner(next)
      onOpenChange?.(next)
    },
    [open, onOpenChange],
  )
  return [isOpen, setOpen] as const
}

export function LayerCloseProvider({ close, children }: { close: () => void; children: ReactNode }) {
  return <LayerClose.Provider value={close}>{children}</LayerClose.Provider>
}

function EscCloses({ close }: { close: () => void }) {
  const { t } = useLingui()
  useKeys([{ key: 'Escape', label: t`Close`, group: 'screen', run: close }])
  return null
}

/** Mount inside a layer's content: while it is open, its keys are the only ones active. */
export function LayerKeys({ name, children }: { name: string; children: ReactNode }) {
  const close = useContext(LayerClose)
  return (
    <KeyScope level="dialog" name={name}>
      {close ? <EscCloses close={close} /> : null}
      {children}
    </KeyScope>
  )
}

/**
 * Where focus goes when a layer closes: back to the element that had it when the layer opened
 * (design gate M1). Radix returns focus to the layer's trigger, and a dialog opened by a key (the ?
 * overlay, Jump to) has none, so focus fell to the page and the list's keys stopped working. Pass
 * both handlers to the Radix content: `onOpenAutoFocus` runs as it mounts, before it moves focus.
 */
export function useReturnFocus(handlers: {
  onOpenAutoFocus?: (event: Event) => void
  onCloseAutoFocus?: (event: Event) => void
}): { onOpenAutoFocus: (event: Event) => void; onCloseAutoFocus: (event: Event) => void } {
  const opener = useRef<Element | null>(null)
  return {
    onOpenAutoFocus(event) {
      opener.current = document.activeElement
      handlers.onOpenAutoFocus?.(event)
    },
    onCloseAutoFocus(event) {
      handlers.onCloseAutoFocus?.(event)
      if (event.defaultPrevented) return
      const el = opener.current
      if (el instanceof HTMLElement && el !== document.body && el.isConnected) {
        event.preventDefault()
        el.focus({ preventScroll: true })
      }
    },
  }
}

/** Pass to a Radix content's `onEscapeKeyDown`: the key map closes the layer instead. */
export function leaveEscToKeyMap(event: KeyboardEvent): void {
  event.preventDefault()
}
