/*
 * "Which Developer?" (docs/design/m0-screens.md §4.2, "After sign-in"): for a user holding current
 * Memberships in several Developers, each Developer with the role held there. ↑ ↓ move, Enter or a
 * click works in it; the page then goes where sign-in was sent from (`?next=`), else the projects.
 */
import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { roleName } from '@/app/roles'
import { meQuery, type MembershipSummary } from '@/app/session'
import { Button, List } from '@/ui'
import { useChooseDeveloper, useSignOut } from './actions'
import { OutsidePage } from './OutsidePage'
import { ProblemBar, problemOf, type Problem } from './problem'

export function ChooseDeveloperPage() {
  const { t, i18n } = useLingui()
  const { data: me } = useSuspenseQuery(meQuery)
  const { next } = useSearch({ strict: false }) as { next?: string }
  const choose = useChooseDeveloper()
  const signOut = useSignOut()
  const [problem, setProblem] = useState<Problem>(null)
  const [busy, setBusy] = useState(false)
  const memberships = me?.memberships ?? []

  async function pick(membership: MembershipSummary | undefined) {
    if (!membership || busy) return
    setBusy(true)
    setProblem(null)
    try {
      await choose(membership.developer.id, next)
    } catch (error) {
      setProblem(problemOf(error))
      setBusy(false)
    }
  }

  const [focused, setFocused] = useState<string | null>(memberships[0]?.id ?? null)
  return (
    <OutsidePage title={t`Which Developer?`} wide>
      <h1 className="mb-4 text-xl">
        <Trans>Which Developer?</Trans>
      </h1>
      <List
        label={t`Your Developers`}
        items={memberships}
        getKey={(m) => m.id}
        focusedKey={focused}
        onFocusedKeyChange={setFocused}
        className="rounded-md border border-border"
        keys={[{ key: 'Enter', label: t`Open this Developer’s projects`, group: 'screen', run: () => void pick(memberships.find((m) => m.id === focused)) }]}
        renderItem={(m) => (
          <button type="button" tabIndex={-1} onClick={() => void pick(m)} className="flex h-full min-w-0 flex-1 items-center gap-3 text-start">
            <span className="min-w-0 flex-1 truncate font-medium">{m.developer.name}</span>
            <span className="text-ink-secondary">{roleName(m.role, i18n)}</span>
          </button>
        )}
      />
      <div className="mt-3 flex flex-col gap-3">
        <ProblemBar problem={problem} />
        <Button variant="ghost" className="self-start" onClick={() => void signOut()}>
          <Trans>Sign out</Trans>
        </Button>
      </div>
    </OutsidePage>
  )
}
