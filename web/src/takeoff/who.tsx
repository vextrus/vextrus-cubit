/*
 * Who acted on a sheet (m0-screens §5 "Who did what", §6.2's State column, §6.6): the actor's initials
 * chip ("NJ"; a Vextrus Engineer's reads "TA Vextrus"), and the inspector's acts, each "what" over
 * "name, role, time" ("Confirmed in bulk with 15 other sheets / Nusrat Jahan, QS, 29 Sep 2026, 19:28").
 */
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import type { MessageDescriptor } from '@lingui/core'
import { useFormat } from '@/format'
import { cn } from '@/ui'
import type { ProposalOut } from './data'
import { REASON_SHORT, UNKNOWN_REASON } from './words'

const ROLE_NAMES: Record<string, MessageDescriptor> = {
  qs: msg`QS`,
  md: msg`MD`,
  vextrus_engineer: msg`Vextrus Engineer`,
  guest: msg`Guest`,
}

/** "Nusrat Jahan" → "NJ"; one name → its first two letters. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0]!.slice(0, 2).toLocaleUpperCase()
  return (words[0]![0]! + words.at(-1)![0]!).toLocaleUpperCase()
}

/** The actor's initials chip, the full name as its accessible name and tooltip. */
export function ActorChip({ name, role }: { name: string | null | undefined; role?: string | null }) {
  const { t } = useLingui()
  if (!name) return null
  const vextrus = role === 'vextrus_engineer'
  // An accessible name is plain text: the isolates round the name are left out.
  const label = vextrus ? t`${name}, Vextrus Engineer`.replace(/[\u2066-\u2069]/g, '') : name
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-4 items-center rounded-xs border px-1 text-2xs font-semibold leading-none whitespace-nowrap',
        vextrus ? 'border-primary text-primary' : 'border-border-strong bg-chrome-sunken text-ink-secondary',
      )}
    >
      <span aria-hidden="true">
        {initials(name)}
        {vextrus ? (
          <>
            {' '}
            <Trans>Vextrus</Trans>
          </>
        ) : null}
      </span>
    </span>
  )
}

/** "Nusrat Jahan, QS, 29 Sep 2026, 19:28" (6.6), the role left out where it is not known. */
export function WhoWhen({ sheet }: { sheet: ProposalOut }) {
  const { i18n } = useLingui()
  const f = useFormat()
  const name = sheet.decided_by ?? ''
  const role = sheet.decided_role ? ROLE_NAMES[sheet.decided_role] : undefined
  const date = sheet.decided_at ? f.date(sheet.decided_at) : ''
  const time = sheet.decided_at ? f.time(sheet.decided_at) : ''
  if (role) {
    const roleName = i18n._(role)
    return (
      <Trans>
        {name}, {roleName}, {date}, {time}
      </Trans>
    )
  }
  return (
    <Trans>
      {name}, {date}, {time}
    </Trans>
  )
}

/** What was done: "Confirmed", "Confirmed in bulk with 15 other sheets", "Excluded: superseded". */
export function WhatWasDone({ sheet }: { sheet: ProposalOut }) {
  const { i18n } = useLingui()
  const others = Math.max(0, (sheet.decided_with ?? 0) - 1)
  if (sheet.decision === 'confirmed')
    return others > 0 ? <Plural value={others} one="Confirmed with # other sheet in one act" other="Confirmed with # other sheets in one act" /> : <Trans>Confirmed</Trans>
  const reason = sheet.excluded_reason === 'other' && sheet.excluded_text ? sheet.excluded_text : i18n._((sheet.excluded_reason && REASON_SHORT[sheet.excluded_reason]) || UNKNOWN_REASON)
  return <Trans>Excluded: {reason}</Trans>
}

/** One act in "Who did what": the what over the who and when, with the initials chip. */
export function Act({ sheet }: { sheet: ProposalOut }) {
  return (
    <span className="flex items-start gap-2">
      <ActorChip name={sheet.decided_by} role={sheet.decided_role} />
      <span className="flex flex-col">
        <span>
          <WhatWasDone sheet={sheet} />
        </span>
        <span className="text-xs text-muted-foreground">
          <WhoWhen sheet={sheet} />
        </span>
      </span>
    </span>
  )
}
