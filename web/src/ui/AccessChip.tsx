/*
 * AccessChip (docs/design/m0-screens.md §3, §1.4; session 02 Q11): in the top bar for anyone whose
 * access has an end date or covers chosen projects only: a Vextrus Engineer always, a Guest, a member
 * given chosen projects. It names the projects when the access is to chosen ones and the end date
 * when it has one; more than three projects are counted, their codes in the tooltip. Amber, and
 * counting days, when 3 days or fewer are left.
 *
 * `until` arrives formatted by ticket 03's date formatter ("26 Oct 2026"); `daysLeft` is counted in
 * the Market's time zone by the caller. Project codes are isolated left to right.
 */
import type { ReactNode } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { ShieldCheck } from 'lucide-react'
import { cn } from './cn'
import { isolateLtr } from './notation'
import { Tooltip, TooltipContent, TooltipTrigger } from './primitives/tooltip'

export interface AccessChipProps {
  /** A Vextrus Engineer's access (always shown), or anyone else's. */
  vextrus: boolean
  developer: string
  /** The project codes the access covers, or 'all'. */
  projects: readonly string[] | 'all'
  /** The end date, formatted; null when the access has none. */
  until: string | null
  /** Whole days until the end date; null when there is none. */
  daysLeft: number | null
  className?: string
}

const Code = ({ code }: { code: string }) => <bdi dir="ltr">{code}</bdi>

/** "KR-01", "KR-01 and BP-02", "KR-01, BP-02 and GH-03", or "4 projects": the catalogue's list pattern. */
function ProjectList({ codes }: { codes: readonly string[] }): ReactNode {
  const [a = '', b = '', c = ''] = codes
  const first = <Code code={a} />
  const second = <Code code={b} />
  const third = <Code code={c} />
  if (codes.length === 1) return first
  if (codes.length === 2) return <Trans>{first} and {second}</Trans>
  if (codes.length === 3) return <Trans>{first}, {second} and {third}</Trans>
  return <Plural value={codes.length} one="# project" other="# projects" />
}

export function AccessChip({ vextrus, developer, projects, until, daysLeft, className }: AccessChipProps) {
  const { t } = useLingui()
  if (!vextrus && projects === 'all' && until === null) return null

  const ending = daysLeft !== null && daysLeft <= 3
  const days = Math.max(0, daysLeft ?? 0)
  const list = projects === 'all' ? null : <ProjectList codes={projects} />
  const date = until ?? ''

  let words: ReactNode
  if (ending) {
    words = vextrus ? (
      <Plural value={days} _0="Vextrus access ends today" one="Vextrus access ends in # day" other="Vextrus access ends in # days" />
    ) : (
      <Plural value={days} _0="Access ends today" one="Access ends in # day" other="Access ends in # days" />
    )
  } else if (vextrus) {
    if (list && until) words = <Trans>Vextrus access to {list} at {developer} until {date}</Trans>
    else if (list) words = <Trans>Vextrus access to {list} at {developer}</Trans>
    else if (until) words = <Trans>Vextrus access to {developer} until {date}</Trans>
    else words = <Trans>Vextrus access to {developer}</Trans>
  } else if (list && until) words = <Trans>Access to {list} at {developer} until {date}</Trans>
  else if (list) words = <Trans>Access to {list} at {developer}</Trans>
  else words = <Trans>Access to {developer} until {date}</Trans>

  const codes = projects === 'all' ? '' : projects.map(isolateLtr).join(', ')
  const tooltip = [
    until ? (vextrus ? t`Vextrus access to ${developer} ends on ${date}.` : t`Your access to ${developer} ends on ${date}.`) : null,
    projects !== 'all' ? t`Projects: ${codes}` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-testid="access-chip"
          data-ending={ending || undefined}
          tabIndex={0}
          className={cn(
            'inline-flex h-6 max-w-[420px] items-center gap-1.5 rounded-xs border px-2 text-xs font-medium whitespace-nowrap',
            ending ? 'border-question-stroke bg-question-surface text-question' : 'border-border-strong bg-chrome-sunken text-ink-secondary',
            className,
          )}
        >
          <ShieldCheck aria-hidden size={14} strokeWidth={1.5} className="shrink-0" />
          <span className="truncate">{words}</span>
        </span>
      </TooltipTrigger>
      {tooltip ? <TooltipContent>{tooltip}</TooltipContent> : null}
    </Tooltip>
  )
}
