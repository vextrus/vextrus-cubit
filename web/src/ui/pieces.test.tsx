import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { I18nRoot } from '@/i18n/I18nRoot'
import { AccessChip } from './AccessChip'
import { Count } from './Count'
import { DesktopOnly } from './DesktopOnly'
import { KeyMapProvider } from './keys/KeyMapProvider'
import { ReadOnlyChip } from './ReadOnlyChip'
import { StatusMark } from './StatusMark'
import { ToastProvider, useToast } from './Toast'
import { TooltipProvider } from './primitives/tooltip'
import { Command, CommandItem, CommandList } from './primitives/command'
import { ProgressLine } from './ProgressLine'

function wrap(ui: React.ReactNode) {
  return render(
    <I18nRoot>
      <KeyMapProvider>
        <TooltipProvider>{ui}</TooltipProvider>
      </KeyMapProvider>
    </I18nRoot>,
  )
}

afterEach(async () => {
  await page.viewport(1440, 900)
  vi.useRealTimers()
})

describe('StatusMark and Count (m0-screens §3)', () => {
  it('shows the glyph and the word; the compact form keeps the word for screen readers', () => {
    wrap(
      <>
        <StatusMark status="question" questionId="Q3" />
        <StatusMark status="confirmed" compact />
      </>,
    )
    expect(screen.getByText('Question Q3')).toBeVisible()
    const compact = screen.getByText('Confirmed')
    expect(compact).toHaveClass('sr-only')
    expect(compact.parentElement).toHaveAttribute('title', 'Confirmed')
  })

  it('shows an unknown N as a dash, never a guess', () => {
    wrap(<Count n={12} N={null} />)
    expect(screen.getByText(/\/ —/)).toBeInTheDocument()
  })

  it('keeps its status colour inside a Command item, which greys other icons (design gate m1)', () => {
    wrap(
      <Command>
        <CommandList>
          <CommandItem value="S-04">
            <StatusMark status="question" compact />
          </CommandItem>
        </CommandList>
      </Command>,
    )
    const mark = screen.getByText('Question').parentElement!
    const glyph = mark.querySelector('svg')!
    expect(getComputedStyle(glyph).color).toBe(getComputedStyle(mark).color)
    expect(getComputedStyle(mark).color).not.toBe(getComputedStyle(document.body).color)
  })
})

describe('ProgressLine (m0-screens §3)', () => {
  it('names its progress bar by its status text (design gate m2)', () => {
    wrap(
      <>
        <ProgressLine value={0.5}>Reading the file</ProgressLine>
        <ProgressLine>Checking the file</ProgressLine>
      </>,
    )
    expect(screen.getByRole('progressbar', { name: 'Reading the file' })).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByRole('progressbar', { name: 'Checking the file' })).not.toHaveAttribute('aria-valuenow')
  })
})

