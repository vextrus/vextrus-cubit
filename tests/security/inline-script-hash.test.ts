/**
 * Public acceptance for inc-120 — AC-4: the one product-authored inline script is admitted by its
 * own digest, and the document that carries it renders per request while staying synchronous.
 *
 * The digest is computed here from the value the product exports, never transcribed: if the resolver
 * text moves, this test and the policy move together or the policy is wrong.
 */
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { CSP_HEADER, LAYOUT_MODULE, POLICY_ROUTES, STAGE_ORIGIN, THEME_RESOLVER_MODULE, assertAcceptedPolicy, headerOf, loadLayout, loadThemeResolver, shippedProxy } from "./support/csp";

/** The Next segment config that makes every route render per request (AC-4). */
const DYNAMIC = "force-dynamic";

/** A React element, seen through the only surface these assertions need. */
function isElement(value: unknown): boolean {
  return typeof value === "object" && value !== null && "type" in value && "props" in value;
}

/** The resolver source the product ships, asserted to be a non-empty string. */
async function themeResolver(): Promise<string> {
  const module = await loadThemeResolver();
  expect(module.THEME_RESOLVER, `${THEME_RESOLVER_MODULE} must export THEME_RESOLVER — the inline script's one home`).toBeTypeOf("string");
  const source = String(module.THEME_RESOLVER);
  expect(source.trim().length, "THEME_RESOLVER must not be empty, or the digest below would hold vacuously").toBeGreaterThan(0);
  return source;
}

describe("AC-4: the inline resolver is admitted by hash, and the document renders per request", () => {
  test("AC-4: the policy's 'sha256-…' source is the digest of the exported THEME_RESOLVER itself", async () => {
    const digest = createHash("sha256").update(await themeResolver(), "utf8").digest("base64");
    const proxy = await shippedProxy();
    for (const route of POLICY_ROUTES) {
      const policy = headerOf(proxy(new NextRequest(new URL(route, STAGE_ORIGIN))), CSP_HEADER, route);
      const { hashSource } = assertAcceptedPolicy(policy, route);
      expect(hashSource, `${route}: script-src must admit the pre-paint resolver by the digest of the value ${THEME_RESOLVER_MODULE} exports — never a transcribed one`).toBe(`'sha256-${digest}'`);
    }
  });

  test(`AC-4: the root layout exports dynamic === "${DYNAMIC}" and RootLayout stays synchronous`, async () => {
    const layout = await loadLayout();
    expect(layout.dynamic, `${LAYOUT_MODULE} must export \`dynamic\` — a prerendered document cannot carry a fresh nonce`).toBe(DYNAMIC);
    expect(typeof layout.default, `${LAYOUT_MODULE} must default-export RootLayout`).toBe("function");
    const rendered = (layout.default as (props: { children: unknown }) => unknown)({ children: null });
    expect(rendered, "RootLayout must not become async: the segment config is what makes the document dynamic, not a headers() read").not.toBeInstanceOf(Promise);
    expect(isElement(rendered), "RootLayout must return an element").toBe(true);
  });
});
