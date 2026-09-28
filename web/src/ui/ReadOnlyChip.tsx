/*
 * ReadOnlyChip (m0-screens §3, §1.4): in the toolbar or page header for the MD and a Guest, who may
 * look at the Takeoff but not change it.
 */
import { Eye } from 'lucide-react'
import { useLingui } from '@lingui/react/macro'
import { cn } from './cn'
import { Tooltip, TooltipContent, TooltipTrigger } from './primitives/tooltip'

export function ReadOnlyChip({ role, className }: { role: 'md' | 'guest'; className?: string }) {
  const { t } = useLingui()
  const words = role === 'md' ? t`Read only: MD` : t`Read only: Guest`
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            'inline-flex h-6 items-center gap-1.5 rounded-xs border border-border-strong bg-chrome-sunken px-2 text-xs font-medium whitespace-nowrap text-ink-secondary',
            className,
          )}
        >
          <Eye aria-hidden size={14} strokeWidth={1.5} />
          {words}
        </span>
      </TooltipTrigger>
      <TooltipContent>{t`You can look at the Takeoff but not change it.`}</TooltipContent>
    </Tooltip>
  )
}
