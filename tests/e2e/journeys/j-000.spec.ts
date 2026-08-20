import { test, expect } from '@playwright/test';
import { AuthPage } from '../support/pages/auth';
import { TenantPage } from '../support/pages/tenant';
import { checkpoint } from '../support/checkpoint';
import { waitForMail } from '../support/mail';
import { JOURNEY_USERS, FIXTURE_TENANTS, REFUSAL_CODES } from '../support/seed';

/**
 * J-000 — the whole-product journey. This increment delivers its seed segment
 * only: sign up → verify → create tenant. Later milestones extend it
 * (project, DXF, partition, BOQ, book, estimate, assure, bid).
 *
 * Proves AC-15 and AC-12.
 */

const user = JOURNEY_USERS.j000;

test.describe('J-000 seed segment', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('J-000: sign up → verify → create tenant', async ({ page }) => {
    const auth = new AuthPage(page);
    const tenant = new TenantPage(page);

    // --- sign up ----------------------------------------------------------
    await auth.gotoSignUp();
    await auth.signUp(user);
    await checkpoint(page, 'j000-signup');

    // --- verify via the file outbox (AC-11) ------------------------------
    const verifyMail = await waitForMail(user.email, 'verify');
    await page.goto(verifyMail.url);
    await expect(page.getByTestId('verify-email-success')).toBeVisible();

    // --- first verified sign-in lands on onboarding (AC-12, R-UI-033) ----
    await auth.gotoSignIn();
    await auth.signIn(user.email, user.password);
    await tenant.expectCreateTenant();

    // AC-12: a slug already taken by the seeded fixture tenant refuses in place
    await tenant.createTenant(FIXTURE_TENANTS.acme.slug);
    await auth.expectRefusal(REFUSAL_CODES.tenantSlugTaken);
    await tenant.expectCreateTenant();

    // --- create the named tenant -----------------------------------------
    await page.getByTestId('create-tenant-name').fill(user.tenantName);
    await page.getByTestId('create-tenant-submit').click();

    const slug = await tenant.expectTenantHome();
    expect(slug, 'the created tenant owns the URL').not.toBe(FIXTURE_TENANTS.acme.slug);

    // R-UI-050: the empty state teaches the next action rather than saying nothing
    await expect(page.getByTestId('tenant-home')).not.toBeEmpty();
    await checkpoint(page, 'j000-tenant-created');

    // D-01: the project URL scheme is reserved but not yet built
    expect(new URL(page.url()).pathname).toMatch(/^\/t\/[a-z0-9-]+$/);
  });
});
