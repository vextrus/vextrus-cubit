import { expect, test } from '@playwright/test';

/**
 * Breaker acceptance — a refusal must name what actually went wrong, and a
 * refusal that has been promised must fire however the request is spelled.
 *
 * R-UI-020 (a refusal renders in place with code, message, remedy and the link
 * that resolves it), R-SPINE-062 (the closed taxonomy), AC-16 (the refusal
 * pattern is used for every auth-screen refusal) and AC-25 / R-UI-020 (a
 * sign-up for a taken address refuses in place, by name).
 *
 * These are not journeys: they carry no checkpoints, no baselines and no axe
 * pass. They exist to hold three answers the product currently gets wrong.
 */

/** The seeded fixture owner (AC-13). Its address is taken; that is the point. */
const TAKEN_ADDRESS = 'owner@e2e.cubit.test';
const OWNER_PASSWORD = 'E2e!Owner#2026';

/**
 * An address the product cannot read at all. Every auth form carries
 * `noValidate`, so the browser hands this straight to the server: it is what a
 * person who mistypes their own address actually sends.
 */
const UNREADABLE_ADDRESS = 'rina.surveyor@';

test.describe('a refusal names what went wrong', () => {
  test('sign-up: an unreadable address is not "email and password do not match"', async ({ page }) => {
    await page.goto('/sign-up');
    await page.getByTestId('signup-name').fill('Rina Haque');
    await page.getByTestId('signup-email').fill(UNREADABLE_ADDRESS);
    await page.getByTestId('signup-password').fill('Breaker!2026#pass');
    await page.getByTestId('signup-submit').click();

    // silence is never the answer: something must be said in place (R-UI-020)
    await expect(page.getByTestId('refusal-state')).toBeVisible();

    // …but not this. There is no account to match on a sign-up screen, and a
    // password reset cannot repair an address the server could not parse.
    await expect(page.getByTestId('refusal-code')).not.toHaveText('AUTH_INVALID_CREDENTIALS');
    await expect(page.getByTestId('refusal-remedy')).not.toContainText('reset the password');
  });

  test('magic link: a screen with no password field does not refuse about one', async ({ page }) => {
    await page.goto('/magic-link');
    await page.getByTestId('magic-link-email').fill(UNREADABLE_ADDRESS);
    await page.getByTestId('magic-link-submit').click();

    await expect(page.getByTestId('refusal-state')).toBeVisible();
    await expect(page.getByTestId('refusal-code')).not.toHaveText('AUTH_INVALID_CREDENTIALS');
    await expect(page.getByTestId('refusal-message')).not.toContainText('password');
  });

  test('create tenant: a name with no letters is not an address already in use', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByTestId('signin-email').fill(TAKEN_ADDRESS);
    await page.getByTestId('signin-password').fill(OWNER_PASSWORD);
    await page.getByTestId('signin-submit').click();
    await page.waitForURL(/\/t\//);

    // the taken address still refuses by its own name (AC-12) — the guard below
    // must not be bought by deleting TENANT_SLUG_TAKEN. `Acme` derives `acme`,
    // which the fixture tenant already holds.
    await page.goto('/create-tenant');
    await page.getByTestId('create-tenant-name').fill('Acme');
    await page.getByTestId('create-tenant-submit').click();
    await expect(page.getByTestId('refusal-code')).toHaveText('TENANT_SLUG_TAKEN');

    // a name no address can be derived from is a different problem, and the
    // screen must say which one it is: nobody holds this address
    await page.goto('/create-tenant');
    await page.getByTestId('create-tenant-name').fill('🏗️ 🏢');
    await page.getByTestId('create-tenant-submit').click();
    await expect(page.getByTestId('refusal-state')).toBeVisible();
    await expect(page.getByTestId('refusal-message')).not.toContainText('already in use');
  });
});

test.describe('a promised refusal fires however the request is spelled', () => {
  test('sign-up: a taken address is refused for a form-encoded body too', async ({ request }) => {
    // The screen posts JSON, and JSON is refused by name. The same request in
    // the other encoding every browser can send walks straight past the guard
    // into better-auth's fabricated success — a reader left waiting for a mail
    // nobody sends, which is the dead end AC-25 was written to close.
    const response = await request.post('/api/auth/sign-up/email', {
      form: { name: 'Impostor', email: TAKEN_ADDRESS, password: 'Breaker!2026#pass' },
    });

    expect(response.status()).toBe(422);
    expect((await response.json()).code).toBe('AUTH_EMAIL_TAKEN');
  });
});
