/*
 * Who from Vextrus has access, for the MD in a project's top bar (docs/design/m0-screens.md §6.12): "TA
 * Vextrus Tanvir Ahmed, Vextrus Engineer, has access until 26 Oct 2026" with "Revoke", which asks first
 * in §4.4's words and ends the access as Members and access does. The rows are `/api/members`' current
 * Vextrus access that may open this project and that the MD may revoke (the row's `actions`, the
 * server's rule). Anyone but the MD sees nothing here; a Guest has no `/api/members` to ask.
 */
import { useRef, useState, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { roleName } from '@/app/roles'
import type { Session } from '@/app/session'
import { can, sameSession } from '@/auth'
import { useSayRefused } from '@/auth/sayRefused'
import { useFormat } from '@/format'
import { Button, useToast } from '@/ui'
import { membersFrom, membersQuery, revoke, type PersonRow } from './data'
import { RevokeDialog } from './RevokeDialog'

export function VextrusAccessNotice({ session, projectCode, chip }: { session: Session; projectCode: string; chip?: (name: string) => ReactNode }) {
  const shown = session.role === 'md' && can(session, 'access')
  const members = useQuery({ ...membersQuery, enabled: shown, select: (out) => membersFrom(out, session) })
  if (!shown || !members.data) return null
  const rows = members.data.vextrus.filter(
    (row) => row.ended === null && row.until !== null && row.actions.includes('revoke') && (row.projects === 'all' || row.projects.includes(projectCode)),
  )
  if (rows.length === 0) return null
  return (
    <ul className="flex min-w-0 items-center gap-3">
      {rows.map((row) => (
        <Notice key={row.membershipId} row={row} chip={chip} />
      ))}
    </ul>
  )
}

function Notice({ row, chip }: { row: PersonRow; chip?: (name: string) => ReactNode }) {
  const { t, i18n } = useLingui()
  const f = useFormat()
  const toast = useToast()
  const sayRefused = useSayRefused()
  const queryClient = useQueryClient()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const confirmed = useRef(false)
  const name = row.name
  const who = row.name
  const role = roleName(row.role, i18n)
  const date = row.until ? f.date(row.until) : ''

  async function end() {
    const current = sameSession(queryClient)
    setBusy(true)
    try {
      await revoke(row.membershipId)
      if (current()) toast.show({ message: <Trans>{name}’s access has ended.</Trans> })
    } catch (error) {
      if (current()) sayRefused(error)
    } finally {
      setBusy(false)
      if (current()) await queryClient.invalidateQueries({ queryKey: membersQuery.queryKey })
    }
  }

  return (
    <li className="flex min-w-0 items-center gap-2 text-sm">
      {chip ? <span aria-hidden>{chip(name)}</span> : null}
      <span className="truncate">
        <Trans>
          {name}, {role}, has access until {date}
        </Trans>
      </span>
      <Button
        className="h-[24px]! focus-visible:outline-offset-0"
        aria-label={t`Revoke access for ${who}`}
        saving={busy}
        disabled={busy}
        onClick={() => setAsking(true)}
      >
        <Trans>Revoke</Trans>
      </Button>
      <RevokeDialog
        name={asking ? name : null}
        onCancel={() => setAsking(false)}
        onCloseAutoFocus={(event) => {
          // Confirmed, the notice and its button go: focus goes to the top bar, its region, not to nowhere.
          if (!confirmed.current) return
          confirmed.current = false
          event.preventDefault()
          const bar = document.querySelector<HTMLElement>('[data-region="top-bar"]')
          if (bar && !bar.hasAttribute('tabindex')) bar.tabIndex = -1
          bar?.focus()
        }}
        onConfirm={() => {
          setAsking(false)
          confirmed.current = true
          void end()
        }}
      />
    </li>
  )
}
