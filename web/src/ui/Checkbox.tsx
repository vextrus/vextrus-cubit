/*
 * A checkbox with its label (docs/design/system.md §7): the browser's own box in the accent colour, so
 * Space, the focus ring and the screen reader's state are the platform's; the label is the caller's,
 * from the catalogue, and clicking it ticks the box. An optional error line under it.
 */
import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from './cn'
import { FieldError } from './FieldError'

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  label: ReactNode
  onCheckedChange?: (checked: boolean) => void
  error?: ReactNode
}

export function Checkbox({ label, onCheckedChange, error, className, id, ...input }: CheckboxProps) {
  const own = useId()
  const inputId = id ?? own
  const errorId = error ? `${inputId}-error` : undefined
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className="inline-flex min-h-6 items-center gap-2 text-sm text-foreground">
        <input
          id={inputId}
          type="checkbox"
          {...input}
          onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="size-3.5 shrink-0 accent-primary"
        />
        <span className="min-w-0">{label}</span>
      </label>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
}
