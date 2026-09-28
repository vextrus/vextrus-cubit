/*
 * The table of expected strings, checked in the browser (Vitest's browser mode on Chromium, whose
 * Intl a QS's Chrome shares): every row of tests/expected-strings.json, for Bangladesh (the seed's
 * static copy) and for the test-only second Market.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { i18n, type Messages } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { compileMessage } from '@lingui/message-utils/compileMessage'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { notationProblems } from '@/ui/notation'
import { BANGLADESH } from '@/app/seed/demo.fixture'
import { FormatProvider, createFormat } from './Format'
import { MachineText, machineText } from './machine'
import { unmarkedNotation } from './unmarked'
import { lengthFromFeetInches, lengthFromInches, lengthFromMm, type Length } from './notation'
import type { MarketFormat } from './profile'
import table from './tests/expected-strings.json'
import testMarket from './tests/test-market.json'

afterEach(() => activateLanguage(ENGLISH, englishMessages()))

/** Visible text: without the isolates the message layer and the formatters put round values. */
const visible = (text: string | null) => (text ?? '').replace(/[\u2066-\u2069]/g, '')

/**
 * A machine message, as the app words one: its English loaded as a code's would be (every
 * placeholder isolated), Lingui formatting with the Market's locale as the frame sets it, rendered by
 * MachineText; its figures must sit in marked left-to-right isolates.
 */
function machine(row: Row, profile: MarketFormat, unitSystem: string): { screen: string; plain: string } {
  const code = 'probe.table.row'
  activateLanguage(ENGLISH, { ...englishMessages(), [code]: compileMessage(row.input.message as string) } as Messages)
  i18n.activate(ENGLISH.code, [profile.locale])
  const message = { code, params: row.input.params as Record<string, string | number> }
  const { container, unmount } = render(
    createElement(I18nProvider, { i18n }, createElement(FormatProvider, { profile, unitSystem, children: createElement(MachineText, { message }) })),
  )
  expect(notationProblems(container)).toEqual([])
  expect(unmarkedNotation(container)).toEqual([])
  const screen = visible(container.textContent)
  unmount()
  const plain = visible(machineText(message, createFormat(profile, unitSystem, i18n), i18n))
  return { screen, plain }
}

const MARKETS: Record<string, MarketFormat> = { bangladesh: BANGLADESH, test: testMarket as MarketFormat }

type Input = Record<string, unknown>

interface Row {
  market: string
  unitSystem?: string
  kind: string
  input: Input
  expected: string
  plain?: string
  why: string
}

function length(input: Input): Length {
  if (typeof input.inches === 'number') return lengthFromInches(input.inches)
  if (typeof input.mm === 'number') return lengthFromMm(input.mm)
  throw new Error(`no length in ${JSON.stringify(input)}`)
}

function run(row: Row): { screen: string; plain?: string } {
  const profile = MARKETS[row.market]!
  const f = createFormat(profile, row.unitSystem ?? profile.unitSystems.default, i18n)
  const i = row.input
  switch (row.kind) {
    case 'money':
      return {
        screen: f.money(
          { amount: i.amount as string, currency: i.currency as string },
          { change: i.change as boolean | undefined, symbol: i.symbol as boolean | undefined },
        ),
      }
    case 'quantity':
      return { screen: f.quantity(i.value as string | null, i.decimals as number | undefined) }
    case 'integer':
      return { screen: f.integer(i.value as number) }
    case 'count':
      return { screen: f.count(i.n as number, i.N as number | null) }
    case 'share':
      return { screen: f.share(i.part as number, i.whole as number) }
    case 'date':
      return { screen: f.date(i.at as string | null) }
    case 'time':
      return { screen: f.time(i.at as string | null) }
    case 'length':
    case 'coordinate':
    case 'level':
      return f.text[row.kind](length(i))
    case 'scale':
      return f.text.scale(i.ratio as number)
    case 'machine':
      return machine(row, profile, row.unitSystem ?? profile.unitSystems.default)
    case 'unit-system-name':
      return { screen: f.unitSystemName }
    default:
      throw new Error(`no formatter for kind ${row.kind}`)
  }
}

const rows = table.rows as Row[]

describe('the table of expected strings', () => {
  it('has rows for Bangladesh and for the test-only second Market', () => {
    expect(rows.filter((r) => r.market === 'bangladesh').length).toBeGreaterThan(20)
    expect(rows.filter((r) => r.market === 'test').length).toBeGreaterThan(10)
  })

  it.each(rows.map((r) => [`${r.market} ${r.unitSystem ?? ''} ${r.kind} ${JSON.stringify(r.input)}: ${r.why}`, r] as const))('%s', (_, row) => {
    const out = run(row)
    expect(out.screen).toBe(row.expected)
    if (row.plain !== undefined) expect(out.plain).toBe(row.plain)
  })
})

describe('an input that is no figure shows the empty figure, never NaN', () => {
  const f = createFormat(BANGLADESH, 'imperial', i18n)
  it.each([
    ['a length', () => f.text.length(lengthFromMm(Number.NaN)).screen],
    ['a plain length', () => f.text.length(lengthFromMm(Number.POSITIVE_INFINITY)).plain],
    ['a level', () => f.text.level(lengthFromInches(Number.NaN)).screen],
    ['money', () => f.money({ amount: 'abc', currency: 'BDT' })],
    ['a quantity', () => f.quantity('12,5')],
    ['an integer', () => f.integer(Number.NaN)],
    ['a scale', () => f.text.scale(Number.NaN).screen],
    ['a share of infinity', () => f.share(5, Number.POSITIVE_INFINITY)],
  ])('%s', (_, run) => {
    expect(run()).toBe('—')
  })
})

describe('the formatters keep to the Market', () => {
  it('refuse a unit system the Market does not offer', () => {
    expect(() => createFormat(testMarket as MarketFormat, 'imperial', i18n)).toThrow(/does not offer/)
  })

  it('build a length from feet and inches as the drawing writes it, −0′-6″ included', () => {
    const f = createFormat(BANGLADESH, 'imperial', i18n)
    expect(f.text.level(lengthFromFeetInches(-0, 6)).screen).toBe('−0′-6″')
    expect(f.text.level(lengthFromFeetInches(-3, 6)).screen).toBe('−3′-6″')
    expect(f.text.length(lengthFromFeetInches(42, 7.5)).screen).toBe('42′-7½″')
  })

  it('count days in the Market’s time zone', () => {
    const f = createFormat(BANGLADESH, 'imperial', i18n)
    // 23:00 UTC on 23 Oct is 05:00 on 24 Oct in Dhaka: two days before the 26th ends.
    expect(f.daysUntil('2026-10-26T17:59:59Z', '2026-10-23T23:00:00Z')).toBe(2)
    expect(f.daysUntil('2026-10-26T17:59:59Z', '2026-10-26T01:00:00Z')).toBe(0)
  })
})
