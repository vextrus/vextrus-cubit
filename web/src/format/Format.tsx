/*
 * The formatters, bound to one Market and one unit system (docs/design/m0-screens.md §1.2, §1.8,
 * §1.9): every figure a screen shows goes through `useFormat()`. Numbers, dates and times come back as
 * strings (they enter messages as placeholders, which the message layer isolates); drawing notation
 * comes back as an element, isolated left to right and marked `data-notation` with its kind, with its
 * plain text alongside for tooltips and the clipboard (LRI…PDI).
 */
import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react'
import type { I18n } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { isolateLtr, type NotationKind } from '@/ui/notation'
import { cn } from '@/ui/cn'
import { SHORT_MONTHS, daysBetween, formatDate, formatDay, formatTime, type Instant } from './dates'
import { coordinateText, lengthText, levelText, scaleText, type Length, type NotationText } from './notation'
import { formatCount, formatInteger, formatMoney, formatQuantity, formatShare, type Decimal, type Money } from './numbers'
import type { MarketFormat, UnitSystemKey } from './profile'
import { unitSystem, type UnitSystem } from './units'

/** A piece of drawing notation as an element: `<bdi dir="ltr" data-notation="length">42′-7½″</bdi>`. */
export function Notation({ kind, text, className }: { kind: NotationKind; text: string; className?: string }) {
  return (
    <bdi dir="ltr" data-notation={kind} className={cn('num whitespace-nowrap', className)}>
      {text}
    </bdi>
  )
}

export interface Format {
  profile: MarketFormat
  unitSystem: UnitSystem
  /** The unit system's name from the catalogue ("Imperial"), as the status bar shows it. */
  unitSystemName: string

  integer(value: number | null | undefined): string
  quantity(value: Decimal | null | undefined, decimals?: number): string
  money(money: Money | null | undefined, options?: { change?: boolean; symbol?: boolean }): string
  count(n: number, N: number | null): string
  share(part: number, whole: number): string
  date(at: Instant | null | undefined): string
  /** A calendar day sent as an ISO date ("2026-09-12" → "12 Sep 2026"); anything else is empty. */
  day(iso: string | null | undefined): string
  time(at: Instant | null | undefined): string
  /** Whole days from now (or `from`) to `at`, counted in the Market's time zone. */
  daysUntil(at: Instant, from?: Instant): number

  length(value: Length): ReactElement
  coordinate(value: Length): ReactElement
  level(value: Length): ReactElement
  scale(value: number | string): ReactElement
  /** The bare forms, screen and plain, without isolates (the table of expected strings reads these). */
  text: {
    length(value: Length): NotationText
    coordinate(value: Length): NotationText
    level(value: Length): NotationText
    scale(value: number | string): NotationText
  }
  /** Plain text isolated left to right (LRI…PDI), for a tooltip, an accessible name or the clipboard. */
  plain: {
    length(value: Length): string
    coordinate(value: Length): string
    level(value: Length): string
    scale(value: number | string): string
  }
}

/** The formatters for one Market, in one of the unit systems it offers, worded by `i18n`. */
export function createFormat(profile: MarketFormat, unitSystemKey: UnitSystemKey, i18n: I18n): Format {
  if (!profile.unitSystems.offered.includes(unitSystemKey)) {
    throw new Error(`The Market does not offer the unit system "${unitSystemKey}"`)
  }
  const system = unitSystem(unitSystemKey)
  const month = (index: number) => i18n._(SHORT_MONTHS[index]!)
  const text = {
    length: (v: Length) => lengthText(v, system.length),
    coordinate: (v: Length) => coordinateText(v, system.length),
    level: (v: Length) => levelText(v, system.length),
    scale: (v: number | string) => scaleText(v),
  }
  return {
    profile,
    unitSystem: system,
    unitSystemName: i18n._(system.name),
    integer: (v) => formatInteger(v, profile),
    quantity: (v, decimals) => formatQuantity(v, profile, decimals),
    money: (m, options) => formatMoney(m, profile, options),
    count: (n, N) => formatCount(n, N, profile),
    share: (part, whole) => formatShare(part, whole, profile),
    date: (at) => formatDate(at, profile, month),
    day: (iso) => formatDay(iso, profile, month),
    time: (at) => formatTime(at, profile),
    daysUntil: (at, from = new Date()) => daysBetween(from, at, profile),
    length: (v) => <Notation kind="length" text={text.length(v).screen} />,
    coordinate: (v) => <Notation kind="coordinate" text={text.coordinate(v).screen} />,
    level: (v) => <Notation kind="level" text={text.level(v).screen} />,
    scale: (v) => <Notation kind="scale" text={text.scale(v).screen} />,
    text,
    plain: {
      length: (v) => isolateLtr(text.length(v).plain),
      coordinate: (v) => isolateLtr(text.coordinate(v).plain),
      level: (v) => isolateLtr(text.level(v).plain),
      scale: (v) => isolateLtr(text.scale(v).plain),
    },
  }
}

const FormatContext = createContext<{ profile: MarketFormat; unitSystem: UnitSystemKey } | null>(null)

/**
 * The Market (and the project's unit system, else the Market's default) for everything below. The
 * shell provides it from the session's Developer; a project screen narrows the unit system.
 */
export function FormatProvider({ profile, unitSystem, children }: { profile: MarketFormat; unitSystem?: UnitSystemKey; children: ReactNode }) {
  const value = useMemo(() => ({ profile, unitSystem: unitSystem ?? profile.unitSystems.default }), [profile, unitSystem])
  return <FormatContext.Provider value={value}>{children}</FormatContext.Provider>
}

/** The formatters for the Market above, in the active language. */
export function useFormat(): Format {
  const market = useContext(FormatContext)
  const { i18n } = useLingui()
  if (!market) throw new Error('useFormat() is used inside <FormatProvider>')
  // Made on each render: useLingui re-renders on a language's activation, so the months and the unit
  // system's name follow it.
  return createFormat(market.profile, market.unitSystem, i18n)
}
