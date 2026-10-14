/*
 * S27-G5's acceptance (#670; the G1 walk of session 26, f-3): on Step 1's sheet list, a row whose title
 * is shared keeps its title readable. Mounted through the app on 22's fake (`../t22/step1.fixture.ts`)
 * with invented Sheets (`../ts15q3/groups.fixture.ts`'s shapes), in the real layout at 1280 and 1440 wide.
 *
 * The promises, in the authority's words:
 * - M0 FL5 (docs/milestones.md): Step 1 "shows every sheet with its proposed ... title".
 * - The owner's ruling of 5 Oct 2026 (#334): one title on several runs is one series, told as
 *   "N sheets share this title"; m0-screens §6.2: a run of sheets is one row, "Title "Column schedule,
 *   3 sheets"".
 * - f-3: the note took the Title cell, so the title was cut "to nothing or 3-4 letters" and the row read
 *   ", 2 sheets". The fix gives the title the priority: it truncates last.
 *
 * Not pinned (the builder's choice): where the note goes (shrunk, on its own line, or in a tooltip), the
 * row's height, the columns' widths, and how much of a long title shows beyond its first 12 characters
 * (on main the Title cell is about 190 px wide at both widths and ", 2 sheets" stays whole, so 12 is what
 * a group row can promise without widening the column). A long title's note need only stay reachable: in
 * the row's text, in an accessible name or title, or in a tooltip on hover. The title truncates last, so
 * a short title on a group row, which fits beside its count once the note gives way, shows whole. A row
 * whose short title and note fit today is unchanged: both show whole.
 *
 * The measure: a text's visible part is its laid-out box clipped by every box around it that clips
 * (overflow not visible). "Shows its first 12 characters" means the first 14 characters' box ends inside
 * the clip, so an ellipsis drawn over the cut cannot cover the twelfth.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'
import { clean, sheet, stage, type Proposal } from '../ts15q3/groups.fixture'

/** Invented, 58 characters: a title a long series of sections might carry. */
const LONG_TITLE = 'STAIR CORE SECTIONS AND LANDING BEAM REINFORCEMENT DETAILS'
/** Invented, 16 characters: fits its group row's Title cell beside ", 2 sheets". */
const SHORT_TITLE = 'LIFT PIT DETAILS'
/** Invented, 4 characters: fits a single row's Title cell beside its note today. */
const TINY_TITLE = 'LIFT'
const LONE_TITLE = 'BOUNDARY GATE ELEVATION'
const SHOWN = 12

/**
 * A series of four on the long title (D-51 and D-52 run on: one row "…, 2 sheets"; D-55 and D-58 alone),
 * a series of three on the short title (D-61 and D-62 run on; D-64 alone), a series of two on the tiny
 * title (D-71 and D-74, each alone), and one Sheet in no series.
 */
function scene(): Proposal[] {
  return [
    ...['D-51', 'D-52', 'D-55', 'D-58'].map((n) => sheet(n, LONG_TITLE, { series: 's51' })),
    ...['D-61', 'D-62', 'D-64'].map((n) => sheet(n, SHORT_TITLE, { series: 's61' })),
    ...['D-71', 'D-74'].map((n) => sheet(n, TINY_TITLE, { series: 's71' })),
    sheet('D-80', LONE_TITLE, { series: null }),
  ]
}

const PATH = '/p/KR-01/takeoff/1'

afterEach(() => {
  vi.useRealTimers()
})

/** Every list row, innermost (a row holding no other row). */
function rows(): HTMLElement[] {
  const all = [...document.querySelectorAll<HTMLElement>('[role="row"]')]
  return all.filter((r) => !all.some((o) => o !== r && r.contains(o)))
}

const numberCell = (row: HTMLElement) => clean(row.querySelectorAll<HTMLElement>('[role="gridcell"]')[1]?.textContent)

async function rowNumbered(pattern: RegExp): Promise<HTMLElement> {
  return waitFor(() => {
    const found = rows().filter((r) => pattern.test(numberCell(r)))
    expect(found, `one row numbered ${String(pattern)}`).toHaveLength(1)
    return found[0]!
  })
}

/** The first text node in `root` holding `text`, and where `text` starts in it. */
function textAt(root: HTMLElement, text: string): { node: Text; start: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const start = (n as Text).data.indexOf(text)
    if (start >= 0) return { node: n as Text, start }
  }
  return null
}

/** The box the text node's every clipping ancestor leaves visible (padding boxes, overflow not visible), in fractional px. */
function clipOf(node: Node): { left: number; right: number; top: number; bottom: number } {
  const clip = { left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity }
  for (let el = node.parentElement; el; el = el.parentElement) {
    const style = getComputedStyle(el)
    const clipsX = style.overflowX !== 'visible'
    const clipsY = style.overflowY !== 'visible'
    if (!clipsX && !clipsY) continue
    const r = el.getBoundingClientRect()
    const px = (v: string) => parseFloat(v) || 0
    if (clipsX) {
      clip.left = Math.max(clip.left, r.left + px(style.borderLeftWidth))
      clip.right = Math.min(clip.right, r.right - px(style.borderRightWidth))
    }
    if (clipsY) {
      clip.top = Math.max(clip.top, r.top + px(style.borderTopWidth))
      clip.bottom = Math.min(clip.bottom, r.bottom - px(style.borderBottomWidth))
    }
  }
  return clip
}

/** The laid-out box of `length` characters of the text node from `start`. */
function boxOf(node: Text, start: number, length: number): DOMRect {
  const range = document.createRange()
  range.setStart(node, start)
  range.setEnd(node, start + length)
  return range.getBoundingClientRect()
}

