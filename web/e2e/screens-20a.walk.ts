/*
 * Ticket 20a's walk of m0-screens §8 on the served demo seed (§7): sign-in, the projects, Members and
 * access, the session's pages, by keyboard, at 1440 × 900 and 1280 × 800 (sign-in at 390 too), in
 * English and the test-only right-to-left language (`?lang=en-XB`), as Kamal Uddin (MD), Nusrat Jahan
 * (QS), Farhana Kabir (Guest) and Arif Rahman (Vextrus Engineer); then 4.4's finish-line step 10 and
 * the Guest's walk. Each screen is screenshotted to WALK_SHOTS and checked: the words, the design
 * gate's DOM greps (§1.1, §1.9, §1.10), a focus ring, whole, on every control reached by Tab, and no
 * call the API refused. The design gate's round 1 is walked too: Members and access whole with a
 * person's acts open (1440, 1280, 1100, right to left), the revoked Engineer's next click refused with
 * no reload, the AccessChip's date whole, two tabs of one browser, and a link pasted into an open /join.
 *
 *   VEXTRUS_DEMO_PASSWORD=… WALK_SHOTS=… npx --prefix web playwright test -c web/e2e/playwright.config.ts
 *
 * (with VEXTRUS_DB_NAME as the API has it, when that serves another database). Step 10 needs a Vextrus
 * Engineer who is one of Vextrus's staff and not yet invited: the walk makes sabbir@vextrus.example as
 * the owner does (manage.py, the owner alias, `set_staff`), once.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test'

const PASSWORD = process.env.VEXTRUS_DEMO_PASSWORD ?? ''
const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const SHOTS = process.env.WALK_SHOTS ?? `${ROOT}.private/work/walk-20a/shots`
const SIZES = [
  [1440, 900],
  [1280, 800],
] as const

const PEOPLE = {
  md: { email: 'kamal@shapla-homes.example', menu: 'Kamal Uddin, MD' },
  qs: { email: 'nusrat@shapla-homes.example', menu: 'Nusrat Jahan, QS' },
  guest: { email: 'farhana@padma-builders.example', menu: 'Farhana Kabir, Guest' },
  engineer: { email: 'arif@vextrus.example', menu: 'Arif Rahman, Vextrus Engineer' },
} as const
type Who = keyof typeof PEOPLE

const STAFF = { email: 'sabbir@vextrus.example', name: 'Sabbir Hossain' }

/** Visible text without the isolates the message layer puts round each value. */
const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩]/g, '')

/** A locator's visible text, isolates left out, as it settles. */
const textOf = (locator: Locator) => async () => clean(await locator.innerText())

/** A pattern for words as shown, the isolates round any value in them allowed for. */
const loose = (words: string) => new RegExp([...words].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[⁦-⁩]*'))

let shotNumber = 0
async function shot(page: Page, name: string) {
  shotNumber += 1
  await page.waitForTimeout(250) // the fade-in of dialogs and toasts (motion-panel, 240 ms)
  await page.screenshot({ path: `${SHOTS}/${String(shotNumber).padStart(2, '0')}-${name}.png` })
}

/** The API's refusals seen by a page (status 400 and over), but the signed-out /api/me of a sign-in page. */
function watchApi(page: Page): string[] {
  const refused: string[] = []
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (!url.pathname.startsWith('/api/') || response.status() < 400) return
    if (url.pathname === '/api/me' && response.status() === 401) return
    refused.push(`${response.request().method()} ${url.pathname} ${response.status()}`)
  })
  return refused
}

