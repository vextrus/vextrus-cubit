/*
 * The empty state (docs/design/system.md §7; m0-screens §3): a glyph, one sentence saying why, one
 * action. The wording is each screen's (m0-screens §4).
 */
import type { ReactNode } from 'react'
import { cn } from './cn'

export function Empty({ glyph, children, action, className }: { glyph: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-10 text-center', className)}>
      <span className="text-muted-foreground [&_svg]:size-5" aria-hidden>
        {glyph}
      </span>
      <p className="max-w-[48ch] text-sm text-ink-secondary">{children}</p>
      {action}
    </div>
  )
}
