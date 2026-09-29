/*
 * A text field (docs/design/system.md §4, §7): its label above, a 28 px input (32 px with `size="lg"`),
 * a hint line, and when refused a red edge and the error line under it. The label, hint and error come
 * from the caller's catalogue; the input takes every native attribute (`type`, `autoComplete`, …).
 * No `required` attribute: the browser's own bubble would speak words outside the catalogue, so a
 * missing value is refused by the caller or the API, under the field.
 */
import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { cn } from './cn'
import { FieldError } from './FieldError'

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  /** 28 px (the default) or 32 px, the sign-in card's. */
  size?: 'md' | 'lg'
  /** Shown after the input on the same line, such as "(30 days)". */
  after?: ReactNode
  ref?: Ref<HTMLInputElement>
  fieldClassName?: string
}

export function TextField({ label, hint, error, size = 'md', after, className, fieldClassName, id, ref, ...input }: TextFieldProps) {
  const own = useId()
  const inputId = id ?? own
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const described = [input['aria-describedby'], errorId, hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className="text-xs font-semibold text-ink-secondary">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          id={inputId}
          {...input}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={cn(
            'min-w-0 flex-1 rounded-md border border-input bg-paper px-2 text-sm text-foreground placeholder:text-muted-foreground',
            'read-only:bg-chrome-sunken disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-disabled',
            'aria-invalid:border-destructive aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive)]',
            size === 'lg' ? 'h-control-lg' : 'h-control',
            fieldClassName,
          )}
        />
        {after}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
}
