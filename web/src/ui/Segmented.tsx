/*
 * The segmented control (docs/design/system.md §8: List | Sheet, As read | Plot | Compare): one
 * choice of a few, on Radix's ToggleGroup, whose arrow keys follow the page's direction and, as a
 * radio group's do, choose as they move. With nothing chosen yet (`value` null), focus chooses nothing,
 * as a radio group with none checked: Tab passing through never makes a choice the person did not make.
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
  describedBy,
  className,
}: {
  value: T | null
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  /** The group's accessible name, from the catalogue. */
  label: string
  /** The id of words that say more about the choice (an error asking for one). */
  describedBy?: string
  className?: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value ?? ''}
      onValueChange={(next) => {
        if (next) onChange(next as T)
      }}
      aria-label={label}
      aria-describedby={describedBy}
      className={cn('inline-flex h-control items-center rounded-md border border-border-strong bg-chrome-sunken p-0.5', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          title={o.title}
          // A radio group chooses as the arrow keys move (WAI-ARIA's radio group; design gate 20a r1):
          // the choice follows focus, which the arrows move and a click or Tab also brings.
          onFocus={() => {
            if (value !== null && o.value !== value) onChange(o.value)
          }}
          className="inline-flex h-full items-center gap-1 rounded-xs px-2 text-xs font-medium whitespace-nowrap text-muted-foreground hover:text-foreground data-[state=on]:bg-paper data-[state=on]:text-foreground data-[state=on]:shadow-1"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
