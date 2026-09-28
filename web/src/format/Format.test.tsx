import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { BANGLADESH } from '@/app/seed/demo.fixture'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { activatePseudoRtl } from '@/i18n/pseudo'
import { notationProblems } from '@/ui/notation'
import { FormatProvider, createFormat, useFormat } from './Format'
import { lengthFromInches } from './notation'

afterEach(() => activateLanguage(ENGLISH, englishMessages()))

const LRI = '⁦'
const PDI = '⁩'

function Figures() {
  const f = useFormat()
  return (
    <p data-testid="figures" style={{ fontSize: 20 }}>
      <span>{f.unitSystemName}</span> {f.length(lengthFromInches(174))} {f.coordinate(lengthFromInches(-42))} {f.level(lengthFromInches(198))}{' '}
      {f.scale(100)} <span>{f.date('2026-09-26T04:42:00Z')}</span>
    </p>
  )
}

function show() {
  return render(
    <I18nProvider i18n={i18n}>
      <FormatProvider profile={BANGLADESH}>
        <Figures />
      </FormatProvider>
    </I18nProvider>,
  )
}

/** The x position of each character of an element's text. */
function xs(el: Element): number[] {
  const text = el.firstChild as Text
  const range = document.createRange()
  return [...text.data].map((_, i) => {
    range.setStart(text, i)
    range.setEnd(text, i + 1)
    return range.getBoundingClientRect().left
  })
}

describe('drawing notation comes out of its formatter isolated and marked (m0-screens §1.8)', () => {
  it('is a <bdi dir="ltr"> carrying data-notation with its kind', () => {
    show()
    const marked = [...screen.getByTestId('figures').querySelectorAll('[data-notation]')]
    expect(marked.map((el) => [el.tagName, el.getAttribute('dir'), el.getAttribute('data-notation'), el.textContent])).toEqual([
      ['BDI', 'ltr', 'length', '14′-6″'],
      ['BDI', 'ltr', 'coordinate', '−3′-6″'],
      ['BDI', 'ltr', 'level', '+16′-6″'],
      ['BDI', 'ltr', 'scale', '1:100'],
    ])
    expect(notationProblems(document.body)).toEqual([])
  })

  it('gives plain text isolated with LRI…PDI for tooltips and the clipboard', () => {
    const f = createFormat(BANGLADESH, 'imperial', i18n)
    expect(f.plain.length(lengthFromInches(174))).toBe(`${LRI}14'-6"${PDI}`)
    expect(f.plain.level(lengthFromInches(198))).toBe(`${LRI}+16'-6"${PDI}`)
  })

  it('keeps 14′-6″ and +16′-6″ in order in the pseudo right-to-left language, and words the rest from its catalogue', () => {
    activatePseudoRtl()
    show()
    const figures = screen.getByTestId('figures')
    expect(getComputedStyle(figures).direction).toBe('rtl')
    for (const el of figures.querySelectorAll('[data-notation]')) {
      const x = xs(el)
      expect(x.every((v, i) => i === 0 || v > x[i - 1]!), `${el.textContent} reads left to right`).toBe(true)
    }
    // The unit system's name and the month come from the (pseudo) catalogue, never from code.
    expect(figures.textContent).toContain('Îɱþéŕîáļ')
    expect(figures.textContent).not.toContain('Imperial')
    expect(figures.textContent).not.toContain('Sep')
  })
})
