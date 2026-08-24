/**
 * J-000's and J-003's page object — S-Home, the create form, and the two new project
 * settings panes, said once.
 *
 * The journeys speak to the screens through the test ids the increment's contract fixes and
 * never through a class name or a sentence: copy belongs to the Design Decisions
 * (`docs/design/s-home.md`, `docs/design/s-project-settings-…`) and moves when the designer
 * says so, while a test id is a contract. The two exceptions are deliberate and named where
 * they appear: the GFA conversion, which the panes file pins as a rule (Interpretation 9),
 * and the refusal code, which is the register's own word.
 *
 * `tests/e2e/pages/auth.ts` and `tests/e2e/pages/settings.ts` are reused unmodified — the
 * fixture tenant's credentials and the sign-in walk are theirs, and a second copy of either
 * would be a second thing to keep true.
 *
 * The axe helper here is *not* `expectNoAxeViolations`. AC-5 gates these routes on "zero
 * serious/critical", which is the increment's own threshold; the lane-wide helper asserts
 * zero violations of any impact. Narrowing is done here, in the open, rather than by
 * filtering inside the shared helper every other journey trusts.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** The routes the test contract fixes. */
export const homeRoute = (slug: string): string => `/t/${slug}`;
export const createRoute = (slug: string): string => `/t/${slug}/projects/new`;
export const fieldsRoute = (slug: string, projectId: string): string =>
  `/t/${slug}/p/${projectId}/settings/project`;
export const participantsRoute = (slug: string, projectId: string): string =>
  `/t/${slug}/p/${projectId}/settings/participants`;
export const rulesetRoute = (slug: string, projectId: string): string =>
  `/t/${slug}/p/${projectId}/settings/ruleset`;

/** The roles a human may pick, verbatim from the act vocabulary (L-ACT-03). */
export const PRINCIPAL = 'PRINCIPAL';
export const MEASURER = 'MEASURER';
export const LEAD = 'LEAD';

/** The building types, verbatim from the closed enum (R-SPINE-010). */
export const BUILDING_TYPES = [
  'residential',
  'commercial',
  'mixed',
  'industrial',
  'infrastructure',
] as const;

/** The refusal L-ACT-03 names for a project about to lose its last principal. */
export const PROJECT_WOULD_HAVE_NO_PRINCIPAL = 'PROJECT_WOULD_HAVE_NO_PRINCIPAL';

/* ───────────────────────────────────── S-Home (AC-2) ────────────────────────────────── */

export const tenantHome = (page: Page): Locator => page.getByTestId('tenant-home');
export const homeProjects = (page: Page): Locator => page.getByTestId('home-projects');
export const homeEmpty = (page: Page): Locator => page.getByTestId('home-empty');
export const homeCreateProject = (page: Page): Locator => page.getByTestId('home-create-project');
export const homeRecentDocuments = (page: Page): Locator =>
  page.getByTestId('home-recent-documents');
export const projectCards = (page: Page): Locator => page.getByTestId('project-card');

/** One card, found by the name it carries — a card is the project as a reader sees it. */
export const projectCard = (page: Page, name: string): Locator =>
  projectCards(page).filter({ hasText: name });

export const cardStatus = (card: Locator): Locator => card.getByTestId('project-card-status');
export const cardStats = (card: Locator): Locator => card.getByTestId('project-card-stats');

/* ───────────────────────────── the create form (s-home §5) ──────────────────────────── */

export const projectForm = (page: Page): Locator => page.getByTestId('project-form');
export const fieldName = (page: Page): Locator => page.getByTestId('project-field-name');
export const fieldCode = (page: Page): Locator => page.getByTestId('project-field-code');
export const fieldClient = (page: Page): Locator => page.getByTestId('project-field-client');
export const fieldSiteAddress = (page: Page): Locator =>
  page.getByTestId('project-field-site-address');
