/**
 * Public acceptance for inc-120 — AC-3: the five static headers have exactly one home, and it is
 * `next.config.ts`'s `headers()`.
 *
 * The config is imported and its `headers()` is called — the same call Next makes when it builds
 * its header rules. No source is read.
 */
import { describe, expect, test } from "vitest";
import { CSP_HEADER, NEXT_CONFIG_MODULE, loadNextConfig } from "./support/csp";
import type { HeaderPair, HeaderRule } from "./support/csp";

/** The path every answer of the product is served from (test contract). */
const SOURCE = "/:path*";

/**
 * AC-3's own enumeration: the five headers and the exact value each carries. Header names are
 * case-insensitive on the wire, so they are matched case-insensitively here; the values are not,
 * and are compared exactly.
 */
const STATIC_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"],
  ["X-Content-Type-Options", "nosniff"],
];

/** The one rule `headers()` resolves to, with the assertions that make it one. */
async function theRule(): Promise<HeaderRule> {
  const config = await loadNextConfig();
  expect(typeof config.headers, `${NEXT_CONFIG_MODULE}'s default export must have a \`headers()\` — the one home of the static headers`).toBe("function");
  const resolving = (config.headers as () => unknown)();
  expect(typeof (resolving as { then?: unknown } | null)?.then, `${NEXT_CONFIG_MODULE}: \`headers()\` is async — Next awaits it`).toBe("function");
  const rules = await (resolving as Promise<unknown>);
  expect(Array.isArray(rules), `${NEXT_CONFIG_MODULE}: \`headers()\` must resolve to an array of header rules`).toBe(true);
  const list = rules as HeaderRule[];
  expect(list.length, `${NEXT_CONFIG_MODULE}: \`headers()\` states exactly one rule — every answer of the product, once`).toBe(1);
  return list[0] as HeaderRule;
}

/** The rule's pairs, keyed by the lower-cased header name, asserted to be stated once each. */
function pairsOf(rule: HeaderRule): Map<string, string> {
  expect(Array.isArray(rule.headers), `${NEXT_CONFIG_MODULE}: the rule's \`headers\` must be an array of { key, value } pairs`).toBe(true);
  const pairs = new Map<string, string>();
  for (const pair of rule.headers as HeaderPair[]) {
    expect(pair.key, `${NEXT_CONFIG_MODULE}: every header pair states a \`key\``).toBeTypeOf("string");
    expect(pair.value, `${NEXT_CONFIG_MODULE}: every header pair states a \`value\``).toBeTypeOf("string");
    const key = String(pair.key).toLowerCase();
    expect(pairs.has(key), `${NEXT_CONFIG_MODULE}: ${String(pair.key)} is stated twice`).toBe(false);
    pairs.set(key, String(pair.value));
  }
  return pairs;
}

describe("AC-3: the five static headers, on every path, from one home", () => {
  test(`AC-3: \`headers()\` states one rule for ${SOURCE}`, async () => {
    const rule = await theRule();
    expect(rule.source, `${NEXT_CONFIG_MODULE}: the rule's source must be ${SOURCE} — the headers reach every answer`).toBe(SOURCE);
  });

  test("AC-3: the rule carries exactly the five static headers, each with its exact value", async () => {
    const pairs = pairsOf(await theRule());
    for (const [name, value] of STATIC_HEADERS) {
      const stated = pairs.get(name.toLowerCase());
      expect(stated, `${NEXT_CONFIG_MODULE}: the rule must carry ${name}`).toBeTypeOf("string");
      expect(stated, `${NEXT_CONFIG_MODULE}: ${name} must be exactly \`${value}\``).toBe(value);
    }
    expect([...pairs.keys()].sort(), `${NEXT_CONFIG_MODULE}: the rule carries the five static headers and nothing else`).toEqual(STATIC_HEADERS.map(([name]) => name.toLowerCase()).sort());
  });

  test(`AC-3: ${CSP_HEADER} is not among them — its one home is the proxy`, async () => {
    const pairs = pairsOf(await theRule());
    expect(pairs.has(CSP_HEADER.toLowerCase()), `${NEXT_CONFIG_MODULE}: a per-request nonce cannot be minted in a static rule — ${CSP_HEADER} belongs to the proxy`).toBe(false);
  });
});
