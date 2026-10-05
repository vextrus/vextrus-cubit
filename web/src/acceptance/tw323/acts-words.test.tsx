/*
 * Ticket T-W323's acceptance tests (#323, G1 walk item FL10): each Step 1 act is a DomainEvent the
 * MD reads in Members and access (m0-screens §4.4, "Acts"), so each of its seven codes has English:
 * worded from the params the activity API sends (`actor`, the name, marked "(Vextrus)" by
 * `actMessage`; `sheets` and `views`, counts), never the plain "no words" sentence.
 * Every name and count here is invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { components } from '@/api/schema.gen'
import { BANGLADESH } from '@/app/seed/demo.fixture'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FormatProvider } from '@/format/Format'
import { MachineText, codesWithoutEnglish } from '@/format/machine'
import { englishMessages } from '@/i18n/catalogues'
import { actMessage } from '@/members/ActsPanel'
import { UiProviders } from '@/ui/UiProviders'

type ActOut = components['schemas']['ActOut']

const CODES = [
  'takeoff.step1.confirmed',
  'takeoff.step1.left_out',
  'takeoff.step1.views_assigned',
  'takeoff.step1.answered',
  'takeoff.step1.kept_open',
  'takeoff.step1.list_changed',
  'takeoff.step1.undone',
] as const

const ENGINEER = 'Tahmina Chowdhury'
const UNWORDED = 'Vextrus has something to tell you here but no words for it yet.'

/** Visible text: without the isolates the message layer puts round every value. */
const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

/** An act as `GET /api/activity` sends it: the Vextrus Engineer acting, `by` and `subject` added. */
function act(code: string, counts: Record<string, number> = {}): ActOut {
  return {
    id: '01a10c00-0000-7000-8000-000000000001',
    code,
    params: { ...counts, actor: ENGINEER, by: 'person', subject: '' },
    actor: { id: '01a10c00-0000-7000-8000-0000000000e1', name: ENGINEER, role: 'vextrus_engineer', vextrus: true },
    project_id: '01a10c00-0000-7000-8000-0000000000b1',
    building_id: null,
    subject_type: 'confirmation',
    subject_id: '01a10c00-0000-7000-8000-0000000000c1',
    occurred_at: '2026-10-02T08:15:00Z',
  }
}

/** The act's sentence as the Acts panel words it. */
async function worded(code: string, counts: Record<string, number> = {}): Promise<string> {
  const { container, unmount } = render(
    <UiProviders>
      <FormatProvider profile={BANGLADESH}>
        <p>
          <MachineText message={actMessage(act(code, counts), (name) => `${name} (Vextrus)`)} />
        </p>
      </FormatProvider>
    </UiProviders>,
  )
  await waitFor(() => expect(clean(container.textContent)).not.toBe(''))
  const words = clean(container.textContent)
  unmount()
  return words
}

