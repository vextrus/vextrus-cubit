import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { i18n, type Messages } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { BANGLADESH } from '@/app/seed/demo.fixture'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { notationProblems } from '@/ui/notation'
import { FormatProvider, createFormat } from './Format'
import { MachineText, machineText, paramKind, type MachineMessage } from './machine'

// Invented codes, worded here as a backend ticket words its own in src/messages/.
const PROBE = {
  'drawings.probe.read': ['Read ', ['sheets', 'plural', { offset: undefined, one: ['#', ' sheet'], other: ['#', ' sheets'] }], ' from ', ['file'], ' on ', ['read_date'], ' at ', ['read_time']],
  'takeoff.probe.two': ['Two sheets are numbered ', ['sheet'], '; ', ['name'], ' asked.'],
} as unknown as Messages

function withProbe(locales?: string[]) {
  activateLanguage(ENGLISH, { ...englishMessages(), ...PROBE })
  if (locales) i18n.activate(ENGLISH.code, locales)
}

afterEach(() => activateLanguage(ENGLISH, englishMessages()))

const READ: MachineMessage = {
  code: 'drawings.probe.read',
  params: { sheets: 124842, file: 'KR-STR-R0.dwg', read_date: '2026-09-26T04:42:00Z', read_time: '2026-09-26T04:42:00Z' },
}

function show(message: MachineMessage) {
  return render(
    <I18nProvider i18n={i18n}>
      <FormatProvider profile={BANGLADESH}>
        <p data-testid="m">
          <MachineText message={message} />
        </p>
      </FormatProvider>
    </I18nProvider>,
  )
}

const invisible = (s: string) => s.replace(/[⁦-⁩]/g, '')

describe('the machine-message renderer: {code, params} to catalogue text (m0-screens §1.7)', () => {
  it('reads a parameter’s kind from its name', () => {
    expect(paramKind('read_date')).toEqual({ kind: 'date' })
    expect(paramKind('time')).toEqual({ kind: 'time' })
    expect(paramKind('sheet')).toEqual({ kind: 'notation', notation: 'sheet-number' })
    expect(paramKind('other_file')).toEqual({ kind: 'notation', notation: 'file-name' })
    expect(paramKind('name')).toEqual({ kind: 'as-sent' })
  })

  it('words the code, with the count grouped as the Market groups, the date and time in its zone, and notation isolated', () => {
    withProbe([BANGLADESH.locale])
    show(READ)
    const m = screen.getByTestId('m')
    expect(invisible(m.textContent ?? '')).toBe('Read 1,24,842 sheets from KR-STR-R0.dwg on 26 Sep 2026 at 10:42')
    const file = m.querySelector('[data-notation="file-name"]')
    expect(file?.textContent).toBe('KR-STR-R0.dwg')
    expect(notationProblems(m)).toEqual([])
  })

  it('gives the same sentence as plain text, notation in LRI…PDI', () => {
    withProbe([BANGLADESH.locale])
    const f = createFormat(BANGLADESH, 'imperial', i18n)
    const text = machineText({ code: 'takeoff.probe.two', params: { sheet: 'S-07', name: 'Nusrat Jahan' } }, f, i18n)
    expect(text).toContain('⁦S-07⁩')
    expect(invisible(text)).toBe('Two sheets are numbered S-07; Nusrat Jahan asked.')
  })

  it('never shows a code that has no English: a plain sentence instead, and a log in development', () => {
    withProbe()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    show({ code: 'drawings.probe.unworded', params: {} })
    const m = screen.getByTestId('m')
    expect(m.textContent).not.toContain('drawings.probe.unworded')
    expect(m.textContent).toBe('Vextrus has something to tell you here but no words for it yet.')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('drawings.probe.unworded'))
    log.mockRestore()
  })
})
