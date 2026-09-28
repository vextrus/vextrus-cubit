/*
 * Buttons on the tokens (docs/design/system.md §2, §4, §7): 28 px controls; indigo primary; copper
 * `commit` for the one bulk Confirm a screen may carry; a spinner only inside a button that is
 * saving. IconButton is the 28 px tool button: icon-only, so its accessible name and tooltip come
 * from the caller's catalogue, with the key that does the same (m0-screens §4.6).
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from './cn'
import { KeyCombo } from './Kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from './primitives/tooltip'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium select-none transition-colors duration-(--motion-state) ease-(--ease) disabled:cursor-not-allowed disabled:border-border-strong disabled:bg-muted disabled:text-ink-disabled [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-pressed',
        secondary: 'border border-input bg-paper text-foreground hover:bg-hover active:bg-pressed',
        ghost: 'text-ink-secondary hover:bg-hover hover:text-foreground active:bg-pressed',
        commit: 'bg-commit text-commit-foreground hover:bg-commit-hover',
        destructive: 'border border-destructive bg-paper text-destructive hover:bg-over-target-surface',
      },
      size: {
        md: 'h-control px-2.5 text-sm',
        lg: 'h-control-lg px-3 text-sm',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Shows a spinner in the button and disables it while an act saves. */
    saving?: boolean
  }

export function Button({ variant, size, saving, disabled, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || saving} aria-busy={saving || undefined} {...rest}>
      {saving ? <Loader2 aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" /> : null}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  combo,
  pressed,
  className,
  children,
  type = 'button',
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'title'> & {
  /** The accessible name and tooltip, from the catalogue. */
  label: string
  /** The key that does the same, shown in the tooltip (`D`, `Shift F`). */
  combo?: string
  /** A toggle's state (CAD-dark, Outlines). */
  pressed?: boolean
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type={type}
          aria-label={label}
          aria-pressed={pressed}
          className={cn(
            'inline-flex size-control items-center justify-center rounded-md text-ink-secondary transition-colors duration-(--motion-state) hover:bg-hover hover:text-foreground [&_svg]:size-4',
            'aria-pressed:bg-selected aria-pressed:text-primary-hover aria-pressed:ring-1 aria-pressed:ring-selected-strong aria-pressed:ring-inset',
            className,
          )}
          {...rest}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {combo ? <KeyCombo combo={combo} className="[&_kbd]:border-ink-secondary [&_kbd]:bg-inverse [&_kbd]:text-ink-inverse" /> : null}
      </TooltipContent>
    </Tooltip>
  )
}
