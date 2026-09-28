/*
 * The form pieces 20a adds to src/ui/ (a text field, a checkbox, a field's error line), judged on the
 * specimen route like 01b's (m0-screens §3, §8): labelled, described by their hint and error, refused
 * with a red edge and a line, keyboard-operable with a visible ring, and mirrored in a right-to-left
 * language.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { overrideLanguage } from '@/app/dev-language'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { activatePseudoRtl } from '@/i18n/pseudo'
import { Checkbox } from './Checkbox'
import { FieldError } from './FieldError'
import { TextField } from './TextField'
import { UiProviders } from './UiProviders'

afterEach(() => {
  overrideLanguage(false)
  activateLanguage(ENGLISH, englishMessages())
})

describe('TextField', () => {
  it('is labelled, and described by its error first, then its hint', () => {
    render(<TextField label="Code" hint="Short, like KR-01" error="Give it a short code, like KR-01." />)
    const input = screen.getByLabelText('Code')
    expect(input).toHaveAccessibleDescription('Give it a short code, like KR-01. Short, like KR-01')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(getComputedStyle(input).borderColor).not.toBe(getComputedStyle(screen.getByText('Short, like KR-01')).color)
  })

  it('has no required attribute, so no browser bubble speaks outside the catalogue', () => {
    render(<TextField label="Name" aria-required />)
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('required')
  })

  it('takes typing, shows a ring on focus by keyboard, and holds its value read only', async () => {
    function Typed() {
      const [value, setValue] = useState('')
      return <TextField label="Email" value={value} onChange={(event) => setValue(event.currentTarget.value)} />
    }
    render(
      <>
        <Typed />
        <TextField label="Locked" defaultValue="kept" readOnly />
      </>,
    )
    await userEvent.tab()
    const input = screen.getByLabelText('Email')
    expect(document.activeElement).toBe(input)
    expect(getComputedStyle(input).outlineStyle).not.toBe('none')
    await userEvent.keyboard('arif@vextrus.example')
    expect(input).toHaveValue('arif@vextrus.example')
    const locked = screen.getByLabelText('Locked')
    await userEvent.type(locked, 'x')
    expect(locked).toHaveValue('kept')
  })

  it('lays out from the start edge in a right-to-left language', () => {
    overrideLanguage()
    activatePseudoRtl()
    render(
      <UiProviders>
        <div style={{ width: 400 }}>
          <TextField label="Code" after={<span data-testid="after">(30 days)</span>} />
        </div>
      </UiProviders>,
    )
    const input = screen.getByLabelText('Code').getBoundingClientRect()
    const after = screen.getByTestId('after').getBoundingClientRect()
    expect(after.right).toBeLessThanOrEqual(input.left)
  })
})

describe('Checkbox', () => {
  it('ticks by click on its label and by Space, and says its error', async () => {
    function Ticked() {
      const [on, setOn] = useState(false)
      return <Checkbox label="End their access on a date" checked={on} onCheckedChange={setOn} error={on ? undefined : 'Choose at least one project.'} />
    }
    render(<Ticked />)
    const box = screen.getByRole('checkbox', { name: 'End their access on a date' })
    expect(box).toHaveAccessibleDescription('Choose at least one project.')
    await userEvent.click(screen.getByText('End their access on a date'))
    expect(box).toBeChecked()
    box.focus()
    await userEvent.keyboard(' ')
    expect(box).not.toBeChecked()
  })
})

describe('FieldError', () => {
  it('renders nothing without a message, and the line with one', () => {
    const { container, rerender } = render(<FieldError id="e" />)
    expect(container.innerHTML).toBe('')
    rerender(<FieldError id="e">Enter a date like 26 Oct 2026.</FieldError>)
    expect(screen.getByText('Enter a date like 26 Oct 2026.')).toHaveAttribute('data-field-error')
  })
})