describe('PhoneNotice and NarrowNotice below the widths m0-screens §1.5 sets', () => {
  const app = <p>The screen</p>

  it('shows the screen alone at 1280 px and wider', async () => {
    await page.viewport(1280, 800)
    wrap(<DesktopOnly>{app}</DesktopOnly>)
    expect(screen.getByText('The screen')).toBeVisible()
    expect(screen.queryByText(/built for 1280 px/)).not.toBeInTheDocument()
  })

  it('puts the narrow notice above the screen from 640 to 1279 px', async () => {
    await page.viewport(1100, 800)
    wrap(<DesktopOnly>{app}</DesktopOnly>)
    expect(screen.getByText('The screen')).toBeVisible()
    expect(screen.getByText(/This screen is built for 1280 px or wider/)).toBeVisible()
  })

  it('replaces the screen with the phone notice under 640 px', async () => {
    await page.viewport(390, 844)
    const signOut = vi.fn()
    wrap(<DesktopOnly onSignOut={signOut}>{app}</DesktopOnly>)
    expect(screen.queryByText('The screen')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vextrus needs a desktop' })).toBeVisible()
    expect(screen.getByText('Open it on a screen 1280 px wide or more. Your work is saved; nothing is lost.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalledOnce()
  })
})

describe('ReadOnlyChip and AccessChip wording (m0-screens §3)', () => {
  it('reads "Read only: MD" and "Read only: Guest"', () => {
    wrap(
      <>
        <ReadOnlyChip role="md" />
        <ReadOnlyChip role="guest" />
      </>,
    )
    expect(screen.getByText('Read only: MD')).toBeInTheDocument()
    expect(screen.getByText('Read only: Guest')).toBeInTheDocument()
  })

  const developer = 'Shapla Homes Ltd'
  const until = '26 Oct 2026'

  it.each([
    ['a Vextrus Engineer with all projects', { vextrus: true, projects: 'all', until, daysLeft: 28 }, 'Vextrus access to Shapla Homes Ltd until 26 Oct 2026'],
    ['a Vextrus Engineer with chosen projects', { vextrus: true, projects: ['KR-01'], until, daysLeft: 28 }, 'Vextrus access to KR-01 at Shapla Homes Ltd until 26 Oct 2026'],
    ['a Guest with one project and an end date', { vextrus: false, projects: ['KR-01'], until, daysLeft: 28 }, 'Access to KR-01 at Shapla Homes Ltd until 26 Oct 2026'],
    ['a member with two projects and no end date', { vextrus: false, projects: ['KR-01', 'BP-02'], until: null, daysLeft: null }, 'Access to KR-01 and BP-02 at Shapla Homes Ltd'],
    ['three projects', { vextrus: false, projects: ['KR-01', 'BP-02', 'GH-03'], until: null, daysLeft: null }, 'Access to KR-01, BP-02 and GH-03 at Shapla Homes Ltd'],
    ['all projects with an end date', { vextrus: false, projects: 'all', until, daysLeft: 28 }, 'Access to Shapla Homes Ltd until 26 Oct 2026'],
    ['more than three projects', { vextrus: false, projects: ['KR-01', 'BP-02', 'GH-03', 'LM-04'], until, daysLeft: 28 }, 'Access to 4 projects at Shapla Homes Ltd until 26 Oct 2026'],
    ['an Engineer with 2 days left', { vextrus: true, projects: 'all', until, daysLeft: 2 }, 'Vextrus access ends in 2 days'],
    ['a Guest with 1 day left', { vextrus: false, projects: ['KR-01'], until, daysLeft: 1 }, 'Access ends in 1 day'],
  ] as const)('words the chip for %s', (_, props, words) => {
    wrap(<AccessChip developer={developer} {...props} projects={props.projects === 'all' ? 'all' : [...props.projects]} />)
    expect(screen.getByTestId('access-chip')).toHaveTextContent(words)
  })

  it('isolates project codes and turns amber with 3 days or fewer left', () => {
    wrap(<AccessChip developer={developer} vextrus={false} projects={['KR-01']} until={until} daysLeft={3} />)
    const chip = screen.getByTestId('access-chip')
    expect(chip).toHaveAttribute('data-ending', 'true')
    wrap(<AccessChip developer={developer} vextrus={false} projects={['KR-01', 'BP-02']} until={null} daysLeft={null} />)
    expect(screen.getByText('BP-02').tagName).toBe('BDI')
  })

  it.each([
    [
      'four projects and an end date',
      { vextrus: false, projects: ['KR-01', 'BP-02', 'GH-03', 'LM-04'], until, daysLeft: 20 },
      'Your access to KR-01, BP-02, GH-03 and LM-04 at Shapla Homes Ltd ends on 26 Oct 2026.',
    ],
    ['an Engineer with every project', { vextrus: true, projects: 'all', until, daysLeft: 20 }, 'Vextrus access to Shapla Homes Ltd ends on 26 Oct 2026.'],
    ['two projects and no end date', { vextrus: false, projects: ['KR-01', 'BP-02'], until: null, daysLeft: null }, 'Your access covers KR-01 and BP-02 at Shapla Homes Ltd.'],
  ] as const)('words the tooltip for %s through the catalogue, the date unbroken (design gate m3, m4)', async (_, props, words) => {
    wrap(<AccessChip developer={developer} {...props} projects={props.projects === 'all' ? 'all' : [...props.projects]} />)
    screen.getByTestId('access-chip').focus()
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip.textContent?.replace(/[⁦-⁩]/g, '')).toBe(words)
  })

  it('shows nothing for a member with every project and no end date', () => {
    wrap(<AccessChip developer={developer} vextrus={false} projects="all" until={null} daysLeft={null} />)
    expect(screen.queryByTestId('access-chip')).not.toBeInTheDocument()
  })
})

describe('Toast (m0-screens §3)', () => {
  function Harness() {
    const toast = useToast()
    return (
      <>
        <button type="button" onClick={() => toast.show({ message: 'Confirmed 14 columns.', onUndo: () => {} })}>
          first
        </button>
        <button type="button" onClick={() => toast.show({ message: 'Excluded S-110.' })}>
          second
        </button>
      </>
    )
  }

  it('shows one at a time, as a status, with Undo and its key when the act can be undone', async () => {
    wrap(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'first' }))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Confirmed 14 columns.')
    expect(screen.getByRole('button', { name: /Undo/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'second' }))
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Excluded S-110.')
    expect(screen.queryByRole('button', { name: /Undo/ })).not.toBeInTheDocument()
  })

  it('goes after 6 seconds', async () => {
    vi.useFakeTimers()
    wrap(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    )
    act(() => screen.getByRole('button', { name: 'second' }).click())
    expect(screen.getByRole('status')).toHaveTextContent('Excluded S-110.')
    act(() => vi.advanceTimersByTime(6000))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