/** m0-screens §1.1's words never shown, §1.9's Market and currency, §1.10's Building, and no message code. */
async function greps(page: Page) {
  const text = clean(await page.locator('body').innerText())
  for (const word of ['handle', 'entity', 'SDF', 'DXF', 'JSON', 'sandbox', 'worker', 'queue', 'hash', 'tenant', 'RLS', 'API', 'null', 'undefined', 'NaN', 'UUID', 'locale', 'Building', 'Bangladesh', 'BDT', '৳']) {
    expect(text, `"${word}" is never shown`).not.toMatch(new RegExp(`\\b${word}\\b`))
  }
  expect(text, 'no message code').not.toMatch(/\b[a-z_]+\.[a-z_]+\.[a-z_]+\b/)
  expect(text, 'no raw CAD code').not.toMatch(/%%|\\P|\\f|\\S|\^J|\{\\/)
}

/** Tabs through the page: every control reached shows a ring, inside the viewport. */
async function ringsOnTab(page: Page, stops = 14) {
  const seen: string[] = []
  for (let i = 0; i < stops; i++) {
    await page.keyboard.press('Tab')
    const focus = await page.evaluate(() => {
      const focused = document.activeElement as HTMLElement | null
      if (!focused || focused === document.body) return null
      // A list with a focused row draws its ring on the row (01b's List).
      const active = focused.getAttribute('aria-activedescendant')
      const el = (active && document.getElementById(active)) || focused
      const style = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      const ring = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2
      // The ring whole: no ancestor that clips (overflow other than visible) cuts into it (gate 20a r1, item 7).
      // How far the ring reaches outside the element: an inset ring (a negative offset) reaches less, or not at all.
      const reach = Math.max(0, parseFloat(style.outlineWidth) + (parseFloat(style.outlineOffset) || 0))
      let cut = false
      for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) {
        const s = getComputedStyle(up)
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue
        const box = up.getBoundingClientRect()
        if (r.left - reach < box.left - 0.5 || r.right + reach > box.right + 0.5 || r.top - reach < box.top - 0.5 || r.bottom + reach > box.bottom + 0.5) {
          // A scrolling region clips what is scrolled out of it; only a ring cut at an edge it shows counts.
          if (up.scrollHeight <= up.clientHeight && up.scrollWidth <= up.clientWidth) cut = true
        }
      }
      return { name: `${el.tagName.toLowerCase()} ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? ''}`, ring, cut, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }
    })
    if (!focus) continue
    seen.push(focus.name)
    expect(focus.ring, `a ring on ${focus.name}`).toBe(true)
    expect(focus.cut, `${focus.name}'s ring whole`).toBe(false)
    expect(focus.inside, `${focus.name} inside the viewport`).toBe(true)
  }
  return seen
}

/**
 * Members and access whole (design gate 20a r1, musts 4 to 7): every row act whole and in view, inside
 * the page and its table's box; every Until whole; and, with a person's acts open, a 24 px gutter at
 * both edges of the page's content (whichever the language's direction).
 */
async function membersWhole(page: Page, panelOpen: boolean) {
  const problems = await page.evaluate((open) => {
    const out: string[] = []
    const pageBox = document.querySelector('[data-region="page"]')!.getBoundingClientRect()
    for (const b of document.querySelectorAll<HTMLElement>('main table button[aria-label]')) {
      const r = b.getBoundingClientRect()
      const box = b.closest('table')!.parentElement!.getBoundingClientRect()
      const name = b.getAttribute('aria-label')
      if (r.width < 40) out.push(`${name}: ${r.width.toFixed(0)} px wide`)
      if (r.left < Math.max(box.left, pageBox.left) - 0.5 || r.right > Math.min(box.right, pageBox.right) + 0.5) out.push(`${name}: out of view`)
      if (getComputedStyle(b.closest('td')!).overflow !== 'visible') out.push(`${name}: its cell clips it`)
    }
    // A cell that does not truncate (with its tooltip) shows whole: Until, Acts and the row's acts.
    for (const td of document.querySelectorAll<HTMLElement>('main table td:not(.truncate)')) {
      if (td.scrollWidth > td.clientWidth + 0.5) out.push(`cut: ${td.textContent}`)
    }
    if (open) {
      for (const t of document.querySelectorAll('main table')) {
        const box = t.parentElement!.getBoundingClientRect()
        if (box.left - pageBox.left < 23.5) out.push(`a table ${(box.left - pageBox.left).toFixed(1)} px from the left edge`)
        if (pageBox.right - box.right < 23.5) out.push(`a table ${(pageBox.right - box.right).toFixed(1)} px from the right edge`)
      }
    }
    return out
  }, panelOpen)
  expect(problems, 'Members and access whole').toEqual([])
}

