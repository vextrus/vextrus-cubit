/*
 * The progress line (m0-screens §3): a 3 px bar under a status text, plus the words. Determinate when
 * steps are counted; else a slow sweep along the inline axis, which is still under reduced motion.
 * The bar is named by its status text.
 */
import { useId, type ReactNode } from 'react'
import { cn } from './cn'

export function ProgressLine({ value, children, className }: { value?: number; children: ReactNode; className?: string }) {
  const labelId = useId()
  const share = value === undefined ? undefined : Math.min(1, Math.max(0, value))
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span id={labelId} className="text-sm text-ink-secondary">
        {children}
      </span>
      <span
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={share === undefined ? undefined : 0}
        aria-valuemax={share === undefined ? undefined : 100}
        aria-valuenow={share === undefined ? undefined : Math.round(share * 100)}
        className="relative block h-progress-line overflow-hidden rounded-full bg-border"
      >
        {share === undefined ? (
          <span className="progress-sweep rounded-full" />
        ) : (
          <span className="absolute inset-y-0 start-0 rounded-full bg-primary" style={{ width: `${share * 100}%` }} />
        )}
      </span>
    </div>
  )
}
