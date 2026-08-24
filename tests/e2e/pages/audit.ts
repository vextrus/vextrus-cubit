/**
 * S-AUDIT's page object — the three audit surfaces, said once
 * (`docs/design/s-audit.md`; R-SPINE-081, S-Audit).
 *
 * The journey speaks to the screens through the test ids the increment's contract fixes and
 * never through a class name or a sentence: copy belongs to the Design Decision (§7) and moves
 * when the designer says so, while a test id is a contract. Two vocabularies are quoted
 * literally and are named where they appear: the act type `ASSIGN_PARTICIPANT_ROLE` and the
 * role names, both of which the test contract lists as "vocabulary literals both suites may
 * quote" — they are the seam's own closed words (L-ACT-03), not copy.
 *
 * `tests/e2e/pages/settings.ts` (the fixture tenant, sign-in), `tests/e2e/pages/projects.ts`
 * (project creation, the participants pane, the Select driver, the axe threshold) and
 * `tests/e2e/pages/shell.ts` (the breadcrumb) are reused unmodified: the acts this screen is a
 * record of are made on those screens, and a second copy of either walk would be a second
 * thing to keep true.
 *
 * The axe helper re-exported here is `expectNoSeriousAxeViolations`, not the lane-wide
 * `expectNoAxeViolations` of `tests/e2e/axe.ts`: AC-1 gates these routes on "no serious or
 * critical", which is this increment's own threshold, and narrowing is done in the open here
 * rather than by filtering inside the helper every other journey trusts.
 */
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { selectOption, selectedValue } from './projects';

export { expectNoSeriousAxeViolations, selectOption, selectedValue } from './projects';

/* ─────────────────────────────── the routes the contract fixes ──────────────────────── */

export const auditRoute = (slug: string, projectId: string): string =>
  `/t/${slug}/p/${projectId}/audit`;
export const modelsRoute = (slug: string, projectId: string): string =>
  `/t/${slug}/p/${projectId}/audit/models`;
export const jobsRoute = (slug: string, projectId: string): string =>
  `/t/${slug}/p/${projectId}/audit/jobs`;

/** The act vocabulary the test contract permits both suites to quote (L-ACT-03). */
export const ASSIGN_PARTICIPANT_ROLE = 'ASSIGN_PARTICIPANT_ROLE';
export const PRINCIPAL = 'PRINCIPAL';
export const REVIEWER = 'REVIEWER';
export const MEASURER = 'MEASURER';

/** The URL search params the explorer filters through (AC-3). */
export const TYPE_PARAM = 'type';
export const ACTOR_PARAM = 'actor';
export const SUBJECT_PARAM = 'subject';

/* ────────────────────────────────────── the surfaces ────────────────────────────────── */

export const auditNav = (page: Page): Locator => page.getByTestId('audit-nav');
export const auditNavActs = (page: Page): Locator => page.getByTestId('audit-nav-acts');
export const auditNavModels = (page: Page): Locator => page.getByTestId('audit-nav-models');
export const auditNavJobs = (page: Page): Locator => page.getByTestId('audit-nav-jobs');

export const actLog = (page: Page): Locator => page.getByTestId('act-log');
export const actLogEntries = (page: Page): Locator => page.getByTestId('act-log-entry');
export const actLogEmpty = (page: Page): Locator => page.getByTestId('act-log-empty');

export const filterType = (page: Page): Locator => page.getByTestId('act-filter-type');
export const filterActor = (page: Page): Locator => page.getByTestId('act-filter-actor');
export const filterSubject = (page: Page): Locator => page.getByTestId('act-filter-subject');
export const filterApply = (page: Page): Locator => page.getByTestId('act-filter-apply');

/** An entry's two derived slots (AC-2). Addressed within the entry, never page-wide. */
export const consequenceOf = (entry: Locator): Locator => entry.getByTestId('act-consequence');
export const evidenceOf = (entry: Locator): Locator => entry.getByTestId('act-evidence');

export const modelLedger = (page: Page): Locator => page.getByTestId('model-ledger');
export const modelLedgerEmpty = (page: Page): Locator => page.getByTestId('model-ledger-empty');
export const jobHistory = (page: Page): Locator => page.getByTestId('job-history');
export const jobHistoryEmpty = (page: Page): Locator => page.getByTestId('job-history-empty');

