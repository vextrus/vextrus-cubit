/**
 * J-000 — the product's first end-to-end story, first segment: sign up → create tenant →
 * create project (J-000, R-SPINE-010, R-UI-033, S-Home).
 *
 * J-000 is the journey the Bible extends milestone by milestone and "the harness gate runs
 * on every merge". At M0 it reaches as far as a created project; DXF upload onward is later
 * increments' to append, and this file is where they append it.
 *
 * Two things are asserted that a shorter spec would leave out:
 *
 *   - **The clock.** AC-5: "the spec asserting the segment's measured wall time is under 120
 *     seconds". That is a claim about a person's first two minutes with the product, so the
 *     measurement starts before the first navigation and stops when the created project is on
 *     screen — the whole segment, mail round trip included, not the sum of the fast parts.
 *     Playwright's own per-test timeout is raised above the budget on purpose: at the config's
 *     60 s a slow run would be killed by the runner and the 120 s assertion could never be the
 *     thing that spoke, which is a budget nobody is measuring.
 *
 *   - **"create tenant".** Sign-up mints the account's personal tenant (J-001's own claim,
 *     R-SPINE-002), so the tenant is created by verifying — and the segment is only honest if
 *     the journey lands in a workspace that is genuinely new and genuinely empty. Hence the
 *     teaching empty state (R-UI-033) is read before the project is made, and the card after.
 *
 * `J-000` is on the describe *and* the test because `pnpm e2e --journey J-000` is Playwright's
 * `--grep` over the full title path, so a spec that never says it is a spec nothing selects.
 */
import { expect, test } from '@playwright/test';
import {
  SIGN_UP_ROUTE,
  freshEmail,
  latestMail,
  notice,
  slugInUrl,
  submitCard,
  tenantHome,
} from './pages/auth';
import {
  createRoute,
  freshProject,
  homeCreateProject,
  homeEmpty,
  homeProjects,
  homeRecentDocuments,
  projectCard,
  projectIdInUrl,
  createProjectThroughForm,
  settingsFields,
} from './pages/projects';

const PASSWORD = 'j000-Passw0rd!';

/** AC-5 and the J-000 checkpoint: "under 120 seconds", measured in-spec. */
const SEGMENT_BUDGET_MS = 120_000;

/** Above the budget, so the assertion is what fails when the segment is slow (see the header). */
const RUNNER_TIMEOUT_MS = 240_000;

test.describe('J-000', () => {
  test('J-000 sign-up → tenant-minted → project-created: the first two minutes, end to end', async ({
    page,
  }) => {
    test.setTimeout(RUNNER_TIMEOUT_MS);

    const address = freshEmail('j000');
    const project = freshProject('J000');

    const startedAt = Date.now();

    // Checkpoint "sign-up": a brand new account, on the public screen anybody arrives at.
    await page.goto(SIGN_UP_ROUTE);
    await submitCard(page, { email: address, password: PASSWORD });
    await expect(notice(page)).toBeVisible();

    // Checkpoint "tenant-minted": verifying the address creates the workspace and lands in it
    // (R-SPINE-002). This is J-000's "create tenant" step — at M0 the mint is the creation.
    await page.goto(await latestMail(address, 'verify'));
    await expect(tenantHome(page)).toBeVisible();
    const slug = slugInUrl(page);
    expect(slug, 'the landing URL carries no tenant slug').not.toBe('');
    expect(new URL(page.url()).pathname).toBe(`/t/${slug}`);

    // R-UI-033: "the empty states teach the next action". A workspace with no project shows
    // the teaching state, never a bare grid — and the way on is one click from here.
    await expect(homeEmpty(page)).toBeVisible();
    await expect(homeProjects(page)).toHaveCount(0);
    await expect(homeCreateProject(page)).toBeVisible();
    await expect(homeCreateProject(page)).toHaveAttribute('href', createRoute(slug));

    // Checkpoint "project-created": every R-SPINE-010 field, through the form a person uses.
    const projectId = await createProjectThroughForm(page, slug, project);
    await expect(settingsFields(page)).toBeVisible();
    expect(projectIdInUrl(page)).toBe(projectId);

    // The J-000 checkpoint, verbatim: "the created project's S-Home card is visible".
    await page.goto(`/t/${slug}`);
    await expect(homeProjects(page)).toBeVisible();
    await expect(projectCard(page, project.name)).toBeVisible();
    await expect(projectCard(page, project.name)).toContainText(project.code);
    await expect(homeEmpty(page)).toHaveCount(0);

    // The M0 state of the rest of S-Home, so "the story ran" is the whole screen and not one
    // card: recent documents says what will arrive rather than sitting silent (s-home §6).
    await expect(homeRecentDocuments(page)).toBeVisible();

    const elapsed = Date.now() - startedAt;
    expect(
      elapsed,
      `sign up → create tenant → create project took ${(elapsed / 1000).toFixed(1)}s, over the ${
        SEGMENT_BUDGET_MS / 1000
      }s the journey budgets for a person's first visit`,
    ).toBeLessThan(SEGMENT_BUDGET_MS);
  });
});
