// SIGNING IN AS THIS WORKER'S SEEDED TENANT — the Playwright half of `seeded-tenant.ts`.
//
// It is a file of its own for the reason `picture-test.ts` is: `seeded-tenant.ts` holds the facts
// and the SQL, both of which are wanted by things that are not a browser (the lane's global setup,
// and the vitest that proves the seed is idempotent and per-index distinct), and importing
// `@playwright/test` into a data module would make it untestable outside a Playwright runner.
//
// WHAT A CALLER GETS. The account exists, verified, owning a workspace that holds a project with
// F-RCC6 already ingested — so this is ONE form post, not the six screens the prologue was: sign up,
// read the refusal, open the outbox, open the verification link, sign in, click the workspace door,
// find or create a project. The session is memoised per worker process, so the second spec file in
// a worker restores cookies rather than posting the form again.
import { expect, type Cookie, type Page } from "@playwright/test";
import { S_AUTH, SAuthPage } from "../pages/s-auth.page";
import { SHELL } from "../pages/shell.page";
import { seededTenant, type SeededTenant } from "./seeded-tenant";

/** The seeded state a spec stands on, and the session it stands on it in. */
export interface SeededSession {
  readonly tenant: SeededTenant;
  readonly cookies: Cookie[];
}

let established: Promise<SeededSession> | null = null;

/**
 * THIS WORKER'S tenant — `parallelIndex`, which is what the lane seeded one per of. Two workers
 * therefore hold two workspaces, two projects and two storage prefixes, and can address none of
 * each other's rows: the isolation the golden run is keyed on (P4b §1), reached without the walk.
 */
export function tenantForWorker(parallelIndex: number): SeededTenant {
  return seededTenant(parallelIndex);
}

/**
 * Put this page inside the seeded tenant's session, signing in once per worker process.
 *
 * The sign-in is a real one — the door, the form, the product's own answer — because the session
 * cookie is the product's to mint and a fixture that forged one would be testing a forgery. What is
 * skipped is the enrolment, and the enrolment is not what any of these journeys is about.
 */
export async function signInAsSeededTenant(page: Page, parallelIndex: number): Promise<SeededSession> {
  established ??= (async (): Promise<SeededSession> => {
    const tenant = tenantForWorker(parallelIndex);
    const auth = new SAuthPage(page);
    await auth.open(S_AUTH.signIn);
    await auth.signInWith(tenant.email, tenant.password);
    await expect(page, `the seeded tenant ${tenant.email} signs in and lands on the nameplate`).toHaveURL(new RegExp(`${SHELL.home}$`));
    return { tenant, cookies: await page.context().cookies() };
  })();
  const session = await established;
  const held = await page.context().cookies();
  if (held.length === 0) await page.context().addCookies(session.cookies);
  return session;
}

/** Forget the memo. A leg file that means to sign in again — a sign-out journey — says so. */
export function forgetSeededSession(): void {
  established = null;
}
