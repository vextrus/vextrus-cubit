/*
 * shadcn/ui's Dialog (initialised with `rtl: true`, components.json), restyled on the tokens
 * (docs/design/system.md §4: radius-panel, elev-3) and closed on Esc through the key map.
 * Centred without a transform, so nothing in the chrome is `translate-x`.
 */
import type { ComponentProps } from 'react'
import { XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useLingui } from '@lingui/react/macro'
import { cn } from '@/ui/cn'
import { LayerCloseProvider, LayerKeys, leaveEscToKeyMap, useLayerOpen } from './layer'

function Dialog({ open, defaultOpen, onOpenChange, ...props }: ComponentProps<typeof DialogPrimitive.Root>) {
  const [isOpen, setOpen] = useLayerOpen(open, defaultOpen, onOpenChange)
  return (
    <LayerCloseProvider close={() => setOpen(false)}>
      <DialogPrimitive.Root data-slot="dialog" open={isOpen} onOpenChange={setOpen} {...props} />
    </LayerCloseProvider>
  )
}

function DialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose(props: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-(--z-overlay) bg-inverse/30 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onEscapeKeyDown,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }) {
  const { t } = useLingui()
  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        onEscapeKeyDown={(event) => {
          leaveEscToKeyMap(event)
          onEscapeKeyDown?.(event)
        }}
        className={cn(
          'fixed inset-x-0 top-[12vh] z-(--z-overlay) mx-auto grid max-h-[76vh] w-full max-w-[calc(100%-2rem)] gap-3 overflow-auto rounded-lg border border-border-raised bg-popover p-4 text-foreground shadow-3 outline-none duration-(--motion-panel) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 sm:max-w-lg',
          className,
        )}
        {...props}
      >
        <LayerKeys name="dialog">
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              className="absolute end-2 top-2 inline-flex size-control items-center justify-center rounded-md text-ink-secondary hover:bg-hover hover:text-foreground [&_svg]:size-4"
            >
              <XIcon aria-hidden />
              <span className="sr-only">{t`Close`}</span>
            </DialogPrimitive.Close>
          ) : null}
        </LayerKeys>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('flex flex-col gap-1 pe-8 text-start', className)} {...props} />
}

function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="dialog-footer" className={cn('flex justify-end gap-2', className)} {...props} />
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn('text-lg font-semibold', className)} {...props} />
}

function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description data-slot="dialog-description" className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogTitle, DialogTrigger }