export const fieldDistrict = (page: Page): Locator => page.getByTestId('project-field-district');
export const fieldBuildingType = (page: Page): Locator =>
  page.getByTestId('project-field-building-type');
export const fieldStoreys = (page: Page): Locator => page.getByTestId('project-field-storeys');
export const fieldGfaM2 = (page: Page): Locator => page.getByTestId('project-field-gfa-m2');
export const fieldNotes = (page: Page): Locator => page.getByTestId('project-field-notes');
export const projectSubmit = (page: Page): Locator => page.getByTestId('project-submit');

/* ─────────────────────────── the fields pane (panes file §2) ────────────────────────── */

export const settingsFields = (page: Page): Locator => page.getByTestId('project-settings-fields');
export const gfaSft = (page: Page): Locator => page.getByTestId('project-gfa-sft');
export const projectStatus = (page: Page): Locator => page.getByTestId('project-status');
export const projectSave = (page: Page): Locator => page.getByTestId('project-save');
export const projectArchive = (page: Page): Locator => page.getByTestId('project-archive');

/* ────────────────────────── the participants pane (panes file §3–§6) ────────────────── */

export const participantsPane = (page: Page): Locator => page.getByTestId('participants-pane');
export const participantsRoster = (page: Page): Locator => page.getByTestId('participants-roster');
export const participantRows = (page: Page): Locator => page.getByTestId('participant-row');
export const participantAssign = (page: Page): Locator => page.getByTestId('participant-assign');
export const consequenceDialog = (page: Page): Locator => page.getByTestId('consequence-dialog');
export const consequenceSummary = (page: Page): Locator => page.getByTestId('consequence-summary');
export const consequenceConfirm = (page: Page): Locator => page.getByTestId('consequence-confirm');
export const consequenceStale = (page: Page): Locator => page.getByTestId('consequence-stale');
export const consequenceRefusal = (page: Page): Locator => page.getByTestId('consequence-refusal');
export const roleHistory = (page: Page): Locator => page.getByTestId('role-history');
export const roleHistoryEntries = (page: Page): Locator => page.getByTestId('role-history-entry');

/** A roster row, addressed by the participant it is about (`data-email`, panes file §4). */
export const participantRow = (page: Page, email: string): Locator =>
  page.locator(`[data-testid="participant-row"][data-email="${email}"]`);

/** The role a roster row currently says the participant holds (`data-role`, panes file §4). */
export async function roleOf(page: Page, email: string): Promise<string> {
  return (await participantRow(page, email).getAttribute('data-role')) ?? '';
}

/* ─────────────────────────────────── the ruleset pane ───────────────────────────────── */

export const projectRuleset = (page: Page): Locator => page.getByTestId('project-ruleset');
export const rulesetEdition = (page: Page): Locator => page.getByTestId('ruleset-edition');
export const rulesetDigest = (page: Page): Locator => page.getByTestId('ruleset-digest');

/* ──────────────────────────────────────── helpers ───────────────────────────────────── */

/** The project id the URL is speaking, out of `/t/{slug}/p/{projectId}/…`. */
export function projectIdInUrl(page: Page): string {
  const parts = new URL(page.url()).pathname.split('/');
  const marker = parts.indexOf('p');
  return marker === -1 ? '' : (parts[marker + 1] ?? '');
}

/** Every value R-SPINE-010 names, as one form fills it. */
export interface ProjectFields {
  readonly name: string;
  readonly code: string;
  readonly client: string;
  readonly siteAddress: string;
  readonly district: string;
  readonly buildingType: string;
  readonly storeys: string;
  readonly gfaM2: string;
  readonly notes: string;
}

/** A project nothing else in this run holds, so a journey's rows are its own. */
export function freshProject(label: string, overrides: Partial<ProjectFields> = {}): ProjectFields {
  const mark = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return {
    name: `${label} ${mark}`,
    code: `${label.toUpperCase()}-${mark}`,
    client: `Client of ${label} ${mark}`,
    siteAddress: `${mark} Site Road`,
    district: `District ${mark}`,
    buildingType: 'residential',
    storeys: '7',
    gfaM2: '1000',
    notes: `Notes for ${label} ${mark}`,
    ...overrides,
  };
}

