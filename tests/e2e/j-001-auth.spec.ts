/**
 * J-001 — Auth: sign up, verify, sign in, magic link, reset, revoke session
 * (R-SPINE-001, R-SPINE-002, S-Auth, Q-12).
 *
 * Seven named checkpoints, in the order a person meets them: sign-up, check-email,
 * verified-landing, sign-in, magic-link, reset, sessions. Each one calls the lane's own
 * accessibility helper, unfiltered — a screen that needs an exception has a defect, and the
 * place to record that is the increment that renders it.
 *
 * Invite accept is knowingly absent. S-Auth's "accept invitation" and J-001's "invite accept"
 * need a membership-granting model beyond the personal mint, which no increment has founded
 * yet; the increment that founds it extends this file (recorded as an Interpretation).
 *
 * `J-001` is on the describe because `pnpm e2e --journey J-001` is Playwright's `--grep` over
 * the full title path, so a spec that never says it is a spec nothing selects.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { expectNoAxeViolations } from './axe';
import {
  MAGIC_LINK_ROUTE,
  RESET_PASSWORD_ROUTE,
  SIGN_IN_ROUTE,
  SIGN_UP_ROUTE,
  activeTenantInSession,
  currentRow,
  emailField,
  errorLine,
  freshEmail,
  latestMail,
  notice,
  passwordField,
  revokeOtherSession,
  sessionRows,
  settled,
  signOut,
  slugInUrl,
  submitButton,
  submitCard,
  tenantHome,
} from './pages/auth';

/** The password the journey signs up with, and the one it resets to. */
const PASSWORD = 'j001-Passw0rd!';
const NEW_PASSWORD = 'j001-Passw0rd!-changed';

/**
 * The seeded tenant (fixtures/e2e/tenant.json). Nobody is a member of it, which is what
 * makes it the one workspace a signed-in stranger can be refused from.
 */
const SEEDED_TENANT = 'cubit-e2e';

/**
 * Sign up, follow the verification link, and land in the personal tenant the mint made.
 *
 * The whole of AC-1 in one helper because three checkpoints share it and the sessions
 * checkpoint needs a member of its own: two devices of *one* account is the claim, and a
 * user carried over from an earlier checkpoint would be signed in more times than that.
 */
async function signUpAndVerify(page: Page, address: string): Promise<string> {
  await page.goto(SIGN_UP_ROUTE);
  await submitCard(page, { email: address, password: PASSWORD });
  await expect(notice(page)).toBeVisible();

  const verifyUrl = await latestMail(address, 'verify');
  await page.goto(verifyUrl);
  await expect(tenantHome(page)).toBeVisible();
  return slugInUrl(page);
}