/** One entry, found by the person it is about — an entry is an act as a reader reads it. */
export const entryAbout = (page: Page, email: string): Locator =>
  actLogEntries(page).filter({ hasText: email });

/* ──────────────────────────────────────── helpers ───────────────────────────────────── */

/**
 * The act log at an address of the reader's choosing — the filters are the URL (§3's
 * Interpretation 3), so every filtered read a journey makes is also a deep link.
 */
export async function openAudit(
  page: Page,
  slug: string,
  projectId: string,
  params: Readonly<Record<string, string>> = {},
): Promise<void> {
  const query = new URLSearchParams(params).toString();
  await page.goto(`${auditRoute(slug, projectId)}${query === '' ? '' : `?${query}`}`);
}

/** Every entry's `data-act-type`, in the order the page lists them (the contract's attribute). */
export async function actTypesInOrder(page: Page): Promise<string[]> {
  return actLogEntries(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-act-type') ?? ''),
  );
}

/** Every entry's text, in page order — what "newest first" is read off. */
export async function entryTextsInOrder(page: Page): Promise<string[]> {
  return actLogEntries(page).evaluateAll((nodes) =>
    nodes.map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim()),
  );
}

/** The value/text pairs a native `<select>` offers, in document order. */
export async function optionsOf(select: Locator): Promise<{ value: string; text: string }[]> {
  return select.evaluateAll((nodes) => {
    const first = nodes[0];
    if (first === undefined) return [];
    return Array.from(first.querySelectorAll('option')).map((option) => ({
      value: option.getAttribute('value') ?? '',
      text: (option.textContent ?? '').trim(),
    }));
  });
}

/**
 * Choose the three filters and apply them — AC-3's own gesture, through the controls rather
 * than through the address bar. An empty string chooses the select's "all" option, whose
 * value the design fixes as empty (§3).
 */
export async function applyFilters(
  page: Page,
  choice: { type?: string; actor?: string; subject?: string },
): Promise<void> {
  if (choice.type !== undefined) await selectOption(filterType(page), choice.type);
  if (choice.actor !== undefined) await selectOption(filterActor(page), choice.actor);
  if (choice.subject !== undefined) await selectOption(filterSubject(page), choice.subject);
  await filterApply(page).click();
  // The filter is a GET: the answer is a fresh document at a new address, so the journey waits
  // for the address before reading a single row of the list it asked for.
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Grant a role through the participants pane, exactly as J-003 does — the acts this screen
 * records are made on that screen and nowhere else (R-UI-021's ConsequenceDialog).
 */
export async function grantRole(
  page: Page,
  slug: string,
  projectId: string,
  email: string,
  role: string,
): Promise<void> {
  await page.goto(`/t/${slug}/p/${projectId}/settings/participants`);
  await expect(page.getByTestId('participants-pane')).toBeVisible();
  await selectOption(page.getByTestId('participant-assign-member'), email);
  await selectOption(page.getByTestId('participant-assign-role'), role);
  await page.getByTestId('participant-assign').click();
  const dialog = page.getByTestId('consequence-dialog');
  await expect(dialog).toBeVisible();
  await page.getByTestId('consequence-confirm').click();
  await expect(dialog).toBeHidden();
  const row = page.locator(`[data-testid="participant-row"][data-email="${email}"]`);
  await expect(row).toHaveAttribute('data-role', role);
}

/**
 * A workspace member who is not the reader, taken from the product's own roster control —
 * pinning an address here would redden this file the day the fixture tenant grows a member
 * (J-003 reasons the same way, in its own words).
 */
export async function someoneElse(page: Page, notThese: readonly string[]): Promise<string> {
  const control = page.getByTestId('participant-assign-member');
  const offered = await optionsOf(control);
  for (const option of offered) {
    const candidate = option.value.includes('@') ? option.value : option.text;
    if (candidate.includes('@') && !notThese.includes(candidate)) return candidate;
  }
  // A Datum Select is not a native one: its options mount only while it is open, so what it
  // holds is what its trigger says — and the pane preselects the first member who is not the
  // reader, which is exactly who is wanted (J-003 reads it the same way).
  const preselected = (await selectedValue(control)).trim();
  expect(
    preselected.includes('@') && !notThese.includes(preselected),
    `the member control offers nobody outside [${notThese.join(', ')}] (it holds “${preselected}”) — this journey needs a second person`,
  ).toBe(true);
  return preselected;
}