/**
 * Fill the R-SPINE-010 fields wherever they are rendered — the create Dialog and the fields
 * pane share s-home §5's ids, labels and order verbatim (panes file §2), so one filler serves
 * both and any divergence between them is a defect this object would rather surface than hide.
 */
export async function fillProjectForm(page: Page, fields: ProjectFields): Promise<void> {
  await fieldName(page).fill(fields.name);
  await fieldCode(page).fill(fields.code);
  await fieldClient(page).fill(fields.client);
  await fieldSiteAddress(page).fill(fields.siteAddress);
  await fieldDistrict(page).fill(fields.district);
  await selectOption(fieldBuildingType(page), fields.buildingType);
  await fieldStoreys(page).fill(fields.storeys);
  await fieldGfaM2(page).fill(fields.gfaM2);
  await fieldNotes(page).fill(fields.notes);
}

/**
 * Choose a value from a Select, whichever Select it is.
 *
 * The Design Decisions call for the Datum Select and leave its implementation to the
 * primitives, so a journey that only knew `selectOption` would be welded to the native
 * element. A native `<select>` takes the value directly; anything else is opened and its
 * option chosen by the text or value it renders.
 */
export async function selectOption(control: Locator, value: string): Promise<void> {
  const tag = await control.evaluate((element) => element.tagName.toLowerCase());
  if (tag === 'select') {
    await control.selectOption(value);
    return;
  }
  await control.click();
  const page = control.page();
  const option = page
    .getByRole('option')
    .filter({ has: page.locator(`[data-value="${value}"], [value="${value}"]`) })
    .or(page.getByRole('option', { name: value, exact: false }))
    .first();
  await option.click();
}

/** The value a Select currently holds, however it renders it. */
export async function selectedValue(control: Locator): Promise<string> {
  const tag = await control.evaluate((element) => element.tagName.toLowerCase());
  if (tag === 'select') return control.inputValue();
  const attribute = await control.getAttribute('data-value');
  return attribute ?? ((await control.textContent()) ?? '').trim();
}

/** Create a project from S-Home and land on its fields pane; answers with its id. */
export async function createProjectThroughForm(
  page: Page,
  slug: string,
  fields: ProjectFields,
): Promise<string> {
  await page.goto(createRoute(slug));
  await expect(projectForm(page)).toBeVisible();
  await fillProjectForm(page, fields);
  await projectSubmit(page).click();
  // s-home §5: success navigates to the project's fields pane — the saved values on screen
  // are the confirmation, so the journey waits for them rather than for a bare URL change.
  await expect(settingsFields(page)).toBeVisible();
  const projectId = projectIdInUrl(page);
  expect(projectId, `creating ${fields.code} did not land on a project route (${page.url()})`)
    .toMatch(/^[0-9a-f-]{36}$/i);
  return projectId;
}

/**
 * Wait until an arrival has stopped moving.
 *
 * The panes fade their refusal, error, saved and stale arrivals over
 * `--motion-state-duration`, and a colour read mid-fade is one neither theme paints — an
 * accessibility scan on that frame reports a contrast defect nobody can ever see.
 */
export async function settled(locator: Locator): Promise<void> {
  await locator.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

/**
 * AC-5's accessibility gate: "zero serious/critical". Violations of lesser impact are
 * reported in the message so a run says everything it saw, and fail nothing on their own.
 */
export async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const described = results.violations
    .map((violation) => {
      const where = violation.nodes.map((node) => node.target.join(' ')).join(', ');
      return `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help} — ${where}`;
    })
    .join('\n');
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(
    blocking.map((violation) => violation.id),
    `axe found ${blocking.length} serious/critical violation(s) on ${page.url()}:\n${described}`,
  ).toEqual([]);
}
