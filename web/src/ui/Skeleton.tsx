/*
 * Loading (docs/design/system.md §7; m0-screens §3): grey bars with a shimmer that stops under
 * reduced motion, plus one line of what is happening ("Opening Kadam Residence…"). No spinner over
 * a table or a canvas.
 */
import type { ReactNode } from 'react'
import { cn } from './cn'

/** Row widths repeat so a list of skeleton rows looks like text, not a barcode. */
const WIDTHS = ['w-[72%]', 'w-[54%]', 'w-[86%]', 'w-[63%]', 'w-[45%]']

export function SkeletonBar({ className }: { className?: string }) {
  return <span aria-hidden className={cn('skeleton block h-3', className)} />
}

export function Skeleton({ rows = 5, status, className }: { rows?: number; status: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} role="status" aria-live="polite">
      <p className="text-sm text-ink-secondary">{status}</p>
      <div className="flex flex-col gap-2.5" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonBar key={i} className={WIDTHS[i % WIDTHS.length]} />
        ))}
      </div>
    </div>
  )
}
