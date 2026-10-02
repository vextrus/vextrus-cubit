/*
 * The actor's initials chip (m0-screens §6.2's State column "Confirmed NJ", §6.6's "who did what"): the
 * initials of the name, and for a Vextrus Engineer the indigo "TA Vextrus" (§6.12). The full name and
 * role are its accessible name and tooltip.
 */
import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@/ui'
import { ROLE_NAMES } from './words'

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0]!, words.at(-1)!] : words
  return letters.map((w) => [...w][0] ?? '').join('').toLocaleUpperCase()
}

export function ActorChip({ name, role }: { name: string; role: string | null | undefined }) {
  const { i18n } = useLingui()
  const vextrus = role === 'vextrus_engineer'
  const said = role && ROLE_NAMES[role] ? `${name}, ${i18n._(ROLE_NAMES[role])}` : name
  return (
    <abbr
      title={said}
      aria-label={said}
      className={cn('inline-flex h-4 items-center gap-1 rounded-sm px-1 text-2xs font-semibold no-underline', vextrus ? 'bg-accent text-accent-foreground' : 'bg-chrome-sunken text-ink-secondary')}
    >
      {initials(name)}
      {vextrus ? (
        <span className="font-normal">
          <Trans>Vextrus</Trans>
        </span>
      ) : null}
    </abbr>
  )
}
