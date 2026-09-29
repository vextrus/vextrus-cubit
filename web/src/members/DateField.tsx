/*
 * A date field that shows and takes 1.2's form, "26 Oct 2026" (docs/design/m0-screens.md §1.2, §4.4),
 * never the browser's own date format, in the Market's time zone. It shows how many days away the day
 * is, "(30 days)". A day it cannot read is said so under it when the field is left, and on submit.
 */
import { useState } from 'react'
import { Plural, useLingui } from '@lingui/react/macro'
import { SHORT_MONTHS } from '@/format/dates'
import { useFormat } from '@/format'
import { TextField } from '@/ui'
import { addDays, daysBetween, endOfDay, parseDay, type Day } from './dates'

/** Formats a day as 1.2 writes it, through 03's date formatter in the Market's time zone. */
export function useDayText(): (day: Day) => string {
  const f = useFormat()
  return (day) => f.date(endOfDay(day, f.profile.timeZone))
}

export function DateField({
  id,
  label,
  value,
  onChange,
  today,
  error,
  showError,
}: {
  id?: string
  label: string
  /** The day, or null while the text typed is not one. */
  value: Day | null
  onChange: (day: Day | null) => void
  /** Today in the Market's time zone, for "(30 days)". */
  today: Day
  error?: React.ReactNode
  /** Say the text is not a day even before the field is left (on submit). */
  showError?: boolean
}) {
  const { t, i18n } = useLingui()
  const dayText = useDayText()
  const [text, setText] = useState(() => (value ? dayText(value) : ''))
  const [left, setLeft] = useState(false)
  const months = SHORT_MONTHS.map((m) => i18n._(m))
  const unreadable = value === null && (left || showError)
  const days = value ? daysBetween(today, value) : null
  // A day the field takes (after today), never one it refuses (design gate 20a r1).
  const example = dayText(addDays(today, 30))
  return (
    <TextField
      id={id}
      label={label}
      value={text}
      inputMode="text"
      autoComplete="off"
      placeholder={example}
      fieldClassName="max-w-[160px]"
      onChange={(event) => {
        const next = event.currentTarget.value
        setText(next)
        onChange(parseDay(next, months))
      }}
      onBlur={() => {
        setLeft(true)
        if (value) setText(dayText(value))
      }}
      after={
        days !== null && days >= 0 ? (
          <span className="num text-xs whitespace-nowrap text-muted-foreground">
            <Plural value={days} _0="(today)" one="(# day)" other="(# days)" />
          </span>
        ) : null
      }
      error={error ?? (unreadable ? t`Enter a date like ${example}.` : undefined)}
    />
  )
}