test.describe('J-001', () => {
  test('J-001 sign-up → check-email → verified-landing: a new account mints its personal tenant, and the session says which one', async ({
    page,
  }) => {
    const address = freshEmail('signup');

    // Checkpoint "sign-up": the form, its Datum fields, and the committed Linux baseline.
    // The name is an array on purpose — a string 'auth/sign-up.png' is flattened to
    // 'auth-sign-up.png' and the directory is lost.
    await page.goto(SIGN_UP_ROUTE);
    await expect(emailField(page)).toBeVisible();
    await expect(passwordField(page)).toBeVisible();
    await expect(submitButton(page)).toBeVisible();
    await expectNoAxeViolations(page);
    await expect(page).toHaveScreenshot(['auth', 'sign-up.png']);

    // Checkpoint "check-email": the notice replaces the card, and the mail seam has the row.
    await submitCard(page, { email: address, password: PASSWORD });
    await expect(notice(page)).toBeVisible();
    await settled(notice(page));
    await expectNoAxeViolations(page);
    const verifyUrl = await latestMail(address, 'verify');
    expect(verifyUrl, 'the verification mail carries no absolute link').toMatch(/^https?:\/\//);

    // Checkpoint "verified-landing": opening the link verifies the account and lands it in
    // its own tenant — the slug in the URL (R-SPINE-002).
    await page.goto(verifyUrl);
    await expect(tenantHome(page)).toBeVisible();
    const slug = slugInUrl(page);
    expect(slug, 'the landing URL carries no tenant slug').not.toBe('');
    expect(new URL(page.url()).pathname).toBe(`/t/${slug}`);
    await expectNoAxeViolations(page);

    // AC-1: "the active tenant is explicit … in the session".
    expect(await activeTenantInSession(page)).toBe(slug);
  });

  test('J-001 sign-in: a wrong password is refused without a session, and the right one lands in the tenant', async ({
    page,
  }) => {
    const address = freshEmail('signin');
    const slug = await signUpAndVerify(page, address);
    await page.context().clearCookies();

    // Checkpoint "sign-in": the screen, and its committed Linux baseline.
    await page.goto(SIGN_IN_ROUTE);
    await expect(emailField(page)).toBeVisible();
    await expectNoAxeViolations(page);
    await expect(page).toHaveScreenshot(['auth', 'sign-in.png']);

    // A wrong password says so, and establishes nothing.
    await submitCard(page, { email: address, password: 'not-the-password' });
    await expect(errorLine(page)).toBeVisible();
    await settled(errorLine(page));
    expect(new URL(page.url()).pathname).toBe(SIGN_IN_ROUTE);
    expect(await activeTenantInSession(page)).toBeNull();
    await expectNoAxeViolations(page);

    // The right one lands in the personal tenant, at the slug the mint gave it.
    await passwordField(page).fill(PASSWORD);
    await submitButton(page).click();
    await expect(tenantHome(page)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(`/t/${slug}`);
    expect(await activeTenantInSession(page)).toBe(slug);
  });

  test('J-001 magic-link: a link mailed to a member signs them in; one mailed to a stranger mints nothing', async ({
    page,
  }) => {
    const address = freshEmail('magic');
    const slug = await signUpAndVerify(page, address);
    await page.context().clearCookies();

    // Checkpoint "magic-link": ask for the link, read it out of the outbox, open it.
    await page.goto(MAGIC_LINK_ROUTE);
    await expect(emailField(page)).toBeVisible();
    await expectNoAxeViolations(page);

    await submitCard(page, { email: address });
    await expect(notice(page)).toBeVisible();
    await settled(notice(page));
    await expectNoAxeViolations(page);

    const magicUrl = await latestMail(address, 'magic-link');
    await page.goto(magicUrl);
    await expect(tenantHome(page)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(`/t/${slug}`);
    expect(await activeTenantInSession(page)).toBe(slug);

    // AC-3: an address with no account is answered the same way and signs nobody in — the
    // link mints no user, so there is no personal tenant for it to land in.
    await page.context().clearCookies();
    const stranger = freshEmail('stranger');
    await page.goto(MAGIC_LINK_ROUTE);
    await submitCard(page, { email: stranger });
    await expect(notice(page)).toBeVisible();
    await page.goto(await latestMail(stranger, 'magic-link'));
    expect(new URL(page.url()).pathname).toBe(MAGIC_LINK_ROUTE);
    expect(await activeTenantInSession(page)).toBeNull();
  });

  test('J-001 reset: the reset link sets a new password, the old one stops working, and the new one signs in', async ({
    page,
  }) => {
    const address = freshEmail('reset');
    const slug = await signUpAndVerify(page, address);
    await page.context().clearCookies();

    // Checkpoint "reset": ask for the link.
    await page.goto(RESET_PASSWORD_ROUTE);
    await expect(emailField(page)).toBeVisible();
    await expectNoAxeViolations(page);
    await submitCard(page, { email: address });
    await expect(notice(page)).toBeVisible();

    // The link lands on the second phase of the same route, which takes the new password.
    const resetUrl = await latestMail(address, 'reset');
    await page.goto(resetUrl);
    await expect(passwordField(page)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(RESET_PASSWORD_ROUTE);
    await expectNoAxeViolations(page);

    await submitCard(page, { password: NEW_PASSWORD });
    await expect(notice(page)).toBeVisible();

    // The old password is refused …
    await page.goto(SIGN_IN_ROUTE);
    await submitCard(page, { email: address, password: PASSWORD });
    await expect(errorLine(page)).toBeVisible();
    expect(await activeTenantInSession(page)).toBeNull();

    // … and the new one is not.
    await passwordField(page).fill(NEW_PASSWORD);
    await submitButton(page).click();
    await expect(tenantHome(page)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(`/t/${slug}`);
  });

  test('J-001 verified-landing guard: a stranger is sent to sign-in, and a member of nothing is told the workspace is not there', async ({
    page,
  }) => {
    await page.goto(SIGN_IN_ROUTE);
    const address = new URL(`/t/${SEEDED_TENANT}`, page.url()).toString();

    // No session: a redirect, answered before any byte of the workspace. Node's fetch rather
    // than the runner's request context — that one rejects outright on a 3xx it is told not
    // to follow, instead of handing back the answer.
    const anonymous = await fetch(address, { redirect: 'manual' });
    const streamed = await anonymous.text();
    expect(anonymous.status, `/t/${SEEDED_TENANT} answered ${anonymous.status} to a stranger`)
      .toBeGreaterThanOrEqual(300);
    expect(anonymous.status).toBeLessThan(400);
    expect(anonymous.headers.get('location')).toBe(SIGN_IN_ROUTE);
    expect(streamed, 'the workspace shell was streamed past the guard').not.toContain(
      'tenant-home',
    );

    // A session, but no membership: the same answer a slug nobody holds gets — 404, never a
    // named permission, because naming one would confirm the workspace exists (Q-12).
    await signUpAndVerify(page, freshEmail('stranger-member'));
    const refused = await page.goto(`/t/${SEEDED_TENANT}`);
    expect(refused?.status(), 'a non-member was not answered 404').toBe(404);
    await expect(tenantHome(page)).toHaveCount(0);
  });

  test('J-001 sessions: two devices, the current one marked, and revoking the other ejects it', async ({
    browser,
    page,
  }) => {
    const address = freshEmail('sessions');
    const slug = await signUpAndVerify(page, address);

    // The second device: a context of its own, so it carries its own cookie jar.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    try {
      await otherPage.goto(SIGN_IN_ROUTE);
      await submitCard(otherPage, { email: address, password: PASSWORD });
      await expect(tenantHome(otherPage)).toBeVisible();

      // Checkpoint "sessions": one row per active session, this device's marked.
      await page.goto(`/t/${slug}/sessions`);
      await expect(sessionRows(page)).toHaveCount(2);
      await expect(currentRow(page)).toHaveCount(1);
      await expectNoAxeViolations(page);

      // Revoke the other device. The click waits for the auth API's answer, not a navigation.
      await revokeOtherSession(page);
      await expect(sessionRows(page)).toHaveCount(1);
      await expect(currentRow(page)).toHaveCount(1);
      await expectNoAxeViolations(page);

      // The revoked device's next request meets the guard.
      await otherPage.goto(`/t/${slug}`);
      await expect(otherPage.getByTestId('auth-submit')).toBeVisible();
      expect(new URL(otherPage.url()).pathname).toBe(SIGN_IN_ROUTE);
    } finally {
      await other.close();
    }

    // And sign-out ends this one.
    await signOut(page);
    expect(new URL(page.url()).pathname).toBe(SIGN_IN_ROUTE);
  });
});
