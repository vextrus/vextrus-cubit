/*
 * n / N (docs/design/system.md §6; m0-screens §3): n bold, "/ N" muted, an optional label; an
 * unknown N shows "—", never a guess, and a count is never a percentage alone. Figures are grouped
 * by `format`, which ticket 03's Market formatter supplies; until then the active language's.
 */
import { useLingui } from '@lingui/react'
import type { ReactNode } from 'react'
import { cn } from './cn'

export function Count({
  n,
  N,
  label,
  format,
  className,
}: {
  n: number
  /** The drawing's own total; null when it is not known. */
  N: number | null
  label?: ReactNode
  format?: (value: number) => string
  className?: string
}) {
  const { i18n } = useLingui()
  const f = format ?? ((v: number) => i18n.number(v))
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 whitespace-nowrap', className)}>
      <span className="num">
        <span className="font-semibold text-foreground">{f(n)}</span>
        <span className="text-muted-foreground"> / {N === null ? '—' : f(N)}</span>
      </span>
      {label ? <span className="text-muted-foreground">{label}</span> : null}
    </span>
  )
}
