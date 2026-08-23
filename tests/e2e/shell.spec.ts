/**
 * J-000, the shell slice — the persistent workspace frame the Golden Path walks through
 * (R-UI-030, R-UI-031, R-UI-033, R-UI-050, R-UI-060; docs/design/shell.md).
 *
 * The Golden Path's first steps are sign up → land in a workspace, and from this increment on
 * everything after them happens inside one frame. So the slice starts where J-001's first
 * checkpoint ends — a verified landing — and then asks the two questions R-UI-030 and R-UI-031
 * exist for: is the frame there on every area, and does the address decide what it says.
 *
 * `J-000` is on the describe and on every test title because `pnpm e2e --journey J-000` is
 * Playwright's `--grep` over the full title path: a shell test that never says it is a test
 * the Golden Path never runs.
 *
 * Every axe scan below runs with no overlay open and after the animations have settled (§11):
 * a menu that is open trips rules the closed page never has, and a colour read mid-transition
 * is a colour neither state paints.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { expectNoAxeViolations } from './axe';
import { freshEmail, latestMail, notice, submitCard, tenantHome } from './pages/auth';
import {
  BOOKS_SEGMENT,
  PROJECTS_SEGMENT,
  RAIL_COLLAPSED_WIDTH,
  RAIL_EXPANDED_WIDTH,
  RAIL_SEGMENTS,
  SESSIONS_SEGMENT,
  SETTINGS_SEGMENT,
  areaEmptyAction,
  areaEmptyState,
  breadcrumb,
  commandAffordance,
  goBack,
  inspectorEmptyState,
  jobsTray,
  main,
  notifications,
  openArea,
  openTenantSwitcher,
  pathOf,
  projectSwitcher,
  rail,
  railItem,
  railToggle,
  railWidth,
  sessionRows,
  settled,
  tenantSwitcher,
  tenantUrl,
  toggleRail,
  topbar,
  userSlot,
} from './pages/shell';

const SIGN_UP_ROUTE = '/sign-up';
const PASSWORD = 'j000-Passw0rd!';

/** Sign up, open the verification link, and land in the personal tenant the mint made. */
async function signUpAndLand(page: Page, address: string): Promise<string> {
  await page.goto(SIGN_UP_ROUTE);
  await submitCard(page, { email: address, password: PASSWORD });
  await expect(notice(page)).toBeVisible();
  await page.goto(await latestMail(address, 'verify'));
  await expect(tenantHome(page)).toBeVisible();
  return pathOf(page).split('/')[2] ?? '';
}

