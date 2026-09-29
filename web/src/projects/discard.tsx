/*
 * A form dialog never throws typed text away without asking (docs/design/m0-screens.md §2.2, Esc):
 * Esc, the close button, a click outside or Cancel on a dialog holding typed text asks first, in a bar
 * inside the dialog; Esc again, or "Keep editing", goes back to the form; "Discard" closes it. Anything
 * entered counts: typed text, a choice changed, a box ticked.
 *
 *   const guard = useDiscardGuard(dirty, () => setOpen(false))
 *   <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : guard.requestClose())}>
 *     …<DiscardBar guard={guard} />
 */
import { useEffect, useId, useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { Button } from '@/ui'

export interface DiscardGuard {
  asking: boolean
  requestClose(): void
  keep(): void
  discard(): void
}

export function useDiscardGuard(dirty: boolean, close: () => void): DiscardGuard {
  const [asking, setAsking] = useState(false)
  return {
    asking,
    requestClose() {
      if (asking) setAsking(false)
      else if (dirty) setAsking(true)
      else close()
    },
    keep() {
      setAsking(false)
    },
    discard() {
      setAsking(false)
      close()
    },
  }
}

export function DiscardBar({ guard }: { guard: DiscardGuard }) {
  const id = useId()
  useEffect(() => {
    if (guard.asking) document.getElementById(`${id}-keep`)?.focus()
  }, [guard.asking, id])
  if (!guard.asking) return null
  return (
    <div role="alertdialog" aria-labelledby={`${id}-question`} className="flex items-center gap-2 rounded-md border border-question-stroke bg-question-surface px-3 py-2">
      <p id={`${id}-question`} className="min-w-0 flex-1 text-sm text-foreground">
        <Trans>Close without saving what you entered?</Trans>
      </p>
      <Button id={`${id}-keep`} variant="secondary" onClick={guard.keep}>
        <Trans>Keep editing</Trans>
      </Button>
      <Button variant="destructive" onClick={guard.discard}>
        <Trans>Discard</Trans>
      </Button>
    </div>
  )
}