/** The innermost element in `row` whose text holds `text` (it may span several text nodes, as a plural's does). */
function holderOf(row: HTMLElement, text: string): HTMLElement | null {
  const all = [row, ...row.querySelectorAll<HTMLElement>('*')].filter((el) => clean(el.textContent).includes(text))
  return all.find((el) => !all.some((o) => o !== el && el.contains(o))) ?? null
}

/**
 * Whether the first `chars` characters of `text`, found in `row`, lie inside every clip around them: a
 * prefix within one text node, or the whole text as its innermost element's contents.
 */
function shows(row: HTMLElement, text: string, chars: number): { ok: boolean; why: string } {
  const at = textAt(row, text.slice(0, chars))
  const holder = at ? null : chars === text.length ? holderOf(row, text) : null
  if (!at && !holder) return { ok: false, why: `no text "${text.slice(0, chars)}" in the row "${clean(row.textContent)}"` }
  let box: DOMRect
  if (at) box = boxOf(at.node, at.start, chars)
  else {
    const range = document.createRange()
    range.selectNodeContents(holder!)
    box = range.getBoundingClientRect()
  }
  const clip = clipOf(at ? at.node : holder!.firstChild ?? holder!)
  const ok = box.width > 0 && box.left >= clip.left - 1 && box.right <= clip.right + 1 && box.top >= clip.top - 1 && box.bottom <= clip.bottom + 1
  return { ok, why: `${ok ? 'shown' : 'cut short'}: "${text.slice(0, chars)}" spans x ${box.left.toFixed(1)}–${box.right.toFixed(1)}, y ${box.top.toFixed(1)}–${box.bottom.toFixed(1)}; visible x ${clip.left.toFixed(1)}–${clip.right.toFixed(1)}, y ${clip.top.toFixed(1)}–${clip.bottom.toFixed(1)}` }
}

/** The note's words: in the row's text, in an accessible name or title within it, or in a tooltip shown on hovering the row's title. */
async function reachable(row: HTMLElement, title: string, words: string): Promise<boolean> {
  if (clean(row.textContent).includes(words)) return true
  const named = [row, ...row.querySelectorAll<HTMLElement>('*')]
  if (named.some((el) => ['title', 'aria-label', 'aria-description'].some((a) => clean(el.getAttribute(a)).includes(words)))) return true
  const described = named.flatMap((el) => (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean))
  if (described.some((id) => clean(document.getElementById(id)?.textContent).includes(words))) return true
  // A tooltip on the title: hovered on the title's own element and each element around it up to the row.
  const around: HTMLElement[] = []
  for (let el = textAt(row, title.slice(0, 4))?.node.parentElement ?? null; el && el !== row; el = el.parentElement) around.push(el)
  for (const el of around) {
    await userEvent.hover(el)
    const shown = await waitFor(() => {
      const tips = screen.queryAllByRole('tooltip')
      if (!tips.some((t) => clean(t.textContent).includes(words))) throw new Error('no tooltip with the note')
      return true
    }).catch(() => false)
    if (shown) return true
    await userEvent.unhover(el)
  }
  return false
}

describe.each([
  [1280, 800],
  [1440, 900],
])('a row whose title is shared, %i wide (#670; M0 FL5)', (width, height) => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-01T06:00:00Z'))
    await page.viewport(width, height)
    const api = new FakeApi()
    const step1 = new FakeStep1(api, 'KR-01')
    stage(step1, scene())
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await rowNumbered(/^D-51\s*[–-]\s*D-52$/)
  })

  it(`shows the first ${SHOWN} characters of a long shared title on its group row ("…, 2 sheets")`, async () => {
    const row = await rowNumbered(/^D-51\s*[–-]\s*D-52$/)
    const seen = shows(row, LONG_TITLE, SHOWN + 2)
    expect(seen.ok, seen.why).toBe(true)
  })

  it(`shows the first ${SHOWN} characters of a long shared title on a single sheet's row of the series`, async () => {
    const row = await rowNumbered(/^D-55$/)
    const seen = shows(row, LONG_TITLE, SHOWN + 2)
    expect(seen.ok, seen.why).toBe(true)
  })

  it('keeps "2 sheets" and "4 sheets share this title" reachable on the long title\'s group row', async () => {
    const row = await rowNumbered(/^D-51\s*[–-]\s*D-52$/)
    expect(clean(row.textContent)).toContain('2 sheets')
    expect(await reachable(row, LONG_TITLE, '4 sheets share this title'), clean(row.textContent)).toBe(true)
  })

  it('shows a short shared title whole on its group row: the note gives way first', async () => {
    const row = await rowNumbered(/^D-61\s*[–-]\s*D-62$/)
    const title = shows(row, SHORT_TITLE, SHORT_TITLE.length)
    expect(title.ok, title.why).toBe(true)
    expect(clean(row.textContent)).toContain('2 sheets')
    expect(await reachable(row, SHORT_TITLE, '3 sheets share this title'), clean(row.textContent)).toBe(true)
  })

  it('leaves a row whose short title and note fit unchanged: "LIFT" and "2 sheets share this title" both whole', async () => {
    const row = await rowNumbered(/^D-71$/)
    const title = shows(row, TINY_TITLE, TINY_TITLE.length)
    expect(title.ok, title.why).toBe(true)
    const note = shows(row, '2 sheets share this title', '2 sheets share this title'.length)
    expect(note.ok, note.why).toBe(true)
  })

  it('shows a short title in no series whole, with no note', async () => {
    const row = await rowNumbered(/^D-80$/)
    const title = shows(row, LONE_TITLE, LONE_TITLE.length)
    expect(title.ok, title.why).toBe(true)
    expect(clean(row.textContent)).not.toContain('share this title')
  })
})
