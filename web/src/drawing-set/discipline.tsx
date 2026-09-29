/*
 * A file's Discipline (docs/design/m0-screens.md §4.5, "Discipline"): the Market's Disciplines as the
 * Library serves them (`GET …/drawings/disciplines`, 14), one name each, in the Library's order; never a
 * list of the web's own (ADR 0038, ADR 0040). The QS changes it on the row through a quiet native select;
 * the MD and a Guest read its name.
 */
import { useLingui } from '@lingui/react/macro'
import { EMPTY } from '@/format'
import { cn } from '@/ui'
import { disciplineName, type DisciplineOut } from './data'

/** A Discipline's name by its key, in the language shown; a key the Library no longer holds reads "—". */
export function useDisciplineName(disciplines: readonly DisciplineOut[] | undefined): (key: string) => string {
  const { i18n } = useLingui()
  return (key) => {
    const found = disciplines?.find((d) => d.key === key)
    return found ? disciplineName(found, i18n.locale) : EMPTY
  }
}

export function DisciplineSelect({
  fileName,
  value,
  disciplines,
  disabled,
  onChange,
}: {
  fileName: string
  value: string | null
  disciplines: readonly DisciplineOut[]
  disabled: boolean
  onChange: (key: string) => void
}) {
  const { t, i18n } = useLingui()
  const known = value !== null && disciplines.some((d) => d.key === value)
  return (
    <select
      aria-label={t`Discipline of ${fileName}`}
      value={known ? value : ''}
      disabled={disabled}
      onChange={(event) => {
        if (event.currentTarget.value) onChange(event.currentTarget.value)
      }}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'h-[24px] w-full min-w-0 truncate rounded-xs border border-transparent bg-transparent px-1 text-sm',
        'hover:border-border focus-visible:border-input focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:text-ink-disabled',
      )}
    >
      {known ? null : (
        <option value="" disabled>
          {t`Choose a Discipline`}
        </option>
      )}
      {disciplines.map((d) => (
        <option key={d.key} value={d.key}>
          {disciplineName(d, i18n.locale)}
        </option>
      ))}
    </select>
  )
}
