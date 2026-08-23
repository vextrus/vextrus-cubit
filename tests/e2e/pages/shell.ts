/**
 * The shell's page object — R-UI-030's frame, said once (docs/design/shell.md §11).
 *
 * The journey speaks to the shell through the test ids the increment's contract fixes and
 * never through a class name or a sentence: copy belongs to the Design Decision and moves when
 * the designer says so, while a test id is a contract.
 *
 * Two things here are not selectors and are worth stating:
 *
 *   - `empty-state` renders in `shell-main` and in `shell-inspector` at once (§11), so every
 *     locator for a state scopes itself to one region. An unscoped `getByTestId('empty-state')`
 *     is strict-mode ambiguous and would fail for a reason that has nothing to do with the
 *     screen.
 *
 *   - `settled` waits out the animations an arrival is running. §8 gives the rail a
 *     `--motion-panel-duration` width transition, and a width or a colour read mid-transition
 *     is a value neither state paints — an axe scan on that frame reports a defect nobody can
 *     ever see.
 */
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** The rail's three areas, as URL segments — the shell's own vocabulary (R-UI-031). */
export const PROJECTS_SEGMENT = 'projects';
export const BOOKS_SEGMENT = 'books';
export const SETTINGS_SEGMENT = 'settings';
export const SESSIONS_SEGMENT = 'sessions';

/** Every area the rail can open, in the order the journey walks them. */
export const RAIL_SEGMENTS = [PROJECTS_SEGMENT, BOOKS_SEGMENT, SETTINGS_SEGMENT] as const;

export type RailSegment = (typeof RAIL_SEGMENTS)[number];

/** The rail item for an area, by the test id the contract fixes. */
const RAIL_TESTID: Readonly<Record<RailSegment, string>> = {
  projects: 'rail-nav-projects',
  books: 'rail-nav-books',
  settings: 'rail-nav-settings',
};

/** The two rail widths §1 decides. */
export const RAIL_EXPANDED_WIDTH = 240;
export const RAIL_COLLAPSED_WIDTH = 48;

export const rail = (page: Page): Locator => page.getByTestId('shell-rail');
export const railToggle = (page: Page): Locator => page.getByTestId('rail-toggle');
export const tenantSwitcher = (page: Page): Locator => page.getByTestId('rail-tenant-switcher');
export const tenantSwitcherItems = (page: Page): Locator =>
  page.getByTestId('tenant-switcher-item');
export const topbar = (page: Page): Locator => page.getByTestId('shell-topbar');
export const breadcrumb = (page: Page): Locator => page.getByTestId('topbar-breadcrumb');
export const projectSwitcher = (page: Page): Locator => page.getByTestId('topbar-project-switcher');
export const commandAffordance = (page: Page): Locator => page.getByTestId('topbar-command');
export const jobsTray = (page: Page): Locator => page.getByTestId('topbar-jobs');
export const notifications = (page: Page): Locator => page.getByTestId('topbar-notifications');
export const userSlot = (page: Page): Locator => page.getByTestId('topbar-user');
export const main = (page: Page): Locator => page.getByTestId('shell-main');
export const inspector = (page: Page): Locator => page.getByTestId('shell-inspector');
export const railItem = (page: Page, segment: RailSegment): Locator =>
  page.getByTestId(RAIL_TESTID[segment]);

/** The area's own empty state, and the inspector's — the same test id in two regions (§11). */
export const areaEmptyState = (page: Page): Locator => main(page).getByTestId('empty-state');
export const areaEmptyAction = (page: Page): Locator =>
  main(page).getByTestId('empty-state-action');
export const inspectorEmptyState = (page: Page): Locator =>
  inspector(page).getByTestId('empty-state');

/** The session list, which is an area of the shell like any other (Interpretation 7). */
export const sessionRows = (page: Page): Locator => page.getByTestId('session-row');

/** `/t/{slug}` and `/t/{slug}/{segment}` — the addresses the URL is the truth of. */
export function tenantUrl(slug: string, segment?: string): string {
  return segment === undefined ? `/t/${slug}` : `/t/${slug}/${segment}`;
}

/** The path the browser is on, without the origin — what R-UI-031's claims are made about. */
export const pathOf = (page: Page): string => new URL(page.url()).pathname;

/** Wait until an arrival — or a rail that is changing width — has stopped moving (§8, §11). */
export async function settled(locator: Locator): Promise<void> {
  await locator.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

/** The rail's width as the browser paints it, once the transition has finished. */
export async function railWidth(page: Page): Promise<number> {
  await settled(rail(page));
  const box = await rail(page).boundingBox();
  expect(box, 'the rail has no box — is it in the layout at all?').not.toBeNull();
  return Math.round(box?.width ?? 0);
}

/**
 * Open an area from the rail and wait for the URL to be the one it names.
 *
 * The wait is the URL rather than a rendered node on purpose: R-UI-031 makes the address the
 * source of truth, so "the rail navigated" is a claim about the address first.
 */
export async function openArea(page: Page, slug: string, segment: RailSegment): Promise<void> {
  await railItem(page, segment).click();
  await page.waitForURL(`**${tenantUrl(slug, segment)}`);
}

/** Collapse or expand the rail, and let the 240 ↔ 48 transition finish (§8). */
export async function toggleRail(page: Page): Promise<void> {
  await railToggle(page).click();
  await settled(rail(page));
}

/** The tenant switcher's menu, opened and waited for — a Radix surface arrives a frame late. */
export async function openTenantSwitcher(page: Page): Promise<Locator> {
  await tenantSwitcher(page).click();
  const items = tenantSwitcherItems(page);
  await expect(items.first()).toBeVisible();
  return items;
}

/** Close whatever overlay is open, and wait until it has really left (Radix unmounts late). */
export async function dismissOverlay(page: Page, surface: Locator): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(surface).toBeHidden();
}

/** The browser's own back button — the one R-UI-031 says works everywhere. */
export async function goBack(page: Page, expected: string): Promise<void> {
  await page.goBack();
  await page.waitForURL(`**${expected}`);
}
