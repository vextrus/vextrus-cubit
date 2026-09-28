/*
 * The segmented control (docs/design/system.md §8: List | Sheet, As read | Plot | Compare): one
 * choice of a few, on Radix's ToggleGroup, whose arrow keys follow the page's direction.
 */
import type { ReactNode } from 'react'
import { ToggleGroup } from 'radix-ui'
import { cn } from './cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** A tooltip naming the key that does the same, from the catalogue. */
  title?: string
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  /** The group's accessible name, from the catalogue. */
  label: string
  className?: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T)
      }}
      aria-label={label}
      className={cn('inline-flex h-control items-center rounded-md border border-border-strong bg-chrome-sunken p-0.5', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          title={o.title}
          className="inline-flex h-full items-center gap-1 rounded-xs px-2 text-xs font-medium whitespace-nowrap text-muted-foreground hover:text-foreground data-[state=on]:bg-paper data-[state=on]:text-foreground data-[state=on]:shadow-1"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