test.describe('J-000', () => {
  test('J-000 shell frame: the verified landing renders the rail, top bar, main and inspector, and the rail collapses and restores', async ({
    page,
  }) => {
    const slug = await signUpAndLand(page, freshEmail('shell-frame'));
    expect(slug, 'the landing URL carries no tenant slug').not.toBe('');

    // R-UI-030: one layout, all four regions, on the route J-001 already asserted.
    await expect(rail(page)).toBeVisible();
    await expect(topbar(page)).toBeVisible();
    await expect(main(page)).toBeVisible();
    await expect(breadcrumb(page)).toContainText(await page.getByRole('heading').first().innerText());

    // AC-1: every top-bar slot is present and named, and the later-milestone ones answer
    // rather than sit there dead (Interpretation 2).
    for (const slot of [
      projectSwitcher(page),
      commandAffordance(page),
      jobsTray(page),
      notifications(page),
      userSlot(page),
    ]) {
      await expect(slot).toBeVisible();
    }
    await commandAffordance(page).click();
    const palette = page.getByRole('dialog').first();
    await expect(palette).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();

    // §5: the inspector teaches what will fill it, on every shell screen.
    await expect(inspectorEmptyState(page)).toBeVisible();

    // Interpretation 5: the rail collapses to icons and back, and the URL never moves.
    const before = pathOf(page);
    expect(await railWidth(page)).toBe(RAIL_EXPANDED_WIDTH);
    // Expanded, the toggle takes focus and keeps its own accessible name (R-UI-060).
    await railToggle(page).focus();
    await expect(railToggle(page)).toBeFocused();
    await toggleRail(page);
    expect(await railWidth(page)).toBe(RAIL_COLLAPSED_WIDTH);
    await expect(rail(page)).toHaveAttribute('data-collapsed', 'true');
    // Collapsed, the toggle still has a name and still takes focus (R-UI-060).
    await railToggle(page).focus();
    await expect(railToggle(page)).toBeFocused();
    await toggleRail(page);
    expect(await railWidth(page)).toBe(RAIL_EXPANDED_WIDTH);
    expect(pathOf(page), 'collapsing the rail changed the URL').toBe(before);

    // AC-1: the switcher lists this reader's memberships, the current one marked.
    const memberships = await openTenantSwitcher(page);
    await expect(memberships).toHaveCount(1);
    await expect(memberships.first()).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(memberships.first()).toBeHidden();
    await expect(tenantSwitcher(page)).toBeVisible();

    // With nothing open and nothing moving: the frame itself is accessible (R-UI-060).
    await settled(rail(page));
    await expectNoAxeViolations(page);
  });

  test('J-000 shell navigation: the rail walks Projects, Books and Settings, the breadcrumb and aria-current follow the URL, and browser back returns through them', async ({
    page,
  }) => {
    const slug = await signUpAndLand(page, freshEmail('shell-nav'));

    // AC-2: rail navigation, one area at a time. The URL leads; everything else follows it.
    for (const segment of RAIL_SEGMENTS) {
      await openArea(page, slug, segment);
      expect(pathOf(page)).toBe(tenantUrl(slug, segment));

      // The area's own heading and its teaching empty state (R-UI-033, R-UI-050).
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(areaEmptyState(page)).toBeVisible();
      await expect(areaEmptyAction(page)).toBeVisible();
      await expect(inspectorEmptyState(page)).toBeVisible();

      // Exactly the current area's rail item is marked, and the others are not — the mark is
      // the meaning, never the tint alone (R-UI-060).
      for (const other of RAIL_SEGMENTS) {
        const item = railItem(page, other);
        if (other === segment) await expect(item).toHaveAttribute('aria-current', 'page');
        else await expect(item).not.toHaveAttribute('aria-current', 'page');
      }

      // The breadcrumb names the tenant and the area, both read from the address.
      await expect(breadcrumb(page)).toContainText(await railItem(page, segment).innerText());

      await settled(main(page));
      await expectNoAxeViolations(page);
    }

    // AC-3: Projects' action answers honestly — the create dialog, not a dead control (§4).
    await openArea(page, slug, PROJECTS_SEGMENT);
    await areaEmptyAction(page).click();
    const dialog = page.getByTestId('dialog-content');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // R-UI-031: "browser back works everywhere". Projects → Books → Settings, then back three
    // times, through the same addresses in reverse, each area rendering as it did.
    await openArea(page, slug, BOOKS_SEGMENT);
    await openArea(page, slug, SETTINGS_SEGMENT);
    expect(pathOf(page)).toBe(`/t/${slug}/settings`);

    await goBack(page, tenantUrl(slug, BOOKS_SEGMENT));
    expect(pathOf(page)).toBe(`/t/${slug}/books`);
    await expect(railItem(page, BOOKS_SEGMENT)).toHaveAttribute('aria-current', 'page');

    await goBack(page, tenantUrl(slug, PROJECTS_SEGMENT));
    expect(pathOf(page)).toBe(`/t/${slug}/projects`);
    await expect(railItem(page, PROJECTS_SEGMENT)).toHaveAttribute('aria-current', 'page');

    await goBack(page, tenantUrl(slug, SETTINGS_SEGMENT));
    expect(pathOf(page)).toBe(`/t/${slug}/settings`);

    // AC-3: Settings teaches the one real destination there is today — the session list, which
    // stays operable inside the shell and still lists a session-row per device (AC-1).
    await areaEmptyAction(page).click();
    await page.waitForURL(`**${tenantUrl(slug, SESSIONS_SEGMENT)}`);
    await expect(sessionRows(page)).toHaveCount(1);
    await expect(rail(page)).toBeVisible();
    await expect(breadcrumb(page)).toBeVisible();
    await expectNoAxeViolations(page);

    // A deep link is the same screen: a fresh GET of an area renders it inside the frame.
    await page.goto(tenantUrl(slug, BOOKS_SEGMENT));
    await expect(areaEmptyState(page)).toBeVisible();
    await expect(railItem(page, BOOKS_SEGMENT)).toHaveAttribute('aria-current', 'page');
  });
});
