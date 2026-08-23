/**
 * J-001's page object — the S-Auth screens and the mail seam, said once.
 *
 * The journey speaks to the screens through the test ids the increment's contract fixes
 * (`auth-email`, `auth-password`, `auth-submit`, `auth-error`, `auth-notice`, `tenant-home`,
 * `session-row`, `session-revoke`, `auth-sign-out`) and never through a class name or a
 * sentence: copy is the Design Decision's and moves when the designer says so, while a test
 * id is a contract.
 *
 * Two things here are not selectors and are worth stating:
 *
 *   - `latestMail` is the whole of the M0 mail seam as a reader sees it. Outbound auth mail
 *     is a row in `public.auth_mail_outbox`, so the journey opens links by reading them out
 *     of the database the lane provisioned. FORCEd row-level security binds the table owner
 *     too, so the connection sets `cubit.scope` before it asks for anything — an unscoped
 *     connection sees zero rows and would look exactly like a mail that was never sent. It
 *     polls, because better-auth sends some of its mail after answering the request.
 *
 *   - `revokeSession` awaits the auth API's own answer rather than a navigation. Revoke is a
 *     fetch (Design Decision §8): a click that only waited for the document would assert
 *     against the list as it was before the act.
 */
import pg from 'pg';
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** The four public routes S-Auth ships (§13). */
export const SIGN_UP_ROUTE = '/sign-up';
export const SIGN_IN_ROUTE = '/sign-in';
export const MAGIC_LINK_ROUTE = '/magic-link';
export const RESET_PASSWORD_ROUTE = '/reset-password';

/** The session payload endpoint, and the field R-SPINE-002 puts in it. */
const SESSION_ENDPOINT = '/api/auth/get-session';
const ACTIVE_TENANT_FIELD = 'activeTenantSlug';

/** The endpoint a revoke goes to, which is what the click waits for. */
const REVOKE_ENDPOINT = '/api/auth/revoke-session';

/** The whole of the mail seam's `kind ∈ {…}`. */
export type MailKind = 'verify' | 'magic-link' | 'reset';

/** How long a mail may take to land: better-auth sends some of it after it has answered. */
const MAIL_DEADLINE_MS = 15_000;
const MAIL_POLL_MS = 200;

/**
 * The newest mail of a kind sent to an address, as its absolute url.
 *
 * `set cubit.scope = 'system'` runs first and on the same connection: the auth tables' policy
 * has a system arm and nothing else, and a connection nobody scoped reads nothing whichever
 * role it is.
 */
export async function latestMail(toEmail: string, kind: MailKind): Promise<string> {
  const client = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
  await client.connect();
  try {
    await client.query("select set_config('cubit.scope', 'system', false)");
    const deadline = Date.now() + MAIL_DEADLINE_MS;
    for (;;) {
      const found = await client.query<{ url: string }>(
        `select url from public.auth_mail_outbox
          where to_email = $1 and kind = $2
          order by created_at desc, id desc
          limit 1`,
        [toEmail, kind],
      );
      const url = found.rows[0]?.url;
      if (url !== undefined) return url;
      if (Date.now() >= deadline) {
        throw new Error(`no auth_mail_outbox row of kind '${kind}' for ${toEmail}`);
      }
      await new Promise((resolve) => setTimeout(resolve, MAIL_POLL_MS));
    }
  } finally {
    await client.end();
  }
}

/** An address nobody else in this run holds, so the journey's rows are its own. */
export function freshEmail(label: string): string {
  return `j001-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

export const emailField = (page: Page): Locator => page.getByTestId('auth-email');
export const passwordField = (page: Page): Locator => page.getByTestId('auth-password');
export const submitButton = (page: Page): Locator => page.getByTestId('auth-submit');
export const errorLine = (page: Page): Locator => page.getByTestId('auth-error');
export const notice = (page: Page): Locator => page.getByTestId('auth-notice');
export const tenantHome = (page: Page): Locator => page.getByTestId('tenant-home');
export const sessionRows = (page: Page): Locator => page.getByTestId('session-row');
export const signOutButton = (page: Page): Locator => page.getByTestId('auth-sign-out');

/** The current device's row, marked `data-current="true"` so the journey can tell them apart. */
export const currentRow = (page: Page): Locator =>
  page.locator('[data-testid="session-row"][data-current="true"]');

/**
 * Wait until an arrival has stopped moving.
 *
 * §11 gives the error line, the notice and the refusal block a `--motion-state-duration`
 * fade, and a colour read while one is at opacity 0.4 is a colour neither theme paints — it
 * is the card blended with whatever is behind it. An accessibility scan run on that frame
 * reports a contrast defect that nobody can ever see, so the scan waits for the animation the
 * browser itself says it is running.
 */
export async function settled(locator: Locator): Promise<void> {
  await locator.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

/** Fill what the card asks for and submit it. */
export async function submitCard(
  page: Page,
  values: { email?: string; password?: string },
): Promise<void> {
  if (values.email !== undefined) await emailField(page).fill(values.email);
  if (values.password !== undefined) await passwordField(page).fill(values.password);
  await submitButton(page).click();
}

/** The slug the URL is speaking, out of `/t/{tenantSlug}`. */
export function slugInUrl(page: Page): string {
  const path = new URL(page.url()).pathname;
  return path.split('/')[2] ?? '';
}

/**
 * The session payload as the product answers it: R-SPINE-002's active tenant, read back out
 * of `/api/auth/get-session` with this context's cookie.
 */
export async function activeTenantInSession(page: Page): Promise<string | null> {
  // Asked from inside the page, so the request carries exactly the cookie the reader's
  // browser holds — a request context of the test runner's own is a second cookie jar, and
  // "with a session cookie" is the whole of the claim.
  const answer = await page.evaluate(async (endpoint) => {
    const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
    return { status: response.status, body: (await response.json()) as unknown };
  }, SESSION_ENDPOINT);
  expect(answer.status, `${SESSION_ENDPOINT} answered ${answer.status}`).toBe(200);
  const payload = answer.body;
  if (typeof payload !== 'object' || payload === null) return null;
  const top = (payload as Record<string, unknown>)[ACTIVE_TENANT_FIELD];
  if (typeof top === 'string') return top;
  const session = (payload as { session?: Record<string, unknown> }).session;
  const carried = session?.[ACTIVE_TENANT_FIELD];
  return typeof carried === 'string' ? carried : null;
}

/**
 * Revoke the one row that is not this device's, waiting for the auth API to answer.
 *
 * The row leaves on the response, not on a navigation, so the wait is the response — a click
 * that only awaited the document would read the list as it was before the act.
 */
export async function revokeOtherSession(page: Page): Promise<void> {
  const answered = page.waitForResponse(
    (response) => response.url().includes(REVOKE_ENDPOINT) && response.request().method() === 'POST',
  );
  await page.getByTestId('session-revoke').first().click();
  const response = await answered;
  expect(response.status(), `${REVOKE_ENDPOINT} answered ${response.status()}`).toBe(200);
}

/** End this device's session and land back on the public screens. */
export async function signOut(page: Page): Promise<void> {
  await signOutButton(page).click();
  await page.waitForURL(`**${SIGN_IN_ROUTE}`);
}
