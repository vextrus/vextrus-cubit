import { test, expect } from '@playwright/test';
import { AuthPage } from '../support/pages/auth';
import { TenantPage } from '../support/pages/tenant';
import { checkpoint, volatileRegions } from '../support/checkpoint';
import { waitForMail, messagesFor } from '../support/mail';
import { JOURNEY_USERS, REFUSAL_CODES } from '../support/seed';

/**
 * J-001 — Auth: sign up, verify, sign in, magic link, reset, revoke session.
 * (invite accept arrives with R-SPINE-003 / J-002, out of scope here)
 *
 * Proves AC-11, AC-12, AC-14, AC-16, AC-17, AC-19 and Q-11 at every checkpoint.
 */

const user = JOURNEY_USERS.j001;

test.describe('J-001 auth', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test('J-001: sign up → verify → sign in → magic link → reset → sessions → revoke', async ({
    page,
    browser,
  }) => {
    const auth = new AuthPage(page);
    const tenant = new TenantPage(page);

    // --- sign up (R-SPINE-001) -------------------------------------------
    await auth.gotoSignUp();
    await auth.signUp(user);

    // AC-11: sign-up does not sign you in; it prompts for verification
    await expect(page.getByTestId('signin-submit')).toHaveCount(0);
    await checkpoint(page, 'j001-signup');

    // --- the verification mail lands in the file outbox (AC-11) ----------
    const verifyMail = await waitForMail(user.email, 'verify');
    expect(verifyMail.to).toBe(user.email);
    expect(verifyMail.subject.length).toBeGreaterThan(0);
    expect(verifyMail.url).toMatch(/^https?:\/\//);
    await checkpoint(page, 'j001-verify-sent');

    // --- AC-11: an unverified sign-in refuses in place, never as a toast --
    await auth.gotoSignIn();
    await auth.signIn(user.email, user.password);
    await auth.expectRefusal(REFUSAL_CODES.emailNotVerified);
    await expect(page).toHaveURL(/\/sign-in/);

    // --- verify (AC-11) ---------------------------------------------------
    await page.goto(verifyMail.url);
    await expect(page.getByTestId('verify-email-success')).toBeVisible();
    await expect(page.getByTestId('verify-email-error')).toHaveCount(0);
    await checkpoint(page, 'j001-verified');

    // --- themed sign-in, light then dark (AC-14, AC-30, R-UI-001) --------
    await auth.gotoSignIn();
    expect(await auth.currentTheme()).not.toBe('dark');
    await checkpoint(page, 'j001-signin-light');

    // AC-19: the focus ring is a visible 2px cobalt outline and the field is labelled
    await page.getByTestId('signin-email').focus();
    const ring = await page.getByTestId('signin-email').evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, style: s.outlineStyle, colour: s.outlineColor };
    });
    expect(ring.width, 'focus ring must be 2px').toBe('2px');
    expect(ring.style, 'focus ring must be drawn').not.toBe('none');
    expect(ring.colour, 'focus ring must be visible').not.toBe('rgba(0, 0, 0, 0)');
    await expect(page.getByTestId('signin-email')).toHaveAccessibleName(/.+/);
    await expect(page.getByTestId('signin-password')).toHaveAccessibleName(/.+/);
    await expect(page.getByTestId('signin-submit')).toHaveAccessibleName(/.+/);

    // AC-19 / R-UI-003: Inter and JetBrains Mono are declared as real @font-face
    // rules and actually load. Under C-07/V-E2E there is no network beyond
    // loopback, so a face reaching status 'loaded' is itself proof it loaded
    // locally. (document.fonts.check() is useless here: with no @font-face at
    // all it answers true for every family, including a bogus one.)
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      const declared: { family: string; status: string }[] = [];
      document.fonts.forEach((face) =>
        declared.push({ family: face.family.replace(/["']/g, ''), status: face.status }),
      );
      // resolve by the family the page actually declares (e.g. "Inter Variable")
      const pick = async (re: RegExp) => {
        const family = declared.find((f) => re.test(f.family))?.family;
        if (family === undefined) return null;
        const matched = await document.fonts.load(`16px "${family}"`);
        return { family, statuses: matched.map((f) => f.status) };
      };
      return {
        size: document.fonts.size,
        families: declared.map((f) => f.family),
        inter: await pick(/\bInter\b/),
        mono: await pick(/JetBrains Mono/),
      };
    });

    // the page ships its own faces — system fallbacks declare nothing
    expect(fonts.size, 'the page must declare @font-face rules of its own').toBeGreaterThan(0);
    expect(fonts.inter, `Inter must be declared; declared: ${fonts.families.join(', ')}`).not.toBeNull();
    expect(
      fonts.mono,
      `JetBrains Mono must be declared; declared: ${fonts.families.join(', ')}`,
    ).not.toBeNull();
    for (const face of [fonts.inter, fonts.mono]) {
      expect(face!.statuses.length, `${face!.family} must resolve to a face`).toBeGreaterThan(0);
      for (const status of face!.statuses) {
        expect(status, `${face!.family} must load locally`).toBe('loaded');
      }
    }

    await auth.toggleTheme();
    await expect
      .poll(async () => auth.currentTheme(), { message: 'theme-toggle must set data-theme' })
      .toBe('dark');
    await checkpoint(page, 'j001-signin-dark');
    await auth.toggleTheme();
    await expect.poll(async () => auth.currentTheme()).not.toBe('dark');

    // --- sign in, land on onboarding (AC-12, R-UI-033) -------------------
    await auth.signIn(user.email, user.password);
    await tenant.expectCreateTenant();

    // AC-12: skipping onboarding drops you into your personal tenant
    await tenant.skipCreateTenant();
    const personalSlug = await tenant.expectTenantHome();
    expect(personalSlug.length, 'a personal tenant is minted at sign-up').toBeGreaterThan(0);

    // AC-17: the spine router answers over /api/trpc
    const ping = await page.request.get('/api/trpc/spine.health.ping');
    expect(ping.ok(), 'spine.health.ping must answer over /api/trpc').toBe(true);
    expect(await ping.text()).toContain('ok');

    // --- magic link (R-SPINE-001) ----------------------------------------
    const magicBefore = messagesFor(user.email, 'magic-link').length;
    await auth.requestMagicLink(user.email);
    await checkpoint(page, 'j001-magic-link-sent');
    const magicMail = await waitForMail(user.email, 'magic-link', { after: magicBefore });
    await page.goto(magicMail.url);
    await expect(page, 'a magic link signs you in').not.toHaveURL(/\/sign-in/);

    // --- password reset (R-SPINE-001) ------------------------------------
    await auth.requestReset(user.email);
    const resetMail = await waitForMail(user.email, 'reset');
    await auth.completeReset(resetMail.url, user.newPassword);
    await checkpoint(page, 'j001-reset');

    // the old password no longer opens the door
    await auth.gotoSignIn();
    await auth.signIn(user.email, user.password);
    await auth.expectRefusal(REFUSAL_CODES.invalidCredentials);

    // --- two devices (AC-14) ---------------------------------------------
    await auth.gotoSignIn();
    await auth.signIn(user.email, user.newPassword);
    await expect(page).not.toHaveURL(/\/sign-in/);

    const second = await browser.newContext();
    const secondPage = await second.newPage();
    const secondAuth = new AuthPage(secondPage);
    await secondAuth.gotoSignIn();
    await secondAuth.signIn(user.email, user.newPassword);
    await expect(secondPage).not.toHaveURL(/\/sign-in/);

    await auth.gotoSessions();
    await expect(auth.sessionRows()).toHaveCount(2);
    await expect(auth.currentSessionRow(), 'exactly one session is the current one').toHaveCount(1);
    await expect(page.getByTestId('sessions-empty')).toHaveCount(0);
    await checkpoint(page, 'j001-sessions', { mask: volatileRegions(page) });

    // --- revoke the other device (R-SPINE-001) ---------------------------
    await auth.otherSessionRows().first().getByTestId('session-revoke').click();
    await expect(auth.sessionRows()).toHaveCount(1);
    await expect(auth.currentSessionRow()).toHaveCount(1);
    await checkpoint(page, 'j001-session-revoked', { mask: volatileRegions(page) });

    await second.close();
  });
});
