/*
 * The Coverage panel's "Unaccounted" list (m0-screens 6.11) at its edges: an untitled view is named by its
 * kind, an entry whose sheet is not in the Step's list is shown but opens nothing, and an entry opens its
 * own sheet and view (never the first). Every title is invented.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { BANGLADESH } from '@/app/seed/demo.fixture'
import { FormatProvider } from '@/format'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import type { CoverageOut, ProposalOut } from './data'
import { CoveragePanel } from './Step1Inspector'

beforeAll(() => activateLanguage(ENGLISH, englishMessages()))

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

const view = (id: string, kind: string, title: string | null) => ({ id, ordinal: 1, kind, title })

const sheet = (id: string, number: string, views: ReturnType<typeof view>[]) =>
  ({ id: `p-${id}`, sheet_id: id, number, title: 'INVENTED SHEET', file_name: 'invented.dwg', layout: null, views }) as unknown as ProposalOut

const coverage = (views: { id: string; view_id: string; sheet_id: string }[]) =>
  ({ views: 3, assigned: 0, excluded: 0, proposed: 3 - views.length, unaccounted: views.length, used: 0, by_step: {}, by_reason: {}, unaccounted_views: views, unread_sheets: 0 }) as CoverageOut

const SHEETS = [sheet('s1', 'S-31', [view('v1', 'plan', 'RAFT ZQ'), view('v2', 'detail', null)]), sheet('s2', 'S-32', [view('v3', 'section', 'SECTION QQ-1')])]

function panel(views: { id: string; view_id: string; sheet_id: string }[], onOpenView = vi.fn()) {
  render(
    <I18nProvider i18n={i18n}>
      <FormatProvider profile={BANGLADESH}>
        <CoveragePanel coverage={coverage(views)} held={[]} reading={[]} sheets={SHEETS} onOpenView={onOpenView} />
      </FormatProvider>
    </I18nProvider>,
  )
  return onOpenView
}

const list = () => within(screen.getByRole('heading', { name: 'Unaccounted' }).closest('section')!)

describe('the Coverage panel’s "Unaccounted" list', () => {
  it('names an untitled view by its sheet’s number and its kind', () => {
    panel([{ id: 'u1', view_id: 'v2', sheet_id: 's1' }])
    expect(list().getAllByRole('button').map((b) => clean(b.textContent))).toEqual(['S-31 Detail'])
  })

  it('opens the entry’s own sheet and view, by Enter as by a click', async () => {
    const opened = panel([
      { id: 'u1', view_id: 'v2', sheet_id: 's1' },
      { id: 'u3', view_id: 'v3', sheet_id: 's2' },
    ])
    const [, second] = list().getAllByRole('button')
    second!.focus()
    await userEvent.keyboard('{Enter}')
    expect(opened).toHaveBeenCalledWith(SHEETS[1], 'v3')
  })

  it('shows an entry whose sheet is not in the list, opening nothing', () => {
    panel([{ id: 'u9', view_id: 'v9', sheet_id: 'gone' }])
    expect(list().queryAllByRole('button')).toEqual([])
    expect(clean(list().getByRole('list').textContent)).toBe('View')
  })
})
