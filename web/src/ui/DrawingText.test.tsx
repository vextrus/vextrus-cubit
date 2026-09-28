import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nRoot } from '@/i18n/I18nRoot'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { activatePseudoRtl } from '@/i18n/pseudo'
import { DrawingText } from './DrawingText'
import { LtrCanvas } from './LtrCanvas'
import { notationProblems } from './notation'

afterEach(() => {
  activateLanguage(ENGLISH, englishMessages())
  vi.restoreAllMocks()
})

describe('DrawingText: drawing notation isolated left to right and marked (m0-screens §1.8)', () => {
  it('wraps a sheet number in a left-to-right isolate marked with its kind', () => {
    render(<DrawingText kind="sheet-number" text="S-04" />)
    const el = screen.getByText('S-04')
    expect(el.tagName).toBe('BDI')
    expect(el).toHaveAttribute('dir', 'ltr')
    expect(el).toHaveAttribute('data-notation', 'sheet-number')
  })

  it.each(['revision', 'mark', 'grid', 'file-name'] as const)('marks a %s the same way', (kind) => {
    render(<DrawingText kind={kind} text="R2" />)
    expect(screen.getByText('R2')).toHaveAttribute('data-notation', kind)
  })

  it('isolates a title in its own direction and does not mark it as notation', () => {
    render(<DrawingText kind="title" text="GROUND FLOOR COLUMN LAYOUT" />)
    const el = screen.getByText('GROUND FLOOR COLUMN LAYOUT')
    expect(el.tagName).toBe('BDI')
    expect(el).toHaveAttribute('dir', 'auto')
    expect(el).not.toHaveAttribute('data-notation')
  })

  it('keeps a sheet number in order inside a right-to-left page', () => {
    activatePseudoRtl()
    render(
      <I18nRoot>
        <p>
          <DrawingText kind="sheet-number" text="S-04" />
        </p>
      </I18nRoot>,
    )
    const el = screen.getByText('S-04')
    expect(getComputedStyle(el).direction).toBe('ltr')
    expect(getComputedStyle(el).unicodeBidi).toBe('isolate')
    // Visual order: the S is drawn before (to the left of) the 4.
    const range = document.createRange()
    const text = el.firstChild!
    range.setStart(text, 0)
    range.setEnd(text, 1)
    const s = range.getBoundingClientRect().left
    range.setStart(text, 3)
    range.setEnd(text, 4)
    const four = range.getBoundingClientRect().left
    expect(s).toBeLessThan(four)
  })

  it('gives the full text as a tooltip, isolated, only when the text is cut', () => {
    render(
      <div style={{ width: 60 }}>
        <DrawingText kind="title" text="TYPICAL FLOOR BEAM LAYOUT (LEVEL 2 TO LEVEL 9)" />
        <DrawingText kind="sheet-number" text="S-1" />
      </div>,
    )
    expect(screen.getByText(/TYPICAL FLOOR/)).toHaveAttribute('title', '⁨TYPICAL FLOOR BEAM LAYOUT (LEVEL 2 TO LEVEL 9)⁩')
    expect(screen.getByText('S-1')).not.toHaveAttribute('title')
  })

  it('logs any raw CAD code it is given, in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<DrawingText kind="title" text="%%C12 BAR" />)
    render(<DrawingText kind="title" text="FIRST\PSECOND" />)
    render(<DrawingText kind="title" text="SLAB S1" />)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[0]?.join(' ')).toMatch(/raw CAD code/)
  })
})

describe('the DOM test 03 and 22 run on the seed (m0-screens §1.8)', () => {
  it('passes when every element marked data-notation is a left-to-right isolate', () => {
    const { container } = render(
      <p>
        <DrawingText kind="sheet-number" text="S-04" /> <DrawingText kind="title" text="PLAN" />
      </p>,
    )
    expect(notationProblems(container)).toEqual([])
  })

  it('fails on an element marked data-notation that is not a left-to-right isolate', () => {
    const { container } = render(
      <p>
        <span data-notation="length">14′-6″</span> <bdi data-notation="scale">1:100</bdi>
      </p>,
    )
    expect(notationProblems(container)).toEqual([
      expect.stringMatching(/data-notation="length".*not left to right/),
      expect.stringMatching(/data-notation="length".*not an isolate/),
      expect.stringMatching(/data-notation="scale".*not left to right/),
    ])
  })
})

describe('LtrCanvas: the canvas is fixed left to right and never mirrored (m0-screens §1.8)', () => {
  it('stays left to right, untransformed, inside a right-to-left page', () => {
    activatePseudoRtl()
    render(
      <I18nRoot>
        <div data-testid="chrome">
          <LtrCanvas data-testid="canvas" style={{ width: 200, height: 100 }}>
            <span data-testid="inside">x</span>
          </LtrCanvas>
        </div>
      </I18nRoot>,
    )
    expect(document.documentElement.dir).toBe('rtl')
    expect(getComputedStyle(screen.getByTestId('chrome')).direction).toBe('rtl')
    const canvas = screen.getByTestId('canvas')
    expect(canvas).toHaveAttribute('dir', 'ltr')
    expect(getComputedStyle(canvas).direction).toBe('ltr')
    expect(getComputedStyle(canvas).transform).toBe('none')
    expect(getComputedStyle(screen.getByTestId('inside')).direction).toBe('ltr')
  })
})