async function signIn(page: Page, email: string, path = '/sign-in') {
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Email')).toBeFocused()
  await page.keyboard.type(email)
  await page.keyboard.press('Tab')
  await page.keyboard.type(PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'))
}

async function signOut(page: Page, menu: string) {
  await page.getByRole('button', { name: loose(menu) }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.waitForURL(/\/sign-in/)
}

async function newPage(browser: Browser, [width, height]: readonly [number, number]) {
  const context = await browser.newContext({ viewport: { width, height } })
  return context.newPage()
}

test.beforeAll(() => {
  expect(PASSWORD, 'VEXTRUS_DEMO_PASSWORD is set').not.toBe('')
  mkdirSync(SHOTS, { recursive: true })
  const make = `
import io, os
from django.core.management import call_command
from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.models import User
email = ${JSON.stringify(STAFF.email)}
if not User.objects.filter(email__iexact=email).exists():
    User.objects.db_manager(OWNER_ALIAS).create_user(email, ${JSON.stringify(STAFF.name)}, os.environ['VEXTRUS_DEMO_PASSWORD'])
call_command('set_staff', email, stdout=io.StringIO())
`
  const made = spawnSync('uv', ['run', '--no-sync', 'manage.py', 'shell', '-c', make], { cwd: ROOT, encoding: 'utf8' })
  expect(made.status, made.stderr).toBe(0)
})

test('sign-in, at 1440, 1280 and 390, in English and right to left (§4.2)', async ({ browser }) => {
  for (const size of [...SIZES, [390, 844] as const]) {
    for (const lang of ['', '?lang=en-XB']) {
      const page = await newPage(browser, size)
      await page.goto(`/sign-in${lang}`)
      await expect(page).toHaveTitle(lang ? /·/ : 'Sign in · Vextrus')
      if (!lang) {
        await page.keyboard.press('Tab')
        await expect(page.getByLabel('Email')).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(page.getByLabel('Password')).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.getByText('Enter your email.')).toBeVisible()
        await page.getByLabel('Email').fill(PEOPLE.qs.email)
        await page.getByLabel('Password').fill('not the password at all')
        await page.keyboard.press('Enter')
        await expect(page.getByRole('alert')).toHaveText("That email and password don't match an account. Check them and try again.")
      }
      await shot(page, `sign-in-${size[0]}${lang ? '-rtl' : ''}`)
      if (!lang) await greps(page)
      await page.context().close()
    }
  }
})

for (const who of ['md', 'qs', 'guest', 'engineer'] as Who[]) {
  test(`${who}: the projects and Members and access, by keyboard, at both sizes (§4.3, §4.4)`, async ({ browser }) => {
    for (const size of SIZES) {
      const page = await newPage(browser, size)
      const refused = watchApi(page)
      await signIn(page, PEOPLE[who].email)
      await expect(page).toHaveURL(/\/projects$/)
      await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
      const header = page.locator('main header').first()
      const subtitle = clean(await header.locator('p').innerText())
      if (who === 'guest') {
        expect(subtitle).toBe('1 project at Shapla Homes Ltd is open to you')
        await expect.poll(textOf(page.getByTestId('access-chip'))).toBe('Access to KR-01 at Shapla Homes Ltd until 26 Oct 2026')
      } else {
        // A walk run before adds a project (step 10): the seed's three are there, and the count says them all.
        expect(subtitle).toMatch(/^\d+ projects at Shapla Homes Ltd$/)
        const listed = clean(await page.getByRole('listbox', { name: 'Projects' }).innerText())
        for (const name of ['Kadam Residence', 'Bokul Place', 'Shimul Garden']) expect(listed).toContain(name)
      }
      if (who === 'engineer') await expect.poll(textOf(page.getByTestId('access-chip'))).toMatch(/^Vextrus access to Shapla Homes Ltd until \d{1,2} [A-Z][a-z]{2} \d{4}$/)
      await expect(header.getByRole('button', { name: 'New project' })).toHaveCount(who === 'qs' || who === 'engineer' ? 1 : 0)
      await expect(header.getByRole('link', { name: 'Members and access' })).toHaveCount(who === 'guest' ? 0 : 1)
      await expect(header.getByText(/^Read only: /)).toHaveCount(who === 'md' || who === 'guest' ? 1 : 0)
      await greps(page)
      await shot(page, `${who}-projects-${size[0]}`)
      await ringsOnTab(page)

      // Enter opens the focused project.
      await page.getByRole('listbox', { name: 'Projects' }).focus()
      await page.keyboard.press('Enter')
      await page.waitForURL(/\/p\/[^/]+\/takeoff\/1$/)
      await page.goBack()

      if (who === 'guest') {
        for (const path of ['/members', '/p/BP-02/takeoff/1', '/p/SG-03']) {
          await page.goto(path)
          await expect(page.getByText(/There is nothing at this address\./)).toBeVisible()
          expect(clean(await page.locator('body').innerText())).not.toMatch(/Bokul Place|Shimul Garden|As a Guest you can/)
        }
        await shot(page, `guest-members-not-found-${size[0]}`)
      } else {
        await page.goto('/members')
        await expect(page.getByRole('heading', { name: 'Members and access' })).toBeVisible()
        await expect(page.getByRole('table').first()).toBeVisible()
        if (who === 'md') await expect(page.getByText(loose('Kamal Uddin (you)'))).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Vextrus access' })).toHaveCount(who === 'engineer' ? 0 : 1)
        await expect(page.getByRole('button', { name: 'Invite' })).toHaveCount(who === 'engineer' ? 0 : 1)
        await greps(page)
        await membersWhole(page, false)
        await shot(page, `${who}-members-${size[0]}`)
        if (who !== 'engineer') {
          await page.getByRole('button', { name: 'Invite' }).focus()
          await page.keyboard.press('Enter')
          const dialog = page.getByRole('dialog', { name: /^Invite someone to/ })
          await expect(dialog).toBeVisible()
          if (who === 'md') await dialog.getByRole('radio', { name: 'Guest' }).click()
          else await expect(dialog.getByText(loose('Role: Vextrus Engineer'))).toBeVisible()
          await shot(page, `${who}-invite-${size[0]}`)
          await dialog.getByLabel('Email').fill('someone@padma-builders.example')
          await page.keyboard.press('Escape')
          await expect(dialog.getByText('Close without saving what you entered?')).toBeVisible()
          await page.keyboard.press('Escape')
          await expect(dialog.getByLabel('Email')).toHaveValue('someone@padma-builders.example')
          await dialog.getByRole('button', { name: 'Cancel' }).click()
          await dialog.getByRole('button', { name: 'Discard' }).click()
          await expect(dialog).toHaveCount(0)
        }
        if (who === 'md' || who === 'qs') {
          const acts = page.getByRole('button', { name: /acts?, last|No acts yet/ }).first()
          await acts.click()
          await expect(page.getByText('Their acts, newest first')).toBeVisible()
          await membersWhole(page, true)
          await shot(page, `${who}-acts-${size[0]}`)
          await page.keyboard.press('Escape')
          await expect(page.getByText('Their acts, newest first')).toHaveCount(0)
          await expect(acts).toBeFocused()
          // With a person's acts open, every control Tab reaches shows its ring whole (gate item 7).
          await acts.click()
          await expect(page.getByText('Their acts, newest first')).toBeVisible()
          await ringsOnTab(page, 24)
        }
      }

      // The pseudo right-to-left language: the same screens, mirrored.
      await page.goto('/projects?lang=en-XB')
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      await shot(page, `${who}-projects-${size[0]}-rtl`)
      if (who !== 'guest') {
        await page.goto('/members?lang=en-XB')
        await page.waitForTimeout(300)
        await shot(page, `${who}-members-${size[0]}-rtl`)
      }
      expect(refused, 'no call the API refused').toEqual([])
      await page.context().close()
    }
  })
}

test('Members and access with a person’s acts open, at 1100 and right to left (design gate 20a r1, musts 4 to 7)', async ({ browser }) => {
  for (const [size, lang] of [
    [[1100, 800], ''],
    [[1280, 800], '?lang=en-XB'],
    [[1440, 900], '?lang=en-XB'],
  ] as const) {
    const page = await newPage(browser, size)
    await signIn(page, PEOPLE.md.email)
    await page.goto(`/members${lang}`)
    await expect(page.locator('main table').first()).toBeVisible()
    await membersWhole(page, false)
    await page.locator('main table button[aria-expanded]').first().click()
    await expect(page.locator('[data-region="panel"]')).toBeVisible()
    await membersWhole(page, true)
    await shot(page, `md-acts-${size[0]}${lang ? '-rtl' : ''}`)
    // (The rings with a person's acts open are walked at 1440 and 1280 above; below 1280 the frame keeps
    // its 1280 px and scrolls sideways, 03's narrow notice saying so.)
    await page.context().close()
  }
})

test('finish line step 10 (§4.4): invite an Engineer, they act, the act is listed under their name, revoke, their next click is refused', async ({ browser }) => {
  const md = await newPage(browser, SIZES[0])
  await signIn(md, PEOPLE.md.email)
  await md.goto('/members')
  // A walk run before may have left the Engineer's invitation unused: withdraw it first (4.4's Withdraw).
  const invitations = md.getByRole('table', { name: 'Invitations not used yet' })
  await expect(invitations).toBeVisible()
  const left = invitations.getByRole('row', { name: new RegExp(STAFF.email) })
  if (await left.count()) {
    await left.getByRole('button', { name: 'Withdraw' }).click()
    await expect.poll(textOf(md.getByRole('status'))).toBe('Invitation withdrawn. The link no longer works.')
  }
  // …or the Engineer still in (a run stopped before its revoke): end that access first.
  const still = md.getByRole('table', { name: 'Vextrus access' }).getByRole('row', { name: new RegExp(STAFF.name) }).filter({ hasNotText: 'Revoked' })
  if (await still.count()) {
    await still.getByRole('button', { name: 'Revoke' }).click()
    await md.getByRole('button', { name: 'End access' }).click()
    await expect.poll(async () => still.count()).toBe(0)
  }
  await md.getByRole('button', { name: 'Invite' }).click()
  const dialog = md.getByRole('dialog', { name: /^Invite someone to/ })
  await dialog.getByLabel('Email').fill(STAFF.email)
  await dialog.getByRole('radio', { name: 'Vextrus Engineer' }).click()
  await expect(dialog.getByLabel('Access ends on')).toHaveValue(/\d{1,2} [A-Z][a-z]{2} \d{4}/)
  await dialog.getByRole('button', { name: 'Create link' }).click()
  await expect(dialog.getByText(/^Copy this link and send it to/)).toBeVisible()
  const link = await dialog.getByLabel('The invitation link').inputValue()
  expect(link).toMatch(/\/join#[^?#/]+$/)
  await shot(md, 'step10-link')
  await md.keyboard.press('Escape')

  const engineer = await newPage(browser, SIZES[0])
  const engineerRefused = watchApi(engineer)
  await engineer.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await expect.poll(textOf(engineer.getByRole('heading', { level: 1 }))).toBe('Join Shapla Homes Ltd')
  expect(new URL(engineer.url()).hash).toBe('')
  await shot(engineer, 'step10-join')
  await engineer.getByLabel('Password').fill(PASSWORD)
  await engineer.getByRole('button', { name: 'Join' }).click()
  await engineer.waitForURL(/\/projects$/)
  const code = `WT-${String(Date.now() % 1000).padStart(3, '0')}`
  await engineer.getByRole('button', { name: 'New project' }).first().click()
  const form = engineer.getByRole('dialog', { name: 'New project' })
  await form.getByLabel('Name').fill('Walk Tower')
  await form.getByLabel('Code').fill(code)
  await form.getByRole('button', { name: 'Create project' }).click()
  await engineer.waitForURL(new RegExp(`/p/${code}/takeoff/1$`))
  expect(engineerRefused).toEqual([])
  // On the project's page, where the top bar is fullest, the AccessChip's date is whole (gate must 3).
  const chip = engineer.getByTestId('access-chip')
  await expect.poll(textOf(chip)).toMatch(/until \d{1,2} [A-Z][a-z]{2} \d{4}$/)
  expect(await chip.locator('[data-words]').evaluate((el) => el.scrollWidth <= el.clientWidth + 0.5)).toBe(true)

  await md.goto('/members')
  // Only the current access: a walk run before leaves an ended one listed, muted (4.4).
  const row = md.getByRole('row', { name: new RegExp(STAFF.name) }).filter({ hasNotText: 'Revoked' })
  await row.getByRole('button', { name: /acts?, last/ }).click()
  const panel = md.locator('[data-region="panel"]')
  await expect.poll(textOf(panel.getByRole('heading', { level: 2 }))).toBe(`${STAFF.name} (Vextrus)`)
  await expect.poll(textOf(panel.locator('ol > li').first())).toMatch(new RegExp(`^${STAFF.name} \\(Vextrus\\) created this project · Walk Tower · \\d{1,2} [A-Z][a-z]{2} \\d{4}, \\d{2}:\\d{2}$`))
  await shot(md, 'step10-acts')
  await md.keyboard.press('Escape')
  await row.getByRole('button', { name: 'Revoke' }).click()
  await expect.poll(textOf(md.getByRole('dialog').getByRole('heading'))).toBe(`End ${STAFF.name}’s access now?`)
  await md.getByRole('button', { name: 'End access' }).click()
  await expect.poll(textOf(md.getByRole('status'))).toBe(`${STAFF.name}’s access has ended.`)
  await expect.poll(async () => (await md.getByRole('row', { name: new RegExp(STAFF.name) }).filter({ hasNotText: 'Revoked' }).count())).toBe(0)
  await expect.poll(textOf(md.getByRole('row', { name: new RegExp(STAFF.name) }).last())).toContain('Revoked by Kamal Uddin')
  // The Revoke button went with the row: focus is on the section's heading, not lost (gate may).
  await expect(md.getByRole('heading', { name: 'Vextrus access' })).toBeFocused()
  await shot(md, 'step10-revoked')

  // The Engineer's next click, in the page they already had open: the brand, which asks the API for
  // nothing a page needs. Refused all the same, to 4.1's page, with no reload (gate must 1).
  let reloaded = false
  engineer.on('load', () => (reloaded = true))
  await engineer.getByRole('link', { name: 'Vextrus' }).click()
  await engineer.waitForURL(/\/access-ended$/)
  expect(reloaded, 'no reload').toBe(false)
  await expect
    .poll(textOf(engineer.getByRole('main').locator('p').first()))
    .toMatch(/^Your access to Shapla Homes Ltd has ended\. Kamal Uddin revoked it on \d{1,2} [A-Z][a-z]{2} \d{4}\. What you did before then is kept under your name\.$/)
  await shot(engineer, 'step10-access-ended')
  await engineer.context().close()

  // The refuter's finding, on the server: the MD's toast never follows into the next person's session.
  await signOut(md, 'Kamal Uddin, MD')
  await signIn(md, PEOPLE.guest.email)
  await expect(md.getByRole('button', { name: loose('Farhana Kabir, Guest') })).toBeVisible()
  expect(clean(await md.getByRole('status').innerText())).toBe('')
  expect(clean(await md.locator('body').innerText())).not.toContain('access has ended')
  await md.context().close()
})

test('the Guest’s walk (§4.4): KR-01 only, the chip, BP-02 and /members not found, read only', async ({ browser }) => {
  const page = await newPage(browser, SIZES[1])
  const refused = watchApi(page)
  await signIn(page, PEOPLE.guest.email)
  await expect(page.getByRole('listbox', { name: 'Projects' }).getByRole('option')).toHaveCount(1)
  await expect(page.getByText('Read only: Guest')).toBeVisible()
  await page.getByRole('listbox', { name: 'Projects' }).focus()
  await page.keyboard.press('Control+k')
  const jump = page.getByRole('dialog', { name: 'Jump to' })
  await expect(jump.getByRole('option')).toHaveText([/Kadam Residence/])
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: loose('Farhana Kabir, Guest') }).click()
  await expect(page.getByRole('menuitem', { name: 'Members and access' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await shot(page, 'guest-walk')
  expect(refused).toEqual([])
  await signOut(page, 'Farhana Kabir, Guest')
  await page.context().close()
})

test('#75’s seed: "Which Developer?", the switcher and an empty Developer (§4.1, §4.2, §4.3)', async ({ browser }) => {
  const page = await newPage(browser, SIZES[0])
  const refused = watchApi(page)
  await signIn(page, 'sharmin@chameli-homes.example')
  await expect(page).toHaveURL(/\/choose-developer/)
  await expect(page.getByRole('heading', { name: 'Which Developer?' })).toBeVisible()
  await expect.poll(textOf(page.getByRole('listbox', { name: 'Your Developers' }))).toMatch(/Chameli Homes Ltd\s*QS[\s\S]*Meghna Properties Ltd\s*QS/)
  await shot(page, 'choose-developer')
  await page.getByRole('listbox', { name: 'Your Developers' }).focus()
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/projects$/)
  await expect(page.getByText('No projects yet. Create one for each development whose drawings you will take off.')).toBeVisible()
  await shot(page, 'projects-empty')
  await page.getByRole('button', { name: loose('Sharmin Akter, QS') }).click()
  await page.getByRole('menuitem', { name: loose('Switch to Meghna Properties Ltd') }).click()
  await expect(page.getByText('Meghna Heights')).toBeVisible()
  await expect(page.getByText('No projects yet.', { exact: false })).toHaveCount(0)
  expect(refused).toEqual([])
  await page.context().close()
})

test('#75’s seed: an expired Guest signs in to "Access ended", and the MD sees the ended row, renewable (§4.1, §4.4)', async ({ browser }) => {
  const guest = await newPage(browser, SIZES[1])
  await signIn(guest, 'rafiq@jamuna-consultants.example')
  await expect(guest).toHaveURL(/\/access-ended$/)
  await expect
    .poll(textOf(guest.getByRole('main').locator('p').first()))
    .toMatch(/^Your access to KR-01 at Shapla Homes Ltd ended on \d{1,2} [A-Z][a-z]{2} \d{4}\. Ask Shapla Homes Ltd to renew it\.$/)
  await expect(guest.getByRole('link', { name: 'Choose another Developer' })).toHaveCount(0)
  await shot(guest, 'access-ended-expired')
  await guest.context().close()

  const md = await newPage(browser, SIZES[1])
  await signIn(md, PEOPLE.md.email)
  await md.goto('/members')
  const row = md.getByRole('row', { name: /Rafiq Islam/ })
  await expect.poll(textOf(row)).toMatch(/Ended \d{1,2}\u00a0[A-Z][a-z]{2}\u00a0\d{4}/)
  await expect(row.getByRole('button', { name: 'Renew 30 days' })).toBeVisible()
  await shot(md, 'members-ended-row')
  await md.context().close()
})

test('`?next=` never leaves the app (the trust boundary): a dot segment, a protocol-relative address, a script', async ({ browser }) => {
  for (const next of ['/.//evil.example', '//evil.example', 'https://evil.example', 'javascript:alert(1)', '/a/..//x/sign-in', '/%2e%2e%2f/evil.example', '/%252e%252e//evil.example', '/members/..%2f..%2f/evil']) {
    const page = await newPage(browser, SIZES[0])
    await signIn(page, PEOPLE.qs.email, `/sign-in?next=${encodeURIComponent(next)}`)
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/projects$/)
    await page.context().close()
  }
})

test('two tabs of one browser (review 20a r1, finding 1): a switch in one, and the other never writes into the new Developer', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const a = await context.newPage()
  await signIn(a, 'sharmin@chameli-homes.example')
  await a.waitForURL(/\/choose-developer/)
  await a.getByRole('listbox', { name: 'Your Developers' }).focus()
  await a.keyboard.press('Enter')
  await a.waitForURL(/\/projects$/)
  await a.goto('/members')
  await a.getByRole('button', { name: 'Invite' }).click()
  const dialog = a.getByRole('dialog', { name: /^Invite someone to/ })
  await expect.poll(textOf(dialog.getByRole('heading'))).toBe('Invite someone to Chameli Homes Ltd')
  await dialog.getByLabel('Email').fill('walk-two-tabs@vextrus.example')

  // The other tab switches the session to Meghna.
  const b = await context.newPage()
  await b.goto('/projects')
  await b.getByRole('button', { name: loose('Sharmin Akter, QS') }).click()
  await b.getByRole('menuitem', { name: loose('Switch to Meghna Properties Ltd') }).click()
  await expect(b.getByText('Meghna Heights')).toBeVisible()

  // This tab heard it: its dialog for Chameli is gone, it works in Meghna, and it says why.
  await expect(dialog).toHaveCount(0)
  await expect.poll(textOf(a.getByRole('status').filter({ hasText: /another tab/ }))).toBe('You switched to Meghna Properties Ltd in another tab, so this tab has switched too.')
  await expect(a).toHaveURL(/\/projects$/)
  await expect.poll(textOf(a.locator('[data-region="top-bar"]'))).toContain('Meghna Properties Ltd')
  await shot(a, 'two-tabs-switched')
  // Nothing was invited into Meghna.
  await b.goto('/members')
  await expect(b.locator('main table').first()).toBeVisible()
  expect(clean(await b.locator('main').innerText())).not.toContain('walk-two-tabs@vextrus.example')
  await context.close()
})

