/**
 * The tenant-settings page object — S-Settings' tenant slice, said once
 * (docs/design/s-settings.md §13).
 *
 * The journey speaks to the screen through the test ids the increment's contract fixes and
 * never through a class name or a sentence: copy belongs to the Design Decision and moves
 * when the designer says so, while a test id is a contract.
 *
 * Three things here are not selectors and are worth stating:
 *
 *   - `signIn` signs in through the product's own form, as a person does. The roster is
 *     seeded with a real better-auth credential hash (scripts/seed.mjs), so a journey that
 *     wrote a session row by hand would prove the screen renders for a session the guard
 *     never issued.
 *
 *   - `outboxCount` is the whole of the M0 mail seam as a reader sees it: outbound mail is a
 *     row in `public.auth_mail_outbox`, and FORCEd row-level security binds the table owner
 *     too, so the connection sets `cubit.scope` before it asks for anything. An unscoped
 *     connection sees zero rows and would look exactly like a mail that was never sent.
 *
 *   - `settled` waits out the `--motion-state-duration` fade §5 and §6 give the refusal block
 *     and the error line. A colour read mid-fade is a value neither state paints, and an axe
 *     scan on that frame reports a defect nobody can ever see.
 */
import pg from 'pg';
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** The seeded fixture tenant this journey administers (fixtures/e2e/tenant.json). */
export const TENANT_SLUG = 'cubit-e2e';

/** The route the whole increment is about. */
export const SETTINGS_ROUTE = '/t/cubit-e2e/settings';

/** The card screen the roster signs in through. */
export const SIGN_IN_ROUTE = '/sign-in';

/** The seeded actors (scripts/seed.mjs ROSTER) and the one password they share. */
export const PASSWORD = 'cubit-e2e-Passw0rd!';
export const OWNER_EMAIL = 'owner@cubit-e2e.test';
export const WORKER_EMAIL = 'worker@cubit-e2e.test';
export const IDLE_EMAIL = 'idle@cubit-e2e.test';
export const INVITEE_EMAIL = 'invitee@cubit-e2e.test';

/** R-SPINE-003's closed role set, as the controls offer it. */
export const OWNER_ROLE = 'OWNER';
export const ADMIN_ROLE = 'ADMIN';
export const MEMBER_ROLE = 'MEMBER';

/** How long a mail may take to land, and how often to look. */
const MAIL_DEADLINE_MS = 20_000;
const MAIL_POLL_MS = 200;

export const tenantSettings = (page: Page): Locator => page.getByTestId('tenant-settings');
export const membersSection = (page: Page): Locator => page.getByTestId('members-section');
export const invitationsSection = (page: Page): Locator => page.getByTestId('invitations-section');
export const permissionDenied = (page: Page): Locator => page.getByTestId('permission-denied');

/** The invitations empty state, scoped: `empty-state` also renders in the shell inspector. */
export const emptyState = (page: Page): Locator =>
  invitationsSection(page).getByTestId('empty-state');
export const emptyStateAction = (page: Page): Locator =>
  invitationsSection(page).getByTestId('empty-state-action');

/** The invite form (§4). */
export const inviteEmail = (page: Page): Locator => page.getByTestId('invite-email');
export const inviteRole = (page: Page): Locator => page.getByTestId('invite-role');
export const inviteSubmit = (page: Page): Locator => page.getByTestId('invite-submit');

/** One row of either list, addressed by the email it carries (§2, §4). */
export const memberRow = (page: Page, email: string): Locator =>
  page.locator(`[data-testid="member-row"][data-email="${email}"]`);
export const invitationRow = (page: Page, email: string): Locator =>
  page.locator(`[data-testid="invitation-row"][data-email="${email}"]`);

export const memberRole = (page: Page, email: string): Locator =>
  memberRow(page, email).getByTestId('member-role');
export const memberRemove = (page: Page, email: string): Locator =>
  memberRow(page, email).getByTestId('member-remove');
export const invitationResend = (page: Page, email: string): Locator =>
  invitationRow(page, email).getByTestId('invitation-resend');
export const invitationRevoke = (page: Page, email: string): Locator =>
  invitationRow(page, email).getByTestId('invitation-revoke');

/** §5's block: never a toast, always in place, with the register's own words. */
export const settingsRefusal = (page: Page): Locator => page.getByTestId('settings-refusal');
export const refusalCode = (page: Page): Locator => settingsRefusal(page).getByTestId('refusal-code');
export const refusalRemedy = (page: Page): Locator =>
  settingsRefusal(page).getByTestId('refusal-remedy');

/** Sign in as one of the seeded actors and land in the workspace they belong to. */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto(SIGN_IN_ROUTE);
  await page.getByTestId('auth-email').fill(email);
  await page.getByTestId('auth-password').fill(PASSWORD);
  await page.getByTestId('auth-submit').click();
  await page.waitForURL(/\/t\//);
}

/** Open the settings screen and wait for the document the server sent. */
export async function openSettings(page: Page): Promise<void> {
  await page.goto(SETTINGS_ROUTE);
  await expect(tenantSettings(page)).toBeVisible();
}

/** How many mails this address has been sent — the count a resend has to grow. */
export async function outboxCount(toEmail: string): Promise<number> {
  const client = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
  await client.connect();
  try {
    await client.query("select set_config('cubit.scope', 'system', false)");
    const found = await client.query<{ n: string }>(
      `select count(*)::int as n from public.auth_mail_outbox where to_email = $1`,
      [toEmail],
    );
    return Number(found.rows[0]?.n ?? 0);
  } finally {
    await client.end();
  }
}

/** Wait until this address has been sent more than `was` mails, or say it never was. */
export async function outboxGrewPast(toEmail: string, was: number): Promise<number> {
  const deadline = Date.now() + MAIL_DEADLINE_MS;
  for (;;) {
    const now = await outboxCount(toEmail);
    if (now > was) return now;
    if (Date.now() >= deadline) {
      throw new Error(
        `auth_mail_outbox still holds ${String(now)} mail(s) for ${toEmail}, not more than ${String(was)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, MAIL_POLL_MS));
  }
}

/** Wait out whatever this element is animating, so the next read is of a settled frame. */
export async function settled(locator: Locator): Promise<void> {
  await locator.evaluate(async (element: Element) => {
    // The subtree, not the element: the fade belongs to the block inside the region a
    // checkpoint holds, and an element that is not itself animating has nothing to wait for.
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}
