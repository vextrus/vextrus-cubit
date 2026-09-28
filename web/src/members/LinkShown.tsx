/*
 * A new invitation link, shown once (docs/design/m0-screens.md §4.4): "Copy this link and send it to
 * arif@vextrus.example. It works once, until 3 Oct 2026." The link is selectable text as well as the
 * [Copy link] button, since the browser may refuse the clipboard; copied, the toast "Link copied".
 * Never a link (`href`) itself: it is someone else's to open.
 */
import { useId, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { sameSession } from '@/auth'
import { useFormat } from '@/format'
import { Button, useToast } from '@/ui'

export function LinkShown({ email, link, worksUntil, replaced = false }: { email: string; link: string; worksUntil: string; replaced?: boolean }) {
  const { t } = useLingui()
  const f = useFormat()
  const toast = useToast()
  const queryClient = useQueryClient()
  const id = useId()
  const [refused, setRefused] = useState(false)
  const date = f.date(worksUntil)
  const select = () => {
    const input = document.getElementById(id)
    if (input instanceof HTMLInputElement) {
      input.focus()
      input.select()
    }
  }
  async function copy() {
    const current = sameSession(queryClient)
    try {
      await navigator.clipboard.writeText(link)
      setRefused(false)
      if (current()) toast.show({ message: <Trans>Link copied</Trans> })
    } catch {
      setRefused(true)
      select()
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground">
        <Trans>
          Copy this link and send it to {email}. It works once, until {date}.
        </Trans>
        {replaced ? (
          <>
            {' '}
            <Trans>The link sent before no longer works. Send this one instead.</Trans>
          </>
        ) : null}
      </p>
      <input
        id={id}
        readOnly
        value={link}
        aria-label={t`The invitation link`}
        onFocus={(event) => event.currentTarget.select()}
        className="h-control w-full rounded-md border border-input bg-chrome-sunken px-2 text-sm text-foreground"
        dir="ltr"
      />
      {refused ? (
        <p className="text-xs text-ink-secondary">
          <Trans>Your browser did not let Vextrus copy it. The link is selected above; press Ctrl C to copy it.</Trans>
        </p>
      ) : null}
      <Button variant="primary" className="self-end" onClick={() => void copy()}>
        <Trans>Copy link</Trans>
      </Button>
    </div>
  )
}