test('a new link pasted into an open /join page that said the last could not be used (gate must 2)', async ({ browser }) => {
  const md = await newPage(browser, SIZES[0])
  await signIn(md, PEOPLE.md.email)
  await md.goto('/members')
  const email = `walk-paste-${Date.now() % 100000}@padma-builders.example`
  await md.getByRole('button', { name: 'Invite' }).click()
  const dialog = md.getByRole('dialog', { name: /^Invite someone to/ })
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByRole('button', { name: 'Create link' }).click()
  const first = await dialog.getByLabel('The invitation link').inputValue()
  await md.keyboard.press('Escape')
  // A new link for the same invitation ends the first (4.4's Copy link).
  const row = md.getByRole('table', { name: 'Invitations not used yet' }).getByRole('row', { name: new RegExp(email.replace(/\./g, '\\.')) })
  await row.getByRole('button', { name: 'Copy link' }).click()
  const again = md.getByRole('dialog', { name: /^New link for/ })
  const second = await again.getByLabel('The invitation link').inputValue()
  await md.keyboard.press('Escape')

  const page = await newPage(browser, SIZES[0])
  await page.goto(first.replace(/^https?:\/\/[^/]+/, ''))
  await expect(page.getByText('This invitation can no longer be used. Ask whoever sent it for a new one.')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Invitation' })).toBeVisible()
  let reloaded = false
  page.on('load', () => (reloaded = true))
  // Pasted into the address bar: only the fragment differs, so nothing reloads.
  await page.goto(second.replace(/^https?:\/\/[^/]+/, ''))
  await expect.poll(textOf(page.getByRole('heading', { level: 1 }))).toBe('Join Shapla Homes Ltd')
  expect(reloaded, 'no reload').toBe(false)
  await shot(page, 'join-pasted')
  await page.context().close()

  // Leave nothing behind.
  await row.getByRole('button', { name: 'Withdraw' }).click()
  await expect(row).toHaveCount(0)
  await md.context().close()
})

test('the frame’s notices on the projects page (§1.5): narrow at 1100, phone at 390', async ({ browser }) => {
  for (const [size, words] of [
    [[1100, 800], 'This screen is built for 1280 px or wider.'],
    [[390, 844], 'Vextrus needs a desktop'],
  ] as const) {
    const page = await newPage(browser, size)
    await signIn(page, PEOPLE.qs.email)
    await expect.poll(textOf(page.locator('body'))).toContain(words)
    await shot(page, `notice-${size[0]}`)
    await page.context().close()
  }
})
