/*
 * shadcn/ui's Tabs (rtl: true), restyled on the tokens as the inspector's tabs ("Selection |
 * Questions", m0-screens §4.1): text tabs on a hairline with an indigo underline on the active one.
 * Arrow keys between tabs are Radix's own (roving focus, mirrored by the DirectionProvider).
 */
import type { ComponentProps } from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from '@/ui/cn'

function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col', className)} {...props} />
}

function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('flex h-toolbar items-stretch gap-3 border-b border-border px-3', className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'relative inline-flex items-center gap-1.5 text-sm whitespace-nowrap text-ink-secondary hover:text-foreground disabled:text-ink-disabled',
        'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent',
        'data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:after:bg-primary',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn('flex-1 outline-none', className)} {...props} />
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
