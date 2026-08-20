import { expect, test, type Page } from '@playwright/test';

/**
 * Breaker acceptance — a submit that lands before the screen is interactive.
 *
 * The auth screens are client components whose forms carry `method="post"` so
 * that a click arriving before hydration cannot put a password in the URL. That
 * settles half the question. The other half is what the person is left with: a
 * native submit of a form no handler is listening to navigates, and the browser
 * comes back with an empty form — the credentials gone, nothing said, no session.
 * Silence is the one answer R-UI-020 forbids, and the recorded diagnosis for this
 * increment asks for more than "not a GET": submits must wait for interactivity.
 *
 * These are not journeys: no checkpoints, no baselines, no axe pass. They hold
 * one answer the product currently gets wrong, on the two screens where losing
 * what was typed costs the most.
 *
 * R-UI-020 (silence never happens), AC-11 (the auth flows work), and the held-out
 * runtime note: auth screens must behave correctly under a click that lands
 * before hydration.
 */

const OWNER = 'owner@e2e.cubit.test';
const OWNER_PASSWORD = 'E2e!Owner#2026';

/** Long enough that hydration cannot rescue the click, and the run still moves. */
const HYDRATION_HELD_MS = 6_000;
const SETTLE_MS = 3_000;

/**
 * Holds every script the page needs. The markup arrives and the fields are
 * fillable — which is exactly the window a person on a slow connection types in
 * — but React has not taken the form over yet.
 */
async function holdHydration(page: Page): Promise<void> {
  await page.route('**/_next/static/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, HYDRATION_HELD_MS));
    await route.continue();
  });
}

/**
 * What the person is left holding once the click has been answered. Three of
 * these are fine — the product may sign them in, refuse in place, or simply not
 * act until it can. The fourth is the defect: the form comes back blank with
 * nothing said.
 */
type Outcome =
  | 'went-somewhere'
  | 'refused-in-place'
  | 'kept-what-was-typed'
  | 'silently-emptied'
  | 'lost-the-screen';

/** The three answers a person may be given; anything else is the screen going quiet. */
const ANSWERED: Outcome[] = ['went-somewhere', 'refused-in-place', 'kept-what-was-typed'];

async function outcomeOf(page: Page, screen: string, field: string, typed: string): Promise<Outcome> {
  if (new URL(page.url()).pathname !== screen) return 'went-somewhere';
  if (await page.getByTestId('refusal-state').isVisible().catch(() => false)) return 'refused-in-place';

  const still = page.getByTestId(field);
  await still.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
  // the form itself gone, on the URL it was asked for: an error page, or nothing
  if (!(await still.isVisible().catch(() => false))) return 'lost-the-screen';

  return (await still.inputValue()) === typed ? 'kept-what-was-typed' : 'silently-emptied';
}

test.describe('a submit that beats hydration', () => {
  test('sign-in: the credentials are not swallowed in silence', async ({ page }) => {
    await holdHydration(page);
    await page.goto('/sign-in', { waitUntil: 'commit' });

    await page.getByTestId('signin-email').waitFor({ state: 'attached' });
    await page.getByTestId('signin-email').fill(OWNER);
    await page.getByTestId('signin-password').fill(OWNER_PASSWORD);
    await page.getByTestId('signin-submit').click();
    await page.waitForTimeout(SETTLE_MS);

    // the settled half: a password never reaches the address bar
    expect(page.url()).not.toContain(OWNER_PASSWORD);

    const outcome = await outcomeOf(page, '/sign-in', 'signin-email', OWNER);
    expect(
      ANSWERED,
      'a click that lands before hydration must sign in, refuse in place, or wait — never return an empty form with nothing said',
    ).toContain(outcome);
  });

  test('sign-up: what was typed survives the click', async ({ page }) => {
    const address = `breaker-hydration-${Date.now()}@e2e.cubit.test`;

    await holdHydration(page);
    await page.goto('/sign-up', { waitUntil: 'commit' });

    await page.getByTestId('signup-name').waitFor({ state: 'attached' });
    await page.getByTestId('signup-name').fill('Rina Haque');
    await page.getByTestId('signup-email').fill(address);
    await page.getByTestId('signup-password').fill('Breaker!2026#pass');
    await page.getByTestId('signup-submit').click();
    await page.waitForTimeout(SETTLE_MS);

    expect(page.url()).not.toContain('Breaker!2026#pass');

    // a sign-up that answered at all says so: the prompt for the mailed link
    if (await page.getByTestId('verify-email-sent').isVisible().catch(() => false)) return;

    const outcome = await outcomeOf(page, '/sign-up', 'signup-email', address);
    expect(
      ANSWERED,
      'a click that lands before hydration must not discard the account being claimed without a word',
    ).toContain(outcome);
  });
});

/**
 * The sign-up screen marks the name field required, and `/create-tenant` refuses
 * a name no address can be derived from by name (TENANT_NAME_UNREADABLE). Both
 * promises are about the same value: the personal tenant minted at sign-up takes
 * the account's name (db/migrations/0003), so a blank name mints a tenant with no
 * name at all — and `/t/{slug}` heads that screen with an empty heading.
 *
 * Every form here carries `noValidate`, so `required` is a promise only the
 * server can keep. Any refusal in place keeps it; which code it carries is the
 * product's to choose.
 */
test('sign-up: a blank name is not quietly accepted', async ({ page }) => {
  const address = `breaker-blankname-${Date.now()}@e2e.cubit.test`;

  await page.goto('/sign-up');
  await page.getByTestId('signup-submit').waitFor();
  await page.getByTestId('signup-email').fill(address);
  await page.getByTestId('signup-password').fill('Breaker!2026#pass');
  await page.getByTestId('signup-submit').click();

  await expect(page.getByTestId('refusal-state')).toBeVisible();
  // and no account is claimed on the strength of it
  await expect(page.getByTestId('verify-email-sent')).toBeHidden();
});
