/*
 * shadcn/ui's Popover (rtl: true), restyled on the tokens (radius-panel, elev-2) and closed on Esc
 * through the key map. Radix's `side` is physical ("left" is left); the slide-in follows it.
 */
import type { ComponentProps } from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { cn } from '@/ui/cn'
import { LayerCloseProvider, LayerKeys, leaveEscToKeyMap, useLayerOpen } from './layer'

function Popover({ open, defaultOpen, onOpenChange, ...props }: ComponentProps<typeof PopoverPrimitive.Root>) {
  const [isOpen, setOpen] = useLayerOpen(open, defaultOpen, onOpenChange)
  return (
    <LayerCloseProvider close={() => setOpen(false)}>
      <PopoverPrimitive.Root data-slot="popover" open={isOpen} onOpenChange={setOpen} {...props} />
    </LayerCloseProvider>
  )
}

function PopoverTrigger(props: ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverAnchor(props: ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  children,
  onEscapeKeyDown,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        onEscapeKeyDown={(event) => {
          leaveEscToKeyMap(event)
          onEscapeKeyDown?.(event)
        }}
        className={cn(
          'z-(--z-overlay) w-72 origin-(--radix-popover-content-transform-origin) rounded-lg border border-border-raised bg-popover p-3 text-sm text-foreground shadow-2 outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
          className,
        )}
        {...props}
      >
        <LayerKeys name="popover">{children}</LayerKeys>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger }
