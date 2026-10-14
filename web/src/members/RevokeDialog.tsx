/*
 * "Revoke" asked first (docs/design/m0-screens.md §4.4): "End Kamal Uddin’s access now? Their next click
 * is refused. What they did stays under their name." [End access] [Cancel]. Members and access and the
 * MD's Step 1 top bar (§6.12) ask it in the same words.
 */
import { Trans } from '@lingui/react/macro'
import { Button } from '@/ui'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/primitives/dialog'

export function RevokeDialog({
  name,
  onCancel,
  onConfirm,
  onCloseAutoFocus,
}: {
  /** Whose access, or null while the dialog is closed. */
  name: string | null
  onCancel: () => void
  onConfirm: () => void
  onCloseAutoFocus?: (event: Event) => void
}) {
  const who = name ?? ''
  return (
    <Dialog open={name !== null} onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent className="sm:max-w-[420px]" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>
            <Trans>End {who}’s access now?</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Their next click is refused. What they did stays under their name.</Trans>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onCancel}>
            <Trans>Cancel</Trans>
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            <Trans>End access</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