describe('a Step 1 act in the Acts panel (T-W323, m0-screens §4.4)', () => {
  it('11. words a confirmation with how many sheets', async () => {
    expect(await worded('takeoff.step1.confirmed', { sheets: 1 })).toBe('Tahmina Chowdhury (Vextrus) confirmed 1 sheet in Step 1')
    expect(await worded('takeoff.step1.confirmed', { sheets: 7 })).toBe('Tahmina Chowdhury (Vextrus) confirmed 7 sheets in Step 1')
  })

  it('12. words an exclusion with its sheets, its views left out on their own, or both', async () => {
    const leftOut = (sheets: number, views: number) => worded('takeoff.step1.left_out', { sheets, views })
    expect(await leftOut(1, 0)).toBe('Tahmina Chowdhury (Vextrus) left out 1 sheet in Step 1')
    expect(await leftOut(5, 0)).toBe('Tahmina Chowdhury (Vextrus) left out 5 sheets in Step 1')
    expect(await leftOut(1, 2)).toBe('Tahmina Chowdhury (Vextrus) left out 1 sheet and 2 views in Step 1')
    expect(await leftOut(3, 6)).toBe('Tahmina Chowdhury (Vextrus) left out 3 sheets and 6 views in Step 1')
    expect(await leftOut(0, 4)).toBe('Tahmina Chowdhury (Vextrus) left out 4 views in Step 1')
    expect(await leftOut(0, 1)).toBe('Tahmina Chowdhury (Vextrus) left out 1 view in Step 1')
  })

  it('13. words views put in Takeoff Steps with how many', async () => {
    expect(await worded('takeoff.step1.views_assigned', { views: 4 })).toBe('Tahmina Chowdhury (Vextrus) put 4 views in Takeoff Steps')
    expect(await worded('takeoff.step1.views_assigned', { views: 1 })).toBe('Tahmina Chowdhury (Vextrus) put 1 view in Takeoff Steps')
  })

  it('14. words an answer, a Question kept open, a drawing list and an undo', async () => {
    expect(await worded('takeoff.step1.answered')).toBe('Tahmina Chowdhury (Vextrus) answered a Question in Step 1')
    expect(await worded('takeoff.step1.kept_open')).toBe('Tahmina Chowdhury (Vextrus) kept a Question open in Step 1')
    expect(await worded('takeoff.step1.list_changed')).toBe('Tahmina Chowdhury (Vextrus) changed a drawing list in Step 1')
    expect(await worded('takeoff.step1.undone')).toBe('Tahmina Chowdhury (Vextrus) took back their last act in Step 1')
  })
})

describe('no Step 1 act falls back to "no words" (T-W323)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T06:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('15. has English for each of the seven codes', () => {
    expect(codesWithoutEnglish([...CODES], englishMessages())).toEqual([])
  })

  it('15. lists the Engineer’s Step 1 acts newest first in their panel, each worded', async () => {
    const api = new FakeApi()
    const shapla = api.developer('Shapla Homes Ltd')
    const engineer = api.addUser('tahmina@vextrus.example', ENGINEER, true)
    api.addMembership(shapla, engineer, 'vextrus_engineer', {
      invitedBy: api.user(PEOPLE.md).id,
      since: '2026-10-01T04:00:00Z',
      expiresAt: '2026-10-30T17:59:00Z',
    })
    const project = api.project('KR-01', shapla.id).id
    api.addAct(shapla.id, 'takeoff.step1.list_changed', engineer.id, null, '2026-10-02T03:10:00Z', project)
    api.addAct(shapla.id, 'takeoff.step1.answered', engineer.id, null, '2026-10-02T03:20:00Z', project)
    api.addAct(shapla.id, 'takeoff.step1.kept_open', engineer.id, null, '2026-10-02T03:30:00Z', project)
    api.addAct(shapla.id, 'takeoff.step1.undone', engineer.id, null, '2026-10-02T03:40:00Z', project)

    await mountApp('/members', { as: PEOPLE.md, api })
    const opens = await screen.findByRole('button', { name: (n: string) => /^4 acts, last .*, by Tahmina Chowdhury$/.test(clean(n)) })
    await userEvent.click(opens)
    const panel = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Tahmina Chowdhury (Vextrus)' })
    expect(within(panel).getByText('Their acts, newest first')).toBeVisible()
    const items = (await within(panel).findAllByRole('listitem')).map((li) => clean(li.textContent))

    expect(items.map((line) => line.split(' · ')[0])).toEqual([
      'Tahmina Chowdhury (Vextrus) took back their last act in Step 1',
      'Tahmina Chowdhury (Vextrus) kept a Question open in Step 1',
      'Tahmina Chowdhury (Vextrus) answered a Question in Step 1',
      'Tahmina Chowdhury (Vextrus) changed a drawing list in Step 1',
    ])
    expect(items.every((line) => line.includes(' · Kadam Residence · '))).toBe(true)
    expect(clean(panel.textContent)).not.toContain(UNWORDED)
  })
})
