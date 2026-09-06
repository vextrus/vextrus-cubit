/**
 * Public acceptance for inc-120 — AC-1 (the policy every answer carries) and AC-2 (the nonce is per
 * response and reaches the renderer).
 *
 * The proxy is driven exactly as Next drives it: a `NextRequest` in, a response out, and every
 * assertion is made against the headers of what came back. Nothing reads the module's source.
 */
import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import {
  CSP_HEADER,
  CSP_REPORT_ONLY_HEADER,
  FORWARDED_CSP_HEADER,
  MIDDLEWARE_MODULE,
  POLICY_ROUTES,
  PROXY_MODULE,
  STAGE_ORIGIN,
  assertAcceptedPolicy,
  checkoutHolds,
  headerOf,
  loadProxy,
  matcherPatterns,
  matcherRuns,
  shippedPolicyBuilder,
  shippedProxy,
} from "./support/csp";

/** One answer of the shipped proxy for a path on the stage's origin. */
async function answerFor(path: string): Promise<{ policy: string; forwarded: string | null; reportOnly: string | null }> {
  const proxy = await shippedProxy();
  const response = proxy(new NextRequest(new URL(path, STAGE_ORIGIN)));
  expect(response, `${PROXY_MODULE}: proxy(${path}) must return a response`).toBeTruthy();
  expect(typeof response.headers?.get, `${PROXY_MODULE}: proxy(${path}) must return a NextResponse — its headers are what Next sends`).toBe("function");
  return {
    policy: headerOf(response, CSP_HEADER, path),
    forwarded: response.headers.get(FORWARDED_CSP_HEADER),
    reportOnly: response.headers.get(CSP_REPORT_ONLY_HEADER),
  };
}

describe("AC-1: every answer carries the nonce-based policy", () => {
  for (const route of POLICY_ROUTES) {
    test(`AC-1: the policy minted for ${route} states each directive with exactly the sources the criterion names`, async () => {
      const answer = await answerFor(route);
      assertAcceptedPolicy(answer.policy, route);
      expect(answer.reportOnly, `${route}: no ${CSP_REPORT_ONLY_HEADER} is set — the policy is enforced, never shadowed`).toBeNull();
    });
  }

  test("AC-1: the policy on the answer is the one `contentSecurityPolicy(nonce)` builds for that answer's nonce", async () => {
    const contentSecurityPolicy = await shippedPolicyBuilder();
    for (const route of POLICY_ROUTES) {
      const { policy } = await answerFor(route);
      const { nonce } = assertAcceptedPolicy(policy, route);
      expect(contentSecurityPolicy(nonce), `${route}: the answer's policy must be what the exported builder makes of the answer's own nonce — one home for the policy`).toBe(policy);
    }
  });
});

describe("AC-2: the nonce is per response and reaches the renderer", () => {
  test("AC-2: two answers for one URL carry different nonces, each of at least 16 bytes", async () => {
    const first = await answerFor("/sign-in");
    const second = await answerFor("/sign-in");
    const one = assertAcceptedPolicy(first.policy, "/sign-in (first call)");
    const other = assertAcceptedPolicy(second.policy, "/sign-in (second call)");

    for (const [nonce, which] of [
      [one.nonce, "first"],
      [other.nonce, "second"],
    ] as const) {
      expect(Buffer.from(nonce, "base64").length, `the ${which} nonce decodes to fewer than 16 bytes — a nonce is 16 random bytes`).toBeGreaterThanOrEqual(16);
    }
    expect(one.nonce, "two answers for the same URL must never share a nonce — it is minted per request").not.toBe(other.nonce);
    expect(one.hashSource, "the inline resolver's hash is a property of the source, so it does not move between answers").toBe(other.hashSource);
  });

  test("AC-2: the identical policy is forwarded on the request, so the renderer stamps Next's own scripts", async () => {
    for (const route of POLICY_ROUTES) {
      const answer = await answerFor(route);
      expect(answer.forwarded, `${route}: the policy must be set on the cloned REQUEST headers — Next reads the nonce from the request at render time (${FORWARDED_CSP_HEADER})`).toBeTypeOf("string");
      expect(answer.forwarded, `${route}: the forwarded policy and the answered policy are one value`).toBe(answer.policy);
    }
  });

  test("AC-2: `config.matcher` excludes only the /_next/static and /_next/image prefixes, and no src/middleware.ts stands beside the proxy", async () => {
    const module = await loadProxy();
    expect(module.config, `${PROXY_MODULE} must export \`config\` — Next reads the matcher from it`).toBeTypeOf("object");
    const patterns = matcherPatterns((module.config as { matcher?: unknown }).matcher, PROXY_MODULE);
    expect(patterns.length, `${PROXY_MODULE}: \`config.matcher\` must state at least one pattern`).toBeGreaterThan(0);

    for (const path of [...POLICY_ROUTES, "/definitely-not-a-route", "/favicon.ico"]) {
      expect(matcherRuns(patterns, path, PROXY_MODULE), `the proxy must run for ${path} — every answer carries the policy (matcher: ${patterns.join(" | ")})`).toBe(true);
    }
    for (const path of ["/_next/static", "/_next/static/chunks/main.js", "/_next/image"]) {
      expect(matcherRuns(patterns, path, PROXY_MODULE), `the proxy must not run for ${path} — the two static prefixes are the only exclusions (matcher: ${patterns.join(" | ")})`).toBe(false);
    }

    expect(checkoutHolds(MIDDLEWARE_MODULE), `${MIDDLEWARE_MODULE} must not exist — ${PROXY_MODULE} is the one home for the per-request policy (Next 16's convention)`).toBe(false);
  });
});
