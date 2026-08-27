// Breaker acceptance for two seams R-SPINE-001 states in words the build has only half-kept: the
// address that names an account, and the address a mailed link points back at.
//
// Both are driven through the built server's own HTTP lane rather than through a unit seam, because
// both faults live in what the *transport* hands the doors — the folded value `storedAddress`
// writes, and the origin Next builds a Request's url from. Neither is visible to a caller that
// constructs its own Request.
//
// The describe title carries the J-001 tag so `pnpm e2e --journey J-001` (which forwards to
// Playwright's --grep) collects this file: a guarantee no gate invocation runs is green-by-omission,
// which J-001's own words forbid, and the settled arbitration on s-auth-breaker.spec.ts:40 fixes
// this as the tagging every S-Auth breaker spec owes.
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newestMail } from "../support/outbox";

/** The identity lane as a caller reaches it (src/app/api/trpc/[trpc]/route.ts). */
const LANE = "/api/trpc/spine.auth.";

/** One run's own addresses, so a re-run never meets the accounts the last one made. */
const RUN = `${Date.now().toString(36)}`;

/**
 * An address past `WRITABLE_EMAIL_MAX_OCTETS` (2000), which `src/server/auth/session.ts`'s
 * `storedAddress` does not store as presented: it stores `digest of <sha-256 hex>` instead. A person
 * can paste one into `[data-testid=s-auth-email]` — the browser validates the *shape* of an address
 * and Design Decision I-13 forbids the screen inventing a length rule — so this is a value the
 * shipped form can send.
 */
const LONG_ADDRESS = `${"a".repeat(2000)}${RUN}@cubit.test`;

/**
 * The same account's address as the table carries it — and, being an unkeyed SHA-256 over a value
 * the presenter chose, a string anybody can compute (`src/server/auth/secrets.ts`'s `digestOf`).
 *
 * `src/server/auth/rate-limit.ts:76-81` states the invariant this file tests, and its `keyed()` keeps
 * it by tagging *both* spaces (`as presented …` / `digest of …`) so "a presented value is only ever
 * equal to itself". `storedAddress` tags only the folded side, so the presented space and the folded
 * space meet on exactly this string.
 */
const FOLDED_ADDRESS = `digest of ${createHash("sha256").update(LONG_ADDRESS, "utf8").digest("hex")}`;

const LONG_ADDRESS_PASSWORD = "the-long-address-owner-9";

/** A plain address for the mailed-link half, which needs nothing unusual about the address at all. */
const MAILED_LINK_ADDRESS = `proto-breaker-${RUN}@cubit.test`;

/** The scheme this deployment actually answers on — the journeys' own server (playwright.config.ts). */
function servedScheme(baseURL: string | undefined): string {
  return new URL(baseURL ?? "http://127.0.0.1").protocol;
}

test.describe("J-001 S-AUTH-BREAKER — the address that names an account, and the address a link points at", () => {
  test("S-AUTH-BREAKER: two different addresses are never one account", async ({ request }) => {
    const signedUp = await request.post(`${LANE}signUp`, {
      data: { email: LONG_ADDRESS, password: LONG_ADDRESS_PASSWORD, tenantName: `Long Address Works ${RUN}` },
    });
    // R-SPINE-002 and Design Decision I-14: the creating door judges nothing about what the string
    // says, so a long address makes an account like any other. This is the state under test, not the
    // thing under test.
    expect(signedUp.ok(), "the creating door takes the address as presented (R-SPINE-002, I-14)").toBe(true);
    expect(((await signedUp.json()) as { result?: { data?: { sessionToken?: string } } }).result?.data?.sessionToken).toEqual(expect.any(String));

    // R-SPINE-001's identifying door matches "a presented address and password against the account it
    // names". This address names no account: nobody signed up with it. It must therefore not open the
    // account somebody else's address made, whatever the seam stores either of them under.
    const impostor = await request.post(`${LANE}signIn`, { data: { email: FOLDED_ADDRESS, password: LONG_ADDRESS_PASSWORD } });
    const answer = (await impostor.json()) as { result?: { data?: { sessionToken?: string } }; error?: { data?: { refusalCode?: string } } };

    expect(
      answer.result?.data?.sessionToken,
      `signing in as "${FOLDED_ADDRESS}" — an address no account was made with — handed out a session for the account "${LONG_ADDRESS.slice(0, 12)}…" made (R-SPINE-001)`,
    ).toBeUndefined();
    expect(answer.error?.data?.refusalCode, "an address that names no account is CREDENTIALS_NOT_VALID (R-SPINE-062)").toBe("CREDENTIALS_NOT_VALID");
  });

  test("S-AUTH-BREAKER: a caller's own header does not decide where a mailed link points", async ({ baseURL, request }) => {
    const signedUp = await request.post(`${LANE}signUp`, {
      data: { email: MAILED_LINK_ADDRESS, password: "reset-me-please-7", tenantName: `Proto Works ${RUN}` },
    });
    expect(signedUp.ok(), "the account the reset link is asked for exists").toBe(true);

    // R-SPINE-001 legislates against a key a caller can rotate ("never client-influencable headers
    // alone"), and src/server/context.ts applies that to a mailed link in as many words: the origin
    // is "the address it was configured with, or the request's when the request came from loopback —
    // never a `Host` the caller wrote". `X-Forwarded-Proto` is the same class of value: written by
    // whoever sent the request unless a proxy the deployment trusts overwrote it. Next builds the
    // Request's url from it, so it reaches `originOf` unguarded, and the link a victim is mailed is
    // then addressed at a scheme an attacker chose — on a plain-http deployment, a link nobody can
    // follow, while the door answers `{ sent: true }`.
    const asked = await request.post(`${LANE}requestPasswordReset`, {
      data: { email: MAILED_LINK_ADDRESS },
      headers: { "x-forwarded-proto": "https" },
    });
    expect(asked.ok(), "the mailing door answers the same way whatever a caller writes in a header").toBe(true);

    const mail = await newestMail(MAILED_LINK_ADDRESS, "password-reset");
    expect(
      new URL(mail.url).protocol,
      `the reset link was mailed as ${new URL(mail.url).protocol}// because the caller wrote x-forwarded-proto: https — the deployment answers on ${servedScheme(baseURL)}// (R-SPINE-001)`,
    ).toBe(servedScheme(baseURL));
  });
});
