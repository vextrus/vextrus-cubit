/*
 * The error bar (docs/design/system.md §7; m0-screens §3): a red inset bar saying what went wrong and
 * what to do, with one action. Never a red wall; a field's error is a red edge and a line under it.
 */
import type { ReactNode } from 'react'
import { cn } from './cn'
import { CircleAlert } from 'lucide-react'

export function ErrorBar({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex min-h-control-lg items-center gap-2.5 border-s-[3px] border-destructive bg-over-target-surface py-1.5 ps-3 pe-1.5 text-sm text-foreground',
        className,
      )}
    >
      <CircleAlert aria-hidden size={16} strokeWidth={1.5} className="shrink-0 text-destructive" />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  )
}
