/*
 * The segmented control (docs/design/system.md §8: List | Sheet, As read | Plot | Compare): one
 * choice of a few, on Radix's ToggleGroup, whose arrow keys follow the page's direction and, as a
 * radio group's do, choose as they move.
 */
import type { ReactNode } from 'react'
import { ToggleGroup } from 'radix-ui'
import { cn } from './cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** A tooltip naming the key that does the same, from the catalogue; for a disabled option, why. */
  title?: string
  /**
   * Not choosable now: marked `aria-disabled` (not `disabled`, so its tooltip still shows why), skipped
   * by the choice that follows focus; a click calls `onRefused` instead of `onChange`.
   */
  disabled?: boolean
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  onRefused,
}: {
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  /** A disabled option was clicked: say why (6.13's no-Plot note). */
  onRefused?: (value: T) => void
  /** The group's accessible name, from the catalogue. */
  label: string
  className?: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (!next) return
        if (options.find((o) => o.value === next)?.disabled) onRefused?.(next as T)
        else onChange(next as T)
      }}
      aria-label={label}
      className={cn('inline-flex h-control items-center rounded-md border border-border-strong bg-chrome-sunken p-0.5', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          title={o.title}
          aria-disabled={o.disabled || undefined}
          // A radio group chooses as the arrow keys move (WAI-ARIA's radio group; design gate 20a r1):
          // the choice follows focus, which the arrows move and a click or Tab also brings.
          onFocus={() => {
            if (o.value !== value && !o.disabled) onChange(o.value)
          }}
          className="inline-flex h-full items-center gap-1 rounded-xs px-2 text-xs font-medium whitespace-nowrap text-muted-foreground hover:text-foreground data-[state=on]:bg-paper data-[state=on]:text-foreground data-[state=on]:shadow-1 aria-disabled:cursor-not-allowed aria-disabled:text-ink-disabled aria-disabled:hover:text-ink-disabled"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
